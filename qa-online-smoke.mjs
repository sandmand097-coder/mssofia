import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const origin='https://mssofia.onrender.com';
const errors=[];
const health=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(90000)});
assert.equal(health.status,200);
const status=await health.json();
assert.ok(status.ok&&status.mode==='preview','public Render API serves safe preview mode');
assert.equal(status.videoConfigured,false,'cloud video remains closed to pupils until full launch');
assert.equal(status.videoCloudReady,true,'LiveKit Cloud credentials are configured server-side');
console.log('PASS PUBLIC HEALTH '+JSON.stringify(status));
const register=await fetch(origin+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
assert.equal(register.status,503);
console.log('PASS public registration API disabled until production email/provider ready');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 const desktop=await browser.newPage({viewport:{width:1366,height:850},locale:'ar-EG'});
 desktop.on('pageerror',e=>errors.push('desktop '+e.message));
 await desktop.goto(origin,{waitUntil:'networkidle',timeout:65000});
 await desktop.getByRole('heading',{name:/العلوم مش حفظ/}).waitFor({timeout:16000});
 await desktop.getByText('100',{exact:false}).first().waitFor();
 await desktop.getByText('170 جنيه',{exact:false}).first().waitFor();
 await desktop.screenshot({path:'mssofia-render-desktop.png',fullPage:true});
 console.log('PASS public homepage and introductory prices');
 await desktop.goto(origin+'/login',{waitUntil:'networkidle'});
 await desktop.getByRole('heading',{name:'التسجيل هيفتح قريبًا'}).waitFor({timeout:10000});
 await desktop.goto(origin+'/register',{waitUntil:'networkidle'});
 await desktop.getByRole('heading',{name:'التسجيل هيفتح قريبًا'}).waitFor({timeout:10000});
 console.log('PASS login/register routes safely closed to public');
 for(const [route,heading] of [['/privacy','الخصوصية وحماية الطلاب'],['/terms','شروط الدراسة والاشتراك']]){
  await desktop.goto(origin+route,{waitUntil:'networkidle'});
  await desktop.getByRole('heading',{name:heading}).waitFor({timeout:10000});
  console.log('PASS public policy route '+route);
 }
 const mobile=await browser.newPage({viewport:{width:390,height:844},locale:'ar-EG'});
 mobile.on('pageerror',e=>errors.push('mobile '+e.message));
 await mobile.goto(origin,{waitUntil:'networkidle'});
 await mobile.getByText('100',{exact:false}).first().waitFor();
 const scroll=await mobile.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
 assert.ok(scroll.document<=scroll.viewport+2,'no mobile horizontal scrolling '+JSON.stringify(scroll));
 await mobile.screenshot({path:'mssofia-render-mobile.png',fullPage:true});
 console.log('PASS Render website mobile-responsive '+JSON.stringify(scroll));
 assert.deepEqual(errors,[]);
 console.log('RESULT public Render end-to-end browser smoke test passed');
}finally{await browser.close()}
