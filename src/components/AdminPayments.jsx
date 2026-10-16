import React,{useEffect,useMemo,useState} from 'react';
import {CheckCircle2,ShieldCheck,Smartphone,RefreshCw,AlertTriangle} from 'lucide-react';

const money=amount=>Number(amount).toLocaleString('ar-EG')+' جنيه';
const dateTime=value=>value?new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Cairo'}).format(new Date(value)):'—';

export default function AdminPayments({onChanged}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[reasons,setReasons]=useState({});
 const [withoutProof,setWithoutProof]=useState([]),[selectedBooking,setSelectedBooking]=useState('');
 const [manualPhone,setManualPhone]=useState(''),[manualMessage,setManualMessage]=useState('');
 const load=async()=>{
  const [response,eligible]=await Promise.all([
   fetch('/api/admin/payments',{credentials:'same-origin'}),
   fetch('/api/admin/payments/without-proof',{credentials:'same-origin'})
  ]);
  const result=await response.json().catch(()=>({}));
  const candidates=await eligible.json().catch(()=>({}));
  if(!response.ok||!eligible.ok)throw Error(result.error||candidates.error||'تعذر تحميل تحويلات الطلاب');
  setData(result.payments||[]);setWithoutProof(candidates.bookings||[]);setError('');
 };
 useEffect(()=>{load().catch(e=>setError(e.message))},[]);
 const payments=useMemo(()=>[...(data||[])].sort((a,b)=>(a.status==='pending'?0:1)-(b.status==='pending'?0:1)||Date.parse(b.submitted_at)-Date.parse(a.submitted_at)),[data]);
 const pendingCount=payments.filter(payment=>payment.status==='pending').length;
 const chosen=withoutProof.find(b=>b.booking_id===selectedBooking);
 const submitManual=async(e)=>{
  e.preventDefault();
  if(busy)return;
  if(!chosen){setError('اختاري الطالب صاحب الحجز أولًا');return}
  if(!/^01[0125]\d{8}$/.test(manualPhone.trim())){setError('اكتبي رقم الهاتف الذي ظهر في التحويل الوارد، 11 رقمًا');return}
  setError('');setManualMessage('');setBusy('manual');
  try{
   const response=await fetch('/api/admin/bookings/'+encodeURIComponent(chosen.booking_id)+'/manual-payment',{
    credentials:'same-origin',method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({sender_phone:manualPhone.trim()})
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error||'تعذر اعتماد التحويل');
   setManualMessage('تم اعتماد دفع '+chosen.student_name+' وفتح الاشتراك لمدة 30 يومًا.');
   setManualPhone('');setSelectedBooking('');
   await load();await onChanged?.();
  }catch(err){setError(err.message)}
  finally{setBusy('')}
 };
 const decide=async(payment,decision)=>{
  if(busy)return;
  setError('');
  if(decision==='rejected'&&String(reasons[payment.id]||'').trim().length<5){setError('اكتب سبب رفض واضحًا، مثل عدم وصول المبلغ أو اختلاف رقم المرسل');return}
  setBusy(payment.id);
  try{
   const response=await fetch('/api/admin/payments/'+encodeURIComponent(payment.id)+'/review',{
    credentials:'same-origin',method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({decision,reason:reasons[payment.id]||''})
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error||'تعذرت مراجعة هذا التحويل');
   await load();await onChanged?.();
  }catch(e){setError(e.message)}
  finally{setBusy('')}
 };
 const reconcile=async(payment)=>{
  if(busy)return;
  setError('');setBusy(payment.id);
  try{
   const response=await fetch('/api/bookings/'+encodeURIComponent(payment.booking_id),{
    credentials:'same-origin',method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({status:'approved'})
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error||'تعذر استكمال تفعيل الحجز');
   await load();await onChanged?.();
   setManualMessage('تمت مزامنة الحجز مع التحويل المعتمد سابقًا، دون تسجيل دفعة جديدة.');
  }catch(e){setError(e.message)}
  finally{setBusy('')}
 };
 return <section className="portal-panel sofia-payment-panel" aria-label="طلبات الدفع اليدوية">
  <h2><Smartphone size={22}/> تأكيد أو رفض تحويلات فودافون كاش</h2>
  <p>ولي الأمر يترك رقم الهاتف. افتحي محفظتك، تأكدي أن الرقم هو نفس رقم التحويل الوارد، ثم اضغطي «قبول الدفع». لا تحتاجين إلى كتابة رقم العملية أو المبلغ يدويًا.</p>
  <div className="sofia-payment-instruction"><ShieldCheck size={21}/> زر «قبول الدفع» هو تأكيدك الإداري بأنك راجعت الرقم في المحفظة. قيمة الاشتراك تُحسب تلقائيًا من الدورة.</div>
  {error&&<div role="alert" className="portal-alert">{error}</div>}
  <button type="button" className="portal-soft-btn" onClick={()=>load().catch(e=>setError(e.message))}><RefreshCw size={15}/> تحديث طلبات الدفع</button>
  <p role="status"><strong>طلبات تنتظر مراجعتك: {pendingCount.toLocaleString('ar-EG')}</strong></p>
  <section className="sofia-payment-manual" aria-label="اعتماد تحويل برقم الهاتف">
   <h3><ShieldCheck size={19}/> اعتماد دفع برقم الهاتف</h3>
   <p>إذا لم يرسل الطالب بلاغًا من حسابه، اختاري الحجز واكتبي رقم الهاتف الذي رأيته في التحويل ثم اضغطي اعتماد.</p>
   {!withoutProof.length?<p>لا توجد حجوزات مدفوعة معلّقة بدون بلاغ دفع حاليًا.</p>:
   <form onSubmit={submitManual} className="sofia-payment-manual-form">
    <label>الطالب والحجز
     <select required value={selectedBooking} onChange={e=>setSelectedBooking(e.target.value)}>
      <option value="">اختاري الطالب المطلوب</option>
      {withoutProof.map(b=><option key={b.booking_id} value={b.booking_id}>{b.student_name} — {b.course_title} ({money(b.amount_egp)})</option>)}
     </select>
    </label>
    <label>رقم الهاتف الذي ظهر في التحويل
     <input dir="ltr" type="tel" inputMode="numeric" pattern="01[0125][0-9]{8}" maxLength={11} required value={manualPhone} onChange={e=>setManualPhone(e.target.value)} placeholder="01012345678"/>
    </label>
    {chosen&&<p className="sofia-payment-manual-due">قيمة الاشتراك التي سيعتمدها النظام تلقائيًا: <strong>{money(chosen.amount_egp)}</strong></p>}
    <button type="submit" className="portal-primary-btn" disabled={busy!==''||!chosen}><CheckCircle2 size={16}/> تأكدت من الرقم — اعتماد وفتح الاشتراك</button>
   </form>}
  </section>
  {manualMessage&&<div className="sofia-payment-success" role="status"><CheckCircle2 size={16}/>{manualMessage}</div>}
  {!data?<p>جارٍ تحميل تحويلات الطلاب...</p>:payments.length===0?<p>لا توجد تحويلات مُرسلة حتى الآن.</p>:
  <div className="sofia-payments-review">{payments.map(payment=><article className="sofia-payment-review" key={payment.id}>
   <div className="sofia-payment-review-head">
    <h3>{payment.student_name}</h3>
    <span className={'sofia-payment-review-status status-'+payment.status}>{payment.status==='approved'?'مقبول':payment.status==='rejected'?'مرفوض':'بانتظار مراجعة الرقم'}</span>
   </div>
   <p>{payment.course_title} • قيمة الاشتراك: <strong>{money(payment.amount_egp)}</strong></p>
   <p>رقم الهاتف المسجّل: <strong dir="ltr">{payment.sender_phone||'غير مسجّل'}</strong></p>
   <small>وقت وصول البلاغ للموقع: {dateTime(payment.submitted_at)}</small>
   <div className="sofia-payment-proof">
    {payment.proof_key==='manual:notice'?<small><ShieldCheck size={15}/> بلاغ برقم الهاتف فقط. قارني الرقم بالتحويل الوارد في المحفظة.</small>:payment.transfer_reference?.startsWith('MANUAL-')||payment.transfer_reference?.startsWith('PHONE-')?<small><ShieldCheck size={15}/> تم الاعتماد يدويًا بعد مطابقة رقم الهاتف.</small>:<>
     <a href={'/api/admin/payments/'+payment.id+'/proof'} target="_blank" rel="noopener noreferrer">عرض إيصال الطالب الخاص</a>
     {payment.status==='pending'&&<img src={'/api/admin/payments/'+payment.id+'/proof'} loading="lazy" alt={'إيصال مُرسل من '+payment.student_name}/>}
    </>}
   </div>
   {payment.status==='approved'&&payment.booking_status==='pending'&&(payment.confirmed_on_phone===true||payment.confirmed_on_phone===1)&&
    <div className="sofia-payment-sync-alert" role="status">
     <AlertTriangle size={17}/>
     <span>الدفع معتمد لكن حالة الحجز لم تتحدث. هذه مزامنة للحجز نفسه وليست قبولًا جديدًا للمال.</span>
     <button className="portal-soft-btn" type="button" disabled={busy!==''} onClick={()=>reconcile(payment)}>استكمال تفعيل الحجز</button>
    </div>}
   {payment.status==='approved'&&payment.booking_status==='rejected'&&
    <p className="portal-alert" role="alert">تعارض غير معتاد: الدفع معتمد لكن الحجز مرفوض. يحتاج مراجعة إدارية قبل أي تعديل.</p>}
   {payment.status==='pending'?<div className="sofia-payment-review-actions">
    <p className="sofia-payment-check"><strong>راجعي الرقم في محفظتك:</strong> <span dir="ltr">{payment.sender_phone||'غير مسجّل'}</span></p>
    <button type="button" className="portal-primary-btn" disabled={busy!==''} onClick={()=>decide(payment,'approved')}><CheckCircle2 size={16}/> تأكدت من الرقم — قبول الدفع وفتح الاشتراك 30 يومًا</button>
    <label>سبب الرفض الذي سيظهر للطالب<input type="text" value={reasons[payment.id]||''} onChange={e=>setReasons(current=>({...current,[payment.id]:e.target.value}))} placeholder="المبلغ لم يصل / الرقم غير مطابق" maxLength={500}/></label>
    <button type="button" className="portal-soft-btn danger" disabled={busy!==''} onClick={()=>decide(payment,'rejected')}><AlertTriangle size={15}/> رفض التحويل</button>
   </div>:<p>{payment.status==='approved'?'تم اعتماد الدفع بعد مطابقة رقم الهاتف.':'مرفوض: '+(payment.review_note||'لم يتم اعتماد التحويل')}</p>}
  </article>)}</div>}
 </section>;
}
