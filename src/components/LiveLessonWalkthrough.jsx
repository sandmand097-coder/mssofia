import React,{useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeft,ArrowRight,BookOpen,CalendarDays,CheckCircle2,ChevronLeft,Clock3,GraduationCap,Hand,HelpCircle,LockKeyhole,MicOff,MonitorPlay,PlayCircle,Radio,ShieldCheck,Video,Volume2,Wifi} from 'lucide-react';

// Visual explanations only. No student session, media connection, real lesson
// booking, payment or permissions are created when using this walkthrough.
const STAGES=[
 {
  title:'افتح لوحة الطالب',label:'ابدأ من حسابك',icon:GraduationCap,
  intro:'سجّل الدخول بنفس حساب ولي الأمر الذي أنشأت به حساب الطالب.',
  instructions:[
   'بعد تسجيل الدخول افتح «لوحتي» أو «لوحة الطالب».',
   'تأكد أن طلب الحجز تم قبوله وأن الاشتراك المطلوب لدخول الحصة ساري.',
   'اختار «جدول الحصص». يمكنك أيضًا الوصول لأقرب حصة من الصفحة الرئيسية في لوحة الطالب.'
  ],
  note:'لو الطلب ما زال «قيد المراجعة»، لن تتمكن من مشاهدة الحصة المدفوعة حتى تعتمد الإدارة اشتراكك.'
 },
 {
  title:'اختار الحصة',label:'جدول الحصص',icon:CalendarDays,
  intro:'كل حصة منشورة لها اسمها وموعدها داخل الجدول.',
  instructions:[
   'افتح تبويب «جدول الحصص» في لوحة الطالب.',
   'راجع اسم الدرس والتاريخ والساعة المعروضين بتوقيت القاهرة.',
   'اضغط «مشاهدة البث» أمام الحصة المطلوبة. هذا يفتح صفحة الحصة، وليس الفيديو نفسه بعد.'
  ],
  note:'لو جدول الحصص فاضي، لم تُضف لك حصص معتمدة بعد. لا تعتمد على رابط مُرسل خارج حسابك.'
 },
 {
  title:'افتح غرفة الدرس',label:'الدخول لمشاهدة الحصة',icon:PlayCircle,
  intro:'دي صفحة الحصة التي منها تبدأ خطوة الدخول إلى الغرفة.',
  instructions:[
   'تأكد أن عنوان الحصة والموعد صحيحان.',
   'اضغط «الدخول لمشاهدة الحصة» عندما يصبح الزر متاحًا.',
   'عادةً يفتح الدخول قبل الموعد بـ15 دقيقة. وقد يفتح مبكرًا إذا كانت المعلمة قد فتحت الاستوديو.'
  ],
  note:'لو الزر مش متاح، راجع توقيت الحصة وصلاحية الاشتراك. زر «معاينة تصميم الفصل» مجرد معاينة وليس بثًا حقيقيًا.'
 },
 {
  title:'استنى بداية البث',label:'قاعة الانتظار',icon:Clock3,
  intro:'ممكن تدخل الغرفة قبل ما المعلمة تشغّل الصوت أو الفيديو.',
  instructions:[
   'لو ظهرت رسالة «أنت الآن في قاعة انتظار الحصة» فأنت في المكان الصحيح.',
   'سيب الصفحة مفتوحة. البث يبدأ تلقائيًا عندما تبدأ المعلمة شرحها.',
   'لو ظهر «إعادة محاولة الاتصال بالبث» بعد بدء الشرح ولم تظهر الصورة، اضغطه مرة واحدة.'
  ],
  note:'وجودك في قاعة الانتظار لا يعني أن الفيديو اشتغل بالفعل. الكاميرا والميكروفون الخاصان بالطالب مغلقان افتراضيًا.'
 },
 {
  title:'اتفرّج وشارك',label:'الفصل المباشر',icon:Video,
  intro:'بعد بدء البث ستشاهد شاشة شرح المعلمة داخل موقع Miss Sofia.',
  instructions:[
   'اسمع صوت المعلمة وشاهد الكاميرا أو مشاركة الشاشة. لو ظهر زر «اضغط هنا لتشغيل صوت الدرس» اضغط عليه.',
   'لو محتاج تسأل، اضغط «ارفع إيدك». بعد إذن المعلمة يمكنك اختيار «تشغيل ميكروفوني» والسماح للمتصفح.',
   'لو الإنترنت ضعيف، غيّر «وضع المشاهدة» إلى «توفير الإنترنت» أو «الصوت فقط». عند انتهاء الحصة اضغط «مغادرة الحصة».'
  ],
  note:'لا تشغّل الميكروفون أو الكاميرا تلقائيًا، ولا تعِد تحميل الصفحة أثناء محاولة استعادة الاتصال.'
 }
];

