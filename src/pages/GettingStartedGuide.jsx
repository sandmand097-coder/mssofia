import React,{useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeft,ArrowRight,BookOpen,CalendarClock,CheckCheck,CheckCircle2,ChevronLeft,ClipboardCheck,GraduationCap,Hand,HelpCircle,MessageCircle,PlayCircle,ShieldCheck,Smartphone,UserRoundPlus,Video,Volume2} from 'lucide-react';
import {WHATSAPP_CONTACT_URL} from '../components/whatsapp-contact.js';
import LiveLessonWalkthrough from '../components/LiveLessonWalkthrough.jsx';

// Labels and steps mirror the actual public registration, student portal,
// receipt-approval and LiveKit classroom UI. No demonstration sends real money,
// creates a real student, or joins an actual live room.
const STEPS=[
 {
  icon:UserRoundPlus,title:'اعمل حساب الطالب',short:'التسجيل بحساب ولي الأمر',
  subtitle:'ولي الأمر يبدأ التسجيل بنفسه من الموقع.',
  points:[
   'افتح «إنشاء حساب» واكتب اسم الطالب بالكامل.',
   'اقرأ سياسة الخصوصية والشروط، وفعّل موافقة ولي الأمر.',
   'اضغط «تسجيل الطالب باستخدام حساب ولي الأمر Google»، واختار بريد ولي الأمر. حاليًا إنشاء الحسابات الجديدة متاح عبر Google فقط.'
  ],
  preview:'إنشاء حساب الطالب',previewItems:['اسم الطالب بالكامل','موافقة ولي الأمر','التسجيل بحساب Google'],
  tip:'عندك حساب بالفعل؟ ادخل من «تسجيل الدخول» باستخدام نفس حساب ولي الأمر.',
  to:'/register',action:'افتح إنشاء الحساب'
 },
 {
  icon:BookOpen,title:'اختر بداية اشتراكك',short:'الكورسات وتفاصيل الحصص',
  subtitle:'تعرّف على الكورسات واختر الدورة التي ستبدأ منها طلب الاشتراك.',
  points:[
   'افتح «الكورسات» واختر أي دورة مناسبة لبدء طلب الاشتراك.',
   'راجع وصف الدورة والسعر ومدة الحصة، والجدول إذا كانت الإدارة نشرته.',
   'من تفاصيل الدورة، وأنت مسجل الدخول كطالب، اضغط «طلب الحجز». بعد اعتماد أول دفعة مدفوعة يصبح الاشتراك شاملًا لكل الكورسات المنشورة لمدة 30 يومًا.'
  ],
  preview:'تفاصيل الدورة',previewItems:['اسم الدورة والمرحلة','السعر ومدة الحصة','طلب الحجز'],
  tip:'الحجز في هذه المرحلة طلب قيد مراجعة الإدارة. التفعيل الشامل يبدأ فقط بعد اعتماد الإدارة للتحويل.',
  to:'/courses',action:'استكشف الكورسات'
 },
 {
  icon:Smartphone,title:'أبلغ الإدارة بعد التحويل',short:'رسالة أو رقم للتواصل',
  subtitle:'لا يوجد خصم إلكتروني تلقائي داخل الموقع؛ التنسيق والتحقق مع الإدارة مباشرة.',
  points:[
   'بعد إرسال الحجز، افتح «لوحة الطالب»، ثم قسم «إبلاغ الإدارة».',
   'نسّق مع الإدارة بشأن وسيلة التحويل الرسمية قبل إرسال أي مبلغ خارج الموقع.',
   'ارجع للوحة الطالب ← «إبلاغ الإدارة»، واترك رقم التواصل بعد التحويل. أو أرسل رسالة على واتساب الرسمي. لا يلزم رفع صورة إيصال.'
  ],
  preview:'إبلاغ الإدارة — لوحة الطالب',previewItems:['رقم الهاتف للتواصل','إرسال البلاغ للمراجعة','القرار عند المديرة فقط'],
  tip:'لا تحوّل أي مبلغ قبل تأكيد الرقم الرسمي والمبلغ مع الإدارة بنفسك. لا ترسل كلمة مرور أو رمز OTP أو بيانات مالية سرية.',
  to:'/student',action:'افتح لوحة الطالب'
 },
 {
  icon:ClipboardCheck,title:'استنى تأكيد الإدارة',short:'اعتماد الحجز والاشتراك',
  subtitle:'البلاغ أو الرسالة لا يثبتان دفع المبلغ ولا يفعّلان الحصة.',
  points:[
   'من لوحة الطالب افتح «طلباتي» لمتابعة حالة طلب الحجز.',
   'الإدارة تتأكد بنفسها من وصول التحويل، وبعدها تقبل الطلب وتفعّل الوصول الشامل.',
   'لو ظهر «قيد المراجعة»، لا تكرر التحويل أو البلاغ. لو ظهر «مرفوض»، تواصل مع الإدارة أولًا.'
  ],
  preview:'طلباتي',previewItems:['قيد المراجعة','مراجعة تحويل الإدارة','مقبول بعد التأكيد'],
  tip:'بعد اعتماد أول دفعة، يحصل الطالب على اشتراك شامل لمدة 30 يومًا في كل الكورسات المنشورة.',
  to:'/student',action:'تابع حالة طلبك'
 },
 {
  icon:CalendarClock,title:'ادخل في موعد الحصة',short:'جدول الحصص وقاعة الانتظار',
  subtitle:'مش محتاج رابط Zoom أو Google Meet منفصل.',
  points:[
   'بعد اعتماد الاشتراك، افتح «جدول الحصص» من لوحة الطالب لمشاهدة مواعيد كل الكورسات المتاحة لك بتوقيت القاهرة.',
   'اضغط «مشاهدة البث» أمام الحصة المطلوبة. يتاح دخول الطالب قبل الموعد بـ15 دقيقة، أو حين تسمح حالة استوديو المعلمة بالدخول مبكرًا.',
   'لو ظهرت «قاعة انتظار الحصة»، سيب الصفحة مفتوحة؛ الاتصال بالفيديو يبدأ عند بدء بث المعلمة.'
  ],
  preview:'جدول الحصص',previewItems:['موعد الحصة بتوقيت القاهرة','مشاهدة البث','قاعة انتظار الحصة'],
  tip:'لو زر الدخول غير متاح، راجع الموعد وحالة الاشتراك. يمكن فتح قاعة الانتظار قبل تشغيل بث الصوت والصورة.',
  to:'/student',action:'روح لجدول الحصص'
 },
 {
  icon:Video,title:'احضر وتفاعل في البث',short:'الصوت والفيديو ورفع اليد',
  subtitle:'الحصة بتتفتح داخل منصة Miss Sofia نفسها.',
  points:[
   'تابع شاشة شرح المعلمة، سواء بالكاميرا أو مشاركة الشاشة. لو الصوت ما اشتغلش، اضغط «اضغط هنا لتشغيل صوت الدرس».',
   'للسؤال، اضغط «ارفع إيدك». المعلمة تقدر تسمح لك بالمشاركة الصوتية، وبعدها تضغط بنفسك «تشغيل ميكروفوني» وتسمح للمتصفح.',
   'الكاميرا والميكروفون مقفولين للطالب افتراضيًا. المعلمة ما تقدرش تشغلهم من جهازك بدون إذنك.'
  ],
  preview:'الفصل المباشر',previewItems:['شاشة شرح المعلمة','اضغط هنا لتشغيل صوت الدرس','ارفع إيدك للسؤال'],
  tip:'لو النت فصل، استنى محاولات إعادة الاتصال أو ادخل الحصة تاني من جدولك. ظهور الحصة مرتبط باشتراك مقبول وساري.',
  to:'/student',action:'افتح حصصك'
 },
 {
  icon:CheckCheck,title:'تابع الحضور والتجديد',short:'بعد الحصة ومتابعة التقدم',
  subtitle:'كل خطوات الدراسة والاشتراك الشامل من لوحة واحدة.',
  points:[
   'بعد الحصة، راجع «الرئيسية» أو «دوراتي» في لوحة الطالب لمتابعة الحصص المسجلة في الحضور.',
   'لو قرب اشتراكك الشهري يخلص، تواصل مع الإدارة بشأن التجديد؛ التجديد يمدد الوصول لكل الكورسات المنشورة لمدة 30 يومًا جديدة.',
   'التجديد مش تلقائي. لو في مشكلة أو استفسار، استخدم واتساب الرسمي أسفل الموقع.'
  ],
  preview:'رحلتك التعليمية',previewItems:['دوراتي والحضور','مدة الاشتراك المتبقية','التواصل مع الإدارة'],
  tip:'الحضور يُسجّل عند دخول الطالب الفعلي للفصل، وليس بمجرد فتح صفحة الجدول.',
  to:'/student',action:'راجع لوحة الطالب'
 }
];

