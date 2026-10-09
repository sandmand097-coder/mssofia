// Real end-to-end local test: email signup -> verification -> school admin approves enrollment.
// Works with a temporary copy of the database and never creates actual pupil accounts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync,backup} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const home=path.join(os.homedir(),'Documents');
const secrets=path.join(home,'mrssofia-local-tools');
const files=fs.readdirSync(secrets).filter(x=>/^private-mrsofia-admin-\d+\.txt$/.test(x)).sort().reverse();
assert.ok(files.length>0,'Bootstrap Mrs Sofia admin locally first');
const credential=fs.readFileSync(path.join(secrets,files[0]),'utf8');
const email=credential.match(/Email:\s*(.+)/)?.[1]?.trim();
const password=credential.match(/Temporary password:\s*(.+)/)?.[1]?.trim();
assert.ok(email&&password);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mrsofia-account-e2e-'));
const file=path.join(tmp,'test.sqlite'),mailbox=path.join(tmp,'mail');
const source=new DatabaseSync(path.join(root,'data','education.sqlite'),{readOnly:true});
await backup(source,file);source.close();fs.mkdirSync(mailbox);
const base='http://127.0.0.1:4099';
let logs='',proc,browser;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function login(page,username,pass,target){
 await page.goto(base+'/login',{waitUntil:'networkidle'});
 await page.locator('input[type=email]').fill(username);
 await page.locator('input[type=password]').fill(pass);
 await page.locator('button[type=submit]').click();
 await page.waitForURL('**'+target,{timeout:15000});
}
try{
 proc=spawn(process.execPath,['--env-file=.env','server/index.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'4099',NODE_ENV:'development',DATABASE_URL:'',APP_ORIGIN:base,MADRASATI_DB_PATH:file,TEST_EMAIL_CAPTURE_DIR:mailbox}});
 proc.stdout.on('data',d=>logs+=d.toString());proc.stderr.on('data',d=>logs+=d.toString());
 let started=false;for(let i=0;i<100;i++){await pause(120);if(proc.exitCode!==null)throw Error('Sandbox exited unexpectedly');try{if((await fetch(base+'/api/health',{signal:AbortSignal.timeout(600)})).ok){started=true;break}}catch{}}
 assert.ok(started,'isolated website starts');
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-first-run']});
 const student=await browser.newPage({viewport:{width:390,height:850},locale:'ar-EG'});
 const address='science-'+randomUUID().slice(0,8)+'@example.com',studentPass='safe-'+randomUUID().replace(/-/g,'');
 await student.goto(base+'/register',{waitUntil:'networkidle'});
 await student.getByRole('heading',{name:'ابدأ رحلتك مع Mrs Sofia'}).waitFor();
 await student.locator('input[autocomplete=name]').fill('طالبة تجريبية');
 await student.locator('input[autocomplete=email]').fill(address);
 await student.locator('input[autocomplete="new-password"]').fill(studentPass);
 await student.locator('input[type=checkbox]').check();
 await student.getByRole('button',{name:/إنشاء حساب الطالب/}).click();
 await student.getByRole('status').getByText(/تم إرسال رابط تفعيل/).waitFor();
 console.log('PASS student email registration form');
 const messages=fs.readdirSync(mailbox).filter(x=>x.endsWith('-verify_email.txt'));
 assert.equal(messages.length,1,'one verification email');
 const content=fs.readFileSync(path.join(mailbox,messages[0]),'utf8');
 const url=content.match(/http:\/\/127\.0\.0\.1:4099\/verify-email\?token=[a-f0-9]{64}/)?.[0];
 assert.ok(url);
 await student.goto(url,{waitUntil:'networkidle'});
 await student.getByText('تم تأكيد البريد وتفعيل حسابك بنجاح.').waitFor({timeout:13000});
 await login(student,address,studentPass,'/student');
 console.log('PASS email verification and student dashboard');
 const science=await (await student.request.get(base+'/api/courses')).json();
 const course=science.courses.find(c=>c.subject==='علوم'&&c.capacity>c.enrolled);
 assert.ok(course,'needs available science course in local copy');
 const booking=await student.request.post(base+'/api/courses/'+course.id+'/book',{data:{}});
 assert.equal(booking.status(),201);
 console.log('PASS student booked science course (pending admin approval)');
 const admin=await browser.newPage({viewport:{width:1366,height:920},locale:'ar-EG'});
 await login(admin,email,password,'/admin');
 await admin.getByText('أهلاً يا Mrs Sofia — مديرة المدرسة').waitFor();
 await admin.getByRole('navigation',{name:'قائمة الإدارة'}).getByRole('button',{name:/الحجوزات/}).click();
 await admin.getByText('طلبات الطلاب للانضمام').waitFor();
 const nameLine=admin.locator('.portal-list-item').filter({hasText:'طالبة تجريبية'}).first();
 await nameLine.getByRole('button',{name:'قبول'}).click();
 await nameLine.getByText('مقبول').waitFor();
 console.log('PASS school admin approves student course');
 await admin.getByRole('navigation',{name:'قائمة الإدارة'}).getByRole('button',{name:/الدورات/}).click();
 await admin.getByRole('button',{name:'دورة جديدة'}).click();
 await admin.locator('.portal-modal input').first().fill('تجربة مع Mrs Sofia');
 await admin.locator('.portal-modal textarea').fill('دورة من مديرة المدرسة لاختبار البث');
 const selector=admin.locator('.portal-modal select');
 await selector.selectOption({label:'Mrs Sofia - مدرسة العلوم'});
 await admin.locator('.portal-modal button[type=submit]').click();
 await admin.getByText('تجربة مع Mrs Sofia').waitFor();
 console.log('PASS principal teacher creates science course under her own account');
 const dim=await student.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(dim.scroll<=dim.viewport+2);
 await admin.screenshot({path:path.join(root,'mrsofia-admin-ready.png'),fullPage:true});
 await student.screenshot({path:path.join(root,'mrsofia-student-verified.png'),fullPage:true});
 console.log('PASS responsive registration/admin workflow');
}finally{
 if(browser)await browser.close().catch(()=>{});
 if(proc){proc.kill();await Promise.race([new Promise(r=>proc.once('exit',r)),pause(4000)])}
 try{fs.rmSync(tmp,{recursive:true,force:true,maxRetries:8,retryDelay:100})}catch{}
}
