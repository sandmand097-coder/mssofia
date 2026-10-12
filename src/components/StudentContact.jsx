import React,{useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeft,CheckCircle2,Clock3,MessageCircle,PhoneCall,ShieldCheck} from 'lucide-react';
import {WHATSAPP_CONTACT_URL} from './whatsapp-contact.js';

const isPhone=value=>/^01[0125]\d{8}$/.test(value||'');

export default function StudentContact({bookings=[],refresh=()=>{}}){
 const [phones,setPhones]=useState({}),[busy,setBusy]=useState(''),[feedback,setFeedback]=useState({}),[consents,setConsents]=useState({});
 const eligible=useMemo(()=>bookings.filter(b=>Number(b.price)>0&&['pending','approved'].includes(b.status)),[bookings]);
 const contact=async booking=>{
  const phone=String(phones[booking.id]||booking.guardian_phone||'').trim();
  if(!isPhone(phone)){setFeedback(s=>({...s,[booking.id]:{error:'أدخل رقم موبايل مصري صحيح مكوّن من 11 رقمًا.'}}));return}
  if(consents[booking.id]!==true){setFeedback(s=>({...s,[booking.id]:{error:'يلزم موافقة ولي الأمر على استخدام رقمه للتواصل بشأن الاشتراك.'}}));return}
  setBusy(booking.id);setFeedback(s=>({...s,[booking.id]:null}));
  try{
   const response=await fetch('/api/bookings/'+encodeURIComponent(booking.id)+'/contact',{
    method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({phone,guardianConsent:true})
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||'تعذر حفظ رقم ولي الأمر.');
   setFeedback(s=>({...s,[booking.id]:{success:data.message}}));
   await refresh();
  }catch(error){setFeedback(s=>({...s,[booking.id]:{error:error.message}}))}
  finally{setBusy('')}
 };
 return <section className="portal-panel sofia-contact-panel" aria-label="التواصل ومراجعة الاشتراك يدويًا">
  <header className="sofia-contact-head"><ShieldCheck size={25}/><div>
   <h2>تأكيد الاشتراك مع الإدارة مباشرة</h2>
   <p>لا توجد بوابة دفع أو رفع إيصالات داخل الموقع. عند تحويل المبلغ خارج المنصة، راسل المُدرِّسة على واتساب أو اترك رقم ولي الأمر لتتواصل معك الإدارة.</p>
  </div></header>
  <div className="sofia-contact-notice" role="note">
   <CheckCircle2 size={19}/><p><strong>القرار يدوي 100%:</strong> لا يكفي إرسال رسالة أو رقم هاتف لتفعيل الدورة. تتأكد المُدرِّسة بنفسها من وصول المبلغ، ثم تقبل الاشتراك أو ترفضه.</p>
  </div>
  {!eligible.length?<div className="sofia-contact-empty"><p>لم يظهر لديك طلب حجز مدفوع بعد.</p><Link to="/courses" className="portal-soft-btn">استكشف الدورات <ArrowLeft size={15}/></Link></div>:
  <div className="sofia-contact-list">{eligible.map(b=>{
   const kind=b.status==='approved'?'renewal':'initial';
   const pending=b.contact_status==='pending',rejected=b.contact_status==='rejected';
   const wa=WHATSAPP_CONTACT_URL+'?text='+encodeURIComponent(
    'مرحبًا، أنا ولي أمر الطالب صاحب طلب '+b.course_title+'، ورقم الحجز '+b.id+
    '. أرجو مراجعة الاشتراك '+(kind==='renewal'?'وتجديده':'وتأكيد وصول التحويل')+'.');
   return <article className="sofia-contact-card" key={b.id}>
    <div className="sofia-contact-title"><div><h3>{b.course_title}</h3><small>{kind==='renewal'?'تواصل بشأن التجديد الشهري':'طلب اشتراك جديد'}</small></div><span className={'sofia-contact-chip '+(pending?'waiting':rejected?'rejected':'')}>{pending?'بانتظار مراجعة الإدارة':rejected?'لم يتم اعتماد التحويل بعد':b.status==='approved'?'الحجز الأول معتمد':'طلب قيد الانتظار'}</span></div>
    {rejected&&b.contact_review_note&&<p className="sofia-contact-reject" role="status">ملاحظة الإدارة: {b.contact_review_note}</p>}
    <a className="sofia-contact-wa" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={19}/> راسل المُدرِّسة على واتساب <ArrowLeft size={17}/></a>
    <form onSubmit={e=>{e.preventDefault();void contact(b)}} className="sofia-contact-form">
     <p><PhoneCall size={17}/> أو اترك رقم ولي الأمر للمتابعة</p>
     <label htmlFor={'sofia-contact-phone-'+b.id}>رقم ولي الأمر</label>
     <input id={'sofia-contact-phone-'+b.id} dir="ltr" type="tel" autoComplete="tel" inputMode="numeric" pattern="01[0125][0-9]{8}" maxLength={11} required placeholder="01XXXXXXXXX" value={phones[b.id]??b.guardian_phone??''} onChange={e=>setPhones(s=>({...s,[b.id]:e.target.value}))}/>
     <label className="sofia-contact-consent"><input type="checkbox" checked={consents[b.id]===true} onChange={e=>setConsents(s=>({...s,[b.id]:e.target.checked}))}/> أنا ولي الأمر أو أُدخل الرقم بموافقته، وأوافق على التواصل بخصوص هذا الاشتراك فقط.</label>
     <button className="portal-primary-btn" type="submit" disabled={busy!==''||!consents[b.id]}><PhoneCall size={17}/>{busy===b.id?'جارٍ إرسال الطلب...':'حفظ الرقم وإرسال طلب المراجعة'}</button>
     {feedback[b.id]?.error&&<p className="sofia-contact-reject" role="alert">{feedback[b.id].error}</p>}
     {feedback[b.id]?.success&&<p className="sofia-contact-success" role="status"><CheckCircle2 size={16}/>{feedback[b.id].success}</p>}
    </form>
    <p className="sofia-contact-foot"><Clock3 size={16}/> إذا لم يصلك رد، استخدم واتساب الرسمي. لا ترسل أرقامًا سرية أو رموز OTP لأي شخص.</p>
   </article>
  })}</div>}
 </section>;
}
