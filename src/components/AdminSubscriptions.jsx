import React,{useEffect,useState} from 'react';
import {Search,RefreshCw,CalendarClock,ShieldCheck} from 'lucide-react';
import {dateTimeLabel} from './PortalShell.jsx';

const stateLabel={
 monthly:'ساري',free:'مجاني معتمد',expired:'منتهي',
 payment_required:'الدفع غير معتمد',pending:'قيد المراجعة',invalid:'غير صالح'
};
export default function AdminSubscriptions(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[search,setSearch]=useState(''),[filter,setFilter]=useState('all');
 const load=async()=>{
  const result=await fetch('/api/admin/subscriptions',{credentials:'same-origin'});
  const body=await result.json();
  if(!result.ok)throw Error(body.error||'تعذر تحميل الاشتراكات');
  setData(body);setError('');
 };
 useEffect(()=>{load().catch(e=>setError(e.message))},[]);
 const rows=(data?.memberships||[]).filter(m=>{
  const matches=(m.student_name+' '+m.student_email+' '+m.course_title).toLowerCase().includes(search.toLowerCase());
  const status=filter==='active'?m.live_access_active:filter==='expiring'?m.live_access_active&&m.live_access_days_remaining!==null&&m.live_access_days_remaining<=5:filter==='expired'?m.live_access_status==='expired':true;
  return matches&&status;
 });
 return <section className="portal-panel" aria-label="الاشتراكات الشهرية">
  <h2><CalendarClock size={21}/> متابعة الاشتراكات الشهرية</h2>
  <p>الاشتراكات السارية والانتهاء والتجديد مبنيان على الدفعات المعتمدة في الخادم، وليس على حالة الحجز وحدها. لا تتحول صورة الإيصال تلقائيًا إلى اشتراك.</p>
  <div className="portal-metrics">
   <div className="portal-panel"><strong>اشتراكات سارية</strong><h3>{data?.counts?.active??'—'}</h3></div>
   <div className="portal-panel"><strong>تنتهي خلال 5 أيام</strong><h3>{data?.counts?.expiringSoon??'—'}</h3></div>
   <div className="portal-panel"><strong>اشتراكات منتهية</strong><h3>{data?.counts?.expired??'—'}</h3></div>
  </div>
  <div className="portal-filters">
   <div className="portal-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث باسم الطالب أو الدورة"/></div>
   <select aria-label="فلتر الاشتراكات" value={filter} onChange={e=>setFilter(e.target.value)}>
    <option value="all">كل الاشتراكات</option><option value="active">السارية</option>
    <option value="expiring">قرب انتهاء الاشتراك</option><option value="expired">المنتهية</option>
   </select>
   <button className="portal-soft-btn" type="button" onClick={()=>load().catch(e=>setError(e.message))}><RefreshCw size={15}/> تحديث</button>
  </div>
  {error&&<div className="portal-alert" role="alert">{error}</div>}
  {!data?<p>جارٍ تحميل الاشتراكات...</p>:rows.length===0?<p>لا توجد اشتراكات تطابق هذه الخيارات.</p>:
   <div className="portal-table-scroll"><table className="portal-table"><thead><tr>
    <th>الطالب</th><th>الكورس</th><th>الحالة</th><th>صلاحية الحضور</th>
   </tr></thead><tbody>{rows.map(m=><tr key={m.id}>
    <td><strong>{m.student_name}</strong><small>{m.student_email}</small></td>
    <td>{m.course_title}</td>
    <td>{stateLabel[m.live_access_status]||'بانتظار المراجعة'}
     {m.live_access_active&&m.live_access_days_remaining!==null&&m.live_access_days_remaining<=5&&<small>قرب الانتهاء</small>}</td>
    <td>{m.live_access_expires_at?dateTimeLabel(m.live_access_expires_at):m.live_access_status==='free'?'دورة مجانية':'—'}</td>
   </tr>)}</tbody></table></div>}
  <p className="sofia-payment-footer-note"><ShieldCheck size={15}/> تجديد الاشتراك ومراجعة الإيصالات من قسم المدفوعات. لا تعتمد الحجز المدفوع دون فحص المبلغ على هاتف المدرسة.</p>
 </section>;
}