const FAQ=[
 ['هل لازم أعمل حساب باسم الطفل؟','اسم الطالب بيتكتب في نموذج التسجيل، لكن الحساب مرتبط ببريد ولي الأمر المؤكد عبر Google وموافقته. استخدم نفس بريد ولي الأمر عند العودة.'],
 ['هل الموقع بياخد فلوس تلقائيًا؟','لا. لا يوجد خصم تلقائي. التحويل يتم يدويًا بعد التنسيق مع الإدارة، والتفعيل يتم فقط بعد مراجعة الإدارة للتحويل.'],
 ['إزاي أبلغ الإدارة بعد التحويل؟','من لوحة الطالب اختار «إبلاغ الإدارة» واكتب رقم هاتفك، أو ابعت رسالة على واتساب الرسمي. المديرة هي اللي تؤكد وصول المبلغ فعليًا ثم تقبل أو ترفض.'],
 ['هل لازم أنزّل برنامج عشان الحصة؟','الحصة المباشرة داخل موقع Miss Sofia. استخدم متصفحًا محدثًا وإنترنت مستقرًا؛ وقد يطلب المتصفح إذن تشغيل الصوت أو الميكروفون عندما تسمح المعلمة بالمشاركة.'],
 ['مش سامع الصوت أو الحصة ما فتحتش؟','تأكد من مستوى الصوت، واضغط «اضغط هنا لتشغيل صوت الدرس» إذا ظهر. راجع موعد الحصة وحالة اشتراكك؛ لو المعلمة لم تبدأ بثها بعد ابقَ في قاعة الانتظار.'],
 ['هل أقدر أفتح الميكروفون والكاميرا في أي وقت؟','الطالب يبدأ مستمعًا فقط. اضغط «ارفع إيدك»، وانتظر إذن المعلمة، ثم اختر بنفسك تشغيل الميكروفون أو الكاميرا إن أُتيحا.']
];

