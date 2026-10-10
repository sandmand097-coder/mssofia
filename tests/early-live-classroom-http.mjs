// Fully isolated student / instructor test: no production users or media.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import bcrypt from 'bcryptjs';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sofia-early-live-'));
process.env.MADRASATI_DB_PATH=path.join(temp,'sqlite.sqlite');
const {db,run,uid,now}=await import('../server/db.js');
const password=randomBytes(16).toString('hex'),hash=bcrypt.hashSync(password,10);
const newUser=role=>{
 const id=uid(),email=role+'-'+id+'@test.invalid';
 run('INSERT INTO users(id,name,email,password_hash,role,status,created_at,email_verified_at) VALUES(?,?,?,?,?,?,?,?)',
  id,role+' test',email,hash,role,'active',now(),now());
 return{id,email,role};
};
const teacher=newUser('teacher'),admin=newUser('admin'),student=newUser('student'),unpaid=newUser('student'),stranger=newUser('student');
const course=uid(),lesson=uid(),room=uid();
run('INSERT INTO courses(id,title,description,subject,level,price,duration_minutes,capacity,teacher_id,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
 course,'Synthetic verified science','isolated entitlement test','science','grade 5',100,80,40,teacher.id,'published',now());
run('INSERT INTO lessons(id,course_id,title,starts_at,duration_minutes,status,room_key,created_at) VALUES(?,?,?,?,?,?,?,?)',
 lesson,course,'Teacher is broadcasting early',new Date(Date.now()+45*60000).toISOString(),80,'scheduled',room,now());
const paidBooking=uid();
run('INSERT INTO bookings(id,student_id,course_id,status,created_at) VALUES(?,?,?,?,?)',paidBooking,student.id,course,'approved',now());
run('INSERT INTO bookings(id,student_id,course_id,status,created_at) VALUES(?,?,?,?,?)',uid(),unpaid.id,course,'approved',now());
run('INSERT INTO payment_submissions(id,booking_id,student_id,course_id,amount_egp,transfer_reference,proof_key,status,submitted_at,reviewed_at,confirmed_on_phone) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
 uid(),paidBooking,student.id,course,100,'VERIFIED-TEST-PAYMENT','test/receipt/not-a-real-file','approved',now(),now(),1);
db.close();
let published=true;
const fake=http.createServer(async(req,res)=>{
 if(req.url!=='/twirp/livekit.RoomService/ListParticipants'){res.writeHead(404);res.end('{}');return}
 const body=[];for await(const x of req)body.push(x);
 const data=JSON.parse(Buffer.concat(body).toString()||'{}');
 const ok=data.room===room;
 const participants=ok?[{identity:teacher.id,tracks:published?[{source:2,muted:false}]:[]}]:[];
 res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({participants}));
});
const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',()=>r(s.address().port)));
const fakePort=await listen(fake);
const port=await new Promise((resolve,reject)=>{
 const s=net.createServer().once('error',reject);
 s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>resolve(n))});
});
const app=spawn(process.execPath,['server/index.js'],{
 cwd:root,windowsHide:true,
 env:{...process.env,NODE_ENV:'test',PORT:String(port),
  JWT_SECRET:randomBytes(54).toString('hex'),
  LIVEKIT_URL:'ws://127.0.0.1:'+fakePort,
  LIVEKIT_API_KEY:'FAKE_SERVER_ONLY',LIVEKIT_API_SECRET:randomBytes(38).toString('hex')}
});
let stderr='';
app.stderr.on('data',data=>stderr+=(String(data).slice(0,1800)));
const base='http://127.0.0.1:'+port+'/api';
const call=async(path,method='GET',body,cookie)=>{
 const res=await fetch(base+path,{
  method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},
  body:body?JSON.stringify(body):undefined
 });
 return{status:res.status,data:await res.json().catch(()=>({})),cookie:res.headers.get('set-cookie')?.split(';')[0]};
};
let count=0;const ok=(condition,label)=>{assert.ok(condition,label);count++;console.log('PASS '+label)};
async function login(user){
 const response=await call('/auth/login','POST',{email:user.email,password});
 ok(response.status===200&&response.cookie,'isolated '+user.role+' login');
 return response.cookie;
}
try{
 let ready=false;
 for(let i=0;i<85;i++){
  if(app.exitCode!==null)throw Error('server exited '+stderr);
  try{if((await call('/health')).status===200){ready=true;break}}catch{}
  await new Promise(r=>setTimeout(r,100));
 }
 ok(ready,'private HTTP fixture started');
 const signed={
  teacher:await login(teacher),admin:await login(admin),student:await login(student),
  unpaid:await login(unpaid),stranger:await login(stranger)
 };
 const path='/lessons/'+lesson;
 const view=await call(path,'GET',null,signed.student);
 ok(view.status===200&&view.data.studentEarlyLive===true,'enrolled paying student sees active early broadcast before 15-minute window');
 ok(!('room_key' in view.data.lesson),'LiveKit room key is not revealed to student before token issuance');
 const entry=await call(path+'/token','POST',{},signed.student);
 ok(entry.status===200&&!!entry.data.token&&entry.data.canPublish===false,'verified paid student obtains read-only LiveKit token early');
 ok((await call(path,'GET',null,signed.unpaid)).status===403,'unpaid booking cannot see early classroom');
 ok((await call(path+'/token','POST',{},signed.unpaid)).status===403,'approved booking without verified transfer cannot get early token');
 ok((await call(path,'GET',null,signed.stranger)).status===403,'stranger not enrolled cannot discover early classroom');
 ok((await call(path+'/token','POST',{},signed.stranger)).status===403,'stranger cannot request paid room token');
 ok((await call(path+'/token','POST',{},signed.teacher)).status===200,'teacher can prepare classroom earlier than its schedule');
 ok((await call(path+'/token','POST',{},signed.admin)).status===200,'school director can broadcast on legacy teacher room');
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 published=false;
 await wait(5200);
 const stopped=await call(path,'GET',null,signed.student);
 ok(stopped.status===200&&stopped.data.studentEarlyLive===false,'after teacher stops publishing, early waiting room closes');
 ok((await call(path+'/token','POST',{},signed.student)).status===403,'paid student cannot join early with inactive teacher');
 console.log('RESULT '+count+' early-live HTTP checks passed (all fake accounts/LiveKit)');
}finally{
 app.kill();
 await Promise.race([new Promise(resolve=>app.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2000))]);
 await new Promise(resolve=>fake.close(resolve));
 fs.rmSync(temp,{recursive:true,force:true,maxRetries:6,retryDelay:100});
}