function DemoScreen({stage}){
 return <div className="sofia-livewalk-screen" aria-hidden="true">
  <div className="sofia-livewalk-browser"><span className="sofia-livewalk-dots"><i/><i/><i/></span><b>Miss Sofia</b><small>عرض توضيحي • ليس بثًا حقيقيًا</small></div>
  {stage===0&&<div className="sofia-livewalk-screen-body">
   <div className="sofia-livewalk-screen-title"><GraduationCap size={19}/><strong>لوحة الطالب</strong></div>
   <div className="sofia-livewalk-mini-grid"><span><BookOpen size={18}/> دوراتي</span><span className="sofia-livewalk-emphasis"><CalendarDays size={18}/> جدول الحصص <ArrowLeft size={14}/></span><span><CheckCircle2 size={18}/> اشتراكي معتمد</span></div>
   <p>اختار «جدول الحصص» لمتابعة مواعيدك.</p>
  </div>}
  {stage===1&&<div className="sofia-livewalk-screen-body">
   <div className="sofia-livewalk-screen-title"><CalendarDays size={19}/><strong>جدول حصصي</strong></div>
   <div className="sofia-livewalk-lesson-row"><div><strong>حصة علوم</strong><small>الوقت يظهر هنا حسب الجدول المعتمد</small></div><span className="sofia-livewalk-demo-btn"><Video size={15}/> مشاهدة البث</span></div>
   <p>الزر يفتح تفاصيل غرفة الحصة المختارة.</p>
  </div>}
  {stage===2&&<div className="sofia-livewalk-screen-body">
   <div className="sofia-livewalk-screen-title"><ShieldCheck size={19}/><strong>غرفة الحصة المباشرة</strong></div>
   <div className="sofia-livewalk-center-symbol"><PlayCircle size={47}/><strong>الدخول لمشاهدة الحصة</strong></div>
   <div className="sofia-livewalk-demo-btn sofia-livewalk-demo-full"><PlayCircle size={17}/> الدخول لمشاهدة الحصة</div>
   <p>يتاح الدخول عند الموعد المناسب للطلاب المقبولين.</p>
  </div>}
  {stage===3&&<div className="sofia-livewalk-screen-body">
   <div className="sofia-livewalk-screen-title"><Clock3 size={19}/><strong>قاعة انتظار الحصة</strong></div>
   <div className="sofia-livewalk-center-symbol"><Clock3 size={42}/><strong>أنت الآن في قاعة انتظار الحصة</strong><small>في انتظار بدء شرح المعلمة...</small></div>
   <div className="sofia-livewalk-soft-status">عندما تبدأ المعلمة البث، تنتقل تلقائيًا إلى الفصل.</div>
  </div>}
  {stage===4&&<div className="sofia-livewalk-screen-body">
   <div className="sofia-livewalk-screen-title"><Radio size={19}/><strong>البث مباشر • Miss Sofia</strong></div>
   <div className="sofia-livewalk-video"><MonitorPlay size={53}/><strong>هنا تظهر كاميرا المعلمة أو مشاركة الشاشة</strong></div>
   <div className="sofia-livewalk-controls"><span><Volume2 size={15}/> صوت الدرس</span><span><Hand size={15}/> ارفع إيدك</span><span><MicOff size={15}/> الميكروفون مغلق</span></div>
  </div>}
 </div>;
}

const HELP=[
 ['زر «مشاهدة البث» مش ظاهر','راجع «جدول الحصص» في لوحة الطالب وتأكد أن الدورة والحصة مضافتان إلى حسابك بعد موافقة الإدارة. لو لا توجد حصص بعد، استفسر عن الجدول.'],
 ['زر «الدخول لمشاهدة الحصة» مش شغال','قد يكون موعد السماح بالدخول لم يبدأ بعد، أو انتهت الحصة، أو الاشتراك غير ساري. راجع رسالة صفحة الحصة والموعد.'],
 ['دخلت قاعة الانتظار ومفيش فيديو','انتظر بدء بث المعلمة واترك الصفحة مفتوحة. قاعة الانتظار ليست هي البث؛ قد يبدأ الاتصال بالفيديو تلقائيًا عند تشغيل الشرح.'],
 ['الصورة موجودة لكن مش سامع','ارفع صوت جهازك، وتأكد من عدم كتم علامة التبويب، واضغط «اضغط هنا لتشغيل صوت الدرس» إن ظهر داخل الفصل.'],
 ['الإنترنت ضعيف أو البث قطع','حافظ على الصفحة مفتوحة أثناء محاولة إعادة الاتصال؛ داخل الفصل جرّب وضع «الصوت فقط». إذا انقطع الاتصال نهائيًا، افتح الحصة مرة أخرى من جدولك.'],
 ['عايز أسأل المعلمة','اضغط «ارفع إيدك». لو المعلمة سمحت بالمشاركة، اضغط أنت «تشغيل ميكروفوني» واسمح للمتصفح عند الطلب.']
];

