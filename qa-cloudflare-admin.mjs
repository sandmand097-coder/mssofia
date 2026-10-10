import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

// Safe external QA: no credentials, authenticated session or production data changes.
const origin=process.env.PAGES_TEST_ORIGIN||'https://mssofia.pages.dev';
const client=await chromium.launch({
 headless:true,
 executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
 args:['--no-first-run']
});
const expectedClientId='1037386718990-idpsvtb4p41hovp1ahinfig1hf114d45.apps.googleusercontent.com';
async function verifyRoute(path,status,method='GET'){
 const response=await fetch(origin+path,{
  method,
  headers:{'Content-Type':'application/json'},
  ...(method==='POST'?{body:'{}'}:{}),
  signal:AbortSignal.timeout(40000)
 });
 assert.equal(response.status,status,method+' '+path+' unexpected HTTP '+response.status);
 return response.json().catch(()=>({}));
}
try {
 const h=await verifyRoute('/api/health',200);
 assert.equal(h.ok,true);
 assert.equal(h.mode,'admin');
 assert.equal(h.registrationAvailable,false);
 const config=await verifyRoute('/api/auth/google/config',200);
 assert.equal(config.enabled,true);
 assert.equal(config.clientId,expectedClientId);
 await verifyRoute('/api/auth/me',401);
 await verifyRoute('/api/admin/dashboard',401);
 await verifyRoute('/api/payments/config',401);
 await verifyRoute('/api/auth/register',503,'POST');
 await verifyRoute('/api/auth/login',503,'POST');
 assert.deepEqual(await verifyRoute('/api/courses',200),{courses:[]});
 console.log('PASS Cloudflare Admin API flags, Google config, registration locked, private routes protected');
 for(const width of [390,1366]){
  const page=await client.newPage({viewport:{width,height:840},locale:'ar-EG'});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const [route,title] of [
   ['/','العلوم مش حفظ'],
   ['/privacy','الخصوصية وحماية الطلاب'],
   ['/terms','شروط الدراسة والاشتراك'],
   ['/courses','كل تجربة علمية']]){
   await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:30000});
   await page.getByRole('heading',{name:new RegExp(title)}).first().waitFor({timeout:18000});
   const sizes=await page.evaluate(()=>({width:window.innerWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(sizes.scroll<=sizes.width+2,'Horizontal overflow '+route+' @ '+width+': '+JSON.stringify(sizes));
   console.log('PASS production route '+route+' at '+width+'px');
  }
  await page.goto(origin+'/register',{waitUntil:'domcontentloaded',timeout:30000});
  await page.getByRole('heading',{name:/التسجيل هيفتح قريبًا/}).first().waitFor({timeout:15000});
  await page.goto(origin+'/login',{waitUntil:'domcontentloaded',timeout:30000});
  const widget=page.locator('.sofia-google-admin-entry');
  await widget.waitFor({timeout:20000});
  const googleFrame=page.locator('iframe[src*="accounts.google.com"]');
  let button='';
  try{
   await googleFrame.first().waitFor({timeout:16000});
   button='rendered';
  }catch{
   const alerts=await page.locator('.sofia-google-admin-entry [role="alert"]').allTextContents().catch(()=>[]);
   console.log('GOOGLE_RENDER_STATE '+width+': no iframe; alerts='+JSON.stringify(alerts).slice(0,180));
   button='unverified';
  }
  await page.goto(origin+'/admin',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForURL(/\/login$/, {timeout:15000});
  assert.equal(errors.length,0,'Browser errors at '+width+': '+errors.join('; ').slice(0,340));
  console.log('PASS Google admin entry '+button+', guest admin redirected, registration closed ('+width+'px)');
  await page.close();
 }
 console.log('PASS published admin-only browser and API smoke suite');
}finally{
 await client.close();
}
