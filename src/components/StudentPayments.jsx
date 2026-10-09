import React,{useEffect,useState} from 'react';
import {UploadCloud,ShieldCheck,CheckCircle2,AlertCircle,Smartphone,RefreshCw} from 'lucide-react';

const money=n=>Number(n).toLocaleString('ar-EG')+' جنيه';
export default function StudentPayments({bookings,refresh}){
 const [config,setConfig]=useState(null),[error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(''),[references,setReferences]=useState({}),[last4,setLast4]=useState({}),[files,setFiles]=useState({});
 useEffect(()=>{let alive=true;fetch('/api/payments/config',{credentials:'same-origin'}).then(async r=>{if(!r.ok)throw Error('تعذر عرض بيانات الدفع');return r.json()}).then(c=>{if(alive)setConfig(c)}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false}},[]);
 const paid=bookings.filter(b=>Number(b.price)>0);
 const upload=async(id)=>{
  setError('');setSuccess('');
  const file=files[id],reference=String(references[id]||'').trim().toUpperCase();
  if(!file||file.size>2*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)){setError('اختار صورة إيصال PNG أو JPEG أو WebP أقل من 2 ميجابايت');return}
  if(!/^[A-Z0-9-_]{5,80}$/.test(reference)){setError('اكتب رقم العملية الموجود في رسالة فودافون كاش');return}
  const body=new FormData();body.set('receipt',file);body.set('reference',reference);body.set('sender_last4',last4[id]||'');
  setBusy(id);
  try{const response=await fetch('/api/bookings/'+id+'/payment',{method:'POST',credentials:'same-origin',body});const result=await response.json();if(!response.ok)throw Error(result.error||'تعذّر إرسال الإيصال');setSuccess(result.message);await refresh();}
  catch(e){setError(e.message)}finally{setBusy('')}
 };
 return <section className="portal-panel sofia-payment-panel" aria-label="فودافون كاش">
  <h2><Smartphone size={23}/> دفع الاشتراك عبر فودافون كاش</h2>
  <p>أول شهر من شرح العلوم للطالب الجديد <strong>100 جنيه بدل 170</strong>. من الشهر الثاني 170 جنيه شهريًا. الحجز لا يُعتمد إلا بعد أن تتأكد المديرة من التحويل على هاتفها.</p>
  {!config?<p>جارٍ مراجعة إعدادات الدفع...</p>:!config.enabled?<div className="portal-alert" role="status">استقبال التحويلات متوقف مؤقتًا. لا تحوّل أي مبلغ قبل ظهور رقم فودافون كاش الرسمي للمدرسة هنا.</div>:<div className="sofia-payment-number"><span>رقم فودافون كاش الرسمي</span><strong dir="ltr">{config.number}</strong><small>اتأكد من اسم المستلم في تطبيق التحويل قبل تأكيد العملية.</small></div>}
  {error&&<p role="alert" className="portal-alert">{error}</p>}
  {success&&<p role="status" className="sofia-payment-success"><CheckCircle2 size={16}/>{success}</p>}
  {!paid.length?<p>لما تختار دورة مدفوعة ويظهر طلب الحجز، تفاصيل تحويل الاشتراك هتظهر هنا.</p>:
  paid.map(b=><div className="sofia-payment-item" key={b.id}>
   <h3>{b.course_title}</h3>
   <p>المطلوب لأول شهر: <strong>{money(/(علوم|فيزياء|أحياء|كيمياء|science)/i.test(b.subject||'')?100:b.price)}</strong></p>
   {b.payment_status==='approved'?<span className="sofia-payment-success"><ShieldCheck size={16}/> التحويل مؤكد، وتمت مراجعة الحجز</span>:
    b.payment_status==='pending'?<span className="sofia-payment-wait"><AlertCircle size={16}/> الإيصال قيد المراجعة — لا تحول المبلغ مرة ثانية</span>:
    b.status==='approved'?<span className="sofia-payment-success"><CheckCircle2 size={16}/> حجزك معتمد</span>:
    !config?.enabled?<p>رفع الإيصالات غير متاح الآن.</p>:
    <>
     {b.payment_status==='rejected'&&<p className="portal-alert">الإيصال السابق لم يُقبل: {b.payment_note||'راجع رقم العملية ثم أعد رفع الإيصال الصحيح'}</p>}
     <div className="sofia-payment-fields">
      <label>رقم العملية من رسالة فودافون كاش<input value={references[b.id]||''} onChange={e=>setReferences(s=>({...s,[b.id]:e.target.value}))} maxLength={80} placeholder="رقم العملية" autoComplete="off"/></label>
      <label>آخر 4 أرقام من رقم المُرسِل (اختياري)<input inputMode="numeric" maxLength={4} value={last4[b.id]||''} onChange={e=>setLast4(s=>({...s,[b.id]:e.target.value}))} placeholder="1234"/></label>
      <label>صورة التحويل<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setFiles(s=>({...s,[b.id]:e.target.files?.[0]}))}/></label>
     </div>
     <button className="portal-primary-btn" disabled={busy===b.id} onClick={()=>upload(b.id)}><UploadCloud size={16}/>{busy===b.id?'جارٍ رفع الإيصال...':'إرسال صورة التحويل للمراجعة'}</button>
     <small>الصورة لا تعني تأكيد الدفع. لا تشارك أكواد محفظتك السرية أو بيانات بطاقاتك.</small>
    </>
   }
  </div>)}
  <p className="sofia-payment-footer-note"><RefreshCw size={15}/> الدفع يدوي حاليًا، والمديرة لا تعتمد أي طلب إلا بعد مراجعة إشعار وصول المبلغ في فودافون كاش.</p>
 </section>
}
