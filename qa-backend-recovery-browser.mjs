// Browser acceptance: public lessons info paints while Render sleeps; a later
// successful health probe restores sign-in without reloading the whole site.
// No real student, payment or LiveKit endpoint is ever contacted.
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
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,windowsHide:true});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser;
try{
 let ready=false;
 for(let i=0;i<100;i++){try{if((await fetch(base)).ok){ready=true;break}}catch{}await pause(150)}
 assert.ok(ready,'preview did not start');
 browser=await chromium.launch({headless:true,...(process.platform==='win32'?{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}:{})});
 const context=await browser.newContext({viewport:{width:390,height:850},locale:'ar-EG'});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 let healthRequests=0;
 await page.route('**/api/**',async route=>{
  const pathname=new URL(route.request().url()).pathname;
  const reply=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(pathname==='/api/health'){
   healthRequests++;
   if(healthRequests===1){await pause(3400);return reply(503,{error:'Render waking up'})}
   return reply(200,{ok:true,mode:'full',registrationAvailable:false});
  }
  if(pathname==='/api/auth/me')return reply(401,{error:'Not logged in'});
  if(pathname==='/api/courses')return reply(200,{courses:[]});
  return reply(403,{error:'API unavailable in isolated test'});
 });
 const started=Date.now();
 await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:20000});
 await page.getByRole('heading',{name:/العلوم مش حفظ/}).waitFor({timeout:2500});
 assert.ok(Date.now()-started<3400,'public route must paint before sleeping API responds');
 await page.getByRole('button',{name:'إعادة الاتصال'}).waitFor({timeout:11000});
 await page.getByText(/المحتوى التعريفي متاح/).waitFor();
 await page.getByRole('button',{name:'إعادة الاتصال'}).click();
 await page.getByRole('link',{name:'تسجيل الدخول'}).first().waitFor({timeout:18000});
 assert.ok(healthRequests>=2,'retry should issue a fresh health probe');
 await page.goto(base+'/login',{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:/أهلاً بيك/}).waitFor({timeout:12000});
 const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(geometry.scroll<=geometry.width+2,'mobile route horizontal overflow '+JSON.stringify(geometry));
 assert.deepEqual(errors,[],'no browser errors after cold start recovery');
 console.log('PASS public first paint during Render 503 and secure sign-in recovery without reload');
 await context.close();
}finally{
 await browser?.close();
 vite.kill();
 await Promise.race([new Promise(resolve=>vite.once('exit',resolve)),pause(2000)]);
}
