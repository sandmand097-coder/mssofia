import React,{useEffect,useState} from 'react';
import {CalendarDays,Users,Download,CheckCircle2} from 'lucide-react';

export default function AttendancePanel({courses}) {
 const [courseId,setCourseId]=useState(courses[0]?.id||'');
 const [report,setReport]=useState(null);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!courseId)return;
  const abort=new AbortController();
  setBusy(true);setError('');
  fetch('/api/courses/'+courseId+'/attendance',{credentials:'same-origin',signal:abort.signal})
   .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'تعذر تحميل التقرير');return d})
   .then(setReport).catch(e=>{if(e.name!=='AbortError')setError(e.message)}).finally(()=>setBusy(false));
  return ()=>abort.abort();
 },[courseId]);
 const exportCsv=()=>{
  if(!report)return;
  const lines=[['الحصة','اسم الطالب','البريد الإلكتروني','وقت الدخول'],...report.attendance.map(x=>[x.lesson_title,x.student_name,x.student_email,new Date(x.joined_at).toLocaleString('ar-EG')])];
  const escape=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  const csv='\uFEFF'+lines.map(row=>row.map(escape).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='attendance-report.csv';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <div className="attendance-panel">
  <div className="attendance-toolbar">
   <div><h2>تقرير حضور الطلاب</h2><p>يُسجل الحضور عند اتصال الطالب فعليًا بغرفة الفيديو عبر LiveKit.</p></div>
   <div className="attendance-controls">
    <select aria-label="اختر الدورة" value={courseId} onChange={e=>setCourseId(e.target.value)}>
     {courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}
    </select>
    <button className="btn small" onClick={exportCsv} disabled={!report?.attendance?.length}><Download size={16}/> تصدير CSV</button>
   </div>
  </div>
  {error&&<p role="alert" className="attendance-error">{error}</p>}
  {busy?<div className="loading">جارٍ تحميل الحضور...</div>:report&&<div className="dash-panel">
   <div className="attendance-summary">
    <div><Users size={18}/><b>{new Set(report.attendance.map(x=>x.user_id)).size}</b><span>طلاب شاركوا</span></div>
    <div><CalendarDays size={18}/><b>{report.lessons.length}</b><span>حصص مجدولة</span></div>
   </div>
   {report.attendance.length?<div className="attendance-table-wrap"><table className="attendance-table">
    <thead><tr><th>الطالب</th><th>الحصة</th><th>موعد الدخول</th><th>الحالة</th></tr></thead>
    <tbody>{report.attendance.map(a=><tr key={a.lesson_id+'-'+a.user_id}>
      <td><b>{a.student_name}</b><small>{a.student_email}</small></td>
      <td>{a.lesson_title}</td><td>{new Date(a.joined_at).toLocaleString('ar-EG')}</td>
      <td><span className="status approved"><CheckCircle2 size={14}/> حضر</span></td>
    </tr>)}</tbody>
   </table></div>:<div className="empty-state"><Users size={32}/><h3>لا توجد بيانات حضور مؤكدة بعد</h3><p>ستظهر البيانات بعد تفعيل LiveKit وإرسال إشعارات الاتصال الموثّقة للخادم.</p></div>}
  </div>}
 </div>;
}
