// Isolated desktop/mobile browser QA, without touching real student accounts.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=await new Promise((resolve,reject)=>{
 const s=net.createServer().once('error',reject);
 s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>resolve(n))});
});
const base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,windowsHide:true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
try{
 let ready=false;
 for(let i=0;i<90;i++){try{if((await fetch(base)).ok){ready=true;break}}catch{}await wait(125)}
 assert.ok(ready,'preview did not start');
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 for(const width of [360,390,768,1366]){
  const context=await browser.newContext({viewport:{width,height:830},locale:'ar-EG'});
  const page=await context.newPage(),pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  await page.route('**/api/**',async route=>{
   const u=new URL(route.request().url());
   const send=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(u.pathname==='/api/health')return send(200,{ok:true,mode:'preview',registrationAvailable:false});
   if(u.pathname==='/api/auth/me')return send(401,{error:'guest'});
   if(u.pathname==='/api/courses')return send(200,{courses:[]});
   return send(404,{error:'not part of this isolated test'});
  });
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  const logo=page.locator('header .sofia-logo-copy').first();
  await logo.getByText('Miss Sofia.').waitFor({timeout:15000});
  assert.ok((await logo.innerText()).includes('المُدرِّسة'),'Arabic spelling missing');
  assert.ok((await page.title()).includes('Miss Sofia'),'page title uses legacy branding');
  const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(size.scroll<=size.width+2,'horizontal overflow '+width+'px '+JSON.stringify(size));
  assert.deepEqual(pageErrors,[],'page errors at '+width+'px');
  console.log('PASS brand identity, metadata and responsive header at '+width+'px');
  await context.close();
 }
}finally{
 await browser?.close();
 server.kill();
 await Promise.race([new Promise(r=>server.once('exit',r)),wait(2000)]);
}
