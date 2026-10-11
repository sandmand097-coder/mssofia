// Production-built public homepage smoke: device widths, answered learning
// prompts, keyboard-friendly controls, reduced motion and no API access.
// All API calls are mocked: no student sessions, payment writes or LiveKit minutes.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const root=path.dirname(fileURLToPath(import.meta.url));
const port=await new Promise((resolve,reject)=>{
 const server=net.createServer().once('error',reject);
 server.listen(0,'127.0.0.1',()=>{
  const available=server.address().port;
  server.close(()=>resolve(available));
 });
});
const base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,windowsHide:true,stdio:'ignore'});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser;
try{
 let ready=false;
 for(let n=0;n<100;n++){
  try{if((await fetch(base,{signal:AbortSignal.timeout(600)})).ok){ready=true;break}}catch{}
  await pause(150);
 }
 assert.ok(ready,'Vite preview unavailable');
 browser=await chromium.launch({
  headless:true,
  ...(process.platform==='win32'?{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}:{})
 });
 for(const width of [360,390,768,1366]){
  const context=await browser.newContext({viewport:{width,height:820},locale:'ar-EG',hasTouch:width<=390,isMobile:width<=390});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/**',route=>{
   const routePath=new URL(route.request().url()).pathname;
   const reply=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(routePath==='/api/health')return reply(200,{ok:true,mode:'preview'});
   if(routePath==='/api/auth/me')return reply(401,{error:'Guest'});
   if(routePath==='/api/courses')return reply(200,{courses:[]});
   return reply(403,{error:'Blocked in visitor UI test'});
  });
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:20000});
  const section=page.locator('#sofia-discovery');
  await section.waitFor({state:'visible',timeout:14000});
  const info=await page.evaluate(()=>({
   width:window.innerWidth,
   scroll:document.documentElement.scrollWidth,
   lab:document.querySelectorAll('#sofia-discovery').length,
   pictures:document.querySelectorAll('#sofia-discovery img,#sofia-discovery video').length
  }));
  assert.equal(info.lab,1,'one science lab on home');
  assert.ok(info.scroll<=info.width+2,'no horizontal overflow at '+width+'px: '+JSON.stringify(info));
  assert.equal(info.pictures,0,'no heavy external images/video');
  if(width===390||width===1366){
   const folder=path.join(root,'qa-artifacts');
   mkdirSync(folder,{recursive:true});
   await page.locator('.sofia-hero').screenshot({path:path.join(folder,'sofia-hero-'+width+'.png'),animations:'disabled'});
   await section.screenshot({path:path.join(folder,'sofia-discovery-'+width+'.png'),animations:'disabled'});
  }

  const quiz=section.locator('.sofia-discovery-card');
  const choices=quiz.locator('button.sofia-discovery-answer');
  assert.equal(await choices.count(),2,'only two clear choices');
  assert.equal(await quiz.getAttribute('data-discovery-index'),'0');

  if(width===390){
   // Wrong answers remain safe and retryable; none are recorded externally.
   await choices.nth(1).click();
   assert.equal(await quiz.getAttribute('data-answer-result'),'retry');
   assert.match(await quiz.locator('[role="status"]').innerText(),/جرب الإجابة التانية/);
   await choices.nth(0).click();
   assert.equal(await quiz.getAttribute('data-answer-result'),'correct');
   assert.match(await quiz.locator('[role="status"]').innerText(),/أسرع/);
   await quiz.getByRole('button',{name:/السؤال اللي بعده/}).click();
   assert.equal(await quiz.getAttribute('data-discovery-index'),'1');
   await choices.nth(1).click();
   assert.equal(await quiz.getAttribute('data-answer-result'),'correct');
   await quiz.getByRole('button',{name:/السؤال اللي بعده/}).click();
   assert.equal(await quiz.getAttribute('data-discovery-index'),'2');
   await choices.nth(0).click();
   assert.equal(await quiz.getAttribute('data-answer-result'),'correct');
   await quiz.getByRole('button',{name:/جولة جديدة/}).click();
   assert.equal(await quiz.getAttribute('data-discovery-index'),'0');
   assert.equal(await quiz.getAttribute('data-answer-result'),'unanswered');
   // User preference must be honored, including the original hero animation.
   await page.emulateMedia({reducedMotion:'reduce'});
   const animation=await page.locator('.sofia-hero .sofia-illustration').evaluate(el=>getComputedStyle(el).animationName);
   assert.equal(animation,'none','prefers-reduced-motion disables hero animation');
   await page.emulateMedia({reducedMotion:'no-preference'});
   const animated=await page.locator('.sofia-hero .sofia-illustration').evaluate(el=>getComputedStyle(el).animationName);
   assert.ok(animated.includes('sofia-float-lab'),'gentle hero animation present');
  }
  assert.deepEqual(errors,[],'no JavaScript exceptions at '+width+'px');
  await page.goto(base+'/courses',{waitUntil:'domcontentloaded'});
  await page.locator('.sofia-catalog').waitFor({state:'visible',timeout:14000});
  assert.equal(await page.locator('#sofia-discovery').count(),0,'quiz only on marketing homepage, never on courses/lesson');
  console.log('PASS age-friendly science activity at '+width+'px, without layout overflow, errors or private endpoints');
  await context.close();
 }
 console.log('PASS actual production-built kids science discovery on desktop/mobile with reduced-motion QA');
}finally{
 await browser?.close();
 server.kill();
 await Promise.race([new Promise(resolve=>server.once('exit',resolve)),pause(2000)]);
}
