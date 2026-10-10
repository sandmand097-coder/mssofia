// Isolated API tests: NO real transfers, Supabase writes or LiveKit media.
// Run with: node tests/secure-monthly-renewal-http.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mrssofia-renewal-qa-'));
const proofPath=path.join(tmp,'proofs');
process.env.MADRASATI_DB_PATH=path.join(tmp,'db.sqlite');
const {db,run,uid,now}=await import('../server/db.js');
const password=randomBytes(20).toString('hex'),hash=bcrypt.hashSync(password,10);
const user=role=>{
 const id=uid(),email=role+'-'+id.slice(0,8)+'@test.invalid';
 run('INSERT INTO users(id,name,email,password_hash,role,status,created_at,email_verified_at) VALUES(?,?,?,?,?,?,?,?)',
  id,role+' mock',email,hash,role,'active',now(),now());
 return{id,email};
};
const admin=user('admin'),student=user('student'),expired=user('student'),outsider=user('student');
const course=uid(),lesson=uid(),room=uid();
run(`INSERT INTO courses(id,title,description,subject,level,price,duration_minutes,capacity,teacher_id,status,created_at)
 VALUES(?,?,?,?,?,?,?,?,?,?,?)`,course,'علوم شهري','حصة بث داخل الموقع','علوم','الابتدائي',170,60,30,admin.id,'published',now());
run('INSERT INTO lessons(id,course_id,title,starts_at,duration_minutes,status,room_key,created_at) VALUES(?,?,?,?,?,?,?,?)',
 lesson,course,'درس علوم',new Date(Date.now()+8*60000).toISOString(),60,'scheduled',room,now());
