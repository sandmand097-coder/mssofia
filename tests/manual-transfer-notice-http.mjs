// Isolated black-box regression for the phone-only manual transfer queue.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import bcrypt from 'bcryptjs';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=mkdtempSync(path.join(tmpdir(),'mssofia-phone-notice-'));
process.env.MADRASATI_DB_PATH=path.join(dir,'isolated.sqlite');
const {db,run,get,uid,now}=await import('../server/db.js');
const pwd='test-password-'+randomBytes(12).toString('hex');
const hash=bcrypt.hashSync(pwd,10);
const make=(role)=>{const id=uid(),email=role+'-'+id+'@test.invalid';run('INSERT INTO users(id,name,email,password_hash,role,status,created_at) VALUES(?,?,?,?,?,?,?)',id,role,email,hash,role,'active',now());return{id,email}};
const admin=make('admin'),learner=make('student'),secondLearner=make('student'),stranger=make('student');
const course=uid(),booking=uid(),secondBooking=uid(),legacyBooking=uid(),legacySubmission=uid();
run('INSERT INTO courses(id,title,description,subject,level,price,duration_minutes,capacity,teacher_id,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
course,'Science lesson','Isolated manual booking test','علوم','الابتدائي',100,60,25,admin.id,'published',now());
run('INSERT INTO bookings(id,course_id,student_id,status,created_at) VALUES(?,?,?,?,?)',booking,course,learner.id,'pending',now());
run('INSERT INTO bookings(id,course_id,student_id,status,created_at) VALUES(?,?,?,?,?)',secondBooking,course,secondLearner.id,'pending',now());
run('INSERT INTO bookings(id,course_id,student_id,status,created_at) VALUES(?,?,?,?,?)',legacyBooking,course,stranger.id,'pending',now());
// A pre-existing row uses the legacy constant marker. New notices must coexist.
run('INSERT INTO payment_submissions(id,booking_id,student_id,course_id,amount_egp,transfer_reference,sender_phone,sender_last4,proof_key,status,submitted_at,confirmed_on_phone) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
 legacySubmission,legacyBooking,stranger.id,course,100,'NOTICE-'+uid(),'01098765432','5432','manual:notice','pending',now(),0);
