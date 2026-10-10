// Synthetic authorization + token surge. Never touches production, paid
// subscriptions, real children, LiveKit Cloud minutes, or video streams.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import jwt from 'jsonwebtoken';
import {joinWithBackoff} from '../src/components/live-resilience.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'miss-sofia-surge-'));
const dbPath=path.join(dir,'isolated.sqlite');
process.env.MADRASATI_DB_PATH=dbPath;
const {db,uid,run,now}=await import('../server/db.js');
const count=60,secret=randomBytes(56).toString('hex');
const add=role=>{
 const id=uid();
 run('INSERT INTO users(id,name,email,password_hash,role,status,created_at,email_verified_at) VALUES(?,?,?,?,?,?,?,?)',
  id,'Synthetic '+role,role+id.slice(0,10)+'@test.invalid','NOT_A_REAL_PASSWORD',role,'active',now(),now());
 return{id,role};
};
const admin=add('admin'),teacher=add('teacher');
const students=Array.from({length:count},()=>add('student'));
const course=uid(),lesson=uid();
run('INSERT INTO courses(id,title,description,subject,level,price,duration_minutes,capacity,teacher_id,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
 course,'Synthetic science load','Load test only','Science','Test',0,90,100,teacher.id,'published',now());
run('INSERT INTO lessons(id,course_id,title,starts_at,duration_minutes,status,room_key,created_at) VALUES(?,?,?,?,?,?,?,?)',
 lesson,course,'Synthetic test lesson',new Date(Date.now()+60000).toISOString(),90,'scheduled',uid(),now());
for(const user of students){
 run('INSERT INTO bookings(id,course_id,student_id,status,created_at) VALUES(?,?,?,?,?)',
  uid(),course,user.id,'approved',now());
}
db.close();
const port=await new Promise((resolve,reject)=>{
 const socket=net.createServer().once('error',reject);
 socket.listen(0,'127.0.0.1',()=>{
  const number=socket.address().port;socket.close(()=>resolve(number));
 });
});
const base='http://127.0.0.1:'+port+'/api';
const server=spawn(process.execPath,['server/index.js'],{
 cwd:root,windowsHide:true,
 env:{...process.env,NODE_ENV:'development',PUBLIC_LAUNCH_MODE:'full',PORT:String(port),
  DATABASE_URL:'',JWT_SECRET:secret,APP_ORIGIN:'http://127.0.0.1:'+port,
  LIVEKIT_URL:'wss://fake-livekit.test.invalid',LIVEKIT_API_KEY:'TEST_ONLY',
  LIVEKIT_API_SECRET:randomBytes(40).toString('hex'),
  LIVE_JOIN_STUDENT_INFLIGHT:'8',LIVE_JOIN_TOTAL_INFLIGHT:'12'}
});
let logs='';server.stderr.on('data',x=>logs+=String(x).slice(0,1000));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const cookie=user=>'session='+jwt.sign({sub:user.id,role:user.role,version:0},secret,{algorithm:'HS256',expiresIn:'10m'});
const request=async(user,endpoint,method='GET')=>{
 const response=await fetch(base+endpoint,{method,headers:{Cookie:cookie(user)}});
 const data=await response.json().catch(()=>({}));
 return{status:response.status,data,retryAfterSeconds:Number(response.headers.get('Retry-After')||data.retryAfterSeconds||0)};
};
try{
 let ready=false;
 for(let i=0;i<75;i++){
  if(server.exitCode!==null)throw Error('Fixture server failed '+logs.slice(0,2000));
  try{if((await fetch(base+'/health')).ok){ready=true;break}}catch{}
  await pause(100);
 }
 assert.ok(ready,'isolated API server should start');
 const begin=Date.now(),durations=[];
 const actors=[...students,teacher];
 const results=await Promise.all(actors.map(async user=>{
  const start=Date.now();
  const response=await joinWithBackoff(async()=>{
   const value=await request(user,'/lessons/'+lesson+'/token','POST');
   if(value.status!==200){
    const issue=new Error(value.data.error||'synthetic test request rejected');
    issue.status=value.status;
    issue.retryAfterSeconds=value.retryAfterSeconds;
    throw issue;
   }
   return value;
  },{maxAttempts:4,random:()=>Math.random(),sleep:(ms)=>pause(ms)});
  durations.push(Date.now()-start);
  const body=jwt.decode(response.data.token);
  assert.equal(body.video.roomJoin,true);
  assert.equal(body.video.room,body.video.room);
  if(user.role==='student'){
   assert.equal(body.video.canPublish,false);
   assert.equal(JSON.parse(body.metadata).mrsSofiaRole,'viewer');
  }
  return response.status;
 }));
 assert.equal(results.length,count+1);
 assert.ok(results.every(status=>status===200));
 const sorted=durations.sort((a,b)=>a-b),p95=sorted[Math.ceil(sorted.length*.95)-1];
 const state=await request(admin,'/admin/live/admission');
 assert.equal(state.status,200,'admin sees scoped backpressure counters');
 assert.ok(state.data.admission.accepted>=count+1);
 assert.equal(state.data.admission.active,0,'server released all in-flight tokens');
 assert.equal((await request(students[0],'/admin/live/admission')).status,403,'student cannot inspect ops metrics');
 const unauth=await fetch(base+'/lessons/'+lesson+'/token',{method:'POST'});
 assert.equal(unauth.status,401,'anonymous token issuance blocked');
 console.log('PASS '+count+' synthetic students + 1 teacher received authorization checked tokens');
 console.log('PASS director private admission counters and no leaked viewer privileges');
 console.log('INFO SURGE_HTTP_MS='+String(Date.now()-begin)+' P95_MS='+p95+' THROTTLED='+state.data.admission.throttled);
 console.log('NOTE This is not a media or real-account performance guarantee.');
}finally{
 server.kill();
 await Promise.race([new Promise(resolve=>server.once('exit',resolve)),pause(2500)]);
 fs.rmSync(dir,{recursive:true,force:true,maxRetries:7,retryDelay:100});
}