export default function LiveLessonWalkthrough(){
 const [active,setActive]=useState(0);
 const stage=STAGES[active];
 return <section className="sofia-livewalk-section" id="live-class" aria-labelledby="sofia-livewalk-heading" dir="rtl">
  <div className="sofia-container">
   <div className="sofia-livewalk-heading">
    <div><span className="sofia-kicker"><i/> دليل الحصة والبث المباشر</span><h2 id="sofia-livewalk-heading">إزاي تدخل <em>الدرس وتشوف البث؟</em></h2><p>تابع المراحل واحدة واحدة: من جدولك لحد ما تسمع شرح مس صوفيا وتشارك في الفصل.</p></div>
    <Link to="/student" className="sofia-livewalk-portal-link">افتح لوحة الطالب <ArrowLeft size={17}/></Link>
   </div>
   <div className="sofia-livewalk-layout">
    <nav className="sofia-livewalk-navigation" aria-label="خطوات دخول الفصل المباشر">
     {STAGES.map((item,i)=>{const Icon=item.icon;return <button className={'sofia-livewalk-stage'+(active===i?' is-active':'')} key={item.title} type="button" aria-pressed={active===i} aria-controls="sofia-livewalk-current" onClick={()=>setActive(i)}>
      <span className="sofia-livewalk-count">{String(i+1).padStart(2,'0')}</span><Icon size={21}/><span className="sofia-livewalk-stage-text"><strong>{item.title}</strong><small>{item.label}</small></span><ChevronLeft size={16}/>
     </button>})}
    </nav>
    <article className="sofia-livewalk-detail" id="sofia-livewalk-current">
     <div className="sofia-livewalk-detail-title"><span>المرحلة {active+1} من {STAGES.length}</span><h3>{stage.title}</h3><p>{stage.intro}</p></div>
     <DemoScreen stage={active}/>
     <ol className="sofia-livewalk-directions">{stage.instructions.map((instruction,i)=><li key={instruction}><span>{i+1}</span><p>{instruction}</p></li>)}</ol>
     <div className="sofia-livewalk-help"><HelpCircle size={19}/><span>{stage.note}</span></div>
     <div className="sofia-livewalk-actions">
      <button type="button" disabled={active===0} onClick={()=>setActive(i=>Math.max(0,i-1))}><ArrowRight size={16}/> السابق</button>
      <span>{active+1} / {STAGES.length}</span>
      <button type="button" disabled={active===STAGES.length-1} onClick={()=>setActive(i=>Math.min(STAGES.length-1,i+1))}>التالي <ArrowLeft size={16}/></button>
     </div>
    </article>
   </div>
   <div className="sofia-livewalk-more">
    <div><span className="sofia-kicker"><i/> لو حصلت مشكلة</span><h3>أسئلة دخول الحصة والصوت</h3><p>حلول سريعة حسب الرسالة اللي بتظهر عندك.</p></div>
    <div className="sofia-livewalk-faq">{HELP.map(([q,a])=><details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div>
   </div>
   <details className="sofia-livewalk-teacher">
    <summary><Video size={19}/><span><strong>للمعلمة: إزاي تفتحي الاستوديو وتبدأي البث؟</strong><small>شرح مختصر لأدوات إدارة الفصل</small></span><ChevronLeft size={18}/></summary>
    <ol>
     <li>من لوحة الإدارة افتحي «الحصص» ثم الحصة المطلوبة واضغطي «استوديو البث الخاص بي» (وفي لوحة المعلم: «جدول الحصص» ثم «الفصل»).</li>
     <li>اضغطي «فتح استوديو البث»، ويمكنك استخدام «فحص الكاميرا والميكروفون قبل البث» للتأكد من الأجهزة.</li>
     <li>داخل الفصل اضغطي «ابدئي البث الآن» للسماح بالكاميرا والميكروفون، أو استخدمي «مشاركة الشاشة» لشرح الدرس.</li>
     <li>الطلاب يشاهدون فقط في البداية. يمكن السماح بالصوت بعد «ارفع إيدك»، ثم «إنهاء الحصة للجميع» عند الانتهاء.</li>
    </ol>
   </details>
   <p className="sofia-livewalk-note"><LockKeyhole size={17}/> الرسومات محاكاة إرشادية فقط ولا تشغّل بثًا حقيقيًا. دخول الدروس المدفوعة يتطلب حسابًا مقبولًا واشتراكًا ساريًا، والبث يبدأ عندما تشغّله المعلمة.</p>
  </div>
 </section>;
}

export {STAGES,HELP};
