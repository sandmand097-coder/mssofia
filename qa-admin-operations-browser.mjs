// Read-only browser QA for the administrator's operational workflow.
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
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser;
try{
 let ready=false;
 for(let i=0;i<85;i++){try{if((await fetch(origin+'/')).ok){ready=true;break}}catch{}await wait(100)}
 assert.ok(ready);
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 for(const width of [390,1366]){
  const page=await browser.newPage({viewport:{width,height:850},locale:'ar-EG'});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',route=>{
   const pathname=new URL(route.request().url()).pathname;
   const reply=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(pathname==='/api/health')return reply(200,{ok:true,mode:'admin',registrationAvailable:false});
   if(pathname==='/api/auth/me')return reply(200,{user:{id:'admin-1',name:'Miss Sofia',email:'admin@example.com',role:'admin',status:'active'}});
   if(pathname==='/api/admin/dashboard')return reply(200,{statistics:{students:0,teachers:0,courses:0,pendingBookings:0},latestUsers:[],upcomingLessons:[],pendingBookings:[],registrationTrend:[]});
   if(pathname==='/api/my/overview')return reply(200,{courses:[],bookings:[{id:'paid-1',status:'pending',student_name:'طالب حجز مدفوع',course_title:'علوم مدفوعة',course_price:170,payment_status:'pending'},{id:'free-1',status:'pending',student_name:'طالب حجز مجاني',course_title:'حصة مجانية',course_price:0}],lessons:[],stats:{courses:0,bookings:2,upcoming:0}});
   if(pathname==='/api/admin/users')return reply(200,{users:[]});
   if(pathname==='/api/admin/payments')return reply(200,{payments:[]});
   if(pathname==='/api/admin/payments/without-proof')return reply(200,{bookings:[{booking_id:'paid-1',student_name:'طالب حجز مدفوع',course_title:'علوم مدفوعة',amount_egp:100}]});
   if(pathname==='/api/admin/renewals')return reply(200,{enabled:true,renewals:[]});
   if(pathname==='/api/admin/renewals/without-proof')return reply(200,{enabled:true,bookings:[]});
   if(pathname==='/api/admin/bookings/paid-1/manual-payment'&&route.request().method()==='POST')return reply(201,{ok:true,amount_egp:100});
   if(pathname==='/api/admin/dependencies')return reply(200,{checkedAt:new Date().toISOString(),databaseConnected:true,livekitApiVerified:true,receiptBucketPrivateVerified:false,mailDeliveryTested:false});
   if(pathname==='/api/admin/setup-status')return reply(200,{
    launchMode:'admin',adminGoogleEnabled:true,studentGoogleEnabled:false,studentGoogleRegistrationEnabled:false,
    guardianPrivacyApproved:false,registrationAllowedBySchool:false,schoolContactConfigured:false,
    outboundMailConfigured:false,paymentWalletConfigured:true,privateReceiptStorageConfigured:false,
    paymentUploadConfigured:false,livekitCredentialsConfigured:true
   });
   return reply(503,{error:'unmocked test endpoint'});
  });
  await page.goto(origin+'/admin',{waitUntil:'domcontentloaded'});
  const menu=page.getByRole('button',{name:'دليل التشغيل',exact:true});
  await menu.waitFor({timeout:15000});
  await menu.click();
  await page.getByRole('heading',{name:'خريطة تشغيل مُدرِّسة Miss Sofia'}).waitFor({timeout:15000});
  await page.getByText('٦. راجعي تحويل فودافون كاش').waitFor();
  await page.getByRole('heading',{name:'التحقق من التجهيز للإطلاق العام'}).waitFor();
  await page.getByRole('heading',{name:'اختبار الخدمات الفعلي'}).waitFor();
  await page.getByText('اتصال قاعدة بيانات الطلاب والمديرة').waitFor();
  await page.getByRole('button',{name:'الحجوزات',exact:true}).click();
  const paid=page.locator('.portal-list-item').filter({hasText:'طالب حجز مدفوع'});
  const free=page.locator('.portal-list-item').filter({hasText:'طالب حجز مجاني'});
  await paid.getByRole('button',{name:'مراجعة التحويل أولًا'}).waitFor({timeout:7000});
  assert.equal(await paid.getByRole('button',{name:/قبول الحجز المجاني/}).count(),0,'paid course cannot be approved from booking list');
  await free.getByRole('button',{name:'قبول الحجز المجاني'}).waitFor({timeout:7000});
  await page.getByRole('button',{name:'تحويلات فودافون كاش',exact:true}).click();
  const manual=page.getByRole('region',{name:'اعتماد تحويل وصل دون إيصال'});
  await manual.getByRole('heading',{name:'اعتماد دفع بدون صورة إيصال'}).waitFor();
  const submit=manual.getByRole('button',{name:/اعتماد التحويل يدويًا/});
  assert.equal(await submit.isDisabled(),true,'manual payment requires verification');
  await manual.getByRole('combobox',{name:'الطالب والحجز'}).selectOption('paid-1');
  await manual.getByRole('textbox',{name:'رقم فودافون كاش الذي أرسل التحويل'}).fill('01012345678');
  await manual.getByRole('textbox',{name:'رقم العملية الفعلي من فودافون كاش'}).fill('VFCASH-TEST-101');
  await manual.getByRole('spinbutton',{name:'المبلغ الذي وصل للمحفظة (جنيه)'}).fill('100');
  await manual.getByRole('checkbox',{name:/أؤكد بصفتي المديرة/}).check();
  assert.equal(await submit.isEnabled(),true,'director can approve only after completing all fields');
  await submit.click();
  await page.getByText(/تم اعتماد تحويل طالب حجز مدفوع/).waitFor();
  const pixel=await page.evaluate(()=>({view:window.innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(pixel.scroll<=pixel.view+2,'horizontal overflow in admin operations '+width);
  assert.deepEqual(errors,[],'no browser errors in admin operations');
  console.log('PASS director course/live/payment workflow guide and readiness indicators at '+width+'px');
  await page.close();
 }
 console.log('PASS administrator operations browser QA');
}finally{
 if(browser)await browser.close();
 vite.kill();
 await Promise.race([new Promise(resolve=>vite.once('exit',resolve)),wait(1200)]);
}
