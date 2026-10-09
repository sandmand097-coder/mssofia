import React,{useEffect,useState} from 'react';
import {CheckCircle2,ShieldCheck,Smartphone,RefreshCw,AlertTriangle} from 'lucide-react';
export default function AdminPayments(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[checked,setChecked]=useState({}),[reasons,setReasons]=useState({});
 const load=async()=>{const response=await fetch('/api/admin/payments',{credentials:'same-origin'});const result=await response.json();if(!response.ok)throw Error(result.error||'تعذر تحميل التحويلات');setData(result.payments)};
 useEffect(()=>{load().catch(e=>setError(e.message))},[]);
 const decide=async(payment,decision)=>{
  setError('');
  if(decision==='approved'&&!checked[payment.id]){setError('أكّدي أولًا أنك رأيت وصول المبلغ على هاتف فودافون كاش');return}
  if(decision==='rejected'&&String(reasons[payment.id]||'').trim().length<5){setError('اكتبي سبب رفض الإيصال للطالب');return}
  setBusy(payment.id);
  try{const response=await fetch('/api/admin/payments/'+payment.id+'/review',{credentials:'same-origin',method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision,confirmedOnPhone:checked[payment.id]===true,reason:reasons[payment.id]||''})});const result=await response.json();if(!response.ok)throw Error(result.error||'تعذرت المراجعة');await load();setChecked(s=>({...s,[payment.id]:false}))}
  catch(e){setError(e.message)}finally{setBusy('')}
 };
 return <section className="portal-panel sofia-payment-panel">
  <h2><Smartphone size={22}/> مراجعة تحويلات فودافون كاش</h2>
  <p>المديرة تتحقق من وصول مبلغ التحويل على هاتف المدرسة ثم تضغط الموافقة. <strong>صورة الإيصال وحدها ليست إثبات وصول الأموال.</strong></p>
  <div className="sofia-payment-instruction"><ShieldCheck size={21}/> تأكدي من المبلغ ورقم العملية وعدم تكرار التحويل قبل قبول الطالب وفتح الحصص.</div>
  {error&&<div role="alert" className="portal-alert">{error}</div>}
  <button className="portal-soft-btn" onClick={()=>load().catch(e=>setError(e.message))}><RefreshCw size={15}/> تحديث التحويلات</button>
  {!data?<p>جارٍ تحميل إيصالات التحويلات...</p>:!data.length?<p>لا توجد تحويلات مُرسلة للمراجعة حتى الآن.</p>:<div className="sofia-payments-review">{data.map(p=><article className="sofia-payment-review" key={p.id}>
   <div className="sofia-payment-review-head"><h3>{p.student_name}</h3><span className={'sofia-payment-review-status status-'+p.status}>{p.status==='approved'?'مقبول':p.status==='rejected'?'مرفوض':'بانتظار مراجعة'}</span></div>
   <p>{p.course_title} • <strong>{p.amount_egp} جنيه</strong></p><p>رقم العملية: <strong dir="ltr">{p.transfer_reference}</strong></p>
   <small>{p.student_email}{p.sender_last4?' • آخر 4 أرقام: '+p.sender_last4:''}</small>
   <div className="sofia-payment-proof"><a href={'/api/admin/payments/'+p.id+'/proof'} target="_blank" rel="noopener noreferrer">فتح صورة الإيصال في تبويب خاص</a>{p.status==='pending'&&<img src={'/api/admin/payments/'+p.id+'/proof'} loading="lazy" alt={'إيصال مقدم من '+p.student_name}/>}</div>
   {p.status==='pending'?<div className="sofia-payment-review-actions">
    <label className="sofia-payment-check"><input type="checkbox" checked={checked[p.id]===true} onChange={e=>setChecked(s=>({...s,[p.id]:e.target.checked}))}/> تأكدت بنفسي من وصول المبلغ على موبايل فودافون كاش، ومن تطابق رقم العملية</label>
    <button className="portal-primary-btn" disabled={busy===p.id||!checked[p.id]} onClick={()=>decide(p,'approved')}><CheckCircle2 size={16}/> تأكيد التحويل وقبول الطالب</button>
    <label>سبب الرفض<input value={reasons[p.id]||''} onChange={e=>setReasons(s=>({...s,[p.id]:e.target.value}))} placeholder="مثال: المبلغ لم يصل أو رقم العملية غير صحيح" maxLength={500}/></label>
    <button className="portal-soft-btn danger" disabled={busy===p.id} onClick={()=>decide(p,'rejected')}><AlertTriangle size={15}/> رفض الإيصال</button>
   </div>:<p>{p.status==='approved'?'تم تأكيد المبلغ والموافقة على الطالب.':'تم إبلاغ الطالب بسبب الرفض: '+(p.review_note||'')}</p>}
  </article>)}</div>}
 </section>
}
