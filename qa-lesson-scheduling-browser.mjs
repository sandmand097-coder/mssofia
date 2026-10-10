// Read-only browser scheduling contract: all APIs mocked, no production changes.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {cairoParts,cairoLocalToISO} from './src/components/cairo-lesson-time.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const port=await new Promise((resolve,reject)=>{const s=net.createServer().once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})});
const origin='http://127.0.0.1:'+port;
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,windowsHide:true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
try{
 let ready=false;for(let i=0;i<75;i++){try{if((await fetch(origin)).ok){ready=true;break}}catch{}await wait(140)}
 assert.ok(ready,'Vite preview started');
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const course={id:'mock-course',title:'علوم للمرحلة الابتدائية',teacher_name:'Mrs Sofia',enrolled:0,capacity:30,price:170,subject:'علوم',level:'الابتدائي',duration_minutes:60,teacher_id:'director-1'};
 const date=cairoParts(Date.now()+5*86400000).date,expected=cairoLocalToISO(date,'16','30');
 for(const width of [390,1366]){
  const page=await browser.newPage({viewport:{width,height:920},locale:'ar-EG'}),errors=[],saved=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',route=>{
   const url=new URL(route.request().url()).pathname,method=route.request().method();
   const reply=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(url==='/api/health')return reply(200,{ok:true,mode:'full'});
   if(url==='/api/auth/me')return reply(200,{user:{id:'director-1',name:'Mrs Sofia',role:'admin',status:'active',email:'admin@example.test'}});
   if(url==='/api/admin/dashboard')return reply(200,{statistics:{students:0,teachers:0,courses:1,pendingBookings:0},latestUsers:[],upcomingLessons:[],pendingBookings:[],registrationTrend:[]});
   if(url==='/api/my/overview')return reply(200,{courses:[course],bookings:[],lessons:[],stats:{courses:1,bookings:0,upcoming:0}});
   if(url==='/api/admin/users')return reply(200,{users:[{id:'director-1',role:'admin',name:'Mrs Sofia',status:'active',email:'admin@example.test'}]});
   if(url==='/api/admin/dependencies')return reply(200,{checkedAt:new Date().toISOString(),databaseConnected:true,livekitApiVerified:true,receiptBucketPrivateVerified:false});
   if(url==='/api/admin/setup-status')return reply(200,{launchMode:'full',livekitCredentialsConfigured:true});
   if(url==='/api/courses/mock-course/lessons'&&method==='POST'){saved.push(route.request().postDataJSON());return reply(201,{id:'lesson-1'})}
   return reply(503,{error:'API not part of isolated scheduling test'});
  });
  await page.goto(origin+'/admin',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'الدورات',exact:true}).click();
  await page.getByRole('button',{name:'إضافة حصة'}).click();
  await page.getByRole('heading',{name:'إضافة حصة'}).waitFor({timeout:15000});
  const modal=page.locator('.portal-modal');
  assert.equal(await modal.locator('input[type="datetime-local"]').count(),0,'no ambiguous AM/PM datetime-local input');
  assert.equal(await modal.locator('input[type="url"]').count(),0,'external meeting link input removed');
  await modal.getByText(/LiveKit/).waitFor();
  await modal.getByLabel('اسم الحصة').fill('حصة الصوت والصورة');
  await modal.locator('input[type="date"]').fill(date);
  await modal.locator('.sofia-lesson-time-fields select').nth(0).selectOption('16');
  await modal.locator('.sofia-lesson-time-fields select').nth(1).selectOption('30');
  await modal.getByRole('button',{name:'حفظ البيانات'}).click();
  for(let i=0;i<20&&!saved.length;i++)await wait(75);
  assert.equal(saved.length,1,'successful create lesson API request at '+width);
  assert.equal(saved[0].starts_at,expected,'Cairo 24-hour wall time converted to UTC');
  assert.equal(saved[0].duration_minutes,60);
  assert.equal(Object.hasOwn(saved[0],'meet_url'),false,'do not submit Google Meet redirect');
  const layout=await page.evaluate(()=>({width:window.innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(layout.scroll<=layout.width+2,'no horizontal page overflow at '+width);
  assert.deepEqual(errors,[],'JS page errors '+errors.join('; '));
  console.log('PASS internal LiveKit lesson creation, unambiguous Cairo scheduling '+width+'px');
  await page.close();
 }
 console.log('PASS new live course lessons remain within Mrs Sofia, never redirect to Meet');
}finally{
 if(browser)await browser.close();
 vite.kill();await Promise.race([new Promise(r=>vite.once('exit',r)),wait(1200)]);
}
