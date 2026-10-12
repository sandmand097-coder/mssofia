import React,{useEffect,useMemo,useState} from 'react';
import {useLocation} from 'react-router-dom';
import {CheckCircle2,ClipboardCheck,Mail,PhoneCall,RefreshCw,ShieldCheck,XCircle} from 'lucide-react';

const phoneValid=s=>/^01[0125]\d{8}$/.test(s||'');
const money=amount=>Number(amount).toLocaleString('ar-EG')+' جنيه';
const initial={phone:'',reference:'',reason:'',confirmed:false};
export default function AdminManualRequests({onChanged=()=>{}}){
 const location=useLocation();
 const preferredId=new URLSearchParams(location.search).get('booking');
 const [rows,setRows]=useState([]),[form,setForm]=useState({}),[busy,setBusy]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
 const load=async()=>{
  const response=await fetch('/api/admin/manual-requests',{credentials:'same-origin',headers:{'Accept':'application/json'}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'تعذر تحميل الطلبات');
  setRows(data.requests||[]);setError('');
 };
 useEffect(()=>{void load().catch(e=>setError(e.message))},[]);
 const sorted=useMemo(()=>[...rows].sort((a,b)=>Number(b.booking_id===preferredId)-Number(a.booking_id===preferredId)),[rows,preferredId]);
 const setField=(id,key,val)=>setForm(s=>({...s,[id]:{...initial,...s[id],[key]:val,...(key==='phone'||key==='reference'?{confirmed:false}:{})}}));
 const decide=async (booking,decision)=>{
  if(busy)return;
  const f={...initial,...form[booking.booking_id]};
  const phone=String(f.phone||booking.guardian_phone||'').trim();
  if(decision==='approved'&&(!phoneValid(phone)||f.confirmed!==true)){setError('أكّد وصول المبلغ بنفسك واكتب رقم المرسل الصحيح قبل القبول');return}
  if(decision==='rejected'&&String(f.reason).trim().length<5){setError('أدخل سبب رفض واضحًا');return}
  setError('');setMessage('');setBusy(booking.booking_id);
  try{
   const renewal=booking.contact_kind==='renewal'&&booking.booking_status==='approved';
   if(renewal&&decision==='approved'){
    const r=await fetch('/api/admin/bookings/'+encodeURIComponent(booking.booking_id)+'/manual-renewal',{
     credentials:'same-origin',method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({source:'guardian_contact',sender_phone:phone,confirmedOnPhone:true,amount_egp:Number(booking.amount_egp)})
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(data.error||'تعذر اعتماد التجديد');
   }else{
    const r=await fetch('/api/admin/manual-requests/'+encodeURIComponent(booking.booking_id)+'/decision',{
     method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({decision,sender_phone:phone,confirmedOnPhone:f.confirmed===true,
      transfer_reference:String(f.reference||'').trim(),reason:f.reason||''})
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(data.error||'تعذر حفظ القرار');
   }
   setMessage(decision==='approved'?'تم اعتماد الاشتراك يدويًا، وتحديث صلاحية الطالب بعد تحققك من المبلغ.':'تم تسجيل الرفض وإبقاء الحجز أو الاشتراك دون تفعيل دفع جديد.');
   setForm(s=>({...s,[booking.booking_id]:initial}));await load();await onChanged?.();
  }catch(e){setError(e.message)}finally{setBusy('')}
 };
 return <section className="portal-panel sofia-contact-panel" aria-label="مراجعة اشتراكات ولي الأمر يدويًا">
  <div className="sofia-contact-head"><Mail size={25}/><div><h2>طلبات الاشتراك الواردة — قبول أو رفض يدوي</h2>
   <p>افتح الطلب من رسالة البريد أو هنا. راجع كشف المبالغ على هاتفك أولًا؛ زر القبول هو وحده الذي يفعّل الاشتراك. لا يوجد تحصيل آلي ولا رفع إيصالات.</p></div></div>
  <div className="sofia-contact-notice"><ShieldCheck size={18}/><p>روابط البريد تنقلك إلى هذه اللوحة المحمية بتسجيل دخول الإدارة. البريد لا يوافق على أي مبلغ بمفرده. لو خدمة الإرسال لم تُفعّل، سيظل الطلب محفوظًا هنا.</p></div>
  <button className="portal-soft-btn" type="button" onClick={()=>void load().catch(e=>setError(e.message))}><RefreshCw size={16}/> تحديث قائمة الطلبات</button>
  {error&&<p role="alert" className="portal-alert">{error}</p>}
  {message&&<p role="status" className="sofia-contact-success"><CheckCircle2 size={17}/>{message}</p>}
  {sorted.length===0?<p>لا توجد طلبات معلّقة الآن. عند تقديم ولي الأمر طلب حجز أو ترك رقم هاتفه سيظهر هنا.</p>:
   <div className="sofia-contact-list">{sorted.map(b=>{
    const f={...initial,...form[b.booking_id]};
    const selected=String(preferredId||'')===b.booking_id;
    const renewal=b.contact_kind==='renewal'&&b.booking_status==='approved';
    const incompatible=b.payment_status==='pending'||b.payment_status==='approved'&&b.booking_status==='pending';
    return <article key={b.booking_id} id={'manual-booking-'+b.booking_id} className={'sofia-contact-card'+(selected?' sofia-contact-selected':'')}>
     <div className="sofia-contact-title"><div><h3>{b.student_name}</h3><small>{b.course_title} — {renewal?'تجديد شهري':'اشتراك أولي'} — {money(b.amount_egp)}</small></div><span className="sofia-contact-chip waiting">{b.contact_status==='pending'?'تم ترك رقم للتواصل':'حجز ينتظر قرارك'}</span></div>
     <p><PhoneCall size={16}/> رقم ولي الأمر: <strong dir="ltr">{b.guardian_phone||'لم يُسجل — راجع واتساب'}</strong></p>
     <small>بريد الحساب المسجل: {b.guardian_email} • رقم الحجز: {b.booking_id}</small>
     {b.contact_requested_at&&<small>تاريخ طلب التواصل: {new Date(b.contact_requested_at).toLocaleString('ar-EG',{timeZone:'Africa/Cairo'})}</small>}
     {incompatible?<p role="note" className="sofia-contact-reject">يوجد تحويل قديم قيد المراجعة أو معتمد. افتح سجله أولًا لمنع تسجيل نفس الدفعة مرتين.</p>:null}
     <div className="sofia-contact-form">
      <label>رقم الهاتف الذي أكدت وصول التحويل منه<input dir="ltr" type="tel" inputMode="numeric" maxLength={11} pattern="01[0125][0-9]{8}" value={f.phone||b.guardian_phone||''} onChange={e=>setField(b.booking_id,'phone',e.target.value)} placeholder="01XXXXXXXXX"/></label>
      {!renewal&&<label>رقم العملية الحقيقي (اختياري إذا لم يوجد)<input dir="ltr" type="text" maxLength={64} value={f.reference} placeholder="اتركه فارغًا ليُنشئ النظام رقم سجل داخليًا فقط" onChange={e=>setField(b.booking_id,'reference',e.target.value)}/></label>}
      <label className="sofia-contact-consent"><input type="checkbox" checked={f.confirmed} onChange={e=>setField(b.booking_id,'confirmed',e.target.checked)}/> أنا الإدارة، تحققت بنفسي من وصول مبلغ {money(b.amount_egp)} إلى وسيلة التحصيل الرسمية. هذه ليست موافقة تلقائية.</label>
      <button type="button" className="portal-primary-btn" disabled={busy!==''||!f.confirmed||incompatible} onClick={()=>void decide(b,'approved')}><ClipboardCheck size={18}/>{busy===b.booking_id?'جارٍ الحفظ...':renewal?'قبول التجديد يدويًا':'موافق — تم استلام المبلغ'}</button>
      <label>سبب الرفض<input maxLength={240} type="text" placeholder="مثلًا: لم يصل المبلغ المطلوب" value={f.reason} onChange={e=>setField(b.booking_id,'reason',e.target.value)}/></label>
      <button type="button" className="portal-soft-btn danger" disabled={busy!==''} onClick={()=>void decide(b,'rejected')}><XCircle size={16}/> رفض تأكيد الدفع</button>
     </div>
    </article>
   })}</div>}
 </section>;
}
