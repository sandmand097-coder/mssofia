import React,{useEffect,useState} from 'react';
import {CheckCircle2,AlertTriangle,RefreshCw} from 'lucide-react';

const api=async(path,opts={})=>{
 const res=await fetch('/api'+path,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...opts});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(data.error||'تعذر إتمام العملية');
 return data;
};
export default function AdminRenewals(){
 const [records,setRecords]=useState({enabled:false,renewals:[]}),[ready,setReady]=useState(false),
  [error,setError]=useState(''),[busy,setBusy]=useState(''),[verified,setVerified]=useState({}),[reasons,setReasons]=useState({});
 const [available,setAvailable]=useState([]),[selectedBooking,setSelectedBooking]=useState('');
 const [manualPhone,setManualPhone]=useState(''),[manualReference,setManualReference]=useState(''),[manualAmount,setManualAmount]=useState(''),[manualVerified,setManualVerified]=useState(false),[manualMessage,setManualMessage]=useState('');
 const load=async()=>{
  const [data,eligible]=await Promise.all([api('/admin/renewals'),api('/admin/renewals/without-proof')]);
  setRecords(data);setAvailable(eligible.bookings||[]);setReady(true);
 };
 useEffect(()=>{load().catch(e=>{setReady(true);setError(e.message)})},[]);
 const decide=async(item,decision)=>{
  setError('');
  if(decision==='approved'&&verified[item.id]!==true){setError('يجب تأكيد وصول التحويل الفعلي على هاتف المدرسة');return}
  if(decision==='rejected'&&String(reasons[item.id]||'').trim().length<5){setError('اكتب سبب الرفض أولًا');return}
  setBusy(item.id);
  try{
   await api('/admin/renewals/'+item.id+'/review',{method:'POST',body:JSON.stringify({
    decision,confirmedOnPhone:verified[item.id]===true,reason:reasons[item.id]||''
   })});
   await load();setVerified(v=>({...v,[item.id]:false}));
  }catch(e){setError(e.message)}
  finally{setBusy('')}
 };
 const chosen=available.find(a=>a.booking_id===selectedBooking);
 const approveManual=async(e)=>{
  e.preventDefault();if(busy)return;
  setError('');setManualMessage('');
  if(!chosen){setError('اختاري الطالب أولًا');return}
  if(!manualVerified){setError('لا يمكن اعتماد تجديد بدون التحقق من وصول التحويل');return}
  if(!/^01[0125]\\d{8}$/.test(manualPhone.trim())){setError('رقم المحفظة المرسلة غير صحيح');return}
  if(!/^[A-Za-z0-9][A-Za-z0-9./_-]{4,63}$/.test(manualReference.trim())){setError('أدخلي رقم العملية الحقيقي من تطبيق فودافون كاش');return}
  if(Number(manualAmount)!==Number(chosen.amount_egp)){setError('المبلغ المكتوب لا يساوي قيمة التجديد');return}
  setBusy('manual');
  try{
   await api('/admin/bookings/'+chosen.booking_id+'/manual-renewal',{method:'POST',body:JSON.stringify({
    sender_phone:manualPhone.trim(),transfer_reference:manualReference.trim(),amount_egp:Number(manualAmount),confirmedOnPhone:true
   })});
   setManualMessage('تم اعتماد تجديد '+chosen.student_name+' لمدة 30 يومًا، دون رفع صورة إيصال.');
   setSelectedBooking('');setManualPhone('');setManualReference('');setManualAmount('');setManualVerified(false);
   await load();
  }catch(e){setError(e.message)}finally{setBusy('')}
 };
 if(!ready)return <section className="portal-panel">جارٍ تحميل تجديدات الاشتراكات...</section>;
 if(!records.enabled)return <section className="portal-panel"><h2>تجديدات الاشتراك الشهري</h2><p>التجديد لم يُفتح بعد. يلزم ترحيل قاعدة البيانات وتأكيد خصوصية تخزين الإيصالات قبل تشغيله.</p></section>;
 const pending=records.renewals.filter(r=>r.status==='pending');
 return <section className="portal-panel sofia-payment-panel" aria-label="إدارة تجديد الاشتراكات">
  <h2>مراجعة تجديدات الاشتراكات الشهرية</h2>
  <p>وافقي على كل دفعة بعد التأكد من وصول قيمتها إلى المحفظة الرسمية. صورة الإيصال ليست إثباتًا كافيًا.</p>
  <button type="button" className="portal-soft-btn" onClick={()=>load().catch(e=>setError(e.message))}><RefreshCw size={15}/> تحديث الطلبات</button>
  {error&&<div className="portal-alert" role="alert">{error}</div>}
  <section className="sofia-payment-manual" aria-label="تجديد اشتراك بدون إيصال">
   <h3><CheckCircle2 size={18}/> تجديد اشتراك بدون صورة إيصال</h3>
   <p>إذا نسي الطالب إرسال لقطة الشاشة، يمكنك اعتماد الشهر التالي بعد رؤية التحويل الوارد في محفظة فودافون كاش. لن يظهر الطالب هنا إلا في آخر خمسة أيام من اشتراكه أو بعد انتهائه.</p>
   {!available.length?<p>لا توجد تجديدات مؤهلة للاعتماد اليدوي الآن.</p>:
    <form className="sofia-payment-manual-form" onSubmit={approveManual}>
     <label>اختاري الطالب والدورة
      <select required value={selectedBooking} onChange={e=>{const next=available.find(r=>r.booking_id===e.target.value);setSelectedBooking(e.target.value);setManualAmount(next?String(next.amount_egp):'');setManualVerified(false)}}>
       <option value="">اختاري حجزًا مؤهلًا</option>
       {available.map(item=><option value={item.booking_id} key={item.booking_id}>{item.student_name} — {item.course_title} ({item.amount_egp} جنيه)</option>)}
      </select>
     </label>
     <label>رقم المرسل كما ظهر في المحفظة<input dir="ltr" type="tel" pattern="01[0125][0-9]{8}" maxLength={11} value={manualPhone} onChange={e=>{setManualPhone(e.target.value);setManualVerified(false)}} required/></label>
     <label>رقم عملية التحويل<input dir="ltr" type="text" minLength={5} maxLength={64} value={manualReference} onChange={e=>{setManualReference(e.target.value);setManualVerified(false)}} required/></label>
     <label>المبلغ الوارد (جنيه)<input type="number" min="1" inputMode="numeric" value={manualAmount} onChange={e=>{setManualAmount(e.target.value);setManualVerified(false)}} required/></label>
     {chosen&&<p>المبلغ المطلوب للتجديد: <strong>{chosen.amount_egp} جنيه</strong></p>}
     <label className="sofia-payment-check"><input type="checkbox" checked={manualVerified} onChange={e=>setManualVerified(e.target.checked)}/> أؤكد أنني رأيت وصول هذا المبلغ من نفس الرقم ورقم العملية في محفظتي شخصيًا.</label>
     <button className="portal-primary-btn" type="submit" disabled={busy!==''||!manualVerified||!chosen||Number(manualAmount)!==Number(chosen?.amount_egp)}><CheckCircle2 size={16}/> اعتماد تجديد 30 يومًا بدون إيصال</button>
    </form>}
  </section>
  {manualMessage&&<div role="status" className="sofia-payment-success">{manualMessage}</div>}
  {pending.length===0?<p>لا توجد تجديدات قيد المراجعة.</p>:pending.map(p=><article className="sofia-payment-review" key={p.id}>
   <h3>{p.student_name} — {p.course_title}</h3>
   <p>قيمة التجديد: <strong>{Number(p.amount_egp).toLocaleString('ar-EG')} جنيه</strong></p>
   <p>هاتف التحويل: <strong dir="ltr">{p.sender_phone}</strong></p>
   {p.transfer_reference?.startsWith('MANUAL-')?<small>تم الاعتماد يدويًا دون صورة إيصال</small>:<a href={'/api/admin/renewals/'+p.id+'/proof'} target="_blank" rel="noopener noreferrer">عرض إيصال التجديد الخاص للإدارة</a>}
   <div className="sofia-payment-review-actions">
    <label className="sofia-payment-check"><input type="checkbox" checked={verified[p.id]===true} onChange={e=>setVerified(v=>({...v,[p.id]:e.target.checked}))}/> راجعت وصول المبلغ فعليًا إلى حساب Vodafone Cash للمدرسة.</label>
    <button className="portal-primary-btn" disabled={busy===p.id||verified[p.id]!==true} onClick={()=>decide(p,'approved')}><CheckCircle2 size={16}/> اعتماد التجديد 30 يومًا</button>
    <label>سبب الرفض<input type="text" maxLength={500} value={reasons[p.id]||''} onChange={e=>setReasons(v=>({...v,[p.id]:e.target.value}))} placeholder="مثال: التحويل غير موجود على المحفظة"/></label>
    <button className="portal-soft-btn danger" disabled={busy===p.id} onClick={()=>decide(p,'rejected')}><AlertTriangle size={16}/> رفض الطلب</button>
   </div>
  </article>)}
  <h3>سجل التجديدات</h3>
  <div className="portal-list">{records.renewals.slice(0,40).map(p=><div className="portal-list-item" key={p.id}>
   <div className="portal-list-copy"><strong>{p.student_name} — {p.course_title}</strong>
    <small>{Number(p.amount_egp)} جنيه • {p.status==='approved'?'معتمد':p.status==='rejected'?'مرفوض':'بانتظار المراجعة'}</small>
    {p.period_end&&<small>انتهاء الفترة: {new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeZone:'Africa/Cairo'}).format(new Date(p.period_end))}</small>}
   </div>
  </div>)}</div>
 </section>;
}
