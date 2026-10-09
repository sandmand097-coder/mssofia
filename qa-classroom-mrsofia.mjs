import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const root='http://127.0.0.1:5173';
const env=Object.fromEntries(fs.readFileSync(new URL('./.env',import.meta.url),'utf8').split(/\r?\n/).filter(v=>v.includes('=')).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1)]}));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-first-run']});
const errors=[];
async function login(role,width=1366){
 const page=await browser.newPage({viewport:{width,height:850},locale:'ar-EG'});
 page.on('pageerror',e=>errors.push(role+': '+e.message));
 await page.goto(root+'/login',{waitUntil:'networkidle'});
 await page.locator('input[type=email]').fill(env['DEMO_'+role+'_EMAIL']);
 await page.locator('input[type=password]').fill(env['DEMO_'+role+'_PASSWORD']);
 await page.locator('button[type=submit]').click();
 await page.waitForURL(role==='TEACHER'?'**/teacher':'**/student',{timeout:15000});
 return page;
}
try {
 const teacher=await login('TEACHER');
 const ro=await teacher.request.get(root+'/api/my/overview');
 assert.equal(ro.status(),200);
 const data=await ro.json();
 const lesson=data.lessons.find(l=>l.status==='scheduled');
 assert.ok(lesson,'requires at least one scheduled teacher lesson');
 await teacher.goto(root+'/lesson/'+lesson.id,{waitUntil:'networkidle'});
 await teacher.getByText('غرفة الحصة المباشرة').waitFor();
 await teacher.getByRole('button',{name:'معاينة تصميم الفصل الجديد'}).click();
 await teacher.getByRole('heading',{name:'لوحة تحكم المعلمة'}).waitFor({timeout:15000});
 const disabled=await teacher.getByRole('button',{name:'الانضمام إلى الحصة'}).isDisabled();
 const health=await teacher.request.get(root+'/api/health');
 const flags=await health.json();
 if(!flags.videoConfigured) assert.equal(disabled,true,'no live video should enable a fake connection');
 await teacher.screenshot({path:'mrsofia-classroom-teacher.png',fullPage:true});
 console.log('PASS teacher preview, controls and missing-configuration notice');
 const student=await login('STUDENT',390);
 const sr=await student.request.get(root+'/api/my/overview');const sd=await sr.json();
 const studentLesson=sd.lessons.find(l=>l.status==='scheduled');
 assert.ok(studentLesson,'requires an approved student lesson');
 await student.goto(root+'/lesson/'+studentLesson.id,{waitUntil:'networkidle'});
 await student.getByRole('button',{name:'معاينة تصميم الفصل الجديد'}).click();
 await student.getByRole('heading',{name:'مساحة الطالب'}).waitFor();
 await student.screenshot({path:'mrsofia-classroom-student-mobile.png',fullPage:true});
 const dims=await student.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
 assert.ok(dims.scroll<=dims.viewport+2,'mobile classroom preview overflows horizontally');
 console.log('PASS student mobile classroom preview and privacy description');
 if(errors.length)throw Error(errors.join('; '));
 console.log('PASS browser checks without JavaScript errors');
}finally{await browser.close()}
