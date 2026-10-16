import React from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeft,CalendarCheck2,Gift,ShieldCheck,Sparkles} from 'lucide-react';

// Introductory monthly teaching offer, not a payment receipt or automatic subscription.
export const FIRST_MONTH_EGP=100;
export const REGULAR_MONTH_EGP=170;
export function LaunchOffer({compact=false}){
 return <section id="offer" className={'sofia-launch-offer'+(compact?' is-compact':'')} aria-label="عرض الشهر الأول للاشتراك الشامل في العلوم">
  <div className="sofia-container sofia-launch-offer-inner">
   <div className="sofia-offer-intro">
    <span className="sofia-offer-eyebrow"><Gift size={18}/> عرض خاص على اشتراك العلوم الشامل</span>
    <h2>ابدأ أول شهر مع <em>Miss Sofia</em> باشتراك شامل</h2>
    <p>أول دفعة معتمدة تفتح للطالب كل الكورسات المنشورة لمدة 30 يومًا. العرض للاشتراك الجديد، والسعر يعود للقيمة المعتادة عند التجديد.</p>
    <div className="sofia-offer-terms"><span><CalendarCheck2 size={16}/> 30 يوم وصول شامل</span><span><ShieldCheck size={16}/> التفعيل بعد مراجعة الإدارة للتحويل</span></div>
   </div>
   <div className="sofia-offer-price-panel">
    <div className="sofia-offer-price-top"><span><Sparkles size={16}/> للشهر الأول</span><span className="sofia-offer-savings">وفّر 70 جنيه</span></div>
    <div className="sofia-offer-price-values"><strong>100 <small>جنيه</small></strong><del aria-label="السعر المعتاد 170 جنيه">170 جنيه</del></div>
    <p>عند التجديد: <b>170 جنيه لكل 30 يومًا</b></p>
    <Link to="/courses" className="sofia-offer-cta">استكشف الكورسات <ArrowLeft size={18}/></Link>
    <small className="sofia-offer-disclaimer">لا يوجد خصم إلكتروني تلقائي. نسّق مع الإدارة على وسيلة التحويل الرسمية، وبعد وصول التحويل تعتمد الإدارة الاشتراك يدويًا.</small>
   </div>
  </div>
 </section>;
}
