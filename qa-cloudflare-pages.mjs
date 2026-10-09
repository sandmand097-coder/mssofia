import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const origin=process.env.PAGES_TEST_ORIGIN||'http://127.0.0.1:8798';
const client=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-first-run']});
try{
 const healthStart=Date.now();
 const health=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(8000)});
 const info=await health.json();
 assert.equal(health.status,200);
 assert.equal(info.mode,'preview');
 assert.ok(Date.now()-healthStart<8000,'health served immediately without Render');
 assert.equal((await fetch(origin+'/api/auth/me')).status,401);
 assert.equal((await fetch(origin+'/api/auth/google/config')).status,200);
 assert.equal((await fetch(origin+'/api/admin/payments')).status,503);
 console.log('PASS Pages edge API 200 health, protected endpoints, no backend required');
 for(const width of [390,1366]){
  const page=await client.newPage({viewport:{width,height:840},locale:'ar-EG'});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const [route,label] of [
   ['/','العلوم مش حفظ'],
   ['/privacy','الخصوصية وحماية الطلاب'],
   ['/terms','شروط الدراسة والاشتراك'],
   ['/courses','كل تجربة علمية']]){
   await page.goto(origin+route,{waitUntil:'networkidle',timeout:20000});
   await page.getByRole('heading',{name:new RegExp(label)}).first().waitFor({timeout:12000});
   const bounds=await page.evaluate(()=>({viewport:window.innerWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(bounds.scroll<=bounds.viewport+2,'No horizontal scroll on '+route+' at '+width);
   console.log('PASS '+route+' '+width+'px with static Pages SPA fallback');
  }
  await page.goto(origin+'/login',{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:/التسجيل هيفتح قريبًا/}).waitFor({timeout:12000});
  assert.equal(errors.length,0,'No browser runtime errors at width '+width);
  console.log('PASS protected login 390/desktop equivalent '+width);
  await page.close();
 }
 console.log('PASS Cloudflare Pages static SPA and Functions smoke test completed');
}finally{await client.close()}
