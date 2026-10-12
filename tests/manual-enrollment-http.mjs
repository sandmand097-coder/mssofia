// Isolated SQLite / HTTP contract for parent callback -> director approval.
// No real Supabase, Render, students, mail delivery, wallets or LiveKit rooms.
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import bcrypt from 'bcryptjs';
import {validAdminReviewPath,safeAdminRedirect} from '../src/components/manual-review-redirect.js';

const tmp=mkdtempSync(path.join(tmpdir(),'mssofia-manual-'));
process.env.MADRASATI_DB_PATH=path.join(tmp,'local.sqlite');
const {db,run,get,uid,now}=await import('../server/db.js');
const secret=randomBytes(50).toString('hex');
const pwd='Parent-test-'+randomBytes(8).toString('hex'),passwordHash=bcrypt.hashSync(pwd,10);
const makeUser=role=>{
 const id=uid(),email=role+'-'+id+'@example.invalid';
 run('INSERT INTO users(id,name,email,password_hash,role,status,created_at,email_verified_at) VALUES(?,?,?,?,?,?,?,?)',
  id,role+' Test',email,passwordHash,role,'active',now(),now());
 return{id,email};
};
const admin=makeUser('admin'),student=makeUser('student'),other=makeUser('student'),teacher=makeUser('teacher');
const course=uid(),booking=uid(),otherBooking=uid();
run("INSERT INTO courses(id,title,description,subject,level,price,duration_minutes,capacity,teacher_id,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
 course,'Course manual test','Manual enrollment, no charge','علوم','الابتدائي',100,60,25,teacher.id,'published',now());
for(const [b,u] of [[booking,student],[otherBooking,other]])
 run('INSERT INTO bookings(id,course_id,student_id,status,created_at) VALUES(?,?,?,?,?)',b,course,u.id,'pending',now());
