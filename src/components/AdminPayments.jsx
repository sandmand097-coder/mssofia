import React,{useEffect,useMemo,useState} from 'react';
import {CheckCircle2,ShieldCheck,Smartphone,RefreshCw,AlertTriangle} from 'lucide-react';

const money=amount=>Number(amount).toLocaleString('ar-EG')+' جنيه';
const dateTime=value=>value?new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Cairo'}).format(new Date(value)):'—';

export default function AdminPayments(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[checked,setChecked]=useState({}),[reasons,setReasons]=useState({});
 const [withoutProof,setWithoutProof]=useState([]),[selectedBooking,setSelectedBooking]=useState('');
 const [manualPhone,setManualPhone]=useState(''),[manualReference,setManualReference]=useState(''),[manualAmount,setManualAmount]=useState(''),[manualConfirmed,setManualConfirmed]=useState(false);
 const [manualMessage,setManualMessage]=useState('');
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
  if(!/^[A-Za-z0-9][A-Za-z0-9./_-]{4,63}$/.test(manualReference.trim())){setError('اكتبي رقم عملية التحويل الحقيقي كما ظهر في محفظتك');return}
  if(Number(manualAmount)!==Number(chosen.amount_egp)){setError('المبلغ الذي تم تأكيده يجب أن يطابق المبلغ المطلوب للحجز');return}
  if(!manualConfirmed){setError('أكّدي وصول المبلغ بنفسك إلى رقم فودافون كاش للمُدرِّسة');return}
  setError('');setManualMessage('');setBusy('manual');
  try{
   const response=await fetch('/api/admin/bookings/'+encodeURIComponent(chosen.booking_id)+'/manual-payment',{
    credentials:'same-origin',method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({sender_phone:manualPhone.trim(),transfer_reference:manualReference.trim(),amount_egp:Number(manualAmount),confirmedOnPhone:true})
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error||'تعذر تسجيل التحويل يدويًا');
   setManualMessage('تم اعتماد تحويل '+chosen.student_name+' وفتح اشتراكه لمدة 30 يومًا، دون الحاجة إلى رفع صورة.');
   setManualPhone('');setManualReference('');setManualAmount('');setSelectedBooking('');setManualConfirmed(false);
   await load();
  }catch(err){setError(err.message)}
  finally{setBusy('')}
 };
 const decide=async(payment,decision)=>{
  if(busy)return;
  setError('');
  if(decision==='approved'&&checked[payment.id]!==true){setError('يجب التأكد على هاتف المحفظة الرسمي من وصول نفس المبلغ ومن نفس الرقم قبل القبول');return}
  if(decision==='rejected'&&String(reasons[payment.id]||'').trim().length<5){setError('اكتب سبب رفض واضحًا، مثل عدم وصول المبلغ أو اختلاف رقم المرسل');return}
  setBusy(payment.id);
  try{
   const response=await fetch('/api/admin/payments/'+encodeURIComponent(payment.id)+'/review',{
    credentials:'same-origin',method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({decision,confirmedOnPhone:checked[payment.id]===true,reason:reasons[payment.id]||''})
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error||'تعذرت مراجعة هذا الإيصال');
   await load();setChecked(current=>({...current,[payment.id]:false}));
  }catch(e){setError(e.message)}
  finally{setBusy('')}
 };
 return <section className="portal-panel sofia-payment-panel" aria-label="طلبات الدفع اليدوية">
  <h2><Smartphone size={22}/> تأكيد أو رفض تحويلات فودافون كاش</h2>
  <p>كل طالب يرسل رقم الهاتف الذي حوّل منه وصورة الإيصال. قارني **المبلغ ورقم المرسل والتحويل الوارد إلى محفظتك على الهاتف**. صورة الإيصال ليست دليلًا كافيًا، ولا يُفتح الاشتراك المدفوع قبل قبولك.</p>
  <div className="sofia-payment-instruction"><ShieldCheck size={21}/> القبول يدوي فقط: افتحي تطبيق فودافون كاش، وتأكدي من وصول التحويل للمحفظة الرسمية ومن تطابق قيمته ورقم المرسل، ثم ضعي علامة التأكيد واضغطي «قبول الدفع»؛ وإلا اختاري الرفض مع السبب.</div>
  {error&&<div role="alert" className="portal-alert">{error}</div>}
  <button type="button" className="portal-soft-btn" onClick={()=>load().catch(e=>setError(e.message))}><RefreshCw size={15}/> تحديث طلبات الدفع</button>
  <p role="status"><strong>طلبات تنتظر مراجعتك: {pendingCount.toLocaleString('ar-EG')}</strong></p>
  <section className="sofia-payment-manual" aria-label="اعتماد تحويل وصل دون إيصال">
   <h3><ShieldCheck size={19}/> اعتماد دفع بدون صورة إيصال</h3>
   <p>لو الطالب نسي يرفع صورة، يمكنك اعتماد الحجز من هنا بعد رؤية التحويل في محفظتك. لا تختاري هذا المسار قبل وصول المبلغ فعليًا. سجّلي رقم المرسل ورقم العملية كما يظهران في كشف المحفظة، منعًا لاعتماد التحويل مرتين.</p>
   {!withoutProof.length?<p>لا توجد حجوزات مدفوعة معلّقة بدون إيصالات حاليًا.</p>:
   <form onSubmit={submitManual} className="sofia-payment-manual-form">
    <label>الطالب والحجز
     <select required value={selectedBooking} onChange={e=>{
       const next=withoutProof.find(row=>row.booking_id===e.target.value);
       setSelectedBooking(e.target.value);setManualAmount(next?String(next.amount_egp):'');setManualConfirmed(false);
     }}>
      <option value="">اختاري الطالب المطلوب</option>
      {withoutProof.map(b=><option key={b.booking_id} value={b.booking_id}>{b.student_name} — {b.course_title} ({money(b.amount_egp)})</option>)}
     </select>
    </label>
    <label>رقم فودافون كاش الذي أرسل التحويل
     <input dir="ltr" type="tel" inputMode="numeric" pattern="01[0125][0-9]{8}" maxLength={11} required value={manualPhone} onChange={e=>{setManualPhone(e.target.value);setManualConfirmed(false)}} placeholder="01012345678"/>
    </label>
    <label>رقم العملية الفعلي من فودافون كاش
     <input dir="ltr" type="text" required minLength={5} maxLength={64} value={manualReference} onChange={e=>{setManualReference(e.target.value);setManualConfirmed(false)}} placeholder="Transaction ID" autoComplete="off"/>
    </label>
    <label>المبلغ الذي وصل للمحفظة (جنيه)
     <input type="number" inputMode="numeric" min="1" required value={manualAmount} onChange={e=>{setManualAmount(e.target.value);setManualConfirmed(false)}}/>
    </label>
    {chosen&&<p className="sofia-payment-manual-due">المستحق للحجز: <strong>{money(chosen.amount_egp)}</strong> — يجب أن يكون مطابقًا للمبلغ الواصل.</p>}
    <label className="sofia-payment-check">
     <input type="checkbox" checked={manualConfirmed} onChange={e=>setManualConfirmed(e.target.checked)}/>
     أؤكد بصفتي المديرة أنني راجعت محفظتي بالفعل، ورأيت وصول المبلغ ومن نفس رقم المرسل ورقم العملية المدخلين أعلاه.
    </label>
    <button type="submit" className="portal-primary-btn" disabled={busy!==''||!chosen||!manualConfirmed||Number(manualAmount)!==Number(chosen?.amount_egp)}><CheckCircle2 size={16}/> اعتماد التحويل يدويًا وفتح الاشتراك</button>
   </form>}
  </section>
  {manualMessage&&<div className="sofia-payment-success" role="status"><CheckCircle2 size={16}/>{manualMessage}</div>}
  {!data?<p>جارٍ تحميل إيصالات التحويلات...</p>:payments.length===0?<p>لا توجد إيصالات مُرسلة حتى الآن.</p>:
  <div className="sofia-payments-review">{payments.map(payment=><article className="sofia-payment-review" key={payment.id}>
   <div className="sofia-payment-review-head">
    <h3>{payment.student_name}</h3>
    <span className={'sofia-payment-review-status status-'+payment.status}>{payment.status==='approved'?'مقبول':payment.status==='rejected'?'مرفوض':'بانتظار فحص التحويل'}</span>
   </div>
   <p>{payment.course_title} • المبلغ المطلوب: <strong>{money(payment.amount_egp)}</strong></p>
   <p>رقم الهاتف الذي صرّح الطالب بأنه أرسل منه: <strong dir="ltr">{payment.sender_phone||'غير مسجّل'}</strong></p>
   <small>وقت استلام الإيصال في الموقع: {dateTime(payment.submitted_at)} — ليس بالضرورة وقت التحويل</small>
   <div className="sofia-payment-proof">
    {payment.transfer_reference?.startsWith('MANUAL-')?<small><ShieldCheck size={15}/> تم اعتماد التحويل يدويًا بعد مراجعة المحفظة — بدون صورة إيصال. رقم العملية: {payment.transfer_reference.slice(7)}</small>:<>
     <a href={'/api/admin/payments/'+payment.id+'/proof'} target="_blank" rel="noopener noreferrer">عرض إيصال الطالب الخاص</a>
     {payment.status==='pending'&&<img src={'/api/admin/payments/'+payment.id+'/proof'} loading="lazy" alt={'إيصال مُرسل من '+payment.student_name}/>}
    </>}
   </div>
   {payment.status==='pending'?<div className="sofia-payment-review-actions">
    <label className="sofia-payment-check">
     <input type="checkbox" checked={checked[payment.id]===true} onChange={e=>setChecked(current=>({...current,[payment.id]:e.target.checked}))}/>
     راجعت محفظتي بنفسي، وتأكدت من وصول {money(payment.amount_egp)} فعليًا من الرقم {payment.sender_phone||'غير مسجّل'}.
    </label>
    <button type="button" className="portal-primary-btn" disabled={busy!==''||checked[payment.id]!==true} onClick={()=>decide(payment,'approved')}><CheckCircle2 size={16}/> قبول الدفع وفتح الاشتراك 30 يومًا</button>
    <label>سبب الرفض الذي سيظهر للطالب<input type="text" value={reasons[payment.id]||''} onChange={e=>setReasons(current=>({...current,[payment.id]:e.target.value}))} placeholder="المبلغ لم يصل إلى المحفظة / رقم المرسل غير مطابق" maxLength={500}/></label>
    <button type="button" className="portal-soft-btn danger" disabled={busy!==''} onClick={()=>decide(payment,'rejected')}><AlertTriangle size={15}/> رفض إيصال التحويل</button>
   </div>:<p>{payment.status==='approved'?'تم اعتماد هذا التحويل بعد تأكيد وصول المبلغ.':'مرفوض: '+(payment.review_note||'لم يتم اعتماد التحويل')}</p>}
  </article>)}</div>}
 </section>;
}
