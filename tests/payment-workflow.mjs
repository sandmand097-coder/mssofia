import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mssofia-payment-'));
process.env.MADRASATI_DB_PATH=path.join(temp,'payment.sqlite');
const {db,run,get,uid,now}=await import('../server/db.js');
const pass=randomBytes(17).toString('hex'),hash=bcrypt.hashSync(pass,10);
const add=(role)=>{const id=uid(),email=role+id.slice(0,7)+'@test.local';run('INSERT INTO users(id,name,email,password_hash,role,status,created_at,email_verified_at) VALUES(?,?,?,?,?,?,?,?)',id,role,email,hash,role,'active',now(),now());return {id,email}};
const admin=add('admin'),student=add('student'),other=add('student');
const course=uid(),booking=uid(),otherBooking=uid();
run('INSERT INTO courses(id,title,description,subject,level,price,duration_minutes,capacity,teacher_id,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',course,'علوم شهر أول','شرح مباشر','علوم','الابتدائي',170,60,5,admin.id,'published',now());
for(const [id,studentId] of [[booking,student.id],[otherBooking,other.id]])run('INSERT INTO bookings(id,course_id,student_id,status,created_at) VALUES(?,?,?,?,?)',id,course,studentId,'pending',now());
db.close();
const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})});
const base='http://127.0.0.1:'+port+'/api';
const app=spawn(process.execPath,['server/index.js'],{cwd:root,windowsHide:true,env:{...process.env,NODE_ENV:'development',PORT:String(port),JWT_SECRET:randomBytes(48).toString('hex'),APP_ORIGIN:'http://127.0.0.1:'+port,TEST_PAYMENT_UPLOAD_DIR:path.join(temp,'proofs'),TEST_EMAIL_CAPTURE_DIR:path.join(temp,'emails'),SCHOOL_ADMIN_EMAIL:admin.email,VODAFONE_CASH_NUMBER:'01027661546',LIVEKIT_URL:'',LIVEKIT_API_KEY:'',LIVEKIT_API_SECRET:'',DATABASE_URL:''}});
let logs='';app.stdout.on('data',c=>logs+=c);app.stderr.on('data',c=>logs+=c);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function call(url,method='GET',body,cookie){const r=await fetch(base+url,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json().catch(()=>({})),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
async function login(user){const r=await call('/auth/login','POST',{email:user.email,password:pass});assert.equal(r.status,200);return r.cookie}
async function sendReceipt(id,cookie,phone,buffer){
 const form=new FormData();form.set('sender_phone',phone);form.set('receipt',new Blob([buffer],{type:'image/png'}),'receipt.png');
 const r=await fetch(base+'/bookings/'+id+'/payment',{method:'POST',headers:{Cookie:cookie},body:form});return {status:r.status,data:await r.json()};
}
let checks=0;function ok(cond,msg){assert.ok(cond,msg);checks++;console.log('PASS '+msg)}
try{
 let ready=false;for(let i=0;i<80;i++){await wait(130);try{const r=await fetch(base+'/health');if(r.ok){ready=true;break}}catch{}if(app.exitCode!==null)break}
 ok(ready,'payment API starts on temporary database');
 const s=await login(student),a=await login(admin),o=await login(other);
 ok((await call('/payments/config')).status===401,'guest cannot view payment number');
 const settings=await call('/payments/config','GET',undefined,s);
 ok(settings.status===200&&settings.data.enabled&&settings.data.number==='01027661546','student sees payment number when configured');
 ok((await call('/bookings/'+booking,'PATCH',{status:'approved'},s)).status===403,'student cannot approve booking');
 const denied=await call('/bookings/'+booking,'PATCH',{status:'approved'},a);
 ok(denied.status===409,'admin cannot approve paid booking before verified payment');
 const png=await sharp({create:{width:280,height:140,channels:3,background:'#fff7ed'}}).png().toBuffer();
 const submitted=await sendReceipt(booking,s,'01012345678',png);
 ok(submitted.status===201&&submitted.data.status==='pending','student uploads receipt privately');
 ok((await call('/admin/payments','GET',undefined,s)).status===403,'student cannot list other receipts');
 const payments=(await call('/admin/payments','GET',undefined,a)).data.payments;
 const p=payments.find(x=>x.booking_id===booking);ok(p&&p.amount_egp===100&&p.status==='pending'&&p.sender_phone==='01012345678','admin sees 100 EGP offer and pending receipt');
 const unauthorized=await fetch(base+'/admin/payments/'+p.id+'/proof',{headers:{Cookie:s}});
 ok(unauthorized.status===403,'student cannot view private image endpoint');
 const proof=await fetch(base+'/admin/payments/'+p.id+'/proof',{headers:{Cookie:a}});
 const raw=Buffer.from(await proof.arrayBuffer());ok(proof.status===200&&raw.toString('ascii',8,12)==='WEBP','admin-only receipt converted to sanitized WebP');
 ok((await call('/admin/payments/'+p.id+'/review','POST',{decision:'approved'},a)).status===400,'admin approval requires manual phone confirmation');
 ok((await call('/admin/payments/'+p.id+'/review','POST',{decision:'approved',confirmedOnPhone:true},s)).status===403,'student cannot confirm own payment');
 const mailbox=path.join(temp,'emails');
 const emailFile=fs.readdirSync(mailbox).find(x=>x.endsWith('payment-review.txt'));
 ok(Boolean(emailFile),'an email with a private review link is prepared for admin');
 const emailText=fs.readFileSync(path.join(mailbox,emailFile),'utf8');
 const token=emailText.match(/token=([a-f0-9]{64})/)?.[1];
 ok(Boolean(token),'email review link carries an unguessable one-time token');
 const emailReviewBase='http://127.0.0.1:'+port+'/payment-review';
 const reviewPage=await fetch(emailReviewBase+'?token='+token);
 const reviewMarkup=await reviewPage.text();
 ok(reviewPage.status===200&&reviewMarkup.includes('01012345678')&&reviewMarkup.includes('قبول الدفع')&&reviewMarkup.includes('confirmed_on_phone'),'admin sees screenshot, sender phone and accept/reject buttons from email');
 const emailProof=await fetch(emailReviewBase+'/proof?token='+token);
 ok(emailProof.status===200&&emailProof.headers.get('content-type')?.includes('image/webp'),'email-review image is privately served to token holder');
 ok((await fetch(emailReviewBase+'/proof?token='+'a'.repeat(64))).status===404,'forged email token cannot read image');
 const stillPending=await call('/my/overview','GET',undefined,s);
 ok(stillPending.data.bookings.find(b=>b.id===booking)?.status==='pending','opening email link never automatically approves booking');
 const unconfirmed=await fetch(emailReviewBase+'/decision',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token,decision:'approved'})});
 ok(unconfirmed.status===400,'email approval without explicit verified wallet checkbox is rejected');
 const accepted=await fetch(emailReviewBase+'/decision',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token,decision:'approved',confirmed_on_phone:'yes'})});
 ok(accepted.status===200,'admin can approve from email only after checking wallet receipt and ticking confirmation');
 const replay=await fetch(emailReviewBase+'/decision',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token,decision:'approved',confirmed_on_phone:'yes'})});
 ok(replay.status===410,'email review link is single-use after decision');
 ok((await call('/admin/payments/'+p.id+'/review','POST',{decision:'approved',confirmedOnPhone:true},a)).status===409,'second dashboard approval is rejected');
 const my=await call('/my/overview','GET',undefined,s);
 ok(my.data.bookings.find(b=>b.id===booking)?.status==='approved'&&my.data.bookings.find(b=>b.id===booking)?.payment_status==='approved','student sees booking and payment approved');
 ok((await sendReceipt(booking,s,'01012345678',png)).status===409,'approved booking cannot be paid twice');
 ok((await sendReceipt(otherBooking,o,'00000000000',png)).status===400,'invalid sender mobile number rejected');
 const second=await sendReceipt(otherBooking,o,'01123456789',png);
 ok(second.status===201,'other student submits new transfer');
 const otherP=(await call('/admin/payments','GET',undefined,a)).data.payments.find(x=>x.booking_id===otherBooking);
 const secondEmails=fs.readdirSync(mailbox).filter(x=>x.endsWith('payment-review.txt')).sort();
 const oldEmailToken=fs.readFileSync(path.join(mailbox,secondEmails.at(-1)),'utf8').match(/token=([a-f0-9]{64})/)?.[1];
 ok(Boolean(oldEmailToken),'second screenshot generated a fresh administrator email link');
 ok((await call('/admin/payments/'+otherP.id+'/review','POST',{decision:'rejected',reason:'المبلغ لم يصل على الهاتف'},a)).status===200,'admin can reject unverified proof with reason');
 const retry=await sendReceipt(otherBooking,o,'01123456789',png);
 ok(retry.status===201,'rejected student can resubmit fresh proof');
 ok((await fetch(emailReviewBase+'?token='+oldEmailToken)).status===410,'older email approval link is invalidated when student replaces the screenshot');
 const [concurrentApprove,concurrentReject]=await Promise.all([
  call('/admin/payments/'+otherP.id+'/review','POST',{decision:'approved',confirmedOnPhone:true},a),
  call('/admin/payments/'+otherP.id+'/review','POST',{decision:'rejected',reason:'فحص إضافي: المبلغ لم يصل'},a)
 ]);
 ok([concurrentApprove.status,concurrentReject.status].sort().join(',')==='200,409','concurrent admin decisions allow exactly one final result');
 const snapshot=await call('/my/overview','GET',undefined,o);
 const status=snapshot.data.bookings.find(x=>x.id===otherBooking);
 ok(status.payment_status==='approved'?status.status==='approved':status.payment_status==='rejected'&&status.status==='pending','booking never activates without approved payment, including concurrent reviews');
 console.log('RESULT '+checks+' payment workflow checks passed');
}finally{
 app.kill();await Promise.race([new Promise(r=>app.once('exit',r)),wait(3000)]);
 fs.rmSync(temp,{recursive:true,force:true,maxRetries:8,retryDelay:90});
}
