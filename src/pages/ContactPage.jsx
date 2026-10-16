import React from 'react';
import {ArrowLeft,MessageCircle,Phone,ShieldCheck,BookOpen,WalletCards,UserRoundCheck} from 'lucide-react';
import {Link} from 'react-router-dom';
import {WHATSAPP_CONTACT_E164,WHATSAPP_CONTACT_LOCAL,WHATSAPP_CONTACT_URL} from '../components/whatsapp-contact.js';

export default function ContactPage(){
 return <main className="sofia-site sofia-page-bg" dir="rtl">
  <section className="sofia-page-heading"><div className="sofia-container">
   <span className="sofia-kicker"><i/> تواصل مع مس صوفيا</span>
   <h1>نساعدك قبل التسجيل <em>وبعد الاشتراك</em></h1>
   <p>للاستفسار عن الكورسات والمواعيد والاشتراك أو متابعة طلب قائم، استخدم قناة التواصل الرسمية المناسبة لك.</p>
  </div></section>
  <section className="sofia-section"><div className="sofia-container">
   <div className="sofia-method-grid">
    <article className="sofia-method-card"><span className="sofia-method-num">01</span><div className="sofia-method-icon"><MessageCircle size={28}/></div>
     <h2>واتساب الرسمي</h2><p>للأسئلة السريعة عن الكورسات والمواعيد والاشتراكات.</p>
     <a className="sofia-cta" href={WHATSAPP_CONTACT_URL} target="_blank" rel="noopener noreferrer">فتح واتساب <ArrowLeft size={17}/></a>
    </article>
    <article className="sofia-method-card"><span className="sofia-method-num">02</span><div className="sofia-method-icon"><Phone size={28}/></div>
     <h2>اتصال هاتفي</h2><p>يمكنك الاتصال مباشرة على رقم التواصل الرسمي.</p>
     <a className="sofia-cta" href={'tel:'+WHATSAPP_CONTACT_E164} dir="ltr">{WHATSAPP_CONTACT_LOCAL}</a>
    </article>
    <article className="sofia-method-card"><span className="sofia-method-num">03</span><div className="sofia-method-icon"><UserRoundCheck size={28}/></div>
     <h2>لوحة الطالب</h2><p>لمتابعة الحجز أو إبلاغ الإدارة بعد التحويل، استخدم حساب الطالب حتى تظل الحالة مسجلة داخل المنصة.</p>
     <Link className="sofia-cta" to="/student">فتح لوحة الطالب <ArrowLeft size={17}/></Link>
    </article>
   </div>
   <div className="sofia-auth-notice" role="note" style={{marginTop:28,alignItems:'flex-start'}}>
    <ShieldCheck size={22}/><div><strong>خصوصيتك مهمة</strong><p style={{margin:'6px 0 0'}}>لا ترسل كلمة مرور، رمز OTP، بيانات بطاقة بنكية، أو أي بيانات مالية حساسة عبر واتساب أو الهاتف. عند طلب استرداد أو تصحيح بيانات، يكفي اسم ولي الأمر ومرجع الحجز.</p></div>
   </div>
   <div className="sofia-two-col" style={{marginTop:28}}>
    <section className="portal-panel"><h2><BookOpen size={20}/> قبل الاشتراك</h2><p>راجع وصف الكورسات وجدول الحصص، واسأل عن أي نقطة غير واضحة قبل التحويل. أول دفعة معتمدة تفعّل الوصول الشامل إلى كل الكورسات المنشورة لمدة 30 يومًا.</p></section>
    <section className="portal-panel"><h2><WalletCards size={20}/> الدفع والاسترداد</h2><p>الدفع يدوي وخارج الموقع، ولا يوجد خصم تلقائي. الإدارة تعتمد الاشتراك بعد مراجعة التحويل. لتفاصيل الإلغاء والاسترداد راجع شروط الاشتراك.</p><Link to="/terms">شروط الاشتراك والاسترداد <ArrowLeft size={15}/></Link></section>
   </div>
  </div></section>
 </main>;
}
