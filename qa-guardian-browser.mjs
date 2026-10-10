// Browser-only Google Identity UI contract. Google tokens are mocked;
// production Google signature verification is deliberately not bypassed.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import net from 'node:net';
import {chromium} from 'playwright-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const port=await new Promise((resolve,reject)=>{
 const server=net.createServer().once('error',reject);
 server.listen(0,'127.0.0.1',()=>{
  const n=server.address().port;server.close(()=>resolve(n));
 });
});
const origin='http://127.0.0.1:'+port;
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,windowsHide:true});
let browser;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
 let up=false;
 for(let i=0;i<90;i++){try{const r=await fetch(origin+'/');if(r.ok){up=true;break}}catch{}await wait(120)}
 assert.ok(up,'Vite preview did not start');
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 for(const width of [390,1366]){
  const page=await browser.newPage({viewport:{width,height:900},locale:'ar-EG'});
  const errors=[],submissions=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://accounts.google.com/gsi/client',async route=>{
   await route.fulfill({contentType:'application/javascript',body:"window.google={accounts:{id:{initialize(settings){this.handler=settings.callback},renderButton(el){const b=document.createElement('button');b.type='button';b.textContent='Google test button';b.setAttribute('data-qa-google','ready');b.onclick=()=>this.handler({credential:'ui-test-mocked-credential'});el.appendChild(b)}}}};"});
  });
  await page.route('**/api/**',async route=>{
   const request=route.request(),pathname=new URL(request.url()).pathname;
   const method=request.method();
   const reply=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(pathname==='/api/health')return reply(200,{ok:true,mode:'full',registrationAvailable:true});
   if(pathname==='/api/auth/me')return reply(401,{error:'not signed in'});
   if(pathname==='/api/auth/registration-status')return reply(200,{registrationAvailable:true,emailRegistrationAvailable:false,googleRegistrationAvailable:true,emailMode:'disabled'});
   if(pathname==='/api/auth/google/config')return reply(200,{enabled:true,clientId:'ui-test-client.apps.googleusercontent.com',studentEnabled:true,studentRegistrationAvailable:true});
   if(pathname==='/api/auth/google/login'&&method==='POST'){
    const body=request.postDataJSON();submissions.push(body);
    return reply(200,{user:{id:'student-1',role:'student',name:'طالب العلوم',email:'parent@example.com',status:'active'}});
   }
   if(pathname==='/api/courses')return reply(200,{courses:[]});
   if(pathname==='/api/my/overview')return reply(200,{courses:[],bookings:[],lessons:[],stats:{courses:0,bookings:0,upcoming:0}});
   if(pathname==='/api/student/dashboard')return reply(200,{learning:[],attendedLessonIds:[]});
   return reply(403,{error:'test route not in allowlist'});
  });
  await page.goto(origin+'/register',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:/ابدأ رحلة طفلك/}).waitFor({timeout:12000});
  const initial=page.locator('.sofia-google-signin-mount button[data-qa-google="ready"]');
  assert.equal(await initial.count(),0,'Guardian Google widget must wait for consent');
  await page.locator('.sofia-guardian-name input').fill('طالب العلوم');
  await page.locator('.sofia-guardian-signup .sofia-consent input').check();
  await initial.waitFor({timeout:12000});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(overflow<=2,'No horizontal overflow at '+width);
  await initial.click();
  await page.waitForURL(/\/student$/, {timeout:13000});
  assert.equal(submissions.length,1);
  assert.equal(submissions[0].register_student,true);
  assert.equal(submissions[0].student_name,'طالب العلوم');
  assert.equal(submissions[0].guardian_consent,true);
  assert.equal(errors.length,0,'No browser runtime errors at '+width+': '+errors.join('; '));
  console.log('PASS guardian Google new-student UI, consent and redirect at '+width+'px');
  await page.close();
 }
 console.log('PASS guardian Google UI mock and accessibility smoke test');
}finally{
 if(browser)await browser.close();
 vite.kill();
 await Promise.race([new Promise(resolve=>vite.once('exit',resolve)),wait(1500)]);
}