db.close();
const port=await new Promise((res,rej)=>{const n=net.createServer();n.once('error',rej);n.listen(0,'127.0.0.1',()=>{const p=n.address().port;n.close(()=>res(p))})});
const base='http://127.0.0.1:'+port;
const srv=spawn(process.execPath,['server/index.js'],{cwd:root,windowsHide:true,env:{...process.env,NODE_ENV:'test',PUBLIC_LAUNCH_MODE:'',PORT:String(port),DATABASE_URL:'',JWT_SECRET:randomBytes(50).toString('hex'),APP_ORIGIN:base,GOOGLE_ADMIN_LOGIN_ENABLED:'false',LIVEKIT_URL:'',LIVEKIT_API_KEY:'',LIVEKIT_API_SECRET:'',SCHOOL_ADMIN_EMAIL:''}});
let log='';srv.stderr.on('data',x=>log+=String(x));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const request=async(endpoint,{cookie,method='GET',body}={})=>{
 const r=await fetch(base+endpoint,{method,headers:{...(cookie?{'Cookie':cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 return{status:r.status,data:await r.json().catch(()=>({})),cookie:r.headers.get('set-cookie')?.split(';')[0]};
};
try{
 let ready=false;
 for(let i=0;i<90;i++){
  if(srv.exitCode!==null)throw Error('isolated API quit '+log.slice(-450));
  try{if((await request('/api/health')).status===200){ready=true;break}}catch{}
  await wait(100);
 }
 assert.ok(ready,'local isolated API started');
 const login=async u=>{
  const r=await request('/api/auth/login',{method:'POST',body:{email:u.email,password:pwd}});
  assert.equal(r.status,200,'isolated '+u.email+' login');
  return r.cookie;
 };
 const pupil=await login(learner),pupil2=await login(secondLearner),other=await login(stranger),director=await login(admin);
 const url='/api/bookings/'+booking+'/payment-notice';
 assert.equal((await request(url,{method:'POST',body:{sender_phone:'01012345678'}})).status,401,'anon cannot notify');
 assert.equal((await request(url,{method:'POST',cookie:other,body:{sender_phone:'01012345678'}})).status,403,'other student cannot modify booking');
 assert.equal((await request(url,{method:'POST',cookie:pupil,body:{sender_phone:'invalid'}})).status,400,'invalid callback phone denied');
 const posted=await request(url,{method:'POST',cookie:pupil,body:{sender_phone:'01012345678'}});
 assert.equal(posted.status,201,'valid phone-only notice queued');
 assert.equal(posted.data.status,'pending','notification cannot approve itself');
 const postedSecond=await request('/api/bookings/'+secondBooking+'/payment-notice',{method:'POST',cookie:pupil2,body:{sender_phone:'01123456789'}});
 assert.equal(postedSecond.status,201,'a second student must be able to file an independent notice');
 assert.equal(postedSecond.data.status,'pending','second notification remains unverified');
 assert.equal((await request(url,{method:'POST',cookie:pupil,body:{sender_phone:'01012345678'}})).status,409,'duplicate pending notice blocked');
 const pay=(await request('/api/admin/payments',{cookie:director}));
 assert.equal(pay.status,200);
 const row=pay.data.payments.find(p=>p.booking_id===booking);
 const row2=pay.data.payments.find(p=>p.booking_id===secondBooking);
 const legacy=pay.data.payments.find(p=>p.booking_id===legacyBooking);
 assert.equal(row?.status,'pending');
 assert.ok(row&&row2&&legacy,'all three notices are visible to the director');
 assert.equal(row.proof_key,'manual:notice:'+row.id,'first notice has a unique virtual proof marker');
 assert.equal(row2.proof_key,'manual:notice:'+row2.id,'second notice has a unique virtual proof marker');
 assert.notEqual(row.proof_key,row2.proof_key,'independent notices must not share a unique key');
 assert.equal(legacy.proof_key,'manual:notice','the old notice remains intact and readable');
 assert.equal((await request('/api/admin/payments/'+row2.id+'/proof',{cookie:director})).status,404,'a phone-only notice cannot expose a fabricated receipt');
 assert.equal((await request('/api/admin/payments/'+legacy.id+'/proof',{cookie:director})).status,404,'legacy phone-only notices still have no receipt');
 assert.ok(row?.transfer_reference.startsWith('NOTICE-'));
 const missingRef=await request('/api/admin/payments/'+row.id+'/review',{method:'POST',cookie:director,body:{decision:'approved',confirmedOnPhone:true}});
 assert.equal(missingRef.status,400,'admin cannot approve a phone notice without actual transfer reference');
 assert.equal((await request('/api/admin/payments/'+legacy.id+'/review',{method:'POST',cookie:director,body:{decision:'approved',confirmedOnPhone:true}})).status,400,'legacy notices still require a real transfer reference');
 const studentDashboard=(await request('/api/my/overview',{cookie:pupil}));
 assert.equal(studentDashboard.status,200);
 assert.ok(!studentDashboard.data.bookings?.some(b=>b.id===booking&&b.status==='approved'),'no auto-unlock');
 const approvedSecond=await request('/api/admin/payments/'+row2.id+'/review',{method:'POST',cookie:director,body:{decision:'approved',confirmedOnPhone:true,transfer_reference:'TXN234567'}});
 assert.equal(approvedSecond.status,200,'a verified unique notice can be approved without touching other students');
 const otherDashboard=await request('/api/my/overview',{cookie:pupil2});
 assert.ok(otherDashboard.data.bookings?.some(b=>b.id===secondBooking&&b.status==='approved'),'only the independently verified second booking activates');
 const reject=await request('/api/admin/payments/'+row.id+'/review',{method:'POST',cookie:director,body:{decision:'rejected',reason:'لم يصل التحويل للمحفظة'}});
 assert.equal(reject.status,200,'director can reject');
 assert.equal((await request('/api/admin/payments/'+row.id+'/review',{method:'POST',cookie:director,body:{decision:'approved',confirmedOnPhone:true,transfer_reference:'TXN123456'}})).status,409,'reviewed payment cannot be approved later');
 console.log('PASS independent student notices, unique markers, legacy compatibility, protected receipts, no auto access and verified-only approval');
}finally{
 srv.kill();
 await Promise.race([new Promise(resolve=>srv.once('exit',resolve)),wait(4000)]);
 rmSync(dir,{recursive:true,force:true});
}
