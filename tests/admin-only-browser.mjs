import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-first-run']});
const origin='http://127.0.0.1:5173';
try{
 for(const width of [390,1366]){
  const page=await browser.newPage({viewport:{width,height:860},locale:'ar-EG'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/health',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,mode:'admin'})}));
  await page.route('**/api/auth/me',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'not logged in'})}));
  await page.route('**/api/auth/google/config',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(width===1366?{enabled:true,clientId:'test-admin.apps.googleusercontent.com'}:{enabled:false})}));
  await page.route('https://accounts.google.com/gsi/client',route=>route.fulfill({status:200,contentType:'application/javascript',body:"window.google={accounts:{id:{initialize(){},renderButton(node){const button=document.createElement('button');button.textContent='Google Sign In';node.append(button)}}}}"}));
  await page.goto(origin+'/login',{waitUntil:'networkidle',timeout:20000});
  await page.getByRole('heading',{name:'دخول مديرة مدرسة Mrs Sofia'}).waitFor({timeout:10000});
  assert.equal(await page.locator('input[type=password]').count(),0,'admin-only page does not offer legacy passwords');
  if(width===1366)await page.getByRole('button',{name:'Google Sign In'}).waitFor({state:'visible'});
  if(width<=680){
   await page.getByRole('button',{name:'فتح القائمة'}).click();
   await page.getByRole('link',{name:'دخول مديرة المدرسة'}).waitFor({state:'visible'});
  }else{
   assert.equal(await page.getByRole('link',{name:'دخول المديرة'}).count(),1,'desktop exposes administrator login');
  }
  const layout=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(layout.scroll<=layout.viewport+2,'no overflow '+width);
  await page.goto(origin+'/register',{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'التسجيل هيفتح قريبًا'}).waitFor();
  assert.deepEqual(errors,[],'no browser page errors');
  console.log('PASS administrator-only responsive UI '+width+'px, student registration blocked');
  await page.close();
 }
}finally{await browser.close()}
