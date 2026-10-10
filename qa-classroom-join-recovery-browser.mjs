// Isolated browser test: API mocks only, no LiveKit minutes or student accounts.
// GitHub Actions installs the matching Chromium for playwright-core.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=await new Promise((resolve,reject)=>{
 const s=net.createServer().once('error',reject);
 s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))});
});
const base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,windowsHide:true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
try{
 let ready=false;
 for(let i=0;i<80;i++){
  try{if((await fetch(base+'/')).ok){ready=true;break}}catch{}
  await wait(125);
 }
 assert.ok(ready,'preview server started');
 browser=await chromium.launch({headless:true});
 for(const [scenario,firstStatus,expectedAttempts] of [['overload',503,2],['denied',403,1]]){
  const page=await browser.newPage({viewport:{width:390,height:850},locale:'ar-EG'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let tokenCalls=0;
  await page.route('**/api/**',route=>{
   const url=new URL(route.request().url()).pathname;
   const respond=(status,data,headers={})=>route.fulfill({status,contentType:'application/json',headers,body:JSON.stringify(data)});
   if(url==='/api/health')return respond(200,{ok:true,mode:'full',videoConfigured:true});
   if(url==='/api/auth/me')return respond(200,{user:{id:'viewer-test',name:'طالب تجريبي',role:'student',status:'active',email:'viewer@test.invalid'}});
   if(url==='/api/lessons/test-lesson'&&route.request().method()==='GET')
    return respond(200,{lesson:{id:'test-lesson',title:'درس علوم تجريبي',course_title:'علوم',starts_at:new Date(Date.now()+5*60000).toISOString(),duration_minutes:60,status:'scheduled',teacher_id:'teacher-test'},videoConfigured:true,videoLocalOnly:false});
   if(url==='/api/lessons/test-lesson/token'&&route.request().method()==='POST'){
    tokenCalls++;
    if(tokenCalls===1)return respond(firstStatus,{error:firstStatus===503?'يوجد ضغط على دخول الحصة':'انتهى الاشتراك',code:firstStatus===503?'CLASSROOM_BUSY':'DENIED'},firstStatus===503?{'retry-after':'1'}:{});
    return respond(200,{token:'intentionally-invalid-test-token',serverUrl:'wss://media.test.invalid',teacherId:'teacher-test',lessonId:'test-lesson',isHost:false,role:'student'});
   }
   if(url==='/api/lessons/test-lesson/classroom')return respond(200,{isHost:false,hands:[],speakers:[],qaEnabled:false});
   return respond(404,{error:'isolated test endpoint'});
  });
  await page.goto(base+'/lesson/test-lesson',{waitUntil:'domcontentloaded',timeout:25000});
  await page.getByRole('button',{name:'الدخول لمشاهدة الحصة'}).waitFor({timeout:16000});
  await page.getByRole('button',{name:'الدخول لمشاهدة الحصة'}).click();
  if(scenario==='overload'){
   await page.getByText(/خادم الحصة مشغول مؤقتًا/).waitFor({timeout:5000});
   await page.waitForFunction(()=>document.querySelector('.sofia-classroom-live')!==null,{timeout:12000}).catch(()=>{});
  }else{
   await page.getByText('انتهى الاشتراك').waitFor({timeout:6000});
  }
  await wait(1300);
  assert.equal(tokenCalls,expectedAttempts,scenario+' should make exactly the expected number of token requests');
  assert.deepEqual(errors,[],'no unhandled React page errors in '+scenario);
  console.log('PASS retry vs permanent denial in student classroom browser: '+scenario+' calls='+tokenCalls);
  await page.close();
 }
}finally{
 await browser?.close();
 server.kill();
 await Promise.race([new Promise(resolve=>server.once('exit',resolve)),wait(2000)]);
}
