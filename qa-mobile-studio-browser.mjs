// Isolated touch-screen browser UI check. This does NOT join a real LiveKit room
// or read/modify any production learner record.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import net from 'node:net';
import {chromium} from 'playwright-core';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=await new Promise((resolve,reject)=>{
 const s=net.createServer().once('error',reject);
 s.listen(0,'127.0.0.1',()=>{const v=s.address().port;s.close(()=>resolve(v))});
});
const origin='http://127.0.0.1:'+port;
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,windowsHide:true,env:{...process.env,NODE_ENV:'test'}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
try{
 let ready=false;
 for(let i=0;i<100;i++){try{if((await fetch(origin)).ok){ready=true;break}}catch{}await sleep(150)}
 assert.ok(ready,'Vite dev server failed');
 browser=await chromium.launch({headless:true,...(process.platform==='win32'?{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}:{}),args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,locale:'ar-EG',permissions:['camera','microphone']});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url());
  const respond=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(url.pathname==='/api/auth/me')return respond(200,{user:{id:'test-teacher',name:'Teacher test',role:'admin',status:'active',email:'test@example.invalid'}});
  if(url.pathname==='/api/health')return respond(200,{ok:true,mode:'full',registrationAvailable:false});
  if(url.pathname==='/api/courses')return respond(200,{courses:[]});
  if(url.pathname==='/api/lessons/mobile-studio-test/classroom')return respond(200,{duration_minutes:60,ends_at:new Date(Date.now()+3600000).toISOString(),hands:[],speakers:[],maxActiveSpeakers:6,handRaised:false});
  return respond(403,{error:'API blocked in isolated phone test'});
 });
 await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
 await page.evaluate(async()=>{
  const {mountRoomSandbox}=await import('/src/qa/RoomSandbox.jsx');
  mountRoomSandbox('mobile-studio-test',true);
 });
 const studio=page.locator('#mrsofia-room-smoke');
 await studio.locator('.sofia-meeting.mobile-host').waitFor({timeout:15000});
 await studio.getByRole('button',{name:'البدء بالصوت فقط'}).waitFor();
 await studio.getByRole('button',{name:'ابدئي البث الآن'}).waitFor();
 await studio.getByRole('button',{name:'الكاميرا الخلفية'}).waitFor();
 await studio.getByText(/استوديو الهاتف/).waitFor();
 const share=await page.evaluate(()=>typeof navigator.mediaDevices?.getDisplayMedia==='function');
 assert.equal(await studio.getByRole('button',{name:'مشاركة الشاشة'}).count(),share?1:0,'screen sharing offered only when supported');
 const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(overflow.scroll<=overflow.width+2,'no horizontal overflow: '+JSON.stringify(overflow));
 assert.deepEqual(errors,[],'phone studio JS errors');
 console.log('PASS mobile host controls and safe capability behavior at 390px (disconnected harness)');
 await context.close();
}finally{
 await browser?.close();
 vite.kill();
 await Promise.race([new Promise(r=>vite.once('exit',r)),sleep(2000)]);
}
