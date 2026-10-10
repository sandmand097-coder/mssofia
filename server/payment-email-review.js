// Passwordless one-time payment review email for the designated school administrator.
// A link opens a read-only review first. Only an explicit POST can approve or reject.
// Scanned email links (GET requests) can never activate a paid booking.
import express from 'express';
import {rateLimit} from 'express-rate-limit';
import {randomBytes,createHash} from 'node:crypto';
import {mailMode,sendAccountEmail} from './email.js';

const sha=s=>createHash('sha256').update(s).digest('hex');
const tokenValid=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const htmlSafe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const adminAddress=()=>String(process.env.SCHOOL_ADMIN_EMAIL||'').trim().toLowerCase();
const hours24=24*60*60*1000;
const headers=res=>res.set({
 'Cache-Control':'no-store, private',
 'Referrer-Policy':'no-referrer',
 'X-Content-Type-Options':'nosniff',
 'X-Frame-Options':'DENY',
 'Content-Security-Policy':"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
});
const page=(body,title='مراجعة تحويل الطالب')=>`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${htmlSafe(title)} — Mrs Sofia</title><style>body{font-family:Tahoma,Arial,sans-serif;background:#eff7f4;margin:0;padding:22px;color:#163f3a}main{max-width:640px;margin:30px auto;background:white;padding:30px;border:1px solid #d5ebe4;border-radius:20px;box-shadow:0 18px 50px #114b381a}h1{font-size:25px}p{line-height:2}.fact{background:#f0faf5;padding:15px;border-radius:12px;margin-bottom:16px}img{display:block;max-width:100%;max-height:450px;object-fit:contain;margin:12px auto;border:1px solid #ddd;border-radius:10px}button{font:700 16px Tahoma;cursor:pointer;padding:14px;border:0;border-radius:9px;width:100%;margin-top:10px}.accept{background:#0b806b;color:white}.reject{background:#ffeded;color:#ac2535}input[type=text]{width:95%;font:15px Tahoma;padding:11px;border:1px solid #ddd;border-radius:8px}.confirm{display:flex;align-items:flex-start;gap:11px;padding:14px;background:#ebf8ed;border:1px solid #acd7bb;border-radius:10px;font-weight:700;line-height:1.8}.confirm input{width:21px;height:21px;flex-shrink:0}small{color:#647771;display:block;line-height:2}strong{font-size:19px}section{margin-top:22px}</style></head><body><main><h1>Mrs Sofia — مدرسة العلوم</h1>${body}</main></body></html>`;

