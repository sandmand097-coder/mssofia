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
 const load=async()=>{const data=await api('/admin/renewals');setRecords(data);setReady(true);};
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
 if(!ready)return <section className="portal-panel">جارٍ تحميل تجديدات الاشتراكات...</section>;
 if(!records.enabled)return <section className="portal-panel"><h2>تجديدات الاشتراك الشهري</h2><p>التجديد لم يُفتح بعد. يلزم ترحيل قاعدة البيانات وتأكيد خصوصية تخزين الإيصالات قبل تشغيله.</p></section>;
 const pending=records.renewals.filter(r=>r.status==='pending');
 return <section className="portal-panel sofia-payment-panel" aria-label="إدارة تجديد الاشتراكات">
  <h2>مراجعة تجديدات الاشتراكات الشهرية</h2>
  <p>وافقي على كل دفعة بعد التأكد من وصول قيمتها إلى المحفظة الرسمية. صورة الإيصال ليست إثباتًا كافيًا.</p>
  <button type="button" className="portal-soft-btn" onClick={()=>load().catch(e=>setError(e.message))}><RefreshCw size={15}/> تحديث الطلبات</button>
  {error&&<div className="portal-alert" role="alert">{error}</div>}
  {pending.length===0?<p>لا توجد تجديدات قيد المراجعة.</p>:pending.map(p=><article className="sofia-payment-review" key={p.id}>
   <h3>{p.student_name} — {p.course_title}</h3>
   <p>قيمة التجديد: <strong>{Number(p.amount_egp).toLocaleString('ar-EG')} جنيه</strong></p>
   <p>هاتف التحويل: <strong dir="ltr">{p.sender_phone}</strong></p>
   <a href={'/api/admin/renewals/'+p.id+'/proof'} target="_blank" rel="noopener noreferrer">عرض إيصال التجديد الخاص للإدارة</a>
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