export default function GettingStartedGuide(){
 const [active,setActive]=useState(0);
 const panelRef=useRef(null);
 const step=STEPS[active];
 const Icon=step.icon;
 const chooseStep=index=>{
  setActive(index);
  // Move the chosen instructions into view without affecting browser history.
  requestAnimationFrame(()=>panelRef.current?.scrollIntoView({
   behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',
   block:'start'
  }));
 };
 return <main className="sofia-site sofia-guide-page" dir="rtl">
  <section className="sofia-guide-hero">
   <div className="sofia-container">
    <nav className="sofia-guide-breadcrumb" aria-label="مسار الصفحة"><Link to="/">الرئيسية</Link><ChevronLeft size={15}/><span>دليل الاستخدام</span></nav>
    <div className="sofia-guide-hero-grid">
     <div>
      <span className="sofia-guide-eyebrow"><GraduationCap size={18}/> دليلك من أول يوم</span>
      <h1>أول مرة في <em>Miss Sofia؟</em><br/>كل خطوة هنا واضحة.</h1>
      <p>دليل بسيط لولي الأمر والطالب: من إنشاء الحساب واختيار الكورس، لحد متابعة الطلب ودخول الحصة المباشرة والتفاعل مع المعلمة.</p>
      <div className="sofia-guide-hero-actions">
       <a className="sofia-cta" href="#guide-steps">ابدأ الشرح خطوة بخطوة <ArrowLeft size={18}/></a>
       <Link className="sofia-guide-secondary" to="/register">إنشاء حساب الطالب</Link>
       <a className="sofia-guide-secondary" href="#live-class">شرح دخول الحصة والبث المباشر</a>
      </div>
     </div>
     <div className="sofia-guide-hero-art" aria-label="ملخص الرحلة التعليمية">
      <div className="sofia-guide-art-top"><span className="sofia-guide-pulse"/> YOUR LEARNING JOURNEY <span>01 — 07</span></div>
      <div className="sofia-guide-art-center"><div><UserRoundPlus size={24}/><strong>حساب</strong></div><ChevronLeft size={20}/><div><BookOpen size={24}/><strong>كورس</strong></div><ChevronLeft size={20}/><div><PlayCircle size={24}/><strong>حصة</strong></div></div>
      <div className="sofia-guide-art-bottom"><ShieldCheck size={18}/> متابعة منظمة من مكان واحد</div>
     </div>
    </div>
   </div>
  </section>
  <section id="guide-steps" className="sofia-guide-section" aria-labelledby="sofia-guide-step-heading">
   <div className="sofia-container">
    <div className="sofia-guide-intro"><span className="sofia-kicker"><i/> خطوات الاستخدام</span>
     <h2 id="sofia-guide-step-heading">من أول تسجيل الدخول <em>لأول حصة مباشرة</em></h2>
     <p>اختار أي خطوة لمعرفة مكانها بالضبط في الموقع وطريقة تنفيذها.</p>
    </div>
    <div className="sofia-guide-step-grid">
     <nav className="sofia-guide-step-nav" aria-label="خطوات استخدام المنصة">
      {STEPS.map((item,i)=>{const StageIcon=item.icon;return <button type="button" key={item.title} className={'sofia-guide-step-tab'+(i===active?' is-active':'')} aria-pressed={i===active} aria-controls="sofia-guide-step-detail" onClick={()=>chooseStep(i)}>
       <span className="sofia-guide-step-icon"><StageIcon size={21}/></span>
       <span><small>الخطوة {String(i+1).padStart(2,'0')}</small><strong>{item.title}</strong></span>
       <ArrowLeft size={17} className="sofia-guide-step-chevron"/>
      </button>})}
     </nav>
     <div id="sofia-guide-step-detail" ref={panelRef} className="sofia-guide-step-detail" aria-label={'شرح الخطوة '+(active+1)}>
      <div className="sofia-guide-detail-head"><span className="sofia-guide-detail-icon"><Icon size={25}/></span><span>الخطوة {String(active+1).padStart(2,'0')} من {STEPS.length}</span></div>
      <h3>{step.title}</h3><p className="sofia-guide-detail-description">{step.subtitle}</p>
      <ol className="sofia-guide-instructions">{step.points.map((point,i)=><li key={i}><span>{String(i+1).padStart(2,'0')}</span><p>{point}</p></li>)}</ol>
      <div className="sofia-guide-screen" aria-label="توضيح مبسط لأسماء أقسام الموقع في هذه الخطوة">
       <div className="sofia-guide-screen-bar"><span className="sofia-guide-screen-dots"><i/><i/><i/></span><strong>{step.preview}</strong><small>أسماء الأقسام داخل الموقع</small></div>
       <div className="sofia-guide-screen-body">{step.previewItems.map((item,i)=><div key={item}><CheckCircle2 size={17}/><span>{item}</span><b>{String(i+1).padStart(2,'0')}</b></div>)}</div>
      </div>
      <div className="sofia-guide-tip"><HelpCircle size={19}/><p>{step.tip}</p></div>
      <div className="sofia-guide-detail-bottom">
       <Link className="sofia-cta" to={step.to}>{step.action}<ArrowLeft size={17}/></Link>
       <div className="sofia-guide-step-controls">
        <button type="button" disabled={active===0} onClick={()=>chooseStep(active-1)} aria-label="الخطوة السابقة"><ArrowRight size={19}/></button>
        <span>{active+1} / {STEPS.length}</span>
        <button type="button" disabled={active===STEPS.length-1} onClick={()=>chooseStep(active+1)} aria-label="الخطوة التالية"><ArrowLeft size={19}/></button>
       </div>
      </div>
     </div>
    </div>
    <div className="sofia-guide-preview-note"><CheckCircle2 size={19}/><p>الدليل يشرح خطوات الاستخدام الفعلية. أي تحويل مالي يتم بعد التنسيق مع الإدارة، ويبدأ الوصول الشامل للحصص بعد اعتماد الاشتراك يدويًا.</p></div>
   </div>
  </section>
  <LiveLessonWalkthrough/>
  <section className="sofia-guide-ready-section" aria-labelledby="sofia-guide-ready-heading">
   <div className="sofia-container">
    <div className="sofia-guide-ready-head"><span className="sofia-kicker"><i/> قبل موعد الدرس</span><h2 id="sofia-guide-ready-heading">تجهيزات بسيطة لحصة أفضل</h2></div>
    <div className="sofia-guide-ready-grid">
     <div><Smartphone size={22}/><strong>موبايل أو كمبيوتر</strong><p>افتح الموقع من متصفح محدث ومناسب لجهازك.</p></div>
     <div><Volume2 size={22}/><strong>اتأكد من الصوت</strong><p>جرّب صوت الجهاز، واسمح بتشغيل صوت الدرس لو ظهر الزر.</p></div>
     <div><CalendarClock size={22}/><strong>افتح الحصة في موعدها</strong><p>راجع جدولك، وحاول تكون جاهز قبل الموعد بوقت بسيط.</p></div>
     <div><Hand size={22}/><strong>اسأل برفع اليد</strong><p>ابدأ مستمعًا، وارفع إيدك لو محتاج تشارك.</p></div>
    </div>
   </div>
  </section>
  <section className="sofia-guide-faq-section">
   <div className="sofia-container sofia-guide-faq-grid">
    <div><span className="sofia-kicker"><i/> أسئلة شائعة</span><h2>لسه عندك سؤال؟</h2><p>أهم الإجابات للي بيبدأ يستخدم المنصة لأول مرة.</p><a href={WHATSAPP_CONTACT_URL} target="_blank" rel="noopener noreferrer" className="sofia-guide-support"><MessageCircle size={19}/> استفسر على واتساب الرسمي <ArrowLeft size={16}/></a></div>
    <div className="sofia-guide-faqs">{FAQ.map(([question,answer],i)=><details key={question} open={i===0}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
   </div>
  </section>
  <section className="sofia-guide-last-cta"><div className="sofia-container sofia-guide-last-inner"><div><h2>جاهز تبدأ رحلة العلوم؟</h2><p>ابدأ بحساب ولي الأمر واستكشف الدورات المنشورة على Miss Sofia.</p></div><Link className="sofia-cta" to="/register">ابدأ بإنشاء الحساب <ArrowLeft size={17}/></Link></div></section>
 </main>;
}

export {STEPS};
