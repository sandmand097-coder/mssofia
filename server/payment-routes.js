// Private manual Vodafone Cash workflow. A screenshot alone NEVER confirms that money arrived.
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';

export const FIRST_MONTH_EGP=100;
export const REGULAR_MONTH_EGP=170;
const BUCKET='mrsofia-payment-proofs';
const imageMax=2*1024*1024;
const receiptUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:imageMax,files:1,fields:4,parts:5},fileFilter:(req,file,cb)=>{
 cb(null,['image/jpeg','image/png','image/webp'].includes(file.mimetype));
}});
const json=(res,status,data)=>res.status(status).json(data);
const isScience=s=>/(علوم|فيزياء|أحياء|كيمياء|science|physics|biology|chemistry)/i.test(s||'');
const requiredAmount=c=>Number(c.price)<=0?0:isScience(c.subject)?FIRST_MONTH_EGP:Number(c.price);
const prodStorage=()=>Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
const devStorage=()=>process.env.NODE_ENV!=='production'&&!!process.env.TEST_PAYMENT_UPLOAD_DIR;
const enabled=()=>Boolean(/^01\d{9}$/.test(process.env.VODAFONE_CASH_NUMBER||'')&&(prodStorage()||devStorage()));
const storageBase=()=>process.env.SUPABASE_URL.replace(/\/$/,'');
async function saveProof(key,bytes){
 if(devStorage()){const dest=path.join(process.env.TEST_PAYMENT_UPLOAD_DIR,key+'.webp');await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,bytes,{flag:'wx',mode:0o600});return}
 const url=storageBase()+'/storage/v1/object/'+BUCKET+'/'+key+'.webp';
 const response=await fetch(url,{method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'image/webp','x-upsert':'false'},body:bytes});
 if(!response.ok)throw Error('Private image storage failed: '+response.status);
}
async function loadProof(key){
 if(!/^[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(key))throw Error('Invalid storage key');
 if(devStorage())return await readFile(path.join(process.env.TEST_PAYMENT_UPLOAD_DIR,key+'.webp'));
 const url=storageBase()+'/storage/v1/object/'+BUCKET+'/'+key+'.webp';
 const response=await fetch(url,{headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY}});
 if(!response.ok)throw Error('Private image read failed: '+response.status);
 return Buffer.from(await response.arrayBuffer());
}
async function removeProof(key){
 if(devStorage())return unlink(path.join(process.env.TEST_PAYMENT_UPLOAD_DIR,key+'.webp')).catch(()=>{});
 if(!prodStorage())return;
 await fetch(storageBase()+'/storage/v1/object/'+BUCKET+'/'+key+'.webp',{method:'DELETE',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY}}).catch(()=>{});
}
export function attachPaymentRoutes(app,{auth,role,get,all,run,uid,now}){
 const onlyStudent=role('student'),onlyAdmin=role('admin');
 app.get('/api/payments/config',auth,(req,res)=>res.json({
   enabled:enabled(),method:'vodafone_cash',
   number:enabled()?process.env.VODAFONE_CASH_NUMBER:null,
   introductoryMonthEGP:FIRST_MONTH_EGP,regularMonthEGP:REGULAR_MONTH_EGP,
   information:'الموافقة على الحجز بعد تحقق الإدارة من وصول التحويل فعليًا على الهاتف.'
 }));
 app.post('/api/bookings/:id/payment',auth,onlyStudent,(req,res,next)=>{
  if(!enabled())return json(res,503,{error:'فودافون كاش غير مفعل بعد. لا ترسل أي تحويل قبل إعلان رقم المدرسة.'});
  receiptUpload.single('receipt')(req,res,err=>{
   if(err)return json(res,400,{error:'ارفع صورة واحدة PNG أو JPEG أو WebP لا تتجاوز 2 ميجابايت'});
   next();
  });
 },async(req,res,next)=>{
  let newKey;
  try{
   const booking=await get("SELECT b.id,b.status,b.student_id,b.course_id,c.price,c.subject,c.capacity FROM bookings b JOIN courses c ON c.id=b.course_id WHERE b.id=?",req.params.id);
   if(!booking||booking.student_id!==req.user.id)return json(res,404,{error:'الطلب غير موجود'});
   if(booking.status!=='pending')return json(res,409,{error:'يمكن إرسال إيصال للحجز المعلق فقط'});
   const due=requiredAmount(booking);
   if(due<=0)return json(res,409,{error:'الكورس مجاني ولا يحتاج تحويلًا'});
   const reference=String(req.body?.reference||'').trim().toUpperCase();
   const last4=String(req.body?.sender_last4||'').trim();
   if(!/^[A-Z0-9-_]{5,80}$/.test(reference))return json(res,400,{error:'اكتب رقم عملية تحويل صالحًا من الرسالة'});
   if(last4&&!/^\d{4}$/.test(last4))return json(res,400,{error:'آخر أربعة أرقام من هاتف المُرسِل غير صحيحة'});
   if(!req.file?.buffer)return json(res,400,{error:'صورة إيصال التحويل مطلوبة'});
   const current=await get('SELECT id,status,proof_key FROM payment_submissions WHERE booking_id=?',booking.id);
   if(current&&current.status!=='rejected')return json(res,409,{error:'تم رفع إيصال بالفعل وهو قيد المراجعة أو مقبول'});
   const duplicate=await get('SELECT id FROM payment_submissions WHERE upper(transfer_reference)=? AND booking_id<>?',reference,booking.id);
   if(duplicate)return json(res,409,{error:'تم استخدام رقم العملية في طلب آخر'});
   let normalized;
   try{normalized=await sharp(req.file.buffer,{limitInputPixels:8e6}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:79,effort:4}).toBuffer();}
   catch{return json(res,400,{error:'صورة غير صالحة. جرّب لقطة شاشة أخرى'});}
   if(normalized.length>imageMax)return json(res,400,{error:'حجم الصورة بعد المعالجة كبير جدًا'});
   newKey=booking.id+'/'+uid();await saveProof(newKey,normalized);
   if(current){
    await run("UPDATE payment_submissions SET amount_egp=?,transfer_reference=?,sender_last4=?,proof_key=?,status='pending',submitted_at=?,reviewed_at=NULL,reviewed_by=NULL,review_note=NULL,confirmed_on_phone=FALSE WHERE id=?",
     due,reference,last4||null,newKey,now(),current.id);
    await removeProof(current.proof_key);
   }else{
    await run('INSERT INTO payment_submissions(id,booking_id,student_id,course_id,amount_egp,transfer_reference,sender_last4,proof_key,status,submitted_at,confirmed_on_phone) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
     uid(),booking.id,req.user.id,booking.course_id,due,reference,last4||null,newKey,'pending',now(),0);
   }
   return res.status(201).json({ok:true,status:'pending',message:'استلمنا صورة التحويل؛ طلبك ينتظر مراجعة المديرة على موبايلها. رفع الصورة ليس تأكيدًا للدفع.'});
  }catch(e){if(newKey)await removeProof(newKey);next(e)}
 });
 app.get('/api/admin/payments',auth,onlyAdmin,async(req,res,next)=>{
  try{const payments=await all("SELECT p.id,p.booking_id,p.student_id,p.amount_egp,p.transfer_reference,p.sender_last4,p.status,p.submitted_at,p.reviewed_at,p.review_note,p.confirmed_on_phone,u.name AS student_name,u.email AS student_email,c.title AS course_title FROM payment_submissions p JOIN users u ON u.id=p.student_id JOIN courses c ON c.id=p.course_id ORDER BY p.submitted_at DESC LIMIT 200");res.json({payments});}
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
   const row=await get('SELECT p.*,b.status AS booking_status,c.capacity FROM payment_submissions p JOIN bookings b ON b.id=p.booking_id JOIN courses c ON c.id=p.course_id WHERE p.id=?',req.params.id);
   if(!row)return json(res,404,{error:'التحويل غير موجود'});
   if(row.status!=='pending'||row.booking_status!=='pending')return json(res,409,{error:'لا يمكن مراجعة الطلب بعد اتخاذ قرار سابق'});
   const decision=req.body?.decision;
   if(!['approved','rejected'].includes(decision))return json(res,400,{error:'حدد الموافقة أو الرفض'});
   if(decision==='approved'){
    if(req.body?.confirmedOnPhone!==true)return json(res,400,{error:'يجب التأكيد بأن المبلغ وصل فعليًا إلى تطبيق فودافون كاش على هاتف المدرسة'});
    const used=(await get("SELECT COUNT(*) AS n FROM bookings WHERE course_id=? AND status='approved'",row.course_id)).n;
    if(used>=row.capacity)return json(res,409,{error:'المقاعد اكتملت؛ لا توافق على هذا التحويل قبل التواصل مع ولي الأمر'});
    const changed=await run("UPDATE bookings SET status='approved',reviewed_at=? WHERE id=? AND status='pending'",now(),row.booking_id);
    if(!changed.changes)return json(res,409,{error:'الحجز تغير بالفعل'});
    try{await run("UPDATE payment_submissions SET status='approved',confirmed_on_phone=TRUE,reviewed_by=?,reviewed_at=?,review_note=? WHERE id=? AND status='pending'",req.user.id,now(),'تم التأكد من ورود المبلغ على هاتف المدرسة',row.id);}
    catch(err){await run("UPDATE bookings SET status='pending',reviewed_at=NULL WHERE id=?",row.booking_id);throw err}
   }else{
    const note=String(req.body?.reason||'').trim().slice(0,500);
    if(note.length<5)return json(res,400,{error:'اكتب سبب الرفض للطالب (5 أحرف على الأقل)'});
    await run("UPDATE payment_submissions SET status='rejected',reviewed_by=?,reviewed_at=?,review_note=?,confirmed_on_phone=FALSE WHERE id=? AND status='pending'",req.user.id,now(),note,row.id);
   }
   res.json({ok:true,status:decision});
  }catch(e){next(e)}
 });
}
