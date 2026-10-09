// Real WebRTC test against LOCAL LiveKit on loopback; no public stream or real student data is modified.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync,backup} from 'node:sqlite';
import {chromium} from 'playwright-core';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const env=Object.fromEntries(readFileSync(path.join(root,'.env'),'utf8').split(/\r?\n/).filter(x=>/^[a-z_]+=/i.test(x)).map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1)]}));
const temp=mkdtempSync(path.join(tmpdir(),'mrsofia-webrtc-'));
const copy=path.join(temp,'classroom-test.sqlite');
const original=new DatabaseSync(path.join(root,'data','education.sqlite'),{readOnly:true});
await backup(original,copy);
original.close();
const db=new DatabaseSync(copy);
const teacher=db.prepare("SELECT id,name FROM users WHERE email=? AND role='teacher' AND status='active'").get(env.DEMO_TEACHER_EMAIL);
const student=db.prepare("SELECT id,name FROM users WHERE email=? AND role='student' AND status='active'").get(env.DEMO_STUDENT_EMAIL);
assert.ok(teacher&&student,'active demo teacher/student required');
const course=randomUUID(),lesson=randomUUID(),room=randomUUID();
const date=new Date(Date.now()+60000).toISOString();
db.prepare("INSERT INTO courses(id,title,description,subject,level,price,duration_minutes,capacity,teacher_id,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(course,'تجربة بث علوم حقيقية','بيئة منفصلة لا تستخدم بيانات حقيقية','علوم','الابتدائي',0,60,10,teacher.id,'published',date);
db.prepare("INSERT INTO lessons(id,course_id,title,starts_at,duration_minutes,status,room_key,created_at) VALUES(?,?,?,?,?,?,?,?)").run(lesson,course,'حصة الاختبار المباشر',date,60,'scheduled',room,date);
db.prepare("INSERT INTO bookings(id,course_id,student_id,status,created_at) VALUES(?,?,?,?,?)").run(randomUUID(),course,student.id,'approved',date);
db.close();
let apiProcess,browser,teacherPage,studentPage;
let serverLogs='';
const base='http://127.0.0.1:4099';
const errors=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function login(role,email,password){
 const page=await browser.newPage({viewport:{width:role==='TEACHER'?1380:1100,height:920},permissions:['camera','microphone'],locale:'ar-EG'});
 page.on('pageerror',e=>errors.push(role+': '+e.message));
 await page.goto(base+'/login',{waitUntil:'domcontentloaded'});
 await page.locator('input[type=email]').fill(email);
 await page.locator('input[type=password]').fill(password);
 await page.locator('button[type=submit]').click();
 await page.waitForURL(role==='TEACHER'?'**/teacher':'**/student',{timeout:13000});
 return page;
}
try{
 assert.match(env.LIVEKIT_URL||'',/^ws:\/\/127\.0\.0\.1:7880$/,'test only accepts localhost LiveKit');
 let ready=false;
 try{const r=await fetch('http://127.0.0.1:7880/',{signal:AbortSignal.timeout(1400)});ready=!!r}catch{}
 assert.ok(ready,'start local LiveKit first');
 apiProcess=spawn(process.execPath,['--env-file=.env','server/index.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'4099',NODE_ENV:'development',APP_ORIGIN:base,MADRASATI_DB_PATH:copy}});
 apiProcess.stdout.on('data',c=>serverLogs+=c.toString());
 apiProcess.stderr.on('data',c=>serverLogs+=c.toString());
 let ok=false;
 for(let i=0;i<75;i++){await pause(140);if(apiProcess.exitCode!==null)throw Error('API failed to start (no user secrets printed)');try{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(800)});if(r.ok&&(await r.json()).videoConfigured){ok=true;break}}catch{}}
 assert.ok(ok,'local demo API ready');
 console.log('PASS local API ready with real LiveKit credentials');
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 teacherPage=await login('TEACHER',env.DEMO_TEACHER_EMAIL,env.DEMO_TEACHER_PASSWORD);
 studentPage=await login('STUDENT',env.DEMO_STUDENT_EMAIL,env.DEMO_STUDENT_PASSWORD);
 await teacherPage.goto(base+'/lesson/'+lesson,{waitUntil:'domcontentloaded'});
 await teacherPage.getByRole('button',{name:'الانضمام إلى الحصة'}).click();
 await teacherPage.locator('.sofia-meeting-layout').waitFor({timeout:18000});
 console.log('PASS teacher joined real localhost SFU');
 await studentPage.goto(base+'/lesson/'+lesson,{waitUntil:'domcontentloaded'});
 await studentPage.getByRole('button',{name:'الانضمام إلى الحصة'}).click();
 await studentPage.locator('.sofia-meeting-layout').waitFor({timeout:18000});
 console.log('PASS enrolled child joined same room');
 await teacherPage.getByRole('button',{name:'تشغيل صوتي'}).click();
 await teacherPage.getByRole('button',{name:'تشغيل الكاميرا'}).click();
 console.log('PASS teacher camera and microphone publication requested');
 await studentPage.locator('.sofia-meeting-stage video').first().waitFor({timeout:18000});
 const video=await studentPage.locator('.sofia-meeting-stage video').first().evaluate(v=>({width:v.videoWidth,height:v.videoHeight,ready:v.readyState,tracks:v.srcObject?.getVideoTracks?.().length||0}));
 console.log('VIDEO_TRACK_OBSERVED '+JSON.stringify(video));
 assert.ok(video.tracks>0||video.ready>=2,'student received a video track');
 const audio=await studentPage.locator('audio').count();
 console.log('AUDIO_ELEMENTS_OBSERVED '+audio);
 assert.ok(audio>=1,'student received a LiveKit audio element');
 assert.equal(await studentPage.getByRole('button',{name:'الميكروفون بإذن المعلمة'}).isDisabled(),true,'student initially listen-only');
 await studentPage.getByRole('button',{name:'ارفع إيدك'}).click();
 await teacherPage.getByRole('button',{name:'اسمحي بالصوت'}).waitFor({timeout:12000});
 await teacherPage.getByRole('button',{name:'اسمحي بالصوت'}).click();
 await studentPage.getByRole('button',{name:'تشغيل ميكروفوني'}).waitFor({timeout:12000});
 console.log('PASS hand raise and real-time teacher-granted microphone permission');
 await teacherPage.screenshot({path:path.join(root,'mrsofia-real-local-teacher.png'),fullPage:true});
 await studentPage.screenshot({path:path.join(root,'mrsofia-real-local-student.png'),fullPage:true});
 await teacherPage.getByRole('button',{name:'قفل كل ميكروفونات الطلاب'}).click();
 await studentPage.getByRole('button',{name:'الميكروفون بإذن المعلمة'}).waitFor({timeout:12000});
 console.log('PASS teacher revoked permission via real SFU');
 assert.equal(errors.length,0,'no browser crashes or JavaScript errors');
 console.log('RESULT real two-browser local WebRTC classroom smoke test passed');
}catch(e){
 console.log('REAL_WEBRTC_TEST_FAILED '+String(e.message).slice(0,500));
 if(errors.length)console.log('BROWSER_ERRORS '+errors.join('; ').slice(0,600));
 console.log('SERVER_ERROR_COUNT '+(serverLogs.match(/ERROR|Error|Exception/g)||[]).length);
 process.exitCode=1;
}finally{
 if(browser)await browser.close().catch(()=>{});
 if(apiProcess){apiProcess.kill();await Promise.race([new Promise(resolve=>apiProcess.once('exit',resolve)),pause(4000)])}
 try{rmSync(temp,{recursive:true,force:true,maxRetries:10,retryDelay:50})}catch{console.log('TEMP_CLEANUP_PENDING')}
}
