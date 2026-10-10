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
let published=false,connected=true;
const fake=http.createServer(async(req,res)=>{
 if(req.url!=='/twirp/livekit.RoomService/ListParticipants'){res.writeHead(404);res.end('{}');return}
 const body=[];for await(const x of req)body.push(x);
 const data=JSON.parse(Buffer.concat(body).toString()||'{}');
 const ok=data.room===room;
 const participants=ok&&connected?[{identity:teacher.id,tracks:published?[{source:2,muted:false}]:[]}]:[];
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
 const lobby=await call(path,'GET',null,signed.student);
 ok(lobby.status===200&&lobby.data.studentRoomOpen===true,'enrolled paying child sees private lobby as soon as instructor opens studio');
 ok(lobby.data.hostConnected===true&&lobby.data.hostPublishing===false,'camera/mic may remain OFF in private waiting lobby');
 ok(!('room_key' in lobby.data.lesson),'LiveKit room key never exposed in pre-stream lobby response');
 const earlyToken=await call(path+'/token','POST',{},signed.student);
 ok(earlyToken.status===200&&earlyToken.data.canPublish===false,'paid subscriber may request read-only entry after instructor joins studio');
 ok((await call(path,'GET',null,signed.unpaid)).status===403,'unpaid booking cannot read private lobby');
 ok((await call(path+'/token','POST',{},signed.unpaid)).status===403,'unverified payment cannot obtain LiveKit token');
 ok((await call(path,'GET',null,signed.stranger)).status===403,'stranger cannot discover private lesson');
 ok((await call(path+'/token','POST',{},signed.stranger)).status===403,'stranger cannot join authorized lobby');
 ok((await call(path+'/token','POST',{},signed.teacher)).status===200,'teacher can rehearse without published media');
 ok((await call(path+'/token','POST',{},signed.admin)).status===200,'admin can control older teacher room');
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 published=true;
 await wait(5400);
 const broadcasting=await call(path,'GET',null,signed.student);
 ok(broadcasting.status===200&&broadcasting.data.hostPublishing===true,'client can automatically start WebRTC media when instructor begins teaching');
 published=false;
 await wait(5400);
 const paused=await call(path,'GET',null,signed.student);
 ok(paused.status===200&&paused.data.hostConnected===true&&paused.data.hostPublishing===false,'stopping camera keeps waiting room available to subscribed child');
 ok((await call(path+'/token','POST',{},signed.student)).status===200,'subscribed student can remain authorized after media pauses');
 connected=false;
 await wait(5400);
 const left=await call(path,'GET',null,signed.student);
 ok(left.status===200&&left.data.studentRoomOpen===false,'early lobby closes when teacher leaves LiveKit studio');
 ok((await call(path+'/token','POST',{},signed.student)).status===403,'paid child cannot join early without connected teacher');
 console.log('RESULT '+count+' early-live HTTP checks passed (all fake accounts/LiveKit)');
}finally{
 app.kill();
 await Promise.race([new Promise(resolve=>app.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2000))]);
 await new Promise(resolve=>fake.close(resolve));
 fs.rmSync(temp,{recursive:true,force:true,maxRetries:6,retryDelay:100});
}
