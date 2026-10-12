// Isolated production-build browser acceptance for refresh, navigation and
// parent onboarding. All API results are mocked; no real users or payments.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const root=path.dirname(fileURLToPath(import.meta.url));
const folder=path.join(root,'qa-artifacts','first-visit');
mkdirSync(folder,{recursive:true});
const port=await new Promise((resolve,reject)=>{
 const s=net.createServer().once('error',reject);
 s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))});
});
const origin='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
try{
 let ready=false;
 for(let i=0;i<120;i++){
  try{if((await fetch(origin,{signal:AbortSignal.timeout(600)})).ok){ready=true;break}}catch{}
  await sleep(140);
 }
 assert.ok(ready,'built Vite preview must start');
 browser=await chromium.launch({headless:true,...(process.platform==='win32'?{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}:{})});
 for(const width of [360,390,768,1366]){
  const context=await browser.newContext({viewport:{width,height:850},locale:'ar-EG',hasTouch:width<=390,isMobile:width<=390});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/**',route=>{
   const p=new URL(route.request().url()).pathname;
   const reply=(status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(p==='/api/health')return reply(200,{ok:true,mode:'full',registrationAvailable:true,videoConfigured:true});
   if(p==='/api/auth/me')return reply(401,{error:'No test user session'});
   if(p==='/api/courses')return reply(200,{courses:[]});
   if(p==='/api/auth/registration-status')return reply(200,{registrationAvailable:true,emailRegistrationAvailable:false,googleRegistrationAvailable:true,emailMode:'disabled'});
   if(p==='/api/auth/google/config')return reply(200,{enabled:false});
   return reply(403,{error:'Public UI QA: private endpoint disabled'});
  });

  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
  await page.locator('.sofia-hero-copy h1').waitFor({state:'visible',timeout:14000});
  assert.ok(await page.locator('.sofia-guide-home-link').count(),'home intro CTA must be present');
  await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,left:0,behavior:'instant'}));
  await page.waitForFunction(()=>window.scrollY>300);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.sofia-hero-copy h1').waitFor({state:'visible'});
  await page.waitForTimeout(250);
  assert.ok(await page.evaluate(()=>window.scrollY)<15,'refresh must reopen home at top for '+width+'px');

  await page.locator('.sofia-guide-home-link').click();
  const title=page.locator('.sofia-guide-hero h1');
  await title.waitFor({state:'visible',timeout:14000});
  assert.match(await title.innerText(),/أول مرة في/);
  assert.equal(await page.locator('.sofia-guide-step-tab').count(),7,'all onboarding steps visible as a selectable sequence');
  assert.equal(await page.locator('.sofia-guide-faqs details').count(),6);
  const stages=page.locator('.sofia-livewalk-stage');
  assert.equal(await stages.count(),5,'five progressive classroom walkthrough stages');
  await stages.nth(1).click();
  assert.equal(await stages.nth(1).getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('#sofia-livewalk-current').innerText(),/مشاهدة البث/);
  await stages.nth(2).click();
  assert.match(await page.locator('#sofia-livewalk-current').innerText(),/الدخول لمشاهدة الحصة/);
  await stages.nth(3).click();
  assert.match(await page.locator('#sofia-livewalk-current').innerText(),/قاعة انتظار الحصة/);
  await stages.nth(4).click();
  assert.match(await page.locator('#sofia-livewalk-current').innerText(),/ارفع إيدك/);
  assert.match(await page.locator('.sofia-livewalk-screen').innerText(),/ليس بثًا حقيقيًا/);
  assert.equal(await page.locator('.sofia-livewalk-faq details').count(),6,'common sound and waiting problems');
  assert.equal(await page.locator('.sofia-livewalk-teacher').count(),1,'instructor guide remains accessible');

  const third=page.locator('.sofia-guide-step-tab').nth(2);
  await third.click();
  assert.equal(await third.getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('#sofia-guide-step-detail').innerText(),/واتساب أو اترك رقم ولي الأمر/);
  assert.match(await page.locator('#sofia-guide-step-detail').innerText(),/لا تحوّل أي مبلغ/);
  assert.equal(await page.locator('#sofia-guide-step-detail .sofia-cta').getAttribute('href'),'/student');
  await page.locator('.sofia-guide-step-tab').first().click();
  assert.match(await page.locator('#sofia-guide-step-detail').innerText(),/موافقة ولي الأمر/);
  assert.equal(await page.locator('#sofia-guide-step-detail .sofia-cta').getAttribute('href'),'/register');
  const text=await page.locator('main.sofia-guide-page').innerText();
  assert.ok(!/ليلة الامتحان|نزول الأطفال بالليل|كلهم عارفين بعض/.test(text),'private family motivation absent from guide');
  assert.ok((await page.locator('a[href="/guide"]').count())>=2,'guide remains reachable from navigation and footer');

  if(width===390||width===1366)await page.screenshot({path:path.join(folder,'guide-'+width+'.png'),fullPage:true,animations:'disabled'});
  const horizontal=await page.evaluate(()=>document.documentElement.scrollWidth);
  assert.ok(horizontal<=width+2,'guide has no horizontal overflow at '+width+'px, got '+horizontal);
  await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,left:0,behavior:'instant'}));
  await page.waitForFunction(()=>window.scrollY>300);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.sofia-guide-hero h1').waitFor({state:'visible',timeout:14000});
  await page.waitForTimeout(240);
  assert.ok(await page.evaluate(()=>window.scrollY)<15,'refresh must reopen guide at top for '+width+'px');

  // Deep-linked classroom guide should honor the anchor after lazy module loading.
  await page.goto(origin+'/guide#live-class',{waitUntil:'domcontentloaded'});
  await page.locator('#live-class').waitFor({state:'visible',timeout:14000});
  await page.waitForFunction(()=>{
   const target=document.getElementById('live-class');
   if(!target)return false;
   const rect=target.getBoundingClientRect();
   return rect.top<220&&rect.bottom>100;
  },null,{timeout:13000});
  assert.match(await page.locator('#sofia-livewalk-heading').innerText(),/إزاي تدخل/);

  // Lazy-loaded home anchors must resolve even when entered directly.
  await page.goto(origin+'/#method',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>{
   const section=document.getElementById('method');
   return section&&window.scrollY>250&&Math.abs(section.getBoundingClientRect().top-106)<95;
  },null,{timeout:12000});
  const anchorOffset=await page.locator('#method').evaluate(el=>el.getBoundingClientRect().top);
  assert.ok(anchorOffset>=5&&anchorOffset<220,'anchor visible below sticky header');

  await page.locator('header .sofia-logo').click();
  await page.locator('.sofia-hero h1').waitFor({state:'visible'});
  await page.waitForTimeout(100);
  assert.ok(await page.evaluate(()=>window.scrollY)<15,'SPA route to home resets to top');
  assert.deepEqual(errors,[],'no unhandled frontend errors at '+width+'px');
  console.log('PASS first-visit guide, mobile layout, home and guide refresh, delayed anchors, private copy: '+width+'px');
  await context.close();
 }
 console.log('PASS all visitor guide and scroll restoration browser checks');
}finally{
 await browser?.close().catch(()=>{});
 server.kill();
 await Promise.race([new Promise(r=>server.once('exit',r)),sleep(2500)]);
}
