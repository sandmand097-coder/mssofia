// Manual-first enrollment. The platform never charges money, uploads a receipt,
// or accepts an unverified transfer. Guardians give a callback number; the
// director must manually confirm settlement using the official wallet/bank app.
// Email is notification only and links to an AUTHENTICATED admin dashboard.
import {rateLimit} from 'express-rate-limit';
import {sendAccountEmail,mailMode} from './email.js';
import {countCurrentMembers} from './monthly-access.js';

const isPhone=value=>/^01[0125]\d{8}$/.test(String(value||''));
const hasPaidAccess=course=>Number(course?.price)>0;
const initialDue=course=>!hasPaidAccess(course)?0:/(علوم|فيزياء|أحياء|كيمياء|science|physics|biology|chemistry)/i.test(course.subject||'')?100:Number(course.price);
const notifyAddress=()=>String(process.env.SCHOOL_ADMIN_EMAIL||'').trim().toLowerCase();
const send=(res,status,obj)=>res.status(status).set('Cache-Control','no-store, private').json(obj);
const reasonText=value=>String(value||'').trim().slice(0,240);
const ID_RE=/^[a-f0-9-]{36}$/i;
const bookLock=isCloud=>isCloud?' FOR UPDATE OF b,c':'';

export function attachManualEnrollment(app,{auth,role,get,all,run,uid,now,withTransaction,isCloudDatabase}){
 const onlyStudent=role('student'),onlyAdmin=role('admin');
 const contactLimiter=rateLimit({windowMs:15*60000,limit:8,standardHeaders:'draft-8',legacyHeaders:false,
  message:{error:'تم إرسال طلبات تواصل كثيرة. حاول لاحقًا أو تواصل عبر واتساب.'}});
 // The existing student booking is required; no unauthenticated phone collection.
 app.post('/api/bookings/:id/contact',auth,onlyStudent,contactLimiter,async(req,res,next)=>{
  try{
   const phone=String(req.body?.phone||'').trim();
   if(!ID_RE.test(String(req.params.id))||!isPhone(phone)||req.body?.guardianConsent!==true)
    return send(res,400,{error:'اكتب رقم موبايل مصري صحيح ووافق على تواصل الإدارة مع ولي الأمر.'});
   const row=await get(\`SELECT b.id,b.status,b.contact_requested_at,b.student_id,b.contact_status,c.title,c.price
    FROM bookings b JOIN courses c ON c.id=b.course_id WHERE b.id=? AND b.student_id=?\`,
    req.params.id,req.user.id);
   if(!row)return send(res,404,{error:'طلب الاشتراك غير موجود في حساب الطالب'});
   if(row.status==='rejected')return send(res,409,{error:'هذا الحجز مرفوض؛ تواصل مع الإدارة لمراجعته'});
   const kind=row.status==='approved'?'renewal':'initial';
   if(row.status==='approved'){
    const payment=await get(\`SELECT p.status,p.confirmed_on_phone,p.reviewed_at,
     (SELECT MAX(r.period_end) FROM subscription_renewals r WHERE r.booking_id=b.id AND r.status='approved' AND r.confirmed_on_phone=TRUE) AS last_end
     FROM bookings b LEFT JOIN payment_submissions p ON p.booking_id=b.id WHERE b.id=?\`,row.id);
    const paid=payment?.status==='approved'&&(payment.confirmed_on_phone===true||payment.confirmed_on_phone===1);
    if(!paid)return send(res,409,{error:'التجديد يتطلب اشتراكًا أوليًا معتمدًا؛ تواصل مع الإدارة'});
    const first=Date.parse(payment.reviewed_at||''),last=Date.parse(payment.last_end||'');
    const end=Math.max(first+30*86400000,Number.isFinite(last)?last:0);
    if(Number.isFinite(end)&&end-Date.now()>7*86400000)
     return send(res,409,{error:'يمكن طلب التجديد خلال الأسبوع الأخير من الاشتراك أو بعد انتهائه'});
   }
   if(row.contact_status==='pending'&&Number.isFinite(Date.parse(row.contact_requested_at))&&
    Date.now()-Date.parse(row.contact_requested_at)<5*60000)
    return send(res,429,{error:'طلب التواصل السابق ما زال قيد المراجعة. انتظر خمس دقائق قبل تحديث الرقم.'});
   const saved=await run(\`UPDATE bookings SET guardian_phone=?,contact_requested_at=?,contact_kind=?,contact_status='pending',
     contact_review_note=NULL WHERE id=? AND student_id=? AND status=?\`,
    phone,now(),kind,row.id,req.user.id,row.status);
   if(!saved.changes)return send(res,409,{error:'تغيرت حالة الحجز؛ أعد تحميل صفحة الطالب'});
   // The request is stored even if mail is disabled/unavailable. This MUST NOT
   // trigger any payment approval, invoice, LiveKit token or paid entitlement.
   let emailed=false;
   const address=notifyAddress();
   if(address&&mailMode()!=='disabled'){
    const origin=String(process.env.APP_ORIGIN||'').replace(/\/$/,'');
    if(origin.startsWith('https://')){
     const url=origin+'/admin?tab=manual&booking='+encodeURIComponent(row.id);
     try{
      await sendAccountEmail({
       to:address,url,kind:'manual-enrollment',
       subject:'Miss Sofia — طلب تواصل واشتراك ينتظر قرارك',
       text:'وصلك طلب '+(kind==='renewal'?'تجديد':'حجز')+' يحتاج منك مراجعة. افتح لوحة الإدارة برابط آمن، وراجع بيانات الطلب ورقم ولي الأمر، ثم تحقق من وصول المال بنفسك قبل القبول أو الرفض. لا تتم أي موافقة تلقائية.'
      });
      emailed=true;
     }catch{console.warn('Manual enrollment notification not delivered; request remains in admin queue');}
    }
   }
   return send(res,200,{ok:true,status:'pending',emailNotified:emailed,
    message:emailed?'تم حفظ رقم ولي الأمر وإرسال الطلب إلى بريد الإدارة. الاشتراك في انتظار قرارها.':
     'تم حفظ رقم ولي الأمر في لوحة الإدارة. تواصل أيضًا عبر واتساب الرسمي؛ الاشتراك لن يتفعّل قبل موافقة الإدارة.'});
  }catch(err){next(err)}
 });
 app.get('/api/admin/manual-requests',auth,onlyAdmin,async(req,res,next)=>{
  try{
   const items=await all(\`SELECT b.id AS booking_id,b.status AS booking_status,
      b.guardian_phone,b.contact_requested_at,b.contact_kind,b.contact_status,b.contact_review_note,
      u.name AS student_name,u.email AS guardian_email,c.title AS course_title,c.subject,c.price,
      p.status AS payment_status,p.confirmed_on_phone,
      p.reviewed_at AS payment_reviewed_at
      FROM bookings b JOIN users u ON u.id=b.student_id
      JOIN courses c ON c.id=b.course_id
      LEFT JOIN payment_submissions p ON p.booking_id=b.id
      WHERE (b.status='pending' OR b.contact_status='pending')
      ORDER BY CASE WHEN b.contact_status='pending' THEN 0 ELSE 1 END,
       b.contact_requested_at DESC,b.created_at DESC LIMIT 200\`);
   return send(res,200,{requests:items.map(item=>({
    ...item,amount_egp:item.contact_kind==='renewal'?170:initialDue(item)
   }))});
  }catch(err){next(err)}
 });
 app.post('/api/admin/manual-requests/:id/decision',auth,onlyAdmin,async(req,res,next)=>{
  try{
   const decision=String(req.body?.decision||'');
   if(!ID_RE.test(String(req.params.id))||!['approved','rejected'].includes(decision))
    return send(res,400,{error:'حدد قبولًا أو رفضًا لطلب صالح'});
   if(decision==='approved'&&req.body?.confirmedOnPhone!==true)
    return send(res,400,{error:'لا يمكن قبول الدفع إلا بعد إقرارك بأن المبلغ وصل إلى حسابك بالفعل.'});
   const phone=String(req.body?.sender_phone||'').trim();
   if(decision==='approved'&&!isPhone(phone))
    return send(res,400,{error:'اكتب رقم الهاتف الذي ظهر في التحويل الصحيح'});
   const reason=reasonText(req.body?.reason);
   if(decision==='rejected'&&reason.length<5)
    return send(res,400,{error:'اكتب سبب رفض واضحًا للمتابعة مع ولي الأمر'});
   const reference=String(req.body?.transfer_reference||'').trim().toUpperCase();
   if(reference&&!/^[A-Z0-9][A-Z0-9./_-]{4,63}$/.test(reference))
    return send(res,400,{error:'رقم العملية غير صالح؛ اتركه فارغًا فقط إذا لم يوجد رقم مرجعي'});
   const result=await withTransaction(async tx=>{
    const row=await tx.get(\`SELECT b.id,b.student_id,b.status,b.contact_kind,b.contact_status,b.course_id,
     c.capacity,c.price,c.subject FROM bookings b JOIN courses c ON c.id=b.course_id
     WHERE b.id=?\`+bookLock(isCloudDatabase),req.params.id);
    if(!row)return{code:404,error:'الحجز غير موجود'};
    if(row.status!=='pending')return{code:409,error:'هذا الحجز ليس طلب قبول أولي. للتجديد استخدم قسم الاشتراكات.'};
    const existing=await tx.get('SELECT id,status FROM payment_submissions WHERE booking_id=?'+(isCloudDatabase?' FOR UPDATE':''),row.id);
    if(existing)return{code:409,error:'يوجد سجل تحويل سابق؛ يجب مراجعته من سجل التحويلات القديمة أولًا لتجنب تكرار التحصيل'};
    if(decision==='rejected'){
     await tx.run(\`UPDATE bookings SET contact_status='rejected',contact_review_note=? WHERE id=? AND status='pending'\`,
      reason,row.id);
     return{code:200,ok:true,status:'rejected',message:'تم رفض طلب تأكيد الدفع؛ سيظل الحجز غير مفعّل ويمكن للطالب إعادة إرسال رقم التواصل.'};
    }
    const amount=initialDue(row);
    if(amount>0&&process.env.NODE_ENV==='production'&&process.env.SCHOOL_REFUND_POLICY_APPROVED!=='true')
     return{code:503,error:'اعتماد الاشتراكات الجديدة موقوف حتى اعتماد الإدارة سياسة الاشتراك والاسترداد.'};
    const count=await countCurrentMembers(tx.all,row.course_id);
    if(Number(count)>=Number(row.capacity))return{code:409,error:'عدد المقاعد اكتمل؛ لم يتم قبول الدفع'};
    const reviewedAt=now();
    if(amount>0){
     const internal=!reference;
     const token='MANUAL-'+(internal?'CONTACT-'+row.id:reference);
     const repeated=await tx.get('SELECT id FROM payment_submissions WHERE transfer_reference=?',token);
     if(repeated)return{code:409,error:'رقم العملية سبق استخدامه؛ راجع كشف التحويلات قبل إعادة الموافقة'};
     await tx.run(\`INSERT INTO payment_submissions
       (id,booking_id,student_id,course_id,amount_egp,transfer_reference,sender_phone,proof_key,status,
       submitted_at,reviewed_at,reviewed_by,review_note,confirmed_on_phone)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)\`,
      uid(),row.id,row.student_id,row.course_id,amount,token,phone,'manual:'+row.id,
      'approved',reviewedAt,reviewedAt,req.user.id,
      internal?'تأكيد يدوي من الإدارة بناءً على التحويل المستلم؛ رقم سجل داخلي وليس رقم عملية حقيقي':
       'تأكيد يدوي من الإدارة؛ رقم العملية مطابق للمرجع الخارجي الذي أدخلته',
      isCloudDatabase?true:1);
    }
    const updated=await tx.run(\`UPDATE bookings SET status='approved',reviewed_at=?,guardian_phone=?,
      contact_status='approved',contact_review_note=NULL WHERE id=? AND status='pending'\`,
     reviewedAt,phone,row.id);
    if(!updated.changes)throw Error('Concurrent manual booking change');
    return{code:200,ok:true,status:'approved',message:'تم قبول الحجز بعد تأكيد الإدارة، وأصبح الاشتراك صالحًا وفق نظام الحصص.'};
   });
   return send(res,result.code,result.error?{error:result.error}:{ok:result.ok,status:result.status,message:result.message});
  }catch(err){
   if(/unique|duplicate key|constraint failed/i.test(String(err?.message||'')))
    return send(res,409,{error:'طلب مكرر أو رقم عملية مسجل مسبقًا'});
   next(err);
  }
 });
}
