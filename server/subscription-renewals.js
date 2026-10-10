// Add-only payment history for second and subsequent 30-day course periods.
// This feature remains OFF until the reviewed PostgreSQL migration, secure
// private receipt bucket and server-side flag are all operational.
import rateLimit from 'express-rate-limit';
import sharp from 'sharp';
import {PAID_ACCESS_MS,renewalsEnabled,countCurrentMembers} from './monthly-access.js';

const json=(res,status,payload)=>res.status(status).json(payload);
const isPhone=phone=>/^01[0125]\d{8}$/.test(phone||'');
const isScience=value=>/(علوم|فيزياء|أحياء|كيمياء|science|physics|biology|chemistry)/i.test(value||'');
const amountForRenewal=c=>Number(c.price)>0?(isScience(c.subject)?170:Number(c.price)):0;

export function attachSubscriptionRenewalRoutes(app,{
 auth,role,get,all,uid,now,withTransaction,isCloudDatabase,
 receiptUpload,storageReady,saveProof,loadProof,removeProof
}){
 const student=role('student'),admin=role('admin');
 const uploadLimiter=rateLimit({
  windowMs:3600000,limit:8,standardHeaders:'draft-8',legacyHeaders:false,
  message:{error:'تم تجاوز عدد محاولات إرسال الإيصالات. حاول لاحقًا'}
 });

 app.get('/api/student/renewals',auth,student,async(req,res,next)=>{
  try{
   if(!renewalsEnabled())return res.json({enabled:false,renewals:[]});
   const rows=await all('SELECT id,booking_id,amount_egp,status,submitted_at,reviewed_at,review_note,period_start,period_end FROM subscription_renewals WHERE student_id=? ORDER BY submitted_at DESC LIMIT 100',req.user.id);
   res.json({enabled:true,renewals:rows});
  }catch(error){next(error)}
 });

 app.get('/api/admin/renewals',auth,admin,async(req,res,next)=>{
  try{
   if(!renewalsEnabled())return res.json({enabled:false,renewals:[]});
   const rows=await all(`SELECT r.id,r.booking_id,r.student_id,r.course_id,r.amount_egp,r.transfer_reference,
    r.sender_phone,r.status,r.submitted_at,r.reviewed_at,r.review_note,r.period_start,r.period_end,
    u.name AS student_name,u.email AS student_email,c.title AS course_title
    FROM subscription_renewals r JOIN users u ON u.id=r.student_id
    JOIN courses c ON c.id=r.course_id ORDER BY r.submitted_at DESC LIMIT 200`);
   res.json({enabled:true,renewals:rows});
  }catch(error){next(error)}
 });

 app.get('/api/admin/renewals/:id/proof',auth,admin,async(req,res,next)=>{
  try{
   if(!renewalsEnabled())return json(res,503,{error:'تجديد الاشتراكات غير مُفعّل'});
   const row=await get('SELECT proof_key FROM subscription_renewals WHERE id=?',req.params.id);
   if(!row)return json(res,404,{error:'إيصال التجديد غير موجود'});
   if(row.proof_key.startsWith('manual:'))return json(res,404,{error:'تم اعتماد هذا التجديد يدويًا دون إيصال'});
   const bytes=await loadProof(row.proof_key);
   res.set({'Content-Type':'image/webp','Cache-Control':'no-store, private','Content-Disposition':'inline; filename="monthly-renewal.webp"','X-Content-Type-Options':'nosniff'}).send(bytes);
  }catch(error){next(error)}
 });

 app.post('/api/bookings/:id/renewal',auth,student,uploadLimiter,async(req,res,next)=>{
  try{
   if(!renewalsEnabled())return json(res,503,{error:'التجديد غير مُتاح حتى تجهز المُدرِّسة قاعدة البيانات'});
   if(!(await storageReady()))return json(res,503,{error:'التجديد متوقف إلى أن يجتاز تخزين الإيصالات فحص الخصوصية. لا ترسل أي تحويل'});
   receiptUpload.single('receipt')(req,res,error=>{
    if(error)return json(res,400,{error:'ارفع إيصال PNG أو JPEG أو WebP بحجم لا يتجاوز 8 ميجابايت'});
    next();
   });
  }catch(error){next(error)}
 },async(req,res,next)=>{
  let newKey=null;
  try{
   const booking=await get(`SELECT b.id,b.status,b.student_id,b.course_id,c.price,c.subject,
    p.status AS payment_status,p.confirmed_on_phone,p.reviewed_at AS payment_reviewed_at
    FROM bookings b JOIN courses c ON c.id=b.course_id
    LEFT JOIN payment_submissions p ON p.booking_id=b.id WHERE b.id=?`,req.params.id);
   if(!booking||booking.student_id!==req.user.id)return json(res,404,{error:'الاشتراك غير موجود'});
   const confirmed=booking.confirmed_on_phone===true||booking.confirmed_on_phone===1;
   if(booking.status!=='approved'||booking.payment_status!=='approved'||!confirmed||
      !Number.isFinite(Date.parse(booking.payment_reviewed_at||'')))
    return json(res,403,{error:'لا يمكن تجديد اشتراك قبل اعتماد دفعته الأولى'});
   const due=amountForRenewal(booking);
   if(!Number.isInteger(due)||due<=0||due>100000)return json(res,409,{error:'الكورس غير مؤهل للتجديد المدفوع'});
   const lastPaid=await get("SELECT MAX(period_end) AS latest FROM subscription_renewals WHERE booking_id=? AND status='approved' AND confirmed_on_phone=TRUE",booking.id);
   const previous=Date.parse(lastPaid?.latest||'');
   const end=Math.max(Date.parse(booking.payment_reviewed_at)+PAID_ACCESS_MS,Number.isFinite(previous)?previous:0);
   if(end-Date.now()>5*86400000)return json(res,409,{error:'يمكن إرسال التجديد خلال آخر خمسة أيام من الاشتراك أو بعد انتهائه'});
   if((await get("SELECT id FROM subscription_renewals WHERE booking_id=? AND status='pending'",booking.id)))
    return json(res,409,{error:'هناك إيصال تجديد قيد المراجعة؛ لا تدفع مرة أخرى'});
   const senderPhone=String(req.body?.sender_phone||'').trim();
   if(!isPhone(senderPhone))return json(res,400,{error:'اكتب رقم هاتف مصري صحيح للمرسل'});
   if(!req.file?.buffer)return json(res,400,{error:'صورة التحويل مطلوبة'});
   let receipt;
   try{
    receipt=await sharp(req.file.buffer,{limitInputPixels:8e6}).rotate()
     .resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true})
     .webp({quality:79,effort:4}).toBuffer();
   }catch{return json(res,400,{error:'ملف الصورة غير صالح'})}
   if(receipt.length>2*1024*1024)return json(res,400,{error:'الصورة كبيرة بعد المعالجة'});
   newKey=booking.id+'/'+uid();
   await saveProof(newKey,receipt);
   // Atomic duplicate prevention, including concurrent upload requests.
   const outcome=await withTransaction(async tx=>{
    const row=await tx.get('SELECT id FROM bookings WHERE id=?'+(isCloudDatabase?' FOR UPDATE':''),booking.id);
    if(!row)return false;
    if(await tx.get("SELECT id FROM subscription_renewals WHERE booking_id=? AND status='pending'",booking.id))return false;
    await tx.run(`INSERT INTO subscription_renewals(
      id,booking_id,student_id,course_id,amount_egp,transfer_reference,sender_phone,
      proof_key,status,submitted_at,confirmed_on_phone
     ) VALUES(?,?,?,?,?,?,?,?,?,?,FALSE)`,
     uid(),booking.id,req.user.id,booking.course_id,due,'RENEW-'+uid(),senderPhone,newKey,'pending',now());
    return true;
   });
   if(!outcome){await removeProof(newKey);newKey=null;return json(res,409,{error:'هناك تجديد قيد المراجعة بالفعل'})}
   res.status(201).json({ok:true,status:'pending',amount_egp:due,message:'تم استلام إيصال التجديد للمراجعة. لن يبدأ الشهر الجديد إلا بعد اعتماد المديرة للتحويل'});
  }catch(error){
   if(newKey)await removeProof(newKey);
   if(error.code==='23505'||error.code==='SQLITE_CONSTRAINT_UNIQUE')return json(res,409,{error:'هناك إيصال تجديد قيد المراجعة بالفعل'});
   next(error);
  }
 });

 // A child/guardian may forget to upload the screenshot. A director can still
 // extend a verified membership based on the bank's real incoming transaction.
 // No fabricated proof file is created and each manual review is auditable.
 app.get('/api/admin/renewals/without-proof',auth,admin,async(req,res,next)=>{
  try{
   if(!renewalsEnabled())return res.json({enabled:false,bookings:[]});
   const rows=await all(`SELECT b.id AS booking_id,b.student_id,b.course_id,b.status,
    c.title AS course_title,c.subject,c.price,
    u.name AS student_name,u.email AS student_email,
    p.status AS payment_status,p.confirmed_on_phone,p.reviewed_at AS payment_reviewed_at,
    (SELECT MAX(r.period_end) FROM subscription_renewals r WHERE r.booking_id=b.id
     AND r.status='approved' AND r.confirmed_on_phone=TRUE) AS last_renewal_end
    FROM bookings b JOIN courses c ON c.id=b.course_id
    JOIN users u ON u.id=b.student_id
    JOIN payment_submissions p ON p.booking_id=b.id
    WHERE b.status='approved' AND c.price>0 AND p.status='approved'
    AND NOT EXISTS(SELECT 1 FROM subscription_renewals r2 WHERE r2.booking_id=b.id AND r2.status='pending')
    ORDER BY b.created_at DESC LIMIT 200`);
   const eligible=rows.filter(r=>{
    const valid=r.confirmed_on_phone===true||r.confirmed_on_phone===1;
    const first=Date.parse(r.payment_reviewed_at||'');
    const last=Date.parse(r.last_renewal_end||'');
    const until=Math.max(first+PAID_ACCESS_MS,Number.isFinite(last)?last:0);
    return valid&&Number.isFinite(first)&&Number.isFinite(until)&&until-Date.now()<=5*86400000;
   }).map(r=>({booking_id:r.booking_id,student_name:r.student_name,student_email:r.student_email,
    course_title:r.course_title,amount_egp:amountForRenewal(r)})).filter(r=>r.amount_egp>0);
   res.set('Cache-Control','no-store, private').json({enabled:true,bookings:eligible});
  }catch(error){next(error)}
 });

 app.post('/api/admin/bookings/:id/manual-renewal',auth,admin,async(req,res,next)=>{
  try{
   if(!renewalsEnabled())return json(res,503,{error:'تجديد الاشتراكات غير مفعّل'});
   const senderPhone=String(req.body?.sender_phone||'').trim();
   const reference=String(req.body?.transfer_reference||'').trim().toUpperCase();
   const amount=Number(req.body?.amount_egp);
   if(req.body?.confirmedOnPhone!==true)return json(res,400,{error:'يجب التأكد يدويًا من وصول التحويل على محفظة المُدرِّسة'});
   if(!isPhone(senderPhone))return json(res,400,{error:'أدخلي رقم المرسل الحقيقي كما ظهر في كشف المحفظة'});
   if(!/^[A-Z0-9][A-Z0-9./_-]{4,63}$/.test(reference))return json(res,400,{error:'أدخلي رقم عملية فودافون كاش من كشف المحفظة (5–64 حرفًا)'});
   if(!Number.isSafeInteger(amount)||amount<=0)return json(res,400,{error:'أدخلي المبلغ الذي استلمته المُدرِّسة فعليًا'});
   const result=await withTransaction(async tx=>{
    const lock=isCloudDatabase?' FOR UPDATE OF b,p,c':'';
    const booking=await tx.get(`SELECT b.id,b.student_id,b.course_id,b.status,c.price,c.subject,c.capacity,
      p.status AS payment_status,p.confirmed_on_phone,p.reviewed_at AS payment_reviewed_at
      FROM bookings b JOIN courses c ON c.id=b.course_id JOIN payment_submissions p ON p.booking_id=b.id
      WHERE b.id=?`+lock,req.params.id);
    const verified=booking?.confirmed_on_phone===true||booking?.confirmed_on_phone===1;
    if(!booking||booking.status!=='approved'||booking.payment_status!=='approved'||!verified)
     return{status:409,error:'يجب أن يكون الاشتراك الأول مدفوعًا ومعتمدًا قبل التجديد'};
    const due=amountForRenewal(booking);
    if(!Number.isInteger(due)||due<=0||due>100000)return{status:409,error:'اشتراك هذه الدورة غير مؤهل للتجديد'};
    if(due!==amount)return{status:409,error:'المبلغ لا يطابق قيمة التجديد المستحقة: '+due+' جنيه'};
    const first=Date.parse(booking.payment_reviewed_at||'');
    if(!Number.isFinite(first))return{status:409,error:'تاريخ اعتماد الدفعة الأولى غير صالح'};
    if(await tx.get("SELECT id FROM subscription_renewals WHERE booking_id=? AND status='pending'",booking.id))
     return{status:409,error:'يوجد طلب تجديد قيد المراجعة بالفعل'};
    const transfer='MANUAL-'+reference;
    if(await tx.get('SELECT id FROM payment_submissions WHERE transfer_reference=?',transfer))
     return{status:409,error:'رقم العملية مستخدم في دفعة سابقة بالفعل'};
    const last=await tx.get("SELECT MAX(period_end) AS last_end FROM subscription_renewals WHERE booking_id=? AND status='approved' AND confirmed_on_phone=TRUE",booking.id);
    const prev=Date.parse(last?.last_end||'');
    const previousEnd=Math.max(first+PAID_ACCESS_MS,Number.isFinite(prev)?prev:0);
    const reviewedAt=now(),timestamp=Date.parse(reviewedAt);
    if(previousEnd-timestamp>5*86400000)return{status:409,error:'تجديد هذا الطالب متاح في آخر خمسة أيام من الاشتراك أو بعد انتهائه'};
    if(timestamp>=previousEnd){
     const used=await countCurrentMembers(tx.all,booking.course_id);
     if(Number(used)>=Number(booking.capacity))return{status:409,error:'المقاعد مكتملة؛ لا يمكن تجديد اشتراك منتهٍ'};
    }
    const begins=Math.max(previousEnd,timestamp),ends=begins+PAID_ACCESS_MS;
    await tx.run(`INSERT INTO subscription_renewals
     (id,booking_id,student_id,course_id,amount_egp,transfer_reference,sender_phone,proof_key,
      status,submitted_at,reviewed_at,reviewed_by,review_note,confirmed_on_phone,period_start,period_end)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
     uid(),booking.id,booking.student_id,booking.course_id,due,transfer,senderPhone,'manual:'+uid(),
     'approved',reviewedAt,reviewedAt,req.user.id,
     'تجديد يدوي من المديرة بعد التحقق من تحويل حقيقي دون صورة إيصال',
     isCloudDatabase?true:1,new Date(begins).toISOString(),new Date(ends).toISOString());
    return{status:201,ok:true,period_start:new Date(begins).toISOString(),period_end:new Date(ends).toISOString()};
   });
   res.set('Cache-Control','no-store, private').status(result.status).json(result.error?{error:result.error}:result);
  }catch(error){
   if(/unique|duplicate key|constraint failed/i.test(String(error.message||'')))
    return json(res,409,{error:'رقم العملية أو دفعة التجديد هذه مسجلة بالفعل'});
   next(error);
  }
 });

 app.post('/api/admin/renewals/:id/review',auth,admin,async(req,res,next)=>{
  try{
   if(!renewalsEnabled())return json(res,503,{error:'التجديد غير مُفعّل'});
   const decision=req.body?.decision;
   if(!['approved','rejected'].includes(decision))return json(res,400,{error:'حدد الموافقة أو الرفض'});
   if(decision==='approved'&&req.body?.confirmedOnPhone!==true)
    return json(res,400,{error:'يجب التأكد من وصول المبلغ الفعلي على هاتف المُدرِّسة'});
   const reason=String(req.body?.reason||'').trim().slice(0,500);
   if(decision==='rejected'&&reason.length<5)return json(res,400,{error:'اكتب سببًا واضحًا للرفض'});
   const result=await withTransaction(async tx=>{
    const renewal=await tx.get('SELECT * FROM subscription_renewals WHERE id=?'+(isCloudDatabase?' FOR UPDATE':''),req.params.id);
    if(!renewal)return{http:404,error:'طلب التجديد غير موجود'};
    if(renewal.status!=='pending')return{http:409,error:'تمت مراجعة التجديد بالفعل'};
    if(decision==='rejected'){
     const saved=await tx.run("UPDATE subscription_renewals SET status='rejected',reviewed_at=?,reviewed_by=?,review_note=?,confirmed_on_phone=FALSE WHERE id=? AND status='pending'",
      now(),req.user.id,reason,renewal.id);
     if(!saved.changes)throw Error('Concurrent renewal review');
     return{http:200,status:'rejected'};
    }
    const booking=await tx.get(`SELECT b.id,b.student_id,b.course_id,b.status,c.capacity,
       p.status AS payment_status,p.confirmed_on_phone AS first_confirmed,
       p.reviewed_at AS first_reviewed
       FROM bookings b JOIN courses c ON c.id=b.course_id
       JOIN payment_submissions p ON p.booking_id=b.id WHERE b.id=?`+
       (isCloudDatabase?' FOR UPDATE OF b,c,p':''),renewal.booking_id);
    const verified=booking?.first_confirmed===true||booking?.first_confirmed===1;
    if(!booking||booking.status!=='approved'||booking.payment_status!=='approved'||
       !verified||renewal.student_id!==booking.student_id||renewal.course_id!==booking.course_id)
     return{http:409,error:'الحجز الأساسي أو صاحب الحساب غير صالح'};
    const firstAt=Date.parse(booking.first_reviewed||'');
    if(!Number.isFinite(firstAt))return{http:409,error:'تاريخ اعتماد أول دفعة غير صالح'};
    const last=await tx.get("SELECT MAX(period_end) AS last_end FROM subscription_renewals WHERE booking_id=? AND status='approved' AND confirmed_on_phone=TRUE",booking.id);
    const renewedUntil=Date.parse(last?.last_end||'');
    const previousEnd=Math.max(firstAt+PAID_ACCESS_MS,Number.isFinite(renewedUntil)?renewedUntil:0);
    const reviewedNow=now(),timestamp=Date.parse(reviewedNow);
    if(timestamp>=previousEnd){
     const occupied=await countCurrentMembers(tx.all,booking.course_id);
     if(occupied>=Number(booking.capacity))return{http:409,error:'المقاعد مكتملة حاليًا؛ راجعي الحالة قبل قبول التحويل'};
    }
    const start=Math.max(previousEnd,timestamp),end=start+PAID_ACCESS_MS;
    const saved=await tx.run(`UPDATE subscription_renewals
      SET status='approved',reviewed_at=?,reviewed_by=?,review_note=?,
       confirmed_on_phone=TRUE,period_start=?,period_end=?
      WHERE id=? AND status='pending'`,reviewedNow,req.user.id,
      'تمت مراجعة وصول تحويل الشهر التالي على هاتف المُدرِّسة',
      new Date(start).toISOString(),new Date(end).toISOString(),renewal.id);
    if(!saved.changes)throw Error('Concurrent renewal approval');
    return{http:200,status:'approved',period_start:new Date(start).toISOString(),period_end:new Date(end).toISOString()};
   });
   json(res,result.http,result.error?{error:result.error}:{ok:true,status:result.status,period_start:result.period_start,period_end:result.period_end});
  }catch(error){next(error)}
 });
}
