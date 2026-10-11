// UI regression for a misleading public launch banner when Render wakes up.
// Uses local production Vite build + mocked API; never touches real students,
// real account sessions, paid live video, Cloudflare production or Supabase.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const root=path.dirname(fileURLToPath(import.meta.url));
const port=await new Promise((resolve,reject)=>{
 const socket=net.createServer().once('error',reject);
 socket.listen(0,'127.0.0.1',()=>{
  const free=socket.address().port;
  socket.close(()=>resolve(free));
 });
});
const origin='http://127.0.0.1:'+port;
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
async function withPage({mode='full',failFirstHealth=false,url='/',width=390}){
 const context=await browser.newContext({viewport:{width,height:840},locale:'ar-EG'});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e.message)));
 let healthCalls=0,authCalls=0;
 await page.route('**/api/**',async route=>{
  const pathName=new URL(route.request().url()).pathname;
  const reply=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(pathName==='/api/health'){
   healthCalls++;
   if(failFirstHealth&&healthCalls===1){
    await pause(2200);
    return reply(503,{error:'Temporary Render cold start'});
   }
   return reply(200,{ok:true,mode,registrationAvailable:mode==='full',videoConfigured:mode==='full'});
  }
  if(pathName==='/api/auth/me'){authCalls++;return reply(401,{error:'Not logged in'})}
  if(pathName==='/api/courses')return reply(200,{courses:[]});
  if(pathName==='/api/auth/registration-status')return reply(200,{emailMode:'disabled',registrationAvailable:mode==='full'});
  return reply(403,{error:'Fixture only; protected endpoint blocked'});
 });
 await page.goto(origin+url,{waitUntil:'domcontentloaded',timeout:18000});
 const noBanner=async()=>{
  assert.equal(await page.getByText(/تسجيل الطلاب والبث المباشر هيفتحوا بعد اكتمال التجهيز الآمن/).count(),0);
  assert.equal(await page.locator('.sofia-public-preview-notice').count(),0);
 };
 return{context,page,errors,noBanner,getHealthCalls:()=>healthCalls,getAuthCalls:()=>authCalls};
}
try{
 let ready=false;
 for(let i=0;i<90;i++){
  try{if((await fetch(origin,{signal:AbortSignal.timeout(650)})).ok){ready=true;break}}catch{}
  await pause(160);
 }
 assert.ok(ready,'Local preview failed to start');
 browser=await chromium.launch({headless:true,...(process.platform==='win32'?{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}:{})});

 // Public content paints BEFORE a deliberately stalled health check. Banner
 // does not flash during checking or falsely claim registrations are closed.
 {
  const t0=Date.now();
  const t=await withPage({failFirstHealth:true});
  await t.page.getByRole('heading',{name:/العلوم مش حفظ/}).waitFor({timeout:2100});
  assert.ok(Date.now()-t0<2200,'Read-only science homepage must not wait for Render startup');
  await t.noBanner();
  await t.page.waitForFunction(()=>document.querySelector('header .sofia-logo-copy')!==null);
  // Offline state is fail-closed on /register without misleading global banner.
  await t.page.getByRole('link',{name:/أنشئ حسابك/}).click();
  await t.page.getByRole('heading',{name:'خدمة الحسابات غير متاحة مؤقتًا'}).waitFor({timeout:11000});
  await t.noBanner();
  await t.page.getByRole('button',{name:'إعادة الاتصال'}).click();
  await t.page.getByRole('heading',{name:/ابدأ رحلة طفلك/}).waitFor({timeout:13000});
  assert.ok(t.getHealthCalls()>=2,'Explicit retry checks actual origin readiness');
  assert.equal(await t.page.locator('.sofia-public-preview-notice').count(),0);
  assert.deepEqual(t.errors,[]);
  console.log('PASS: cold start never shows old banner; public first paint + secure manual recovery');
  await t.context.close();
 }
 // Preview mode is still enforced; removing a promotional banner must never
 // make student registration or paid lessons accessible.
 for(const mode of ['preview','admin']){
  const t=await withPage({mode,url:'/register',width:360});
  await t.page.getByRole('heading',{name:'التسجيل غير متاح حاليًا'}).waitFor({timeout:10000});
  await t.noBanner();
  assert.deepEqual(t.errors,[]);
  await t.context.close();
  console.log('PASS: '+mode+' mode remains closed for student registration despite no banner');
 }
 // Full mode must offer the actual school login, not a false preview notice.
 {
  const t=await withPage({mode:'full',url:'/login',width:1366});
  await t.page.getByRole('heading',{name:/أهلاً بيك/}).waitFor({timeout:11000});
  await t.noBanner();
  assert.deepEqual(t.errors,[]);
  await t.context.close();
  console.log('PASS: full launch login appears without a misleading promotional notice');
 }
 console.log('PASS all public launch banner and cold-start recovery browser regressions');
}finally{
 await browser?.close().catch(()=>{});
 vite.kill();
 await Promise.race([new Promise(r=>vite.once('exit',r)),pause(2000)]);
}
