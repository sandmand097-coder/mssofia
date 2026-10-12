import React,{useState} from 'react';
import {Smartphone,ShieldCheck,CheckCircle2,RefreshCw,MessageCircle} from 'lucide-react';
import {WHATSAPP_CONTACT_URL} from './whatsapp-contact.js';

const money=n=>Number(n).toLocaleString('ar-EG')+' جنيه';
const validPhone=s=>/^01[0125]\d{8}$/.test(s);
export default function StudentPayments({bookings=[],refresh}){
 const [phones,setPhones]=useState({}),[busy,setBusy]=useState(''),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const paid=bookings.filter(b=>Number(b.price)>0);
 const submit=async booking=>{
  if(busy)return;
  const phone=String(phones[booking.id]||'').trim();
  if(!validPhone(phone)){setError('اكتب رقم موبايل مصري صحيح مكوّن من 11 رقمًا للتواصل معك.');return}
  setBusy(booking.id);setError('');setSuccess('');
  try{
   const response=await fetch('/api/bookings/'+encodeURIComponent(booking.id)+'/payment-notice',{
    method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({sender_phone:phone})
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error||'تعذّر إرسال طلب التواصل');
   setSuccess(result.message||'تم تسجيل بلاغك، وسيتم التواصل معك بعد مراجعة الإدارة.');
   await refresh?.();
  }catch(e){setError(e.message)}
  finally{setBusy('')}
 };
 return <section className="portal-panel sofia-payment-panel" aria-label="الإبلاغ عن تحويل ومراجعة الإدارة">
  <h2><Smartphone size={23}/> إبلاغ الإدارة بعد التحويل</h2>
  <p>لا يوجد دفع إلكتروني داخل موقع Miss Sofia. بعد التنسيق مع الإدارة وإتمام التحويل خارج الموقع، اترك رقم الموبايل للتواصل أو أرسل رسالة على واتساب. <strong>إرسال الرسالة لا يعني قبول الدفع أو تفعيل الاشتراك.</strong></p>
  <div className="sofia-payment-instruction"><ShieldCheck size={21}/> المديرة وحدها تتحقق من وصول المبلغ فعليًا في محفظتها، وتختار «قبول» أو «رفض». لا تشارك كلمة المرور أو رمز التحقق OTP أو بيانات مالية سرية.</div>
  <a href={WHATSAPP_CONTACT_URL} target="_blank" rel="noopener noreferrer" className="portal-soft-btn" style={{display:'inline-flex',gap:8,alignItems:'center',marginTop:14}}><MessageCircle size={16}/> إرسال رسالة إلى الإدارة على واتساب</a>
  {error&&<p role="alert" className="portal-alert">{error}</p>}
  {success&&<p role="status" className="sofia-payment-success"><CheckCircle2 size={16}/>{success}</p>}
  {!paid.length?<p>اختار دورة مدفوعة وأرسل طلب حجز؛ ستتمكن بعدها من ترك رقم التواصل هنا.</p>:
   paid.map(booking=><article className="sofia-payment-card" key={booking.id}>
    <h3>{booking.course_title||booking.title||'الاشتراك بالدورة'}</h3>
    <p>قيمة الاشتراك المعلنة: <strong>{money(booking.price)}</strong>. تأكد من تفاصيل الحصص والمبلغ النهائي مع الإدارة قبل أي تحويل.</p>
    {booking.status==='approved'?<p role="status" className="sofia-payment-success"><CheckCircle2 size={16}/> تم تفعيل حجزك بعد مراجعة الإدارة.</p>:
     booking.payment_status==='pending'?<div className="portal-alert" role="status">تم استلام بلاغك، والقرار قيد مراجعة الإدارة. لا تعِد إرسال الأموال أو البلاغ.</div>:
     booking.status==='rejected'?<div className="portal-alert" role="status">الحجز مرفوض؛ تواصل مع الإدارة قبل أي إجراء جديد.</div>:
     <div className="sofia-payment-fields">
      {booking.payment_status==='rejected'&&<p className="portal-alert">لم تعتمد الإدارة البلاغ السابق: {booking.payment_note||'يرجى التواصل للتوضيح'}</p>}
      <label>رقم الهاتف للتواصل بعد التحويل
       <input type="tel" inputMode="numeric" dir="ltr" autoComplete="tel" maxLength={11} value={phones[booking.id]||''} onChange={e=>setPhones(q=>({...q,[booking.id]:e.target.value}))} placeholder="01012345678"/>
      </label>
      <button className="portal-primary-btn" type="button" disabled={busy!==''} onClick={()=>submit(booking)}><RefreshCw size={16}/>{busy===booking.id?'جارٍ إرسال البلاغ...':'إرسال رقم التواصل للمراجعة اليدوية'}</button>
     </div>
    }
   </article>)}
  <p className="sofia-payment-footer-note"><ShieldCheck size={15}/> لا يوجد خصم تلقائي، ولا تجديد تلقائي، ولا موافقة إلكترونية تلقائية. يبدأ الوصول بعد قرار الإدارة الصريح فقط.</p>
 </section>;
}
