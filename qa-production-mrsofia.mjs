import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const root='http://127.0.0.1:4099';
const env=Object.fromEntries(fs.readFileSync(new URL('./.env',import.meta.url),'utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)]}));
const errors=[];
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-first-run']});
async function page(width=1366){
 const p=await browser.newPage({viewport:{width,height:900},locale:'ar-EG'});
 p.on('pageerror',e=>errors.push(e.message));return p;
}
try{
 const home=await page();
 const response=await home.goto(root+'/',{waitUntil:'networkidle'});
 assert.equal(response.status(),200);
 await home.getByRole('heading',{level:1,name:/العلوم مش حفظ/}).waitFor();
 assert.match(await home.title(),/mrsofia/);
 const favicon=await home.request.get(root+'/favicon.svg');
 assert.equal(favicon.status(),200);
 await home.locator('.sofia-course-card').first().waitFor();
 console.log('PASS compiled production homepage and assets');
 await home.goto(root+'/courses',{waitUntil:'networkidle'});
 await home.locator('.sofia-course-card').first().waitFor();
 console.log('PASS compiled production catalog');
 const accounts=[
 ['ADMIN',env.ADMIN_EMAIL,env.ADMIN_PASSWORD,'/admin','.portal-admin'],
 ['TEACHER',env.DEMO_TEACHER_EMAIL,env.DEMO_TEACHER_PASSWORD,'/teacher','.portal-teacher'],
 ['STUDENT',env.DEMO_STUDENT_EMAIL,env.DEMO_STUDENT_PASSWORD,'/student','.portal-student']
 ];
 for(const [role,email,password,target,selector] of accounts){
  const p=await page(role==='STUDENT'?390:1366);
  await p.goto(root+'/login',{waitUntil:'networkidle'});
  await p.locator('input[type=email]').fill(email);
  await p.locator('input[type=password]').fill(password);
  await p.locator('button[type=submit]').click();
  await p.waitForURL('**'+target,{timeout:12000});
  await p.locator(selector).waitFor({timeout:12000});
  console.log('PASS compiled production '+role+' dashboard');
  const dims=await p.evaluate(()=>({view:innerWidth,document:document.documentElement.scrollWidth}));
  assert.ok(dims.document<=dims.view+2,role+' document overflow');
  await p.close();
 }
 const unauth=await page();
 await unauth.goto(root+'/admin',{waitUntil:'networkidle'});
 await unauth.waitForURL('**/login',{timeout:12000});
 console.log('PASS unauthenticated administrator page redirects');
 if(errors.length)throw Error(errors.join('; '));
 console.log('PASS production bundle cross-role and browser JavaScript checks');
}finally{await browser.close()}
