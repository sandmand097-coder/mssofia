import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import bcrypt from 'bcryptjs';
import {videoGrant,participantPermission,MAX_ACTIVE_SPEAKERS} from '../server/classroom.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sofia-room-test-'));
process.env.MADRASATI_DB_PATH=path.join(tmp,'classroom.sqlite');
const {run,uid,now,db}=await import('../server/db.js');
const password=crypto.randomBytes(24).toString('hex'),passwordHash=bcrypt.hashSync(password,10);
function user(role,name){const id=uid();run('INSERT INTO users(id,name,email,password_hash,role,status,created_at) VALUES(?,?,?,?,?,?,?)',id,name,role+id+'@test.local',passwordHash,role,'active',now());return{id,email:role+id+'@test.local'}}
const teacher=user('teacher','Class teacher'),admin=user('admin','Miss Sofia director'),student=user('student','Test child'),outsider=user('student','Another child'),teacherTwo=user('teacher','Other teacher');
const course=uid(),lesson=uid(),roomKey=uid();
run('INSERT INTO courses(id,title,description,subject,level,price,duration_minutes,capacity,teacher_id,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',course,'علوم مباشرة','حصة آمنة','علوم','الابتدائي',0,90,40,teacher.id,'published',now());
run('INSERT INTO lessons(id,course_id,title,starts_at,duration_minutes,status,room_key,created_at) VALUES(?,?,?,?,?,?,?,?)',lesson,course,'فصل تجريبي',new Date(Date.now()+60000).toISOString(),90,'scheduled',roomKey,now());
run('INSERT INTO bookings(id,course_id,student_id,status,created_at) VALUES(?,?,?,?,?)',uid(),course,student.id,'approved',now());
db.close();
const seen=[];
const online=new Set([teacher.id,student.id]);
const fake=http.createServer(async(req,res)=>{
 if(!req.url?.startsWith('/twirp/livekit.RoomService/')){res.writeHead(404);res.end('{}');return}
 const action=req.url.split('/').at(-1);
 const chunks=[];for await(const chunk of req)chunks.push(chunk);
 const payload=JSON.parse(Buffer.concat(chunks).toString()||'{}');
 seen.push({action,payload});
 let answer={};
 if(action==='UpdateParticipant'){if(!online.has(payload.identity)){res.writeHead(404,{'Content-Type':'application/json'});res.end(JSON.stringify({code:'not_found',msg:'not found'}));return}answer={identity:payload.identity,name:'Participant',permission:payload.permission||{}}}
 if(action==='ListParticipants')answer={participants:Array.from(online).map(identity=>({identity,name:'Participant'}))};
 if(action==='RemoveParticipant')online.delete(payload.identity);
 if(action==='DeleteRoom')online.clear();
 res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(answer));
});
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
const fakePort=await listen(fake);
const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})});
const app=spawn(process.execPath,['server/index.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:String(port),JWT_SECRET:crypto.randomBytes(48).toString('hex'),LIVEKIT_URL:'ws://127.0.0.1:'+fakePort,LIVEKIT_API_KEY:'testroomkey',LIVEKIT_API_SECRET:crypto.randomBytes(30).toString('hex')}});
let logs='';app.stdout.on('data',c=>logs+=c.toString());app.stderr.on('data',c=>logs+=c.toString());
const base='http://127.0.0.1:'+port+'/api';
async function request(endpoint,method='GET',body,cookie){const r=await fetch(base+endpoint,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{'Cookie':cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json().catch(()=>({})),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
let passed=0;function check(condition,reason){assert.ok(condition,reason);passed++;console.log('PASS '+reason)}
async function login(u){const r=await request('/auth/login','POST',{email:u.email,password});check(r.status===200&&!!r.cookie,'login '+u.email.split('@')[0].slice(0,9));return r.cookie}
const payload=t=>JSON.parse(Buffer.from(t.split('.')[1],'base64url').toString());
const decode=t=>payload(t).video;
try{
 let running=false;for(let i=0;i<80;i++){if(app.exitCode!==null)throw Error('test app exited '+logs);await new Promise(r=>setTimeout(r,100));try{if((await request('/health')).status===200){running=true;break}}catch{}}
 check(running,'moderation test server started');
 check(videoGrant('student').canPublish===false&&videoGrant('student').canPublishData===false,'student policy read-only by default');
 check(videoGrant('teacher').canPublish===true&&videoGrant('teacher').roomAdmin===true,'teacher policy publish and moderate');
 check(videoGrant('admin').canPublish===true&&videoGrant('admin').roomAdmin===true,'director can broadcast and manage every scheduled lesson');
 check(JSON.stringify(participantPermission('microphone').canPublishSources)==='[2]','approved speaker can publish microphone only');
 check(JSON.stringify(participantPermission('camera').canPublishSources)==='[2,1]','camera grant requires explicit teacher approval');
 check(MAX_ACTIVE_SPEAKERS===6,'simultaneous speaker limit configured');
 const a={teacher:await login(teacher),admin:await login(admin),student:await login(student),outsider:await login(outsider),other:await login(teacherTwo)};
 const change=(action,identity,cookie=a.teacher)=>request('/lessons/'+lesson+'/moderate','POST',{action,student_id:identity},cookie);
 check((await change('allow_audio',student.id,a.student)).status===403,'student moderation forbidden');
 check((await change('allow_audio',student.id,a.other)).status===403,'other teacher moderation forbidden');
 check((await change('allow_audio',outsider.id)).status===400,'cannot grant audio to unapproved child');
 check((await request('/lessons/'+lesson+'/token','POST',{},a.student)).status===200,'student can initially join');
 const directorResponse=await request('/lessons/'+lesson+'/token','POST',{},a.admin);
 check(directorResponse.status===200,'admin can enter a classroom owned by the teacher account and broadcast');
 const directorToken=payload(directorResponse.data.token);
 check(directorToken.video.canPublish===true&&directorToken.video.roomAdmin===true,'admin token contains host camera and moderator privileges');
 check(JSON.parse(directorToken.metadata).mrsSofiaRole==='director','LiveKit tells student player that admin is the broadcaster');
 const teacherToken=payload((await request('/lessons/'+lesson+'/token','POST',{},a.teacher)).data.token);
 check(JSON.parse(teacherToken.metadata).mrsSofiaRole==='instructor','teacher metadata supports older courses');
 check((await request('/lessons/'+lesson+'/token','POST',{},a.outsider)).status===403,'unapproved child cannot enter live room');
 check((await request('/lessons/'+lesson+'/classroom','GET',null,a.admin)).data.isHost===true,'admin always receives live classroom controls');
 const tokenBefore=decode((await request('/lessons/'+lesson+'/token','POST',{},a.student)).data.token);
 check(tokenBefore.canPublish===false,'child starts without published tracks');
 check(JSON.parse(payload((await request('/lessons/'+lesson+'/token','POST',{},a.student)).data.token).metadata).mrsSofiaRole==='viewer','student session has nonhost metadata');
 check((await request('/lessons/'+lesson+'/hand','POST',{raised:true},a.student)).status===200,'child raises hand for teacher');
 check((await change('allow_audio',student.id,a.admin)).status===200,'director can approve student microphone directly');
 check((await change('allow_audio',student.id)).status===200,'teacher can approve microphone');
 check(seen.some(x=>x.action==='UpdateParticipant'&&x.payload.identity===student.id&&x.payload.permission?.canPublish===true),'LiveKit permission update actually sent');
 const afterMic=decode((await request('/lessons/'+lesson+'/token','POST',{},a.student)).data.token);
 check(afterMic.canPublish===true&&afterMic.canPublishSources?.length===1,'rejoin token only includes mic permission');
 const status=await request('/lessons/'+lesson+'/classroom','GET',null,a.student);
 check(status.data.speakerMode==='microphone'&&!status.data.handRaised,'hand request cleared on approval');
 check((await change('allow_camera',student.id)).status===200,'teacher can separately allow camera');
 const afterCamera=decode((await request('/lessons/'+lesson+'/token','POST',{},a.student)).data.token);
 check(afterCamera.canPublishSources?.length===2,'camera and microphone rights only after consent-grant');
 check((await change('revoke',student.id)).status===200,'teacher can revoke media permissions');
 check(decode((await request('/lessons/'+lesson+'/token','POST',{},a.student)).data.token).canPublish===false,'rejoin token read-only after revocation');
 check((await change('allow_audio',student.id)).status===200,'teacher can restore microphone permission');
 check((await change('mute_all')).status===200,'teacher can mute all with room service');
 check((await request('/lessons/'+lesson+'/classroom','GET',null,a.teacher)).data.speakers.length===0,'all speaker grants removed persistently');
 check(!seen.some(x=>x.action==='ListParticipants'),'speaker mute does not require listing the entire room');
 check((await change('remove',student.id)).status===200,'teacher can remove enrolled student');
 check((await request('/lessons/'+lesson+'/token','POST',{},a.student)).status===403,'removed child cannot receive new room token');
 check((await change('end_room')).status===200,'teacher can end room for everyone');
 check((await request('/lessons/'+lesson+'/token','POST',{},a.teacher)).status===409,'ended room cannot be reopened by token');
 console.log('RESULT '+passed+' mocked LiveKit moderation checks passed.');
}finally{
 app.kill();await new Promise(resolve=>app.once('exit',resolve)).catch(()=>{});
 await new Promise(resolve=>fake.close(resolve));
 fs.rmSync(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
