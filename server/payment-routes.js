// Private manual Vodafone Cash workflow. A screenshot alone NEVER confirms that money arrived.
import {randomBytes} from 'node:crypto';
import {attachEmailReview} from './payment-email-review.js';
import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import {withTransaction,isCloudDatabase} from './db-adapter.js';
import {verifyPrivateStorage} from './deployment-diagnostics.js';
import {createPaymentStorageGate} from './payment-storage-gate.js';

export const FIRST_MONTH_EGP=100;
export const REGULAR_MONTH_EGP=170;
const BUCKET='mrsofia-payment-proofs';
const imageMax=2*1024*1024;
const uploadMax=8*1024*1024;
const receiptUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:uploadMax,files:1,fields:3,parts:4},fileFilter:(req,file,cb)=>{
 cb(null,['image/jpeg','image/png','image/webp'].includes(file.mimetype));
}});
const json=(res,status,data)=>res.status(status).json(data);
const isScience=s=>/(علوم|فيزياء|أحياء|كيمياء|science|physics|biology|chemistry)/i.test(s||'');
const requiredAmount=c=>Number(c.price)<=0?0:isScience(c.subject)?FIRST_MONTH_EGP:Number(c.price);
const storageKey=()=>process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
const storageAuthHeaders=()=>{
 const key=storageKey();
 return key?.startsWith('sb_secret_')?{apikey:key}:{apikey:key,Authorization:'Bearer '+key};
};
const prodStorage=()=>Boolean(process.env.SUPABASE_URL&&storageKey());
const devStorage=()=>process.env.NODE_ENV!=='production'&&!!process.env.TEST_PAYMENT_UPLOAD_DIR;
const enabled=()=>Boolean(/^01[0125]\d{8}$/.test(process.env.VODAFONE_CASH_NUMBER||'')&&(prodStorage()||devStorage()));
const storageReady=createPaymentStorageGate({configured:enabled,development:devStorage,verify:()=>verifyPrivateStorage(process.env)});
const isEgyptianPhone=s=>/^01[0125]\d{8}$/.test(s||'');
const storageBase=()=>process.env.SUPABASE_URL.replace(/\/$/,'');
async function saveProof(key,bytes){
 if(devStorage()){const dest=path.join(process.env.TEST_PAYMENT_UPLOAD_DIR,key+'.webp');await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,bytes,{flag:'wx',mode:0o600});return}
 const url=storageBase()+'/storage/v1/object/'+BUCKET+'/'+key+'.webp';
 const response=await fetch(url,{method:'POST',headers:{...storageAuthHeaders(),'Content-Type':'image/webp','x-upsert':'false'},body:bytes});
 if(!response.ok)throw Error('Private image storage failed: '+response.status);
}
async function loadProof(key){
 if(!/^[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(key))throw Error('Invalid storage key');
 if(devStorage())return await readFile(path.join(process.env.TEST_PAYMENT_UPLOAD_DIR,key+'.webp'));
 const url=storageBase()+'/storage/v1/object/'+BUCKET+'/'+key+'.webp';
 const response=await fetch(url,{headers:storageAuthHeaders()});
 if(!response.ok)throw Error('Private image read failed: '+response.status);
 return Buffer.from(await response.arrayBuffer());
}
async function removeProof(key){
 if(devStorage())return unlink(path.join(process.env.TEST_PAYMENT_UPLOAD_DIR,key+'.webp')).catch(()=>{});
 if(!prodStorage())return;
 await fetch(storageBase()+'/storage/v1/object/'+BUCKET+'/'+key+'.webp',{method:'DELETE',headers:storageAuthHeaders()}).catch(()=>{});
}
export function attachPaymentRoutes(app,{auth,role,get,all,run,uid,now}){
 const onlyStudent=role('student'),onlyAdmin=role('admin');
 const notifyPaymentReviewer=attachEmailReview(app,{get,run,uid,now,loadProof,withTransaction,isCloudDatabase});
 app.get('/api/payments/config',auth,async(req,res,next)=>{
  try{
   const verified=await storageReady();
   return res.json({
    enabled:verified,method:'vodafone_cash',
    number:verified?process.env.VODAFONE_CASH_NUMBER:null,
    introductoryMonthEGP:FIRST_MONTH_EGP,regularMonthEGP:REGULAR_MONTH_EGP,
    information:'الموافقة على الحجز بعد تحقق الإدارة من وصول التحويل فعليًا على الهاتف.'
   });
  }catch(err){next(err)}
 });
 app.post('/api/bookings/:id/payment',auth,onlyStudent,async(req,res,next)=>{
  try{
   if(!(await storageReady()))return json(res,503,{error:'التحويلات غير متاحة لأن حفظ الإيصالات الخاصة لم ينجح فحص الأمان بعد. لا ترسل أي تحويل.'});
   receiptUpload.single('receipt')(req,res,err=>{
    if(err)return json(res,400,{error:'ارفع صورة واحدة PNG أو JPEG أو WebP لا تتجاوز 8 ميجابايت'});
    next();
   });
  }catch(err){next(err)}
 },async(req,res,next)=>{
  let newKey;
  try{
   const booking=await get("SELECT b.id,b.status,b.student_id,b.course_id,c.price,c.subject,c.capacity FROM bookings b JOIN courses c ON c.id=b.course_id WHERE b.id=?",req.params.id);
   if(!booking||booking.student_id!==req.user.id)return json(res,404,{error:'الطلب غير موجود'});
   if(booking.status!=='pending')return json(res,409,{error:'يمكن إرسال إيصال للحجز المعلق فقط'});
   const due=requiredAmount(booking);
   if(due<=0)return json(res,409,{error:'الكورس مجاني ولا يحتاج تحويلًا'});
   const senderPhone=String(req.body?.sender_phone||'').trim();
   if(!isEgyptianPhone(senderPhone))return json(res,400,{error:'اكتب رقم موبايل مصري صحيح يبدأ بـ 010 أو 011 أو 012 أو 015'});
   const reference='PHOTO-'+randomBytes(12).toString('hex').toUpperCase();
   if(!req.file?.buffer)return json(res,400,{error:'صورة إيصال التحويل مطلوبة'});
   const current=await get('SELECT id,status,proof_key FROM payment_submissions WHERE booking_id=?',booking.id);
   if(current&&current.status!=='rejected')return json(res,409,{error:'تم رفع إيصال بالفعل وهو قيد المراجعة أو مقبول'});
   let normalized;
   try{normalized=await sharp(req.file.buffer,{limitInputPixels:8e6}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:79,effort:4}).toBuffer();}
   catch{return json(res,400,{error:'صورة غير صالحة. جرّب لقطة شاشة أخرى'});}
   if(normalized.length>imageMax)return json(res,400,{error:'حجم الصورة بعد المعالجة كبير جدًا'});
   newKey=booking.id+'/'+uid();await saveProof(newKey,normalized);
   if(current){
    await run('UPDATE payment_review_links SET used_at=? WHERE payment_id=? AND used_at IS NULL',now(),current.id);
    await run("UPDATE payment_submissions SET amount_egp=?,transfer_reference=?,sender_phone=?,sender_last4=NULL,proof_key=?,status='pending',submitted_at=?,reviewed_at=NULL,reviewed_by=NULL,review_note=NULL,confirmed_on_phone=? WHERE id=?",
     due,reference,senderPhone,newKey,now(),isCloudDatabase?false:0,current.id);
    await removeProof(current.proof_key);
   }else{
    await run('INSERT INTO payment_submissions(id,booking_id,student_id,course_id,amount_egp,transfer_reference,sender_phone,proof_key,status,submitted_at,confirmed_on_phone) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
     uid(),booking.id,req.user.id,booking.course_id,due,reference,senderPhone,newKey,'pending',now(),isCloudDatabase?false:0);
   }
   // Email failure never activates a booking or loses a successfully stored receipt.
   await notifyPaymentReviewer({bookingId:booking.id}).catch(e=>console.error('Payment email notification unavailable:',e.message));
   return res.status(201).json({ok:true,status:'pending',message:'تم استلام صورة التحويل ورقم الموبايل. الطلب في انتظار قبول أو رفض الإدارة، ولا يتفعّل تلقائيًا.'});
  }catch(e){if(newKey)await removeProof(newKey);next(e)}
 });
 app.get('/api/admin/payments',auth,onlyAdmin,async(req,res,next)=>{
  try{const payments=await all("SELECT p.id,p.booking_id,p.student_id,p.amount_egp,p.transfer_reference,p.sender_phone,p.sender_last4,p.status,p.submitted_at,p.reviewed_at,p.review_note,p.confirmed_on_phone,u.name AS student_name,u.email AS student_email,c.title AS course_title FROM payment_submissions p JOIN users u ON u.id=p.student_id JOIN courses c ON c.id=p.course_id ORDER BY p.submitted_at DESC LIMIT 200");res.json({payments});}
  catch(e){next(e)}
 });
 app.get('/api/admin/payments/:id/proof',auth,onlyAdmin,async(req,res,next)=>{
  try{const row=await get('SELECT proof_key FROM payment_submissions WHERE id=?',req.params.id);if(!row)return json(res,404,{error:'الإيصال غير موجود'});
   const data=await loadProof(row.proof_key);
   res.set({'Content-Type':'image/webp','Cache-Control':'no-store, private','Content-Disposition':'inline; filename="vodafone-receipt.webp"','X-Content-Type-Options':'nosniff'}).send(data);
  }catch(e){next(e)}
 });
 app.post('/api/admin/payments/:id/review',auth,onlyAdmin,async(req,res,next)=>{
  try{
   const answer=await withTransaction(async tx=>{
    const lock=isCloudDatabase?' FOR UPDATE OF p,b,c':'';
    const row=await tx.get('SELECT p.*,b.status AS booking_status,c.capacity FROM payment_submissions p JOIN bookings b ON b.id=p.booking_id JOIN courses c ON c.id=p.course_id WHERE p.id=?'+lock,req.params.id);
    if(!row)return{http:404,error:'التحويل غير موجود'};
    if(row.status!=='pending'||row.booking_status!=='pending')return{http:409,error:'لا يمكن مراجعة الطلب بعد اتخاذ قرار سابق'};
    const decision=req.body?.decision;
    if(!['approved','rejected'].includes(decision))return{http:400,error:'حدد الموافقة أو الرفض'};
    if(decision==='approved'){
     if(req.body?.confirmedOnPhone!==true)return{http:400,error:'يجب التأكيد بأن المبلغ وصل فعليًا إلى تطبيق فودافون كاش على هاتف المدرسة'};
     const used=(await tx.get("SELECT COUNT(*) AS n FROM bookings WHERE course_id=? AND status='approved'",row.course_id)).n;
     if(Number(used)>=Number(row.capacity))return{http:409,error:'المقاعد اكتملت؛ تواصل مع ولي الأمر قبل الموافقة'};
     const evidence=await tx.run("UPDATE payment_submissions SET status='approved',confirmed_on_phone=TRUE,reviewed_by=?,reviewed_at=?,review_note=? WHERE id=? AND status='pending'",req.user.id,now(),'تم التأكد من وصول المبلغ إلى هاتف المدرسة',row.id);
     if(!evidence.changes)throw Error('Concurrent payment review conflict');
     const booking=await tx.run("UPDATE bookings SET status='approved',reviewed_at=? WHERE id=? AND status='pending'",now(),row.booking_id);
     if(!booking.changes)throw Error('Concurrent booking review conflict');
    }else{
     const note=String(req.body?.reason||'').trim().slice(0,500);
     if(note.length<5)return{http:400,error:'اكتب سبب الرفض للطالب (5 أحرف على الأقل)'};
     const changed=await tx.run("UPDATE payment_submissions SET status='rejected',reviewed_by=?,reviewed_at=?,review_note=?,confirmed_on_phone=FALSE WHERE id=? AND status='pending'",req.user.id,now(),note,row.id);
     if(!changed.changes)throw Error('Concurrent payment rejection conflict');
    }
    return{http:200,ok:true,status:decision};
   });
   return json(res,answer.http,answer.error?{error:answer.error}:{ok:true,status:answer.status});
  }catch(e){next(e)}
 });
}
