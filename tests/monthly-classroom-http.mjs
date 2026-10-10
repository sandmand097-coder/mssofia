// Isolated end-to-end API authorization: never touches the production database,
// real Google credentials, real student identities or LiveKit rooms.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import bcrypt from 'bcryptjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mrssofia-live-month-'));
process.env.MADRASATI_DB_PATH=path.join(tmp,'subscription.sqlite');
const {db,run,uid,now}=await import('../server/db.js');
const pw=randomBytes(20).toString('hex'),hash=bcrypt.hashSync(pw,10);
const makeUser=role=>{
 const id=uid(),email=role+'-'+id.slice(0,6)+'@test.invalid';
 run('INSERT INTO users(id,name,email,password_hash,role,status,created_at,email_verified_at) VALUES(?,?,?,?,?,?,?,?)',
  id,role+' dummy',email,hash,role,'active',now(),now());
 return{id,email};
};
const director=makeUser('admin'),active=makeUser('student'),expired=makeUser('student'),unpaid=makeUser('student'),free=makeUser('student');
const newCourse=(price)=>{
 const id=uid();run('INSERT INTO courses(id,title,description,subject,level,price,duration_minutes,capacity,teacher_id,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
 id,price?'اشتراك علوم':'تجربة مجانية','فصل مباشر تجريبي','علوم','الابتدائي',price,60,25,director.id,'published',now());
 const lesson=uid();run('INSERT INTO lessons(id,course_id,title,starts_at,duration_minutes,status,room_key,created_at) VALUES(?,?,?,?,?,?,?,?)',
 lesson,id,'حصة علوم',new Date(Date.now()+8*60000).toISOString(),60,'scheduled',uid(),now());
 return{id,lesson};
};
const paidCourse=newCourse(170),freeCourse=newCourse(0);
const makeBooking=(student,course,daysAgo)=>{
 const b=uid();run('INSERT INTO bookings(id,course_id,student_id,status,created_at,reviewed_at) VALUES(?,?,?,?,?,?)',
 b,course.id,student.id,'approved',now(),now());
 if(daysAgo!==null){
  const at=new Date(Date.now()-daysAgo*86400000).toISOString();
  run('INSERT INTO payment_submissions(id,booking_id,student_id,course_id,amount_egp,transfer_reference,sender_phone,proof_key,status,submitted_at,reviewed_at,reviewed_by,confirmed_on_phone) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
  uid(),b,student.id,course.id,100,'MOCK-'+uid(),null,uid(),'approved',at,at,director.id,1);
 }
};
makeBooking(active,paidCourse,6);makeBooking(expired,paidCourse,31);makeBooking(unpaid,paidCourse,null);makeBooking(free,freeCourse,null);
db.close();
const port=await new Promise((resolve,reject)=>{const s=net.createServer().once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})});
const base='http://127.0.0.1:'+port+'/api';
const server=spawn(process.execPath,['server/index.js'],{
 cwd:root,windowsHide:true,
 env:{...process.env,NODE_ENV:'development',PUBLIC_LAUNCH_MODE:'full',PORT:String(port),
  JWT_SECRET:randomBytes(48).toString('hex'),APP_ORIGIN:'http://127.0.0.1:'+port,
  LIVEKIT_URL:'wss://tests.livekit.cloud',LIVEKIT_API_KEY:'isolated-key',LIVEKIT_API_SECRET:randomBytes(32).toString('hex')}
});
let logs='';server.stdout.on('data',b=>logs+=String(b));server.stderr.on('data',b=>logs+=String(b));
const api=async(url,{method='GET',cookie,body}={})=>{
 const r=await fetch(base+url,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 let data={};try{data=await r.json()}catch{}
 return{status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0]};
};
const login=async user=>{
 const r=await api('/auth/login',{method:'POST',body:{email:user.email,password:pw}});
 assert.equal(r.status,200,'login '+user.email);return r.cookie;
};
let checks=0;
const expect=(actual,expected,why)=>{assert.equal(actual,expected,why);checks++};
try{
 let ready=false;
 for(let i=0;i<85;i++){
  if(server.exitCode!==null)throw Error('Isolated server failed: '+logs.slice(-1100));
  await new Promise(r=>setTimeout(r,105));
  try{if((await api('/health')).status===200){ready=true;break}}catch{}
 }
 assert.ok(ready,'isolated server ready');checks++;
 const cookies={director:await login(director),active:await login(active),expired:await login(expired),unpaid:await login(unpaid),free:await login(free)};
 expect((await api('/lessons/'+paidCourse.lesson,{cookie:cookies.active})).status,200,'paid active member sees lesson');
 expect((await api('/lessons/'+paidCourse.lesson+'/token',{method:'POST',cookie:cookies.active})).status,200,'paid active member receives signed LiveKit token');
 expect((await api('/lessons/'+paidCourse.lesson,{cookie:cookies.expired})).status,403,'expired paid member cannot even read private live lesson');
 expect((await api('/lessons/'+paidCourse.lesson+'/token',{method:'POST',cookie:cookies.expired})).status,403,'expired paid member gets no LiveKit token');
 expect((await api('/lessons/'+paidCourse.lesson+'/classroom',{cookie:cookies.expired})).status,403,'expired member cannot see class state');
 expect((await api('/lessons/'+paidCourse.lesson+'/hand',{method:'POST',cookie:cookies.expired,body:{raised:true}})).status,403,'expired member cannot raise a hand');
 expect((await api('/lessons/'+paidCourse.lesson+'/token',{method:'POST',cookie:cookies.unpaid})).status,403,'unpaid booking cannot enter paid stream');
 expect((await api('/lessons/'+freeCourse.lesson+'/token',{method:'POST',cookie:cookies.free})).status,200,'approved free course remains accessible');
 expect((await api('/lessons/'+paidCourse.lesson+'/token',{method:'POST',cookie:cookies.director})).status,200,'director still broadcasts to the course');
 const overview=(await api('/my/overview',{cookie:cookies.expired})).data;
 expect(overview.lessons.length,0,'expired membership removes lesson listing');
 expect(overview.courses.length,0,'expired membership removes course from active portfolio');
 const expiredBooking=overview.bookings.find(b=>b.course_id===paidCourse.id);
 expect(expiredBooking.live_access_status,'expired','account accurately describes expired 30-day period');
 const catalog=(await api('/courses/'+paidCourse.id)).data;
 expect(catalog.course.enrolled,1,'expired and unpaid bookings do not occupy active monthly seats');
 const publicCatalog=(await api('/courses')).data.courses.find(c=>c.id===paidCourse.id);
 expect(publicCatalog.enrolled,1,'public course capacity counts only active approved memberships');
 const paidOverview=(await api('/my/overview',{cookie:cookies.active})).data;
 expect(paidOverview.bookings[0].live_access_status,'monthly','paid member has valid current monthly period');
 expect(paidOverview.lessons.length,1,'active member sees live lesson');
 const expiredDashboard=(await api('/student/dashboard',{cookie:cookies.expired})).data;
 expect(expiredDashboard.learning.length,0,'expired membership not displayed as active learning');
 console.log('PASS '+checks+' real isolated HTTP monthly LiveKit access, expiry, free course and director tests');
}finally{
 server.kill();
 await Promise.race([new Promise(resolve=>server.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,1400))]);
 fs.rmSync(tmp,{recursive:true,force:true,maxRetries:3,retryDelay:120});
}
