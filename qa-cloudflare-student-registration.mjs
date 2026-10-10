// Read-only production QA: no real child accounts are created and no payments
// are initiated. Google API configuration and guardian-consent UI are verified.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const origin=process.env.PAGES_TEST_ORIGIN||'https://mssofia.pages.dev';
const fetchJson=async(path,{method='GET',body}={})=>{
 const response=await fetch(origin+path,{
  method,cache:'no-store',
  headers:{'Accept':'application/json',...(body?{'Content-Type':'application/json'}:{})},
  body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)
 });
 let data={};try{data=await response.json()}catch{}
 return{status:response.status,data};
};
const health=await fetchJson('/api/health');
assert.equal(health.status,200,'site must respond');
assert.equal(health.data.mode,'full','student registration must be in full launch mode');
assert.equal(health.data.registrationAvailable,true,'guardian Google registration must be available');

const google=await fetchJson('/api/auth/google/config');
assert.equal(google.status,200);
assert.equal(google.data.enabled,true);
assert.equal(google.data.studentEnabled,true);
assert.equal(google.data.studentRegistrationAvailable,true);
assert.ok(google.data.clientId?.endsWith('.apps.googleusercontent.com'));
const status=await fetchJson('/api/auth/registration-status');
assert.equal(status.status,200);
assert.equal(status.data.registrationAvailable,true);
assert.equal(status.data.googleRegistrationAvailable,true);
assert.equal(status.data.emailRegistrationAvailable,false,'unverified outbound email must not allow password signup');

const email=await fetchJson('/api/auth/register',{method:'POST',body:{role:'student',name:'Test Account',email:'noreply@example.test',password:'temporary-test-only'}});
assert.equal(email.status,503,'unsafe password enrollment must stay blocked');
const privateStudent=await fetchJson('/api/my/overview');
assert.equal(privateStudent.status,401,'guest cannot read student records');
const privateAdmin=await fetchJson('/api/admin/dashboard');
assert.equal(privateAdmin.status,401,'guest cannot read administrator records');
const wallet=await fetchJson('/api/payments/config');
assert.equal(wallet.status,401,'guest cannot fetch any private payment configuration');
const badGoogle=await fetchJson('/api/auth/google/login',{method:'POST',body:{credential:'not-a-verified-id-token'}});
assert.ok([400,401].includes(badGoogle.status),'invalid Google credential rejected without creating account');

let browser;try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 for(const width of [390,1366]){
  const page=await browser.newPage({viewport:{width,height:900},locale:'ar-EG'});
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.goto(origin+'/register',{waitUntil:'domcontentloaded',timeout:45000});
  await page.getByRole('heading',{name:/ابدأ رحلة طفلك/}).waitFor({timeout:45000});
  await page.locator('.sofia-guardian-name input').waitFor({timeout:15000});
  const note=page.getByText('حسابات الطلاب والمدفوعات لم تُفتح بعد');
  assert.equal(await note.count(),0,'stale green admin-only banner must be removed');
  await page.getByText('١. بيانات الطالب وموافقة ولي الأمر').waitFor();
  await page.getByText('تسجيل الطالب باستخدام حساب ولي الأمر Google').waitFor({timeout:15000});
  assert.equal(await page.locator('form.sofia-guardian-email-form').count(),0,'password signup remains off until real email delivery');
  const check=page.locator('.sofia-guardian-signup .sofia-consent input');
  assert.equal(await check.isChecked(),false,'guardian consent never preselected');
  await page.getByRole('link',{name:'سياسة الخصوصية'}).first().waitFor();
  const layout=await page.evaluate(()=>({screen:window.innerWidth,page:document.documentElement.scrollWidth}));
  assert.ok(layout.page<=layout.screen+2,'no horizontal overflow at '+width+'px');
  assert.deepEqual(errors,[],'browser errors: '+errors.join('; '));
  await page.close();
  console.log('PASS live guardian registration and absent obsolete banner at '+width+'px');
 }
 console.log('PASS public Google signup, parent privacy consent, auth isolation and disabled payment/email');
}finally{if(browser)await browser.close()}
