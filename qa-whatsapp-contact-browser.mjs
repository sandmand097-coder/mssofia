// Read-only browser smoke of the PRODUCTION BUILD. Links are inspected and
// validated but never opened, so WhatsApp receives no requests or test data.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
import {WHATSAPP_CONTACT_URL} from './src/components/whatsapp-contact.js';

const root=path.dirname(fileURLToPath(import.meta.url));
const output=path.join(root,'qa-artifacts','whatsapp-contact');
mkdirSync(output,{recursive:true});
const port=await new Promise((resolve,reject)=>{
 const socket=net.createServer().once('error',reject);
 socket.listen(0,'127.0.0.1',()=>{const p=socket.address().port;socket.close(()=>resolve(p))});
});
const origin='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore',cwd:root});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
try{
 let started=false;
 for(let attempt=0;attempt<100;attempt++){
  try{if((await fetch(origin,{signal:AbortSignal.timeout(700)})).ok){started=true;break}}catch{}
  await pause(150);
 }
 assert.ok(started,'Vite preview not ready');
 browser=await chromium.launch({headless:true,...(process.platform==='win32'?{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}:{})});
 for(const width of [360,390,768,1366]){
  const context=await browser.newContext({viewport:{width,height:800},locale:'ar-EG',hasTouch:width<=390,isMobile:width<=390});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',route=>{
   const pathname=new URL(route.request().url()).pathname;
   const send=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(pathname==='/api/health')return send(200,{ok:true,mode:'full',registrationAvailable:true,videoConfigured:true});
   if(pathname==='/api/auth/me')return send(401,{error:'Unauthenticated'});
   if(pathname==='/api/courses')return send(200,{courses:[]});
   return send(403,{error:'Private QA fixture blocked'});
  });
  await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:20000});
  const button=page.locator('.sofia-wa-contact-link');
  await button.waitFor({state:'visible',timeout:17000});
  assert.equal(await button.getAttribute('href'),WHATSAPP_CONTACT_URL,'direct click-to-chat URL on '+width);
  assert.equal(await button.getAttribute('target'),'_blank');
  assert.equal(await button.getAttribute('rel'),'noopener noreferrer');
  assert.match(await button.getAttribute('aria-label'),/مس صوفيا.*واتساب/);
  const rect=await button.boundingBox();
  assert.ok(rect&&rect.width>=44&&rect.height>=44,'mobile touch size');
  assert.ok(rect.x>=0&&rect.x+rect.width<=width+2,'WhatsApp card inside '+width+'px viewport');
  const scrollWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
  assert.ok(scrollWidth<=width+2,'no horizontal viewport overflow at '+width+'px');
  const footer=page.locator('.sofia-footer-wa-link');
  assert.equal(await footer.getAttribute('href'),WHATSAPP_CONTACT_URL,'same contact in footer');
  assert.match(await footer.innerText(),/01027661546/);
  const call=page.locator('.sofia-footer-note a[href^="tel:"]');
  assert.equal(await call.getAttribute('href'),'tel:+201027661546','telephone link uses the new number');
  assert.match(await call.innerText(),/01027661546/,'visible footer number matches owner-approved WhatsApp line');
  assert.equal(await page.getByText('01027662546').count(),0,'obsolete support phone must not appear to visitors');
  if(width===390||width===1366){
   await page.screenshot({path:path.join(output,'whatsapp-home-'+width+'.png'),animations:'disabled'});
  }
  await footer.scrollIntoViewIfNeeded();
  await page.locator('.sofia-wa-contact').waitFor({state:'hidden',timeout:8000});
  assert.equal(await footer.getAttribute('target'),'_blank');
  // Contact must remain available in auth flow for a parent.
  await page.goto(origin+'/login',{waitUntil:'domcontentloaded'});
  await page.locator('.sofia-wa-contact-link').waitFor({state:'visible',timeout:13000});
  assert.equal(await page.locator('.sofia-wa-contact-link').getAttribute('href'),WHATSAPP_CONTACT_URL);
  // Critically, never obscure a live class with the floating contact widget.
  await page.goto(origin+'/lesson/isolated-qa',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(150);
  assert.equal(await page.locator('.sofia-wa-contact').count(),0);
  assert.equal(await page.locator('.sofia-footer-wa-link').count(),0);
  assert.deepEqual(errors,[],'no unhandled UI errors on '+width+'px');
  console.log('PASS responsive WhatsApp link, protected classroom exclusion, and footer handoff at '+width+'px');
  await context.close();
 }
 console.log('PASS premium instant WhatsApp click-to-chat UI on mobile/desktop without outside requests');
}finally{
 await browser?.close().catch(()=>{});
 server.kill();
 await Promise.race([new Promise(r=>server.once('exit',r)),pause(2000)]);
}
