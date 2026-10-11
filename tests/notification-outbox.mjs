// Isolated SQLite integration. No network, real phone, production DB or
// registered Meta/WhatsApp account is used by this test.
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const dir=mkdtempSync(path.join(tmpdir(),'mssofia-outbox-'));
process.env.MADRASATI_DB_PATH=path.join(dir,'testing.sqlite');
delete process.env.DATABASE_URL;
process.env.MONTHLY_RENEWALS_ENABLED='false';
const db=await import('../server/db-adapter.js');
const {enqueueApprovedBooking,enqueueUpcomingReminders,processNotificationTick}=await import('../server/notifications/outbox.js');
const {WhatsAppDeliveryError}=await import('../server/notifications/whatsapp-provider.js');
const now=new Date('2026-10-11T10:00:00.000Z'),ts=now.toISOString();
const env={WHATSAPP_ENABLED:'true',WHATSAPP_GRAPH_VERSION:'v25.0',WHATSAPP_PHONE_NUMBER_ID:'123456789012',
 WHATSAPP_ACCESS_TOKEN:'LOCAL_TEST_TOKEN_'.repeat(4),WHATSAPP_BOOKING_TEMPLATE:'sofia_booking_ar',
 WHATSAPP_REMINDER_TEMPLATE:'sofia_reminder_ar',SCHOOL_PUBLIC_URL:'https://mssofia.pages.dev'};
