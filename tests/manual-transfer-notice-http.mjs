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
const admin=make('admin'),learner=make('student'),stranger=make('student');
const course=uid(),booking=uid();
run('INSERT INTO courses(id,title,description,subject,level,price,duration_minutes,capacity,teacher_id,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
course,'Science lesson','Isolated manual booking test','علوم','الابتدائي',100,60,25,admin.id,'published',now());
run('INSERT INTO bookings(id,course_id,student_id,status,created_at) VALUES(?,?,?,?,?)',booking,course,learner.id,'pending',now());
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
 const pupil=await login(learner),other=await login(stranger),director=await login(admin);
 const url='/api/bookings/'+booking+'/payment-notice';
 assert.equal((await request(url,{method:'POST',body:{sender_phone:'01012345678'}})).status,401,'anon cannot notify');
 assert.equal((await request(url,{method:'POST',cookie:other,body:{sender_phone:'01012345678'}})).status,403,'other student cannot modify booking');
 assert.equal((await request(url,{method:'POST',cookie:pupil,body:{sender_phone:'invalid'}})).status,400,'invalid callback phone denied');
 const posted=await request(url,{method:'POST',cookie:pupil,body:{sender_phone:'01012345678'}});
 assert.equal(posted.status,201,'valid phone-only notice queued');
 assert.equal(posted.data.status,'pending','notification cannot approve itself');
 assert.equal((await request(url,{method:'POST',cookie:pupil,body:{sender_phone:'01012345678'}})).status,409,'duplicate pending notice blocked');
 const pay=(await request('/api/admin/payments',{cookie:director}));
 assert.equal(pay.status,200);
 const row=pay.data.payments.find(p=>p.booking_id===booking);
 assert.equal(row?.status,'pending');
 assert.equal(row?.proof_key,'manual:notice','no image needed and no storage API is touched');
 assert.ok(row?.transfer_reference.startsWith('NOTICE-'));
 const missingRef=await request('/api/admin/payments/'+row.id+'/review',{method:'POST',cookie:director,body:{decision:'approved',confirmedOnPhone:true}});
 assert.equal(missingRef.status,400,'admin cannot approve a phone notice without actual transfer reference');
 const studentDashboard=(await request('/api/my/overview',{cookie:pupil}));
 assert.equal(studentDashboard.status,200);
 assert.ok(!studentDashboard.data.bookings?.some(b=>b.id===booking&&b.status==='approved'),'no auto-unlock');
 const reject=await request('/api/admin/payments/'+row.id+'/review',{method:'POST',cookie:director,body:{decision:'rejected',reason:'لم يصل التحويل للمحفظة'}});
 assert.equal(reject.status,200,'director can reject');
 assert.equal((await request('/api/admin/payments/'+row.id+'/review',{method:'POST',cookie:director,body:{decision:'approved',confirmedOnPhone:true,transfer_reference:'TXN123456'}})).status,409,'reviewed payment cannot be approved later');
 console.log('PASS adult-only manual notice, phone validation, duplicate protection, no auto access, unique approval reference, director rejection');
}finally{
 srv.kill();
 await Promise.race([new Promise(resolve=>srv.once('exit',resolve)),wait(4000)]);
 rmSync(dir,{recursive:true,force:true});
}
