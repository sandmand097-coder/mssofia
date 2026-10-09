import React from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeft,CalendarCheck2,Gift,ShieldCheck,Sparkles} from 'lucide-react';

// Introductory monthly teaching offer, not a payment receipt or automatic subscription.
export const FIRST_MONTH_EGP=100;
export const REGULAR_MONTH_EGP=170;
export function LaunchOffer({compact=false}){
 return <section id="offer" className={'sofia-launch-offer'+(compact?' is-compact':'')} aria-label="عرض الشهر الأول لشرح العلوم">
  <div className="sofia-container sofia-launch-offer-inner">
   <div className="sofia-offer-intro">
    <span className="sofia-offer-eyebrow"><Gift size={18}/> عرض خاص على اشتراك شرح العلوم</span>
    <h2>ابدأ أول شهر مع <em>Mrs Sofia</em> بسعر مميز!</h2>
    <p>شرح علوم أونلاين بأسلوب مبسّط ومتابعة منظمة. العرض للاشتراك الشهري الجديد، والسعر يعود للقيمة المعتادة من الشهر الثاني.</p>
    <div className="sofia-offer-terms"><span><CalendarCheck2 size={16}/> أول شهر فقط بالسعر المخفّض</span><span><ShieldCheck size={16}/> الحجز بعد موافقة المدرسة</span></div>
   </div>
   <div className="sofia-offer-price-panel">
    <div className="sofia-offer-price-top"><span><Sparkles size={16}/> للشهر الأول</span><span className="sofia-offer-savings">وفّر 70 جنيه</span></div>
    <div className="sofia-offer-price-values"><strong>100 <small>جنيه</small></strong><del aria-label="السعر المعتاد 170 جنيه">170 جنيه</del></div>
    <p>من الشهر الثاني: <b>170 جنيه شهريًا</b></p>
    <Link to="/courses" className="sofia-offer-cta">استكشف شرح العلوم <ArrowLeft size={18}/></Link>
    <small className="sofia-offer-disclaimer">لا يوجد تحصيل إلكتروني داخل الموقع حاليًا؛ يتم تأكيد تفاصيل الاشتراك مع إدارة المدرسة قبل الدفع.</small>
   </div>
  </div>
 </section>;
}
