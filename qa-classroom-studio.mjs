import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const env=Object.fromEntries(fs.readFileSync(new URL('./.env',import.meta.url),'utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(v=>{const k=v.indexOf('=');return[v.slice(0,k),v.slice(k+1)]}));
const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-first-run']});
const errors=[];
async function loggedIn(role,width){
 const p=await b.newPage({viewport:{width,height:850},locale:'ar-EG'});
 p.on('pageerror',e=>errors.push(role+':'+e.message));
 await p.goto('http://127.0.0.1:5173/login',{waitUntil:'networkidle'});
 await p.locator('input[type=email]').fill(env['DEMO_'+role+'_EMAIL']);
 await p.locator('input[type=password]').fill(env['DEMO_'+role+'_PASSWORD']);
 await p.locator('button[type=submit]').click();
 await p.waitForURL(role==='TEACHER'?'**/teacher':'**/student',{timeout:12000});
 const data=await (await p.request.get('http://127.0.0.1:5173/api/my/overview')).json();
 const lesson=data.lessons.find(x=>x.status==='scheduled');
 assert.ok(lesson);
 await p.goto('http://127.0.0.1:5173/lesson/'+lesson.id,{waitUntil:'networkidle'});
 await p.evaluate(async x=>{const m=await import('/src/qa/RoomSandbox.jsx');m.mountRoomSandbox(x.lessonId,x.host)},{lessonId:lesson.id,host:role==='TEACHER'});
 await p.locator('#mrsofia-room-smoke .sofia-meeting-layout').waitFor({timeout:12000});
 return p;
}
try{
 const t=await loggedIn('TEACHER',1440);
 const room=t.locator('#mrsofia-room-smoke');
 await room.getByText('فصل مباشر • Mrs Sofia').waitFor();
 await room.getByRole('button',{name:'مشاركة الشاشة'}).waitFor();
 await room.getByRole('button',{name:'قفل كل ميكروفونات الطلاب'}).waitFor();
 await room.getByRole('button',{name:'إنهاء الحصة للجميع'}).waitFor();
 await room.getByRole('button',{name:'رسائل المعلمة'}).click();
 await room.locator('#sofia-announcement').waitFor();
 await room.getByRole('button',{name:/الطلاب/}).click();
 await room.screenshot({path:'mrsofia-studio-controls.png'});
 console.log('PASS teacher studio rendered in disconnected SDK smoke harness');
 const s=await loggedIn('STUDENT',390);
 const studentRoom=s.locator('#mrsofia-room-smoke');
 await studentRoom.getByText('في انتظار بث المعلمة').waitFor();
 await studentRoom.getByRole('button',{name:'ارفع إيدك'}).waitFor();
 await studentRoom.getByRole('button',{name:'الميكروفون بإذن المعلمة'}).waitFor();
 assert.equal(await studentRoom.getByRole('button',{name:'مشاركة الشاشة'}).count(),0);
 const overflow=await s.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
 assert.equal(overflow,false);
 await studentRoom.screenshot({path:'mrsofia-studio-student-mobile.png'});
 console.log('PASS student viewer UI and listen-only controls');
 if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS no JavaScript errors mounting full room interface');
}finally{await b.close()}
