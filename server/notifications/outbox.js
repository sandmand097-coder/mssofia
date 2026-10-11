// Durable, consent-gated WhatsApp outbox. The outbox is written in the SAME
// database transaction as verified payment approval, never after a fragile
// network call. Sending happens separately from user-facing HTTP responses.
// Deliveries are AT-LEAST-ONCE: an ambiguous provider timeout may cause a retry.
import {randomUUID} from 'node:crypto';
import {all,get,run,withTransaction,isCloudDatabase} from '../db-adapter.js';
import {evaluateMonthlyAccess,renewalEndSelect} from '../monthly-access.js';
import {configuredWhatsApp,verifiedPhone,sendWhatsAppTemplate,WhatsAppDeliveryError} from './whatsapp-provider.js';

const iso=value=>new Date(value).toISOString();
const TIME_LIMIT=4*60*1000;
const cleanError=error=>error instanceof WhatsAppDeliveryError?error.code:'DELIVERY_UNEXPECTED';
export function notificationsEnabled(env=process.env){return configuredWhatsApp(env)}
async function insertOutbox(tx,{type,studentId,bookingId,lessonId=null,eventKey,scheduledAt,clock=new Date()}){
 const when=iso(scheduledAt),now=iso(clock);
 return tx.run(`INSERT OR IGNORE INTO notification_outbox
 (id,event_key,type,student_id,booking_id,lesson_id,scheduled_at,status,attempts,
 next_attempt_at,locked_until,created_at)
 VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
 randomUUID(),eventKey,type,studentId,bookingId,lessonId,when,'pending',0,when,null,now);
}
export async function enqueueApprovedBooking(tx,bookingId,{env=process.env,clock=new Date()}={}){
 if(!notificationsEnabled(env))return false;
 const record=await tx.get(`SELECT b.id,b.student_id,b.status,c.price,
  p.status AS payment_status,p.confirmed_on_phone,
  nc.student_id AS consent_student
  FROM bookings b JOIN courses c ON c.id=b.course_id
  LEFT JOIN payment_submissions p ON p.booking_id=b.id
  JOIN notification_contacts nc ON nc.student_id=b.student_id
  WHERE b.id=? AND nc.revoked_at IS NULL AND nc.whatsapp_opt_in_at IS NOT NULL
   AND nc.whatsapp_verified_at IS NOT NULL`,bookingId);
 if(!record||record.status!=='approved')return false;
 const confirmed=record.confirmed_on_phone===true||record.confirmed_on_phone===1;
 if(Number(record.price)>0&&!(record.payment_status==='approved'&&confirmed))return false;
 const changed=await insertOutbox(tx,{
  type:'booking_approved',studentId:record.student_id,bookingId,
  eventKey:'booking-approved:'+bookingId,scheduledAt:clock,clock
 });
 return Boolean(changed.changes);
}
export async function enqueueUpcomingReminders({db={all,run},clock=new Date(),env=process.env}={}){
 if(!notificationsEnabled(env))return 0;
 const now=clock.getTime(),early=iso(now+2*60000),latest=iso(now+15*60000);
 const candidates=await db.all(`SELECT l.id AS lesson_id,l.starts_at,
 b.id AS booking_id,b.student_id
 FROM lessons l JOIN bookings b ON b.course_id=l.course_id
 JOIN users u ON u.id=b.student_id
 JOIN notification_contacts nc ON nc.student_id=b.student_id
 WHERE l.status='scheduled' AND b.status='approved' AND u.status='active'
 AND nc.revoked_at IS NULL AND nc.whatsapp_verified_at IS NOT NULL
 AND nc.whatsapp_opt_in_at IS NOT NULL
 AND l.starts_at>? AND l.starts_at<=?
 ORDER BY l.starts_at LIMIT 500`,early,latest);
 let inserted=0;
 for(const row of candidates){
  const at=Date.parse(row.starts_at)-15*60000;
  const result=await insertOutbox(db,{
   type:'lesson_reminder',studentId:row.student_id,
   bookingId:row.booking_id,lessonId:row.lesson_id,
   eventKey:'lesson-reminder:'+row.lesson_id+':'+row.student_id+':'+iso(row.starts_at),
   scheduledAt:new Date(at),clock
  });
  inserted+=Number(result.changes||0);
 }
 return inserted;
}
async function claimNext({db={withTransaction},clock=new Date(),cloud=isCloudDatabase}={}){
 const now=iso(clock),until=iso(clock.getTime()+TIME_LIMIT);
 return db.withTransaction(async tx=>{
  const row=await tx.get(`SELECT * FROM notification_outbox
   WHERE (status='pending' AND next_attempt_at<=?)
    OR (status='processing' AND locked_until<=?)
   ORDER BY next_attempt_at,id LIMIT 1`+(cloud?' FOR UPDATE SKIP LOCKED':''),now,now);
  if(!row)return null;
  const updated=await tx.run(`UPDATE notification_outbox
    SET status='processing',attempts=attempts+1,locked_until=?
    WHERE id=? AND status IN ('pending','processing')`,until,row.id);
  if(!updated.changes)return null;
  return {...row,attempts:Number(row.attempts)+1,locked_until:until};
 });
}
async function readRecipient(job,{db={get},clock=new Date()}={}){
 const record=await db.get(`SELECT u.name AS student_name,u.status AS user_status,
 b.status AS booking_status,c.title AS course_title,c.price AS course_price,
 p.status AS payment_status,p.confirmed_on_phone,p.reviewed_at AS payment_reviewed_at,
 nc.phone_e164,nc.revoked_at,nc.whatsapp_verified_at,nc.whatsapp_opt_in_at,
 ${renewalEndSelect('b')}
 FROM bookings b JOIN users u ON u.id=b.student_id
 JOIN courses c ON c.id=b.course_id
 JOIN notification_contacts nc ON nc.student_id=b.student_id
 LEFT JOIN payment_submissions p ON p.booking_id=b.id
 WHERE b.id=? AND b.student_id=?`,job.booking_id,job.student_id);
 if(!record||record.user_status!=='active'||!verifiedPhone(record.phone_e164)
  ||record.revoked_at||!record.whatsapp_verified_at||!record.whatsapp_opt_in_at
  ||!evaluateMonthlyAccess(record,clock.getTime()).active)return null;
 let lessonTitle,lessonDate;
 if(job.type==='lesson_reminder'){
  const lesson=await db.get("SELECT title,starts_at,status,course_id FROM lessons WHERE id=?",job.lesson_id);
  const when=Date.parse(lesson?.starts_at||'');
  if(!lesson||lesson.status!=='scheduled'||!Number.isFinite(when)
   ||iso(when-15*60000)!==iso(job.scheduled_at)
   ||when<=clock.getTime()+2*60000||when>clock.getTime()+16*60000)return null;
  lessonTitle=lesson.title;
  lessonDate=new Intl.DateTimeFormat('ar-EG',{
   dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Cairo'
  }).format(new Date(when));
 }
 return{
  type:job.type,phone:record.phone_e164,studentName:record.student_name,
  courseTitle:record.course_title,lessonTitle,lessonDate,
  lessonId:job.lesson_id,bookingId:job.booking_id
 };
}
async function completeJob(job,{db={run},status,providerId=null,reason=null,clock=new Date()}){
 const next=iso(clock.getTime()+Math.min(60,2**Math.min(job.attempts,6))*60000);
 const retry= status==='retry'&&job.attempts<5;
 const finalStatus=retry?'pending':status==='retry'?'dead':status;
 await db.run(`UPDATE notification_outbox
  SET status=?,locked_until=NULL,next_attempt_at=?,sent_at=?,
  provider_message_id=?,last_error=?
  WHERE id=? AND status='processing' AND locked_until=?`,
  finalStatus,next,finalStatus==='sent'?iso(clock):null,providerId,
  reason,job.id,job.locked_until);
}
export async function processNotificationTick({
 db={all,get,run,withTransaction},clock=()=>new Date(),
 env=process.env,sender=sendWhatsAppTemplate,cloud=isCloudDatabase,limit=30
}={}){
 if(!notificationsEnabled(env))return{enabled:false,queued:0,processed:0,sent:0,skipped:0,retry:0};
 const queued=await enqueueUpcomingReminders({db,clock:clock(),env});
 const result={enabled:true,queued,processed:0,sent:0,skipped:0,retry:0};
 const jobs=[],maxJobs=Math.min(30,Math.max(1,Math.trunc(Number(limit)||30)));
 // Claim with short transactions BEFORE performing any provider network I/O.
 // Ten parallel deliveries avoid serially delaying a 50-parent lesson reminder.
 for(let n=0;n<maxJobs;n++){
  const job=await claimNext({db,clock:clock(),cloud});
  if(!job)break;
  jobs.push(job);
 }
 result.processed=jobs.length;
 const sendJob=async job=>{
  try{
   const recipient=await readRecipient(job,{db,clock:clock()});
   if(!recipient){
    await completeJob(job,{db,status:'skipped',reason:'INELIGIBLE_OR_OPTED_OUT',clock:clock()});
    result.skipped++;return;
   }
   try{
    const delivery=await sender(recipient,{env});
    await completeJob(job,{db,status:'sent',providerId:delivery.providerId,clock:clock()});
    result.sent++;
   }catch(error){
    await completeJob(job,{db,status:error instanceof WhatsAppDeliveryError&&error.retryable?'retry':'dead',
     reason:cleanError(error),clock:clock()});
    result.retry++;
   }
  }catch{
   // A database outage must NOT trigger an unhandled promise rejection.
   // The locked job expires after 4 minutes and is safely re-claimed later.
   result.retry++;
  }
 };
 for(let index=0;index<jobs.length;index+=10)
  await Promise.all(jobs.slice(index,index+10).map(sendJob));
 return result;
}
