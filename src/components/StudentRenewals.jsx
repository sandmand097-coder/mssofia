import React,{useEffect,useState} from 'react';
import {RefreshCw,CalendarClock,UploadCloud,ShieldCheck} from 'lucide-react';

const request=async(path,opts={})=>{
 const r=await fetch('/api'+path,{credentials:'same-origin',...opts});
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(d.error||'تعذر الاتصال');
 return d;
};
const eligible=b=>b.status==='approved'&&b.payment_status==='approved'&&Number(b.price)>0
 &&(b.live_access_status==='expired'||b.live_access_status==='monthly'&&Number(b.live_access_days_remaining)<=5);
export default function StudentRenewals({bookings=[],refresh}){
 const [records,setRecords]=useState({enabled:false,renewals:[]}),[wallet,setWallet]=useState(null);
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const [phone,setPhone]=useState({}),[proof,setProof]=useState({});
 const load=async()=>{
  const [list,cfg]=await Promise.all([request('/student/renewals'),request('/payments/config')]);
  setRecords(list);setWallet(cfg);
 };
 useEffect(()=>{let live=true;
  Promise.all([request('/student/renewals'),request('/payments/config')])
   .then(([list,cfg])=>{if(live){setRecords(list);setWallet(cfg)}})
   .catch(e=>{if(live)setError(e.message)});
  return()=>{live=false};
 },[]);
 const send=async booking=>{
  setError('');setSuccess('');
  const receipt=proof[booking.id],sender=String(phone[booking.id]||'').trim();
  if(!/^01[0125]\d{8}$/.test(sender)){setError('رقم المحول يجب أن يكون 11 رقمًا مصريًا');return}
  if(!receipt||!['image/jpeg','image/png','image/webp'].includes(receipt.type)||receipt.size>8*1024*1024){setError('أرفق صورة PNG أو JPEG أو WebP لا تتجاوز 8 ميجابايت');return}
  const data=new FormData();data.set('receipt',receipt);data.set('sender_phone',sender);
  setBusy(booking.id);
  try{
   const result=await request('/bookings/'+booking.id+'/renewal',{method:'POST',body:data});
   setSuccess(result.message);
   await load();await refresh?.();
  }catch(e){setError(e.message)}
  finally{setBusy('')}
 };
 if(!records.enabled)return <section className="portal-panel"><h3>تجديد الاشتراك الشهري</h3><p>التجديد الإلكتروني قيد الإعداد. لا ترسل تحويل تجديد جديدًا قبل ظهور وسيلة الدفع المعتمدة هنا.</p></section>;
 const candidates=bookings.filter(eligible);
 const requests=records.renewals||[];
 return <section className="portal-panel sofia-payment-panel" aria-label="تجديد الاشتراكات">
  <h2><CalendarClock size={22}/> تجديد اشتراكي لمدة 30 يومًا</h2>
  <p>تجديد الشهر التالي متاح قبل انتهاء الاشتراك بخمسة أيام أو بعد انتهائه. كل تحويل يخضع لمراجعة المديرة. لا تكرر التحويل أثناء المراجعة.</p>
  {!wallet?.enabled&&<div role="status" className="portal-alert">التجديد المالي متوقف مؤقتًا لحين اعتماد تخزين الإيصالات الخاص. لا ترسل أي أموال.</div>}
  {error&&<p role="alert" className="portal-alert">{error}</p>}
  {success&&<p role="status" className="sofia-payment-success">{success}</p>}
  {requests.length>0&&<div className="portal-list">{requests.slice(0,12).map(r=><div key={r.id} className="portal-list-item">
   <div className="portal-list-copy"><strong>{r.status==='pending'?'تجديد قيد المراجعة':r.status==='approved'?'تم اعتماد التجديد':'تم رفض التجديد'}</strong>
    <small>القيمة: {Number(r.amount_egp)} جنيه</small>
    {r.period_end&&<small>ساري حتى {new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeZone:'Africa/Cairo'}).format(new Date(r.period_end))}</small>}
    {r.status==='rejected'&&<small>{r.review_note}</small>}
   </div></div>)}</div>}
  {!candidates.length&&<p>لا يوجد اشتراك يحتاج إلى تجديد الآن.</p>}
  {candidates.map(b=>{
   const pending=requests.some(r=>r.booking_id===b.id&&r.status==='pending');
   const price=/(علوم|فيزياء|أحياء|كيمياء|science|physics|biology|chemistry)/i.test(b.subject||'')?wallet?.regularMonthEGP:Number(b.price);
   return <div className="sofia-payment-item" key={b.id}>
    <h3>{b.course_title}</h3>
    <p>قيمة تجديد 30 يومًا: <strong>{Number(price).toLocaleString('ar-EG')} جنيه</strong></p>
    {pending?<p className="sofia-payment-wait">إيصال تجديدك قيد المراجعة؛ لا تحوّل مرة ثانية.</p>:
     !wallet?.enabled?<p>الدفع متوقف لحين التحقق من خصوصية الإيصالات.</p>:
     <>
      <div className="sofia-payment-number"><span>رقم محفظة المُدرِّسة المعتمد</span><strong dir="ltr">{wallet.number}</strong></div>
      <div className="sofia-payment-fields">
       <label>هاتف المرسل<input type="tel" dir="ltr" inputMode="numeric" maxLength={11} value={phone[b.id]||''} onChange={e=>setPhone(v=>({...v,[b.id]:e.target.value}))} placeholder="01012345678"/></label>
       <label>إيصال التجديد<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setProof(v=>({...v,[b.id]:e.target.files?.[0]}))}/></label>
      </div>
      <button type="button" className="portal-primary-btn" onClick={()=>send(b)} disabled={busy===b.id}><UploadCloud size={17}/>{busy===b.id?'جارٍ الإرسال...':'إرسال إثبات تجديد الشهر'}</button>
     </>}
   </div>;
  })}
  <p className="sofia-payment-footer-note"><ShieldCheck size={15}/> الحصص المدفوعة لا تُفتح إلا عندما يُسجل الخادم اعتماد الدفعة. <button type="button" className="portal-text-button" onClick={()=>load().catch(e=>setError(e.message))}><RefreshCw size={14}/> تحديث</button></p>
 </section>;
}