try{
 for(const [id,role] of [['teacher','teacher'],['student','student']]){
  await db.run('INSERT INTO users(id,name,email,password_hash,role,status,specialty,created_at) VALUES(?,?,?,?,?,?,?,?)',
   id,id,id+'@example.invalid','NEVER_VALID_LOCAL_HASH',role,'active','',ts);
 }
 await db.run('INSERT INTO courses(id,title,description,subject,level,price,teacher_id,created_at) VALUES(?,?,?,?,?,?,?,?)',
 'course','علوم اختبار','وصف','علوم','الأول',100,'teacher',ts);
 await db.run('INSERT INTO bookings(id,course_id,student_id,status,created_at) VALUES(?,?,?,?,?)','booking','course','student','pending',ts);
 await db.run('INSERT INTO payment_submissions(id,booking_id,student_id,course_id,amount_egp,transfer_reference,proof_key,status,submitted_at) VALUES(?,?,?,?,?,?,?,?,?)',
 'payment','booking','student','course',100,'LOCAL-PAYMENT-UNIQUE-1','test-only-proof','pending',ts);
 let pending=await db.withTransaction(async tx=>enqueueApprovedBooking(tx,'booking',{env,clock:now}));
 assert.equal(pending,false,'never queue before verified approval');
 await db.run('INSERT INTO notification_contacts(student_id,phone_e164,whatsapp_opt_in_at,whatsapp_verified_at,consent_source) VALUES(?,?,?,?,?)',
  'student','+201000000000',ts,ts,'test-only verified guardian consent');
 pending=await db.withTransaction(async tx=>enqueueApprovedBooking(tx,'booking',{env,clock:now}));
 assert.equal(pending,false,'opt-in alone is not an approved payment');
 await db.withTransaction(async tx=>{
  await tx.run("UPDATE payment_submissions SET status='approved',confirmed_on_phone=1,reviewed_at=? WHERE id=?",ts,'payment');
  await tx.run("UPDATE bookings SET status='approved',reviewed_at=? WHERE id=?",ts,'booking');
  assert.equal(await enqueueApprovedBooking(tx,'booking',{env,clock:now}),true);
 });
 assert.equal(await db.withTransaction(tx=>enqueueApprovedBooking(tx,'booking',{env,clock:now})),false,'no duplicate approval messages');
 const starts=new Date(now.getTime()+14*60000).toISOString();
 await db.run('INSERT INTO lessons(id,course_id,title,starts_at,duration_minutes,status,room_key,created_at) VALUES(?,?,?,?,?,?,?,?)',
  'lesson','course','تجربة علمية',starts,60,'scheduled','room-local-only',ts);
 assert.equal(await enqueueUpcomingReminders({db,clock:now,env}),1);
 assert.equal(await enqueueUpcomingReminders({db,clock:now,env}),0,'reminder idempotency');
 let calls=[];
 const sender=async input=>{calls.push(input);return{providerId:'wamid.LOCAL_TEST_0001'}};
 const result=await processNotificationTick({db,env,clock:()=>now,sender,limit:8,cloud:false});
 assert.equal(result.sent,2,'verified booking + 15-min lesson reminder both sent to stub only');
 assert.deepEqual(calls.map(c=>c.type).sort(),['booking_approved','lesson_reminder']);
 assert.ok(calls.every(c=>c.phone==='+201000000000'));
 assert.equal((await db.all("SELECT * FROM notification_outbox WHERE status='sent'")).length,2);
 assert.equal((await db.all("SELECT * FROM notification_outbox WHERE status='pending'")).length,0);
 const second=await processNotificationTick({db,env,clock:()=>now,sender,cloud:false});
 assert.equal(second.sent,0,'repeated worker tick never duplicates a completed job');

 // Revocation is respected AT SEND TIME even if a job was queued earlier.
 await db.run('INSERT INTO lessons(id,course_id,title,starts_at,duration_minutes,status,room_key,created_at) VALUES(?,?,?,?,?,?,?,?)',
 'lesson2','course','درس جديد',starts,60,'scheduled','room-local-2',ts);
 assert.equal(await enqueueUpcomingReminders({db,clock:now,env}),1);
 await db.run('UPDATE notification_contacts SET revoked_at=? WHERE student_id=?',ts,'student');
 const suppressed=await processNotificationTick({db,env,clock:()=>now,sender,cloud:false});
 assert.equal(suppressed.skipped,1);
 assert.equal(calls.length,2);
 assert.equal((await db.all("SELECT * FROM notification_outbox WHERE status='skipped'")).length,1);

 // Provider backpressure persists for a later retry; API decisions do not await it.
 await db.run('UPDATE notification_contacts SET revoked_at=NULL WHERE student_id=?','student');
 await db.run('INSERT INTO lessons(id,course_id,title,starts_at,duration_minutes,status,room_key,created_at) VALUES(?,?,?,?,?,?,?,?)',
 'lesson3','course','درس ثالث',starts,60,'scheduled','room-local-3',ts);
 assert.equal(await enqueueUpcomingReminders({db,clock:now,env}),1);
 const delayed=await processNotificationTick({db,env,clock:()=>now,
  sender:async()=>{throw new WhatsAppDeliveryError('PROVIDER_HTTP_429',true)},cloud:false});
 assert.equal(delayed.retry,1);
 const retryRow=await db.get("SELECT status,attempts,next_attempt_at FROM notification_outbox WHERE lesson_id='lesson3'");
 assert.equal(retryRow.status,'pending');
 assert.equal(retryRow.attempts,1);
 assert.ok(Date.parse(retryRow.next_attempt_at)>now.getTime());
 assert.equal((await processNotificationTick({db,env,clock:()=>now,sender,cloud:false})).sent,0,'not retried before backoff');
 const lateClock=()=>new Date(now.getTime()+3*60000);
 assert.equal((await processNotificationTick({db,env,clock:lateClock,sender,cloud:false})).sent,1);
 assert.equal((await db.get("SELECT status FROM notification_outbox WHERE lesson_id='lesson3'")).status,'sent');

 // A timetable change invalidates the old reminder and generates exactly one
 // new event for the updated start; no stale lesson links/time are sent.
 await db.run('INSERT INTO lessons(id,course_id,title,starts_at,duration_minutes,status,room_key,created_at) VALUES(?,?,?,?,?,?,?,?)',
  'lesson4','course','حصة تم تعديل موعدها',starts,60,'scheduled','room-local-4',ts);
 assert.equal(await enqueueUpcomingReminders({db,clock:now,env}),1);
 const rescheduled=new Date(now.getTime()+15*60000).toISOString();
 await db.run('UPDATE lessons SET starts_at=? WHERE id=?',rescheduled,'lesson4');
 assert.equal(await enqueueUpcomingReminders({db,clock:now,env}),1);
 const changed=await processNotificationTick({db,env,clock:lateClock,sender,cloud:false});
 assert.equal(changed.skipped,1,'obsolete lesson reminder suppressed');
 assert.equal(changed.sent,1,'current rescheduled time reminder delivered');
 assert.equal((await processNotificationTick({db,env:{...env,WHATSAPP_ENABLED:'false'},clock:()=>now,sender})).enabled,false);
 console.log('PASS transactional WhatsApp outbox, guardian consent, paid approval, 15-min reminder, revocation and retry');
}finally{
 await db.closeConnection?.();
 rmSync(dir,{recursive:true,force:true});
}
