// Safe browser test: mocked app APIs; no real school sessions or LiveKit credentials.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import net from 'node:net';
import {chromium} from 'playwright-core';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const port=await new Promise((resolve,reject)=>{
 const s=net.createServer().once('error',reject);
 s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))});
});
const origin='http://127.0.0.1:'+port;
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,windowsHide:true});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser;
try{
 let available=false;
 for(let i=0;i<85;i++){
  try{if((await fetch(origin+'/')).ok){available=true;break}}catch{}
  await wait(120);
 }
 assert.ok(available,'preview failed to launch');
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 for(const width of [390,1366]){
  for(const role of ['admin','student']){
   const context=await browser.newContext({viewport:{width,height:850},locale:'ar-EG',permissions:['camera','microphone']});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/api/**',async route=>{
    const pathname=new URL(route.request().url()).pathname;
    const reply=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(pathname==='/api/health')return reply(200,{ok:true,mode:role==='admin'?'admin':'full',registrationAvailable:false});
    if(pathname==='/api/auth/me')return reply(200,{user:{id:role==='admin'?'director':'approved-student',name:role==='admin'?'Mrs Sofia':'Science learner',role,status:'active',email:role+'@example.test'}});
    if(pathname==='/api/lessons/fixture-lesson'||pathname==='/api/lessons/future-lesson')return reply(200,{lesson:{
     id:pathname.endsWith('future-lesson')?'future-lesson':'fixture-lesson',title:'حصة علوم تجريبية',course_title:'كورس علوم',
     starts_at:new Date(Date.now()+(pathname.endsWith('future-lesson')?40:8)*60000).toISOString(),duration_minutes:60,
     status:'scheduled',teacher_id:'different-original-instructor',meet_url:null
    },videoConfigured:true,videoLocalOnly:false});
    return reply(403,{error:'API disabled in isolated classroom test'});
   });
   await page.goto(origin+'/lesson/fixture-lesson',{waitUntil:'domcontentloaded',timeout:30000});
   if(role==='admin'){
    await page.getByRole('heading',{name:'استوديو بث المديرة'}).waitFor({timeout:15000});
    await page.getByRole('button',{name:'فتح استوديو البث'}).waitFor();
    await page.getByText(/أنتِ مقدمة البث/).waitFor();
    const check=page.getByRole('button',{name:'فحص الكاميرا والميكروفون قبل البث'});
    await check.click();
    await page.getByRole('status').getByText(/اختبار ناجح/).waitFor({timeout:14000});
    const tracks=await page.evaluate(async()=>{
     // The preflight releases its tracks immediately; a fresh call is not
     // needed to validate the UI. Return only the UI result, never media data.
     return document.querySelector('.sofia-director-device-check [role="status"]')?.textContent||'';
    });
    assert.ok(tracks.includes('اختبار ناجح'));
   }else{
    await page.getByRole('heading',{name:'غرفة الحصة المباشرة'}).waitFor({timeout:15000});
    await page.getByRole('button',{name:'الدخول لمشاهدة الحصة'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'فتح استوديو البث'}).count(),0);
    assert.equal(await page.getByRole('button',{name:'فحص الكاميرا والميكروفون قبل البث'}).count(),0);
   }
   const layout=await page.evaluate(()=>({width:window.innerWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(layout.scroll<=layout.width+2,'horizontal overflow in '+role+' at '+width+'px: '+JSON.stringify(layout));
   await page.goto(origin+'/lesson/future-lesson',{waitUntil:'domcontentloaded',timeout:30000});
   const locked=page.getByRole('button',{name:role==='admin'?'فتح استوديو البث':'الدخول لمشاهدة الحصة'});
   await locked.waitFor({timeout:15000});
   assert.equal(await locked.isDisabled(),true,'no broadcasting or student viewing before the session window');
   await page.getByText(/تفتح غرفة البث قبل الموعد/).waitFor();
   assert.deepEqual(errors,[],'page errors: '+errors.join('; ').slice(0,250));
   console.log('PASS '+role+' live classroom entry and director-only controls ('+width+'px)');
   await context.close();
  }
 }
 console.log('PASS browser director-vs-student broadcast entry and camera/microphone preflight');
}finally{
 if(browser)await browser.close();
 vite.kill();
 await Promise.race([new Promise(resolve=>vite.once('exit',resolve)),wait(1500)]);
}