for(const [person,ago] of [[student,27],[expired,31]]){
 const booking=uid(),paid=new Date(Date.now()-ago*86400000).toISOString();
 run('INSERT INTO bookings(id,course_id,student_id,status,created_at,reviewed_at) VALUES(?,?,?,?,?,?)',booking,course,person.id,'approved',now(),paid);
 run(`INSERT INTO payment_submissions(id,booking_id,student_id,course_id,amount_egp,transfer_reference,sender_phone,proof_key,status,submitted_at,reviewed_at,reviewed_by,confirmed_on_phone)
 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,uid(),booking,person.id,course,100,'MOCK-'+uid(),'01012345678',uid(),'approved',paid,paid,admin.id,1);
 person.booking=booking;
}
db.close();
const port=await new Promise((resolve,reject)=>{
 const server=net.createServer().once('error',reject);
 server.listen(0,'127.0.0.1',()=>{const p=server.address().port;server.close(()=>resolve(p))});
});
const base='http://127.0.0.1:'+port+'/api';
const child=spawn(process.execPath,['server/index.js'],{
 cwd:root,windowsHide:true,
 env:{...process.env,PORT:String(port),NODE_ENV:'development',PUBLIC_LAUNCH_MODE:'full',
  MONTHLY_RENEWALS_ENABLED:'true',CLASSROOM_QA_ENABLED:'true',TEST_PAYMENT_UPLOAD_DIR:proofPath,
  VODAFONE_CASH_NUMBER:'01012345678',JWT_SECRET:randomBytes(50).toString('hex'),
  LIVEKIT_URL:'wss://test.invalid',LIVEKIT_API_KEY:'test',
  LIVEKIT_API_SECRET:randomBytes(32).toString('hex'),APP_ORIGIN:'http://127.0.0.1:'+port}
});
let logs='';child.stdout.on('data',s=>logs+=s);child.stderr.on('data',s=>logs+=s);
const api=async(url,{method='GET',cookie,body,form}={})=>{
 const r=await fetch(base+url,{method,
  headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},
  body:body?JSON.stringify(body):form});
 const value=await r.json().catch(()=>({}));
 return {status:r.status,data:value,cookie:r.headers.get('set-cookie')?.split(';')[0]};
};
const login=async person=>{
 const result=await api('/auth/login',{method:'POST',body:{email:person.email,password}});
 assert.equal(result.status,200,'login '+person.email);return result.cookie;
};
const tiny=await sharp({create:{width:32,height:32,channels:3,background:'#e4f1f7'}}).png().toBuffer();
const upload=async(cookie,id)=>{
 const form=new FormData();
 form.set('sender_phone','01012345678');
 form.set('receipt',new Blob([tiny],{type:'image/png'}),'receipt.png');
 return api('/bookings/'+id+'/renewal',{method:'POST',cookie,form});
};
let checks=0;const eq=(got,want,reason)=>{assert.equal(got,want,reason);checks++};
try{
 let online=false;
 for(let i=0;i<90;i++){
  if(child.exitCode!==null)throw Error('Server exited: '+logs.slice(-2500));
  await new Promise(r=>setTimeout(r,120));
  try{if((await api('/health')).status===200){online=true;break}}catch{}
 }
 assert.ok(online,logs.slice(-2200));checks++;
 const cookies={admin:await login(admin),student:await login(student),expired:await login(expired),outsider:await login(outsider)};
 eq((await api('/student/renewals',{cookie:cookies.student})).data.enabled,true,'student sees enabled renewals');
 eq((await api('/admin/renewals',{cookie:cookies.student})).status,403,'no student sees admin renewal queue');
 eq((await api('/lessons/'+lesson+'/token',{method:'POST',cookie:cookies.expired})).status,403,'expired student initially denied');
 const unowned=await upload(cookies.outsider,student.booking);
 eq(unowned.status,404,'student cannot renew another child booking');
 const submitted=await upload(cookies.student,student.booking);
 eq(submitted.status,201,'near-expiring student submits a renewal');
 eq((await upload(cookies.student,student.booking)).status,409,'pending renewal cannot be duplicated');
 const queue=(await api('/admin/renewals',{cookie:cookies.admin})).data.renewals;
 eq(queue.length,1,'renewal listed for director');
 const renewalId=queue[0].id;
 eq(queue[0].amount_egp,170,'subsequent science month costs 170 EGP');
 eq((await api('/admin/renewals/'+renewalId+'/proof',{cookie:cookies.student})).status,403,'private receipt not visible to students');
 eq((await api('/admin/renewals/'+renewalId+'/proof',{cookie:cookies.admin})).status,200,'director can inspect private receipt');
 eq((await api('/admin/renewals/'+renewalId+'/review',{method:'POST',cookie:cookies.admin,body:{decision:'approved'}})).status,400,'photo alone cannot activate renewal');
 eq((await api('/admin/renewals/'+renewalId+'/review',{method:'POST',cookie:cookies.student,body:{decision:'approved',confirmedOnPhone:true}})).status,403,'student cannot self approve');
 const approved=await api('/admin/renewals/'+renewalId+'/review',{method:'POST',cookie:cookies.admin,body:{decision:'approved',confirmedOnPhone:true}});
 eq(approved.status,200,'director manually approves');
 const extension=Date.parse(approved.data.period_end)-Date.now();
 assert.ok(extension>31*86400000 && extension<34*86400000,'approved renewal extends from old expiration');
 checks++;
 eq((await api('/admin/renewals/'+renewalId+'/review',{method:'POST',cookie:cookies.admin,body:{decision:'approved',confirmedOnPhone:true}})).status,409,'same payment cannot be approved twice');
 const overview=(await api('/my/overview',{cookie:cookies.student})).data;
 assert.ok(overview.bookings[0].live_access_days_remaining>30,'new subscription period reflected on student dashboard');checks++;
 const expiredRequest=await upload(cookies.expired,expired.booking);
 eq(expiredRequest.status,201,'previously expired account may renew');
 const expiredRenewals=(await api('/admin/renewals',{cookie:cookies.admin})).data.renewals;
 const expiredId=expiredRenewals.find(r=>r.student_id===expired.id).id;
 eq((await api('/admin/renewals/'+expiredId+'/review',{method:'POST',cookie:cookies.admin,body:{decision:'approved',confirmedOnPhone:true}})).status,200,'expired renewal can restart from approval timestamp');
 eq((await api('/lessons/'+lesson+'/token',{method:'POST',cookie:cookies.expired})).status,200,'renewed student can enter live video');
 const q=await api('/lessons/'+lesson+'/questions',{method:'POST',cookie:cookies.student,body:{message:'ما الفرق بين الخلية النباتية والحيوانية؟'}});
 eq(q.status,201,'student can ask private lesson question');
 eq((await api('/lessons/'+lesson+'/questions',{cookie:cookies.outsider})).status,403,'nonmember cannot read class messages');
 const qa=(await api('/lessons/'+lesson+'/questions',{cookie:cookies.admin})).data.questions;
 eq(qa.length,1,'teacher sees the student question');
 eq((await api('/lessons/'+lesson+'/questions',{cookie:cookies.expired})).data.questions.length,0,'other student sees none of peers questions');
 eq((await api('/lessons/'+lesson+'/questions/'+q.data.id,{method:'PATCH',cookie:cookies.student,body:{answer:'غير مصرح'}})).status,403,'student cannot impersonate teacher in chat');
 eq((await api('/lessons/'+lesson+'/questions/'+q.data.id,{method:'PATCH',cookie:cookies.admin,body:{answer:'الخلية النباتية بها جدار خلوي وبلاستيدات.'}})).status,200,'teacher can respond privately');
 const own=(await api('/lessons/'+lesson+'/questions',{cookie:cookies.student})).data.questions;
 assert.match(own[0].answer,/جدار خلوي/);checks++;
 console.log('PASS '+checks+' isolated secure monthly renewals, receipt privacy, expiry and classroom questions');
}catch(error){console.error('QA failed:',error.message,'server logs:',logs.slice(-2000));process.exitCode=1}
finally{
 child.kill();await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(r,1500))]);
 fs.rmSync(tmp,{recursive:true,force:true,maxRetries:3,retryDelay:130});
}