db.close();
const port=await new Promise((resolve,reject)=>{
 const s=net.createServer();s.once('error',reject);
 s.listen(0,'127.0.0.1',()=>{let n=s.address().port;s.close(()=>resolve(n))});
});
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=spawn(process.execPath,['server/index.js'],{
 cwd:root,windowsHide:true,
 env:{...process.env,PORT:String(port),JWT_SECRET:secret,NODE_ENV:'test',
 PUBLIC_LAUNCH_MODE:'',DATABASE_URL:'',APP_ORIGIN:'https://mssofia.pages.dev',
 SCHOOL_ADMIN_EMAIL:admin.email,MAIL_FROM:'',RESEND_API_KEY:'',SMTP_HOST:'',
 TEST_EMAIL_CAPTURE_DIR:tmp,MONTHLY_RENEWALS_ENABLED:'true',SCHOOL_REFUND_POLICY_APPROVED:'true',
 LIVEKIT_URL:'',LIVEKIT_API_KEY:'',LIVEKIT_API_SECRET:''}
});
let logs='';app.stdout.on('data',x=>logs+=x.toString());app.stderr.on('data',x=>logs+=x.toString());
const url='http://127.0.0.1:'+port+'/api';
const request=async(p,method='GET',body,cookie)=>{
 const r=await fetch(url+p,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},
  body:body?JSON.stringify(body):undefined});
 let data;try{data=await r.json()}catch{data={}};
 return{status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0]};
};
const login=async who=>{
 const r=await request('/auth/login','POST',{email:who.email,password:pwd});
 assert.equal(r.status,200,'test user login');
 assert.ok(r.cookie);return r.cookie;
};
const phone='01012345678';
try{
 let started=false;
 for(let i=0;i<100;i++){if(app.exitCode!==null)throw Error('backend did not start '+logs.slice(-700));try{if((await request('/health')).status===200){started=true;break}}catch{}await new Promise(done=>setTimeout(done,100))}
 assert.ok(started,'isolated Express test service starts');
 const parent=await login(student),stranger=await login(other),director=await login(admin);
 assert.equal((await request('/admin/manual-requests')).status,401,'unauthenticated cannot see parent phone list');
 assert.equal((await request('/admin/manual-requests','GET',null,parent)).status,403,'student cannot list contacts');
 assert.equal((await request('/bookings/'+booking+'/contact','POST',{phone,guardianConsent:true},stranger)).status,404,'other student cannot change guardian callback');
 assert.equal((await request('/bookings/'+booking+'/contact','POST',{phone,guardianConsent:false},parent)).status,400,'explicit guardian consent required');
 assert.equal((await request('/bookings/'+booking+'/contact','POST',{phone:'123',guardianConsent:true},parent)).status,400,'valid Egyptian callback number required');
 const saved=await request('/bookings/'+booking+'/contact','POST',{phone,guardianConsent:true},parent);
 assert.equal(saved.status,200,'guardian can leave phone after booking');
 assert.equal(saved.data.status,'pending');
 assert.equal(saved.data.emailNotified,true,'local test mailer delivers a notification to the isolated mailbox');
 const mailed=readdirSync(tmp).filter(n=>n.endsWith('manual-enrollment.txt'));
 assert.equal(mailed.length,1,'only one contact notification created');
 const body=readFileSync(path.join(tmp,mailed[0]),'utf8');
 assert.ok(body.includes(admin.email)&&body.includes('/admin?tab=manual&booking='+booking),'link leads to protected director review');
 assert.ok(!body.includes(phone),'student phone not disclosed in email body');
 assert.equal((await request('/bookings/'+booking+'/contact','POST',{phone,guardianConsent:true},parent)).status,429,'duplicate mail request is throttled');
 const pending=(await request('/my/overview','GET',undefined,parent)).data.bookings.find(b=>b.id===booking);
 assert.equal(pending.status,'pending','no auto activation after contact/email');
 assert.equal(pending.guardian_phone,phone);
 const records=await request('/admin/manual-requests','GET',null,director);
 assert.equal(records.status,200);
 assert.equal(records.data.requests.find(r=>r.booking_id===booking).amount_egp,100);
 assert.equal((await request('/admin/manual-requests/'+booking+'/decision','POST',{decision:'approved',confirmedOnPhone:true,sender_phone:phone},parent)).status,403,'student cannot approve payment');
 assert.equal((await request('/admin/manual-requests/'+booking+'/decision','POST',{decision:'approved',sender_phone:phone},director)).status,400,'owner must confirm money really received');
 assert.equal((await request('/admin/manual-requests/'+booking+'/decision','POST',{decision:'approved',sender_phone:'123',confirmedOnPhone:true},director)).status,400,'admin must supply verified sender');
 const approved=await request('/admin/manual-requests/'+booking+'/decision','POST',
  {decision:'approved',sender_phone:phone,confirmedOnPhone:true},director);
 assert.equal(approved.status,200,'only director explicitly activates membership');
 assert.equal(approved.data.status,'approved');
 assert.equal((await request('/admin/manual-requests/'+booking+'/decision','POST',
  {decision:'approved',sender_phone:phone,confirmedOnPhone:true},director)).status,409,'duplicate director approval blocked');
 const active=(await request('/my/overview','GET',null,parent)).data.bookings.find(b=>b.id===booking);
 assert.equal(active.status,'approved');
 assert.equal(active.payment_status,'approved');
 assert.equal(active.live_access_active,true,'access begins only after manual approval');
 // A rejected callback must not mark payment approved or permanently reject an
 // initially pending booking; guardian may try again after review.
 const rejected=await request('/admin/manual-requests/'+otherBooking+'/decision','POST',
  {decision:'rejected',reason:'لم يصل المبلغ المطلوب'},director);
 assert.equal(rejected.status,200);
 const after=(await request('/my/overview','GET',null,stranger)).data.bookings.find(b=>b.id===otherBooking);
 assert.equal(after.status,'pending');assert.equal(after.contact_status,'rejected');
 assert.ok(!after.payment_status,'a reject never fabricates payment settlement');
 assert.equal(validAdminReviewPath('/admin?tab=manual&booking='+booking),true);
 assert.equal(safeAdminRedirect('?next='+encodeURIComponent('/admin?tab=manual&booking='+booking),{role:'admin'}),'/admin?tab=manual&booking='+booking);
 assert.equal(safeAdminRedirect('?next='+encodeURIComponent('/admin?tab=manual&booking='+booking),{role:'student'}),null);
 for(const evil of ['https://example.com/','//evil.example','/admin?tab=manual&booking=invalid','/admin?tab=payments'])
  assert.equal(validAdminReviewPath(evil),false,'email deep links reject unapproved targets');
 console.log('PASS isolated guardian callback, no gateway/no auto activation, protected manual approval/rejection, audit, notification and safe admin deep link');
}finally{
 app.kill();
 await Promise.race([new Promise(r=>app.once('exit',r)),new Promise(r=>setTimeout(r,3500))]);
 rmSync(tmp,{recursive:true,force:true});
}