export function attachEmailReview(app,{get,run,uid,now,loadProof,withTransaction,isCloudDatabase}){
 const reviewLimiter=rateLimit({windowMs:15*60*1000,limit:80,standardHeaders:'draft-8',legacyHeaders:false,message:'تم تجاوز عدد المحاولات، حاول مرة أخرى لاحقًا'});
 const lookupSql=`SELECT l.id AS link_id,l.payment_id,l.recipient_email,l.expires_at,l.used_at,
 p.status AS payment_status,p.amount_egp,p.sender_phone,p.proof_key,p.booking_id,
 b.status AS booking_status,c.capacity,c.title AS course_title,u.name AS student_name
 FROM payment_review_links l
 JOIN payment_submissions p ON p.id=l.payment_id
 JOIN bookings b ON b.id=p.booking_id
 JOIN courses c ON c.id=p.course_id
 JOIN users u ON u.id=p.student_id
 WHERE l.token_hash=?`;
 const load=async(token,reader=get)=>{
  if(!tokenValid(token))return null;
  const row=await reader(lookupSql,sha(token));
  if(!row||row.recipient_email!==adminAddress()||!adminAddress()||row.used_at||
     Date.parse(row.expires_at)<=Date.now()||row.payment_status!=='pending'||row.booking_status!=='pending')return null;
  return row;
 };
 const open=async(req,res,next)=>{
  try{
   headers(res);
   const token=String(req.query.token||'');
   const record=await load(token);
   if(!record)return res.status(410).type('html').send(page('<p>انتهت صلاحية الرابط، أو تمت مراجعة الإيصال بالفعل. يمكن الدخول إلى لوحة الإدارة لمتابعة الحالة.</p>','الرابط غير صالح'));
   const data=`<p>إيصال تحويل جديد يحتاج قرار الإدارة. <b>لم يتم تفعيل الكورس بعد.</b></p>
    <div class="fact"><p>الطالب: <strong>${htmlSafe(record.student_name)}</strong></p>
    <p>الكورس: ${htmlSafe(record.course_title)}</p>
    <p>المبلغ: <strong>${Number(record.amount_egp)} جنيه</strong></p>
    <p>رقم الهاتف الذي أرسل التحويل: <strong dir="ltr">${htmlSafe(record.sender_phone||'إيصال قديم')}</strong></p></div>
    <p>صورة الإيصال:</p><img alt="صورة التحويل" src="/payment-review/proof?token=${token}">
    <small>راجع وصول المبلغ داخل تطبيق فودافون كاش قبل الضغط على الموافقة. إرسال صورة وحدها لا يعني وصول الأموال.</small>
    <form method="POST" action="/payment-review/decision">
     <input type="hidden" name="token" value="${token}">
     <label class="confirm"><input type="checkbox" name="confirmed_on_phone" value="yes"> تحققت بنفسي من وصول المبلغ المطلوب ومن رقم المُرسل على هاتف فودافون كاش الرسمي للمدرسة.</label>
     <button name="decision" value="approved" class="accept" type="submit">قبول الدفع بعد التحقق من وصول المبلغ</button>
     <section><label for="reason">سبب الرفض (اختياري)</label><input id="reason" name="reason" type="text" maxlength="250" placeholder="المبلغ لم يصل أو الإيصال غير واضح"></section>
     <button name="decision" value="rejected" class="reject" type="submit">رفض الإيصال</button>
    </form><small>الرابط صالح لمدة 24 ساعة ومخصص لبريد الإدارة؛ لا تشاركه مع أحد.</small>`;
   return res.type('html').send(page(data));
  }catch(err){next(err)}
 };
 app.get('/payment-review',reviewLimiter,open);
 app.get('/payment-review/proof',reviewLimiter,async(req,res,next)=>{
  try{
   headers(res);
   const row=await load(String(req.query.token||''));
   if(!row)return res.status(404).end();
   const data=await loadProof(row.proof_key);
   return res.type('image/webp').send(data);
  }catch(err){next(err)}
 });
 app.post('/payment-review/decision',reviewLimiter,express.urlencoded({extended:false,limit:'4kb'}),async(req,res,next)=>{
  try{
   headers(res);
   const token=String(req.body?.token||'');
   const decision=String(req.body?.decision||'');
   if(!tokenValid(token)||!['approved','rejected'].includes(decision))return res.status(400).type('html').send(page('<p>طلب غير صالح.</p>'));
    if(decision==='approved'&&req.body?.confirmed_on_phone!=='yes')return res.status(400).type('html').send(page('<p>لن يُقبل التحويل إلا بعد التأكيد صراحةً من هاتف المدرسة أن المبلغ وصل من رقم المرسل.</p>'));
   const configuredOrigin=process.env.APP_ORIGIN;
   if(req.headers.origin&&configuredOrigin&&req.headers.origin!==new URL(configuredOrigin).origin)return res.status(403).type('html').send(page('<p>مصدر الطلب غير موثوق.</p>'));
   const result=await withTransaction(async tx=>{
    const lock=isCloudDatabase?' FOR UPDATE OF l,p,b,c':'';
    const row=await tx.get(lookupSql+lock,sha(token));
    if(!row||row.recipient_email!==adminAddress()||!adminAddress()||row.used_at||
       Date.parse(row.expires_at)<=Date.now()||row.payment_status!=='pending'||row.booking_status!=='pending')return {status:410,message:'الرابط انتهت صلاحيته أو تمت مراجعة الطلب بالفعل.'};
    const admin=await tx.get("SELECT id FROM users WHERE role='admin' AND status='active' AND email=?",row.recipient_email);
    if(!admin)return {status:403,message:'هذا البريد غير مرتبط بحساب إدارة نشط.'};
    const nowValue=now();
    if(decision==='approved'){
     const capacity=await tx.get("SELECT COUNT(*) AS n FROM bookings WHERE course_id=(SELECT course_id FROM payment_submissions WHERE id=?) AND status='approved'",row.payment_id);
     if(Number(capacity?.n||0)>=Number(row.capacity))return{status:409,message:'الكورس مكتمل العدد؛ لم يتفعّل الحجز.'};
     const pay=await tx.run("UPDATE payment_submissions SET status='approved',confirmed_on_phone=?,reviewed_by=?,reviewed_at=?,review_note=? WHERE id=? AND status='pending'",isCloudDatabase?true:1,admin.id,nowValue,'أقرت الإدارة بوصول التحويل من رابط البريد',row.payment_id);
     if(!pay.changes)throw Error('Concurrent payment approval failed');
     const booking=await tx.run("UPDATE bookings SET status='approved',reviewed_at=? WHERE id=? AND status='pending'",nowValue,row.booking_id);
     if(!booking.changes)throw Error('Concurrent booking approval failed');
    }else{
     const note=String(req.body?.reason||'').trim().slice(0,250)||'رفضت الإدارة الإيصال بعد المراجعة';
     const result=await tx.run("UPDATE payment_submissions SET status='rejected',confirmed_on_phone=?,reviewed_by=?,reviewed_at=?,review_note=? WHERE id=? AND status='pending'",isCloudDatabase?false:0,admin.id,nowValue,note,row.payment_id);
     if(!result.changes)throw Error('Concurrent payment rejection failed');
    }
    const used=await tx.run('UPDATE payment_review_links SET used_at=? WHERE id=? AND used_at IS NULL',nowValue,row.link_id);
    if(!used.changes)throw Error('One-time review token conflict');
    return{status:200,message:decision==='approved'?'تم قبول التحويل وتفعيل حجز الطالب بنجاح.':'تم رفض الإيصال؛ يمكن للطالب رفع صورة أخرى بعد المراجعة.'};
   });
   return res.status(result.status).type('html').send(page('<p>'+htmlSafe(result.message)+'</p>','نتيجة مراجعة التحويل'));
  }catch(err){next(err)}
 });
 return async function notify({bookingId}){
  const recipient=adminAddress();
  if(!recipient||mailMode()==='disabled')return false;
  const query=`SELECT p.id AS payment_id,p.amount_egp,p.sender_phone,u.name AS student_name,
    c.title AS course_title FROM payment_submissions p
    JOIN users u ON u.id=p.student_id JOIN courses c ON c.id=p.course_id
    WHERE p.booking_id=? AND p.status='pending'`;
  const record=await get(query,bookingId);
  if(!record)return false;
  const admin=await get("SELECT id FROM users WHERE role='admin' AND status='active' AND email=?",recipient);
  if(!admin)return false;
  const token=randomBytes(32).toString('hex'),id=uid();
  await run('INSERT INTO payment_review_links(id,payment_id,token_hash,recipient_email,expires_at,created_at) VALUES(?,?,?,?,?,?)',id,record.payment_id,sha(token),recipient,new Date(Date.now()+hours24).toISOString(),now());
  const url=String(process.env.APP_ORIGIN||'').replace(/\/$/,'')+'/payment-review?token='+token;
  try{
   await sendAccountEmail({to:recipient,kind:'payment-review',subject:'Mrs Sofia — مراجعة تحويل اشتراك جديد',text:`وصل طلب تحويل يحتاج موافقة أو رفض منك.\nاسم الطالب: ${record.student_name}\nالكورس: ${record.course_title}\nالمبلغ: ${record.amount_egp} جنيه\nرقم الموبايل المرسل: ${record.sender_phone}\nالرابط يفتح صورة التحويل وزرّي الموافقة والرفض. لن يتفعّل الحجز إلا بعد قرارك.`,url});
   return true;
  }catch(e){await run('DELETE FROM payment_review_links WHERE id=?',id).catch(()=>{});throw e}
 };
}
