import assert from 'node:assert/strict';
import fs from 'node:fs';
import {get,run} from './server/db.js';
const env=Object.fromEntries(fs.readFileSync(new URL('./.env',import.meta.url),'utf8').split(/\r?\n/).filter(Boolean).map(s=>s.split(/=(.*)/s).slice(0,2)));
const jar={};
async function call(path,method='GET',body,who){
 const res=await fetch('http://127.0.0.1:4010/api'+path,{method,headers:{'Content-Type':'application/json',...(jar[who]?{Cookie:jar[who]}:{})},body:body?JSON.stringify(body):undefined});
 const cookie=res.headers.get('set-cookie');if(who&&cookie?.startsWith('session='))jar[who]=cookie.split(';')[0];
 return {status:res.status,data:await res.json()};
}
async function login(who,email,pass){const r=await call('/auth/login','POST',{email,password:pass},who);assert.equal(r.status,200)}
const email='qa-'+Date.now()+'@example.test';
let userId;
try{
 await login('teacher',env.DEMO_TEACHER_EMAIL,env.DEMO_TEACHER_PASSWORD);
 await login('admin',env.ADMIN_EMAIL,env.ADMIN_PASSWORD);
 const reg=await call('/auth/register','POST',{name:'طالب تجريبي',email,password:'TestPassword12345!'});
 assert.equal(reg.status,201);
 userId=get('SELECT id FROM users WHERE email=?',email).id;
 await login('student',email,'TestPassword12345!');
 const {data:{courses}}=await call('/courses');
 const {data:{lessons}}=await call('/courses/'+courses[0].id);
 const before=await call('/lessons/'+lessons[0].id,'GET',null,'student');assert.equal(before.status,403);
 const booked=await call('/courses/'+courses[0].id+'/book','POST',{},'student');assert.equal(booked.status,201);
 const stillDenied=await call('/lessons/'+lessons[0].id,'GET',null,'student');assert.equal(stillDenied.status,403);
 const booking=get('SELECT id FROM bookings WHERE student_id=? AND course_id=?',userId,courses[0].id);
 const approved=await call('/bookings/'+booking.id,'PATCH',{status:'approved'},'teacher');assert.equal(approved.status,200);
 const after=await call('/lessons/'+lessons[0].id,'GET',null,'student');assert.equal(after.status,200);
 console.log('PASS: register > book > pending denied > teacher approves > private classroom allowed');
}finally{if(userId){run('DELETE FROM attendance WHERE user_id=?',userId);run('DELETE FROM bookings WHERE student_id=?',userId);run('DELETE FROM users WHERE id=?',userId)}}
