import React,{useEffect,useState} from 'react';
import {UploadCloud,ShieldCheck,CheckCircle2,AlertCircle,Smartphone,RefreshCw} from 'lucide-react';

const money=n=>Number(n).toLocaleString('ar-EG')+' جنيه';
const isScience=s=>/(علوم|فيزياء|أحياء|كيمياء|science|physics|biology|chemistry)/i.test(s||'');
const phoneValid=value=>/^01[0125]\d{8}$/.test(value);
const allowedImage=file=>file&&file.size>0&&file.size<=8*1024*1024&&['image/png','image/jpeg','image/webp'].includes(file.type);

export default function StudentPayments({bookings=[],refresh}){
 const [config,setConfig]=useState(null),[error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(''),[phones,setPhones]=useState({}),[files,setFiles]=useState({});
 useEffect(()=>{
  let active=true;
  fetch('/api/payments/config',{credentials:'same-origin'}).then(async response=>{
   if(!response.ok)throw Error('تعذر التحقق من محفظة الدفع، لا ترسل أي أموال الآن');
   return response.json();
  }).then(value=>{if(active)setConfig(value)}).catch(e=>{if(active)setError(e.message)});
  return()=>{active=false};
 },[]);
 const paid=bookings.filter(booking=>Number(booking.price)>0);
 const upload=async bookingId=>{
  if(busy||!config?.enabled)return;
  setError('');setSuccess('');
  const file=files[bookingId],senderPhone=String(phones[bookingId]||'').trim();
  if(!phoneValid(senderPhone)){setError('اكتب نفس رقم فودافون كاش الذي أرسلت منه التحويل (11 رقمًا)');return}
  if(!allowedImage(file)){setError('اختار صورة PNG أو JPEG أو WebP صحيحة ولا يزيد حجمها عن 8 ميجابايت');return}
  const data=new FormData();data.set('sender_phone',senderPhone);data.set('receipt',file);
  setBusy(bookingId);
  try{
   const response=await fetch('/api/bookings/'+encodeURIComponent(bookingId)+'/payment',{credentials:'same-origin',method:'POST',body:data});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error||'تعذّر إرسال إثبات التحويل');
   setSuccess(result.message||'وصل إيصالك للمراجعة ولن يبدأ الاشتراك إلا بعد موافقة الإدارة');
   setFiles(current=>({...current,[bookingId]:null}));
   await refresh?.();
  }catch(e){setError(e.message)}
  finally{setBusy('')}
 };
 return <section className="portal-panel sofia-payment-panel" aria-label="دفع الاشتراك عبر فودافون كاش">
  <h2><Smartphone size={23}/> دفع الاشتراك عبر فودافون كاش</h2>
  <p>يُفعَّل اشتراك الطالب لمدة 30 يومًا <strong>بعد مراجعة المديرة لتحويل فودافون كاش على هاتف المدرسة وقبوله</strong>، وليس بمجرد رفع صورة الإيصال. يحق للإدارة الرفض إذا لم تصل الأموال أو لم تتطابق البيانات.</p>
  {!config?<p>جارٍ التأكد من جاهزية الدفع...</p>:!config.enabled?
   <div className="portal-alert" role="status">استقبال التحويلات متوقف مؤقتًا. لا تحوّل أي مبلغ قبل ظهور رقم المحفظة الرسمي هنا.</div>:
   <div className="sofia-payment-number"><span>رقم فودافون كاش الرسمي للمدرسة</span><strong dir="ltr">{config.number}</strong><small>تحقق من رقم المستلم قبل إرسال المبلغ، ثم احتفظ بإشعار التحويل.</small></div>}
  {error&&<p role="alert" className="portal-alert">{error}</p>}
  {success&&<p role="status" className="sofia-payment-success"><CheckCircle2 size={16}/>{success}</p>}
  {!paid.length?<p>اختَر دورة مدفوعة وأرسل طلب الانضمام، ثم ستظهر هنا قيمة الدفع ورفع الإيصال.</p>:
   paid.map(booking=>{
    const firstMonth=isScience(booking.subject)?config?.introductoryMonthEGP??100:booking.price;
    const canUpload=config?.enabled&&booking.status==='pending'&&!['approved','pending'].includes(booking.payment_status);
    return <div className="sofia-payment-item" key={booking.id}>
     <h3>{booking.course_title}</h3>
     <p>قيمة الاشتراك الأول: <strong>{money(firstMonth)}</strong>{isScience(booking.subject)&&<small> — التجديد الشهري: {money(config?.regularMonthEGP??170)}</small>}</p>
     {booking.live_access_status==='expired'?
      <div className="portal-alert" role="status">انتهت مدة اشتراكك السابق. يمكنك رفع إثبات دفع تجديد من قسم «تجديد اشتراكي لمدة 30 يومًا» أدناه.</div>:
      booking.payment_status==='approved'&&booking.status==='approved'?
      <div className="sofia-payment-success"><ShieldCheck size={16}/> تم اعتماد دفعك، ويمكنك حضور حصص الدورة حتى {booking.live_access_expires_at?new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeZone:'Africa/Cairo'}).format(new Date(booking.live_access_expires_at)):'نهاية مدة اشتراكك'}</div>:
      booking.payment_status==='pending'?
      <div className="sofia-payment-wait" role="status"><AlertCircle size={16}/> تم استلام صورة التحويل من رقمك، وهي قيد مراجعة المديرة. لا تحول المبلغ مرة ثانية.</div>:
      booking.status==='rejected'?
      <div className="portal-alert" role="status">تم رفض طلب الحجز. تواصل مع الإدارة قبل أي تحويل جديد.</div>:
      booking.status==='approved'?
      <div className="portal-alert" role="status">حجزك ظاهر كمعتمد لكن تأكيد الدفع غير مكتمل. تواصل مع إدارة المدرسة؛ لا تدفع مرتين.</div>:
      !config?.enabled?<p>رفع الإيصالات غير متاح حاليًا حتى يكتمل فحص الأمان.</p>:
      <>
       {booking.payment_status==='rejected'&&<div className="portal-alert">لم يُقبل الإيصال السابق: {booking.payment_note||'راجع تفاصيل التحويل وأعد إرسال إثبات صحيح بعد التأكد من العملية'}</div>}
       <div className="sofia-payment-fields">
        <label>رقم الهاتف الذي حوّلت منه فعليًا
         <input type="tel" inputMode="numeric" dir="ltr" required pattern="01[0125][0-9]{8}" maxLength={11} value={phones[booking.id]||''} onChange={e=>setPhones(current=>({...current,[booking.id]:e.target.value}))} placeholder="01012345678" autoComplete="tel"/>
        </label>
        <label>صورة إيصال التحويل من المحفظة
         <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setFiles(current=>({...current,[booking.id]:e.target.files?.[0]||null}))}/>
        </label>
       </div>
       <button type="button" className="portal-primary-btn" disabled={!canUpload||busy!==''} onClick={()=>upload(booking.id)}><UploadCloud size={16}/>{busy===booking.id?'جارٍ رفع الإيصال...':'إرسال الإيصال إلى المديرة للمراجعة'}</button>
       <small>ستقارن المديرة المبلغ ورقم هاتف المرسل مع التحويل الوارد فعليًا إلى محفظة المدرسة قبل الضغط على قبول أو رفض. لا ترسل الرقم السري أو رمز OTP.</small>
      </>
     }
    </div>;
   })}
  <p className="sofia-payment-footer-note"><RefreshCw size={15}/> لا توجد موافقة تلقائية على لقطات الشاشة. قبول الدفع وفتح الحصص بيد المديرة فقط بعد التحقق من وصول الأموال.</p>
 </section>;
}
