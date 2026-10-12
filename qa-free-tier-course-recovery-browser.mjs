// Browser regression for public course detail during a sleeping free Render.
// All APIs mocked: never contacts school student, billing or LiveKit production.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {chromium} from 'playwright-core';

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const port=await new Promise((resolve,reject)=>{
 const sock=net.createServer().once('error',reject);
 sock.listen(0,'127.0.0.1',()=>{const p=sock.address().port;sock.close(()=>resolve(p))});
});
const base='http://127.0.0.1:'+port;
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});
let browser;
try{
 let ready=false;
 for(let i=0;i<100;i++){
  try{if((await fetch(base,{signal:AbortSignal.timeout(600)})).ok){ready=true;break}}catch{}
  await pause(130);
 }
 assert.ok(ready,'vite preview ready');
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},locale:'ar-EG'});
 const page=await context.newPage();
 let detailsCalls=0,catalogCalls=0,postCalls=0;
 const course={id:'science-1',status:'published',title:'كورس العلوم التفاعلي',subject:'علوم',level:'الصف الأول',description:'تجارب علوم مبسطة',price:100,capacity:50,enrolled:12,teacher_name:'Miss Sofia',duration_minutes:45};
 const ok=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 await page.route('**/api/**',route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(route.request().method()!=='GET'){postCalls++;return ok(route,{error:'writes blocked'},403)}
  if(path==='/api/health')return ok(route,{error:'Render asleep'},503);
  if(path==='/api/auth/me')return ok(route,{error:'Render asleep'},503);
  if(path==='/api/courses'){catalogCalls++;return ok(route,{courses:[course],availability:{source:'stale',stale:true}})}
  if(path==='/api/courses/science-1'){
   detailsCalls++;
   if(detailsCalls===1)return ok(route,{error:'Render asleep'},503);
   return ok(route,{course,lessons:[{id:'lesson-1',title:'المادة والطاقة',course_id:course.id,starts_at:'2026-10-18T14:00:00Z',duration_minutes:45,status:'scheduled'}]});
  }
  return ok(route,{error:'fixture only'},403);
 });
 const errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.goto(base+'/courses/science-1',{waitUntil:'domcontentloaded',timeout:20000});
 await page.getByRole('heading',{name:'كورس العلوم التفاعلي'}).waitFor({timeout:15000});
 assert.ok(await page.getByRole('button',{name:/الحجز متاح عند عودة الاتصال/}).isDisabled(),'booking remains disabled in public fallback');
 assert.ok((await page.getByText('جارٍ التحقق').count())>=1,'unverified seats/lessons must be marked');
 await page.getByText('المادة والطاقة').waitFor({timeout:24000});
 assert.ok(detailsCalls>=2,'course details should recover automatically without reload');
 assert.equal(await page.getByRole('button',{name:/الحجز متاح عند عودة الاتصال/}).count(),0,'temporary fallback ended when public data recovered');
 assert.equal(postCalls,0,'never replay enrollment or money operations');
 assert.deepEqual(errors,[],'no uncaught browser exceptions');
 assert.ok(catalogCalls>=1);
 await context.close();
 console.log('PASS: public course is readable from cached listing, then self-recovers without writes');
}finally{
 await browser?.close().catch(()=>{});
 vite.kill();
 await Promise.race([new Promise(r=>vite.once('exit',r)),pause(1800)]);
}
