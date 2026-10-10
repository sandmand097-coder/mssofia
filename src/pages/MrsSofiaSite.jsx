import React,{useEffect,useMemo,useState} from 'react';
import {Link,useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {ArrowLeft,ArrowUpLeft,Atom,BookOpen,CalendarDays,CheckCircle2,ChevronLeft,CircleHelp,ClipboardCheck,Clock3,Dna,FlaskConical,GraduationCap,Heart,Lightbulb,LockKeyhole,Microscope,PlayCircle,Gift,Search,ShieldCheck,Sparkles,Target,Users,Video,Beaker,XCircle,Eye,EyeOff,Send,Filter,School} from 'lucide-react';
import {ScienceScene,ScienceCourseCard,scienceSubject,scienceSubjects,currency,formatDateTime,dashboardPath} from '../components/MrsSofiaBrand.jsx';
import {LaunchOffer} from '../components/LaunchOffer.jsx';

const categories=[
 {name:'علوم',icon:FlaskConical,eng:'SCIENCE',desc:'اكتشف العلوم في حياتنا اليومية',tone:'mint'},
 {name:'فيزياء',icon:Atom,eng:'PHYSICS',desc:'افهم الحركة والقوة والطاقة',tone:'blue'},
 {name:'أحياء',icon:Dna,eng:'BIOLOGY',desc:'رحلة ممتعة داخل عالم الكائنات',tone:'rose'},
 {name:'كيمياء',icon:Beaker,eng:'CHEMISTRY',desc:'افهم العناصر والتفاعلات ببساطة',tone:'sun'}
];
function Heading({eyebrow,title,description,action,center=false}){
 return <div className={'sofia-section-heading '+(center?'center':'')}><div><span className="sofia-kicker"><i/>{eyebrow}</span><h2>{title}</h2>{description&&<p>{description}</p>}</div>{action}</div>;
}
export function MrsHome({api}){
 const [courses,setCourses]=useState([]),[loading,setLoading]=useState(true);
 useEffect(()=>{let cancel=false;api('/courses').then(d=>{if(!cancel)setCourses(d.courses.filter(c=>scienceSubject(c.subject)).slice(0,3))}).catch(()=>{}).finally(()=>{if(!cancel)setLoading(false)});return()=>{cancel=true}},[api]);
 return <div className="sofia-site">
  <section className="sofia-hero"><div className="sofia-container sofia-hero-grid">
   <div className="sofia-hero-copy"><span className="sofia-hero-eyebrow"><span>✦</span> مس صوفيا للعلوم | MISS SOFIA</span><h1>العلوم مش حفظ...<br/><span>العلوم حكاية</span><br/>بتتفهم!</h1><p>مع مس صوفيا للعلوم، كل سؤال ليه إجابة، وكل درس وراه اكتشاف. شرح مبسّط، أمثلة من الحياة، وحصص منظمة تخليك تحب العلوم وتفهمها بجد.</p>
    <div className="sofia-hero-actions"><Link className="sofia-cta" to="/courses">اكتشف كورسات العلوم <ArrowLeft size={19}/></Link><a href="#offer" className="sofia-ghost"><Gift size={21}/> عرض أول شهر 100 جنيه</a></div>
    <div className="sofia-hero-proof"><div><span><CheckCircle2 size={17}/></span> شرح خطوة بخطوة</div><div><span><CheckCircle2 size={17}/></span> حصص تفاعلية</div><div><span><CheckCircle2 size={17}/></span> متابعة المواعيد</div></div>
   </div>
   <ScienceScene/>
  </div><div className="sofia-hero-decoration" aria-hidden="true">SCIENCE IS EVERYWHERE</div></section>
  <LaunchOffer/>
  <section className="sofia-trust-strip"><div className="sofia-container sofia-trust-grid"><div><span><Lightbulb size={23}/></span><b>افهم الفكرة الأول</b><small>الأساس قبل الحفظ</small></div><div><span><Microscope size={23}/></span><b>تعلّم بالاكتشاف</b><small>تجارب وأمثلة واقعية</small></div><div><span><CalendarDays size={23}/></span><b>نظّم وقتك</b><small>جدول حصص واضح</small></div><div><span><ShieldCheck size={23}/></span><b>حسابك ومساحتك</b><small>دوراتك وطلباتك في مكان واحد</small></div></div></section>
  <section className="sofia-section sofia-subjects-section"><div className="sofia-container"><Heading eyebrow="اختار اللي بتحب تكتشفه" title={<>العلم كبير.. <em>تعالى نستكشفه!</em></>} description="مجالات علمية متنوعة بشرح مبسّط يربط المعلومة بالعالم اللي حوالينا." center/>
   <div className="sofia-subject-grid">{categories.map(c=>{const Icon=c.icon;return <Link className={'sofia-subject-card tone-'+c.tone} to={'/courses?subject='+encodeURIComponent(c.name)} key={c.name}><div className="sofia-subject-top"><span>{c.eng}</span><ArrowUpLeft size={19}/></div><div className="sofia-subject-icon"><Icon size={45} strokeWidth={1.5}/></div><h3>{c.name}</h3><p>{c.desc}</p></Link>})}</div>
  </div></section>
  <section className="sofia-section sofia-courses-section"><div className="sofia-container"><Heading eyebrow="ابدأ رحلتك" title={<>كورسات تساعدك <em>تفهم أكتر</em></>} description="اختار المجال والمرحلة المناسبة، وشوف تفاصيل الدروس قبل ما تطلب الحجز." action={<Link className="sofia-text-link" to="/courses">كل الكورسات <ArrowLeft size={18}/></Link>}/>
   {courses.length?<div className="sofia-card-grid">{courses.map(c=><ScienceCourseCard course={c} key={c.id}/>)}</div>:<div className="sofia-course-empty"><span><FlaskConical size={26}/></span><h3>{loading?'بنحضّر الكورسات...':'الكورسات الجديدة جاية قريباً'}</h3><p>الكورسات المنشورة في قسم العلوم هتظهر هنا تلقائياً.</p><Link to="/courses">تصفح الكورسات <ArrowLeft size={16}/></Link></div>}
  </div></section>
  <section className="sofia-method-section" id="method"><div className="sofia-container"><Heading eyebrow="طريقتنا مختلفة" title={<>من أول سؤال... <em>لحد ما تفهم</em></>} description="رحلتك التعليمية في خطوات سهلة وواضحة." center/>
    <div className="sofia-method-grid">{[
      {n:'01',icon:Search,title:'اختار كورسك',desc:'استكشف المواد والمستويات، واختار الدورة المناسبة ليك.'},
      {n:'02',icon:ClipboardCheck,title:'احجز مكانك',desc:'قدّم طلب الالتحاق واستنى موافقة المدرّسة على الحجز.'},
      {n:'03',icon:Video,title:'اتعلم وتفاعل',desc:'تابع جدولك وادخل الفصل وقت الحصة بعد تفعيل البث المباشر.'}
     ].map(x=>{const Icon=x.icon;return <div className="sofia-method-card" key={x.n}><span className="sofia-method-num">{x.n}</span><div className="sofia-method-icon"><Icon size={28}/></div><h3>{x.title}</h3><p>{x.desc}</p></div>})}</div>
  </div></section>
  <section className="sofia-about-section" id="about"><div className="sofia-container sofia-about-grid"><div className="sofia-about-art"><div className="sofia-about-orbit"/><div className="sofia-about-card"><span className="sofia-about-symbol"><FlaskConical size={80} strokeWidth={1.15}/></span><span className="sofia-about-ms">Miss Sofia</span><span className="sofia-about-ar">مس صوفيا للعلوم</span><div className="sofia-about-dots">✦ ✳ ✦</div></div><div className="sofia-about-sticker"><Heart size={20}/> حبّ العلوم بيبدأ بالفهم</div></div><div className="sofia-about-copy"><span className="sofia-kicker"><i/> اتعرف على مس صوفيا للعلوم</span><h2>هنا هنتعلم <em>نحبّ العلوم</em> قبل ما نمتحن فيها.</h2><p>الفكرة بسيطة: لما الدرس يتحكي بطريقة مفهومة، المعلومة بتثبت. منصة مس صوفيا للعلوم بتجمع شرح العلوم وجدول الحصص وطلبات الاشتراك في تجربة واحدة سهلة للطالب.</p><div className="sofia-about-bullets"><span><CheckCircle2 size={19}/> ربط الأفكار بأمثلة من حياتنا</span><span><CheckCircle2 size={19}/> خطوات واضحة من غير تعقيد</span><span><CheckCircle2 size={19}/> مسار تعلم سهل المتابعة</span></div><Link to="/register" className="sofia-cta">ابدأ دلوقتي <ArrowLeft size={18}/></Link></div></div></section>
  <section className="sofia-section sofia-faq" id="faq"><div className="sofia-container sofia-faq-grid"><div><Heading eyebrow="أسئلة متكررة" title={<>كل سؤال <em>ليه إجابة</em></>} description="أهم الحاجات اللي ممكن تحتاج تعرفها قبل التسجيل."/></div><div className="sofia-faq-list">{[
     ['إزاي أشترك في كورس؟','أنشئ حساب طالب، اختار الدورة المناسبة، واضغط طلب الحجز. طلبك هيظهر في حسابك لحد ما المدرّسة توافق عليه.'],
     ['أقدر أشوف مواعيد حصصي فين؟','من لوحة الطالب، افتح جدول الحصص. المواعيد بتظهر بعد الموافقة على حجزك في الدورة.'],
     ['هل فيه حصص أونلاين مباشرة؟','المنصة فيها فصل مباشر تفاعلي بالصوت والفيديو ومشاركة الشاشة، ويحتاج تفعيل خدمة البث قبل الاستخدام الفعلي.'],
     ['عرض الشهر الأول بكام؟','عرض شرح العلوم للطالب الجديد: 100 جنيه في الشهر الأول بدل 170 جنيه، وبعده 170 جنيه شهريًا. تأكيد الاشتراك بعد مراجعة الإدارة للتحويل.'],
     ['إزاي أدفع الاشتراك؟','تسجيل الطالب يتم بحساب Google الخاص بولي الأمر. التحويل عبر فودافون كاش لن يكون متاحًا إلا عندما يظهر رقم المحفظة داخل لوحة الطالب بعد فحص مخزن الإيصالات الخاص، والمديرة تراجع الدفع قبل قبول الحجز.']
   ].map(([q,a],i)=><details className="sofia-faq-item" key={q} open={i===0}><summary><span>{q}</span><span className="sofia-faq-plus">+</span></summary><p>{a}</p></details>)}</div></div></section>
  <section className="sofia-container"><div className="sofia-bottom-cta"><div className="sofia-bottom-molecule"><Atom size={108} strokeWidth={1.2}/></div><div><span>خلّي الفضول يقودك ✦</span><h2>جاهز تشوف العلوم بشكل مختلف؟</h2><p>ابدأ خطوة جديدة في رحلة الفهم والاكتشاف مع مس صوفيا للعلوم.</p></div><Link to="/register" className="sofia-cta sofia-cta-white">أنشئ حسابك <ArrowLeft size={19}/></Link></div></section>
 </div>;
}

export function MrsCourses({api}){
 const [params,setParams]=useSearchParams(),[courses,setCourses]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const subject=params.get('subject')||'الكل',q=params.get('q')||'';
 useEffect(()=>{let alive=true;setLoading(true);api('/courses').then(d=>{if(alive){setCourses(d.courses);setError('')}}).catch(e=>{if(alive)setError(e.message)}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[api]);
 const visible=useMemo(()=>courses.filter(c=>scienceSubject(c.subject)&&(!subject||subject==='الكل'||c.subject===subject)&&(!q||[c.title,c.subject,c.level,c.teacher_name,c.description].some(s=>String(s||'').toLowerCase().includes(q.trim().toLowerCase())))),[courses,subject,q]);
 const update=(key,value)=>{const next=new URLSearchParams(params);if(!value||value==='الكل')next.delete(key);else next.set(key,value);setParams(next)};
 return <main className="sofia-site sofia-page-bg"><section className="sofia-page-heading"><div className="sofia-container"><span className="sofia-kicker"><i/> EXPLORE OUR COURSES</span><h1>كل تجربة علمية <em>بداية اكتشاف</em></h1><p>اختار المادة اللي عايز تفهمها أكتر، وابدأ مع كورسات مُدرِّسة العلوم Miss Sofia.</p></div></section><LaunchOffer compact/><div className="sofia-container sofia-catalog">
  <div className="sofia-catalog-toolbar"><label className="sofia-catalog-search"><Search size={20}/><input aria-label="ابحث في الكورسات" placeholder="ابحث عن كورس أو مادة أو مرحلة..." value={q} onChange={e=>update('q',e.target.value)}/></label><span className="sofia-result-count"><Filter size={17}/> {visible.length.toLocaleString('ar-EG')} كورس</span></div>
  <div className="sofia-catalog-filters" aria-label="تصفية حسب المادة">{scienceSubjects.map(s=><button type="button" key={s} className={subject===s?'active':''} onClick={()=>update('subject',s)}>{s}</button>)}</div>
  {error&&<div role="alert" className="sofia-alert">{error}</div>}
  {loading?<div className="sofia-page-loading">بنجهّز الكورسات...</div>:visible.length?<div className="sofia-card-grid">{visible.map(c=><ScienceCourseCard course={c} key={c.id}/>)}</div>:<div className="sofia-no-results"><Search size={37}/><h3>مش لاقيين كورسات مطابقة</h3><p>جرّب تختار مادة تانية، أو امسح كلمة البحث.</p><button onClick={()=>setParams({})}>عرض كل المواد</button></div>}
 </div></main>;
}

export function MrsCourseDetails({api,user,show}){
 const {id}=useParams(),[data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[bookingStatus,setBookingStatus]=useState(''),[monthlyExpired,setMonthlyExpired]=useState(false);
 useEffect(()=>{let alive=true;setLoading(true);setData(null);api('/courses/'+id).then(d=>{if(alive){setData(d);setError('')}}).catch(e=>{if(alive)setError(e.message)}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[id,api]);
 useEffect(()=>{let alive=true;if(user?.role==='student')api('/my/overview').then(d=>{if(alive){const booking=d.bookings.find(b=>b.course_id===id);setBookingStatus(booking?.status||'');setMonthlyExpired(booking?.live_access_status==='expired')}}).catch(()=>{});return()=>{alive=false}},[id,user,api]);
 const book=async()=>{if(!user)return;setBusy(true);try{const d=await api('/courses/'+id+'/book',{method:'POST'});setBookingStatus('pending');show(d.message)}catch(e){show(e.message)}finally{setBusy(false)}};
 if(loading)return <div className="sofia-page-loading">بنجهّز تفاصيل الكورس...</div>;
 if(error||!data)return <main className="sofia-site sofia-container sofia-no-results"><h2>تعذر عرض الدورة</h2><p>{error||'الدورة غير موجودة'}</p><Link to="/courses">العودة للكورسات</Link></main>;
 const c=data.course,isStudent=user?.role==='student',canBook=isStudent&&!bookingStatus;
 return <main className="sofia-site sofia-page-bg"><div className="sofia-container sofia-detail-wrap"><nav className="sofia-breadcrumb"><Link to="/">الرئيسية</Link><ChevronLeft size={15}/><Link to="/courses">الكورسات</Link><ChevronLeft size={15}/><span>{c.subject}</span></nav>
  <div className="sofia-detail-layout"><div className="sofia-detail-content"><div className="sofia-detail-art"><div className="sofia-detail-art-grid"/><span><FlaskConical size={108} strokeWidth={1}/></span><div className="sofia-detail-art-caption"><Sparkles size={18}/> عالم العلوم مع Miss Sofia</div></div>
    <div className="sofia-detail-section"><span className="sofia-kicker"><i/> عن الكورس</span><h2>إيه اللي هتتعلمه؟</h2><p>{c.description}</p></div>
    <div className="sofia-detail-section"><span className="sofia-kicker"><i/> جدول الحصص</span><h2>رحلتك خطوة بخطوة</h2>{data.lessons.length?<div className="sofia-detail-lessons">{data.lessons.map((lesson,i)=><div key={lesson.id} className="sofia-detail-lesson"><span>{String(i+1).padStart(2,'0')}</span><div><strong>{lesson.title}</strong><small><CalendarDays size={14}/> {formatDateTime(lesson.starts_at)}</small></div><em>{lesson.duration_minutes} دقيقة</em></div>)}</div>:<p>مواعيد الحصص هتظهر هنا عند إضافتها.</p>}</div>
  </div>
  <aside className="sofia-detail-sidebar"><span className="sofia-detail-label"><Sparkles size={16}/> كورس علوم تفاعلي</span><h1>{c.title}</h1><div className="sofia-detail-chips"><span>{c.subject}</span><span>{c.level}</span></div><div className="sofia-detail-instructor"><span><GraduationCap size={23}/></span><div><small>مع المدرّس</small><strong>{c.teacher_name}</strong></div></div><div className="sofia-detail-facts"><div><span><Clock3 size={18}/> مدة الحصة</span><strong>{c.duration_minutes} دقيقة</strong></div><div><span><Users size={18}/> المقاعد المتاحة</span><strong>{Math.max(0,c.capacity-c.enrolled)} من {c.capacity}</strong></div><div><span><BookOpen size={18}/> عدد الحصص</span><strong>{data.lessons.length} حصص</strong></div></div>
   <div className="sofia-detail-price">{scienceSubject(c.subject)&&Number(c.price)>0?<><small>عرض اشتراك شرح العلوم — الشهر الأول</small><strong>100 جنيه <del style={{fontSize:'.52em',opacity:.62}}>170 جنيه</del></strong><small>من الشهر الثاني 170 جنيه شهريًا — 30 يوم بث مباشر داخل الموقع بعد تأكيد الدفع</small></>:<><small>سعر الكورس</small><strong>{currency(c.price)}</strong></>}</div>
   {!user?<Link to="/login" className="sofia-cta sofia-detail-book">سجّل دخولك للحجز <ArrowLeft size={17}/></Link>:<button type="button" className="sofia-cta sofia-detail-book" disabled={!canBook||busy} onClick={book}>{busy?'جارٍ إرسال الطلب...':bookingStatus==='approved'?(monthlyExpired?'الاشتراك الشهري منتهٍ — تواصل مع الإدارة':'الاشتراك نشط ومشاهدة البث متاحة'):bookingStatus==='pending'?'طلبك قيد المراجعة':bookingStatus==='rejected'?'تم رفض طلب الحجز':!isStudent?'الحجز متاح للطلاب فقط':'اطلب الحجز الآن'} <ArrowLeft size={17}/></button>}
   {bookingStatus==='approved'&&!monthlyExpired&&<Link className="sofia-dashboard-link" to="/student">تابع الحصص المباشرة من داخل موقع المُدرِّسة <ArrowLeft size={16}/></Link>}
   <p className="sofia-detail-fine"><ShieldCheck size={17}/> سيتم مراجعة الطلب قبل السماح بدخول الحصص.</p>
   {c.price>0&&<p className="sofia-detail-fine">الدفع غير متاح حاليًا؛ لا ترسل تحويلًا قبل ظهور رقم المحفظة الرسمي داخل لوحة الطالب.</p>}
  </aside></div></div></main>;
}

export function MrsAuth({api,user,setUser,show,login=false}){
 const navigate=useNavigate(),[form,setForm]=useState({name:'',email:'',password:'',role:'student',specialty:''}),[busy,setBusy]=useState(false),[visible,setVisible]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(user)navigate(dashboardPath(user),{replace:true})},[user,navigate]);
 const submit=async(e)=>{e.preventDefault();setBusy(true);setError('');try{const d=await api(login?'/auth/login':'/auth/register',{method:'POST',body:JSON.stringify(form)});if(login){setUser(d.user);navigate(dashboardPath(d.user),{replace:true})}else{show(d.message);navigate('/login')}}catch(e){setError(e.message)}finally{setBusy(false)}};
 return <main className="sofia-site sofia-auth-bg"><div className="sofia-container sofia-auth-layout"><div className="sofia-auth-card"><div className="sofia-auth-icon"><FlaskConical size={28}/></div><span className="sofia-kicker"><i/> {login?'WELCOME BACK':'JOIN MISS SOFIA'}</span><h1>{login?'وحشتنا! نكمّل رحلة العلم؟':'جاهز تبدأ عالم من الاكتشاف؟'}</h1><p>{login?'سجّل دخولك عشان ترجع لكورساتك وحصصك.':'أنشئ حسابك وخليك جزء من مجتمع بيحب العلوم.'}</p>
  {error&&<div className="sofia-alert" role="alert">{error}</div>}
  <form onSubmit={submit} className="sofia-auth-form">
   {!login&&<><label>الاسم بالكامل<input required autoComplete="name" maxLength={80} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="اكتب اسمك هنا"/></label><label>نوع الحساب<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="student">طالب / طالبة</option><option value="teacher">مدرس / مُدرِّسة — بعد موافقة الإدارة</option></select></label>{form.role==='teacher'&&<label>التخصص<input maxLength={120} required value={form.specialty} onChange={e=>setForm({...form,specialty:e.target.value})} placeholder="مثال: العلوم"/></label>}</>}
   <label>البريد الإلكتروني<input required type="email" autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="name@example.com"/></label>
   <label>كلمة المرور<div className="sofia-password-field"><input required minLength={login?1:10} type={visible?'text':'password'} autoComplete={login?'current-password':'new-password'} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder={login?'أدخل كلمة المرور':'10 أحرف على الأقل'}/><button type="button" aria-label={visible?'إخفاء كلمة المرور':'إظهار كلمة المرور'} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={19}/>:<Eye size={19}/>}</button></div></label>
   <button className="sofia-cta sofia-auth-submit" type="submit" disabled={busy}>{busy?'جارٍ المعالجة...':login?'تسجيل الدخول':'إنشاء الحساب'} <ArrowLeft size={19}/></button>
  </form><div className="sofia-auth-switch">{login?'لسه معندكش حساب؟':'عندك حساب بالفعل؟'} <Link to={login?'/register':'/login'}>{login?'أنشئ حسابك مجاناً':'سجّل دخولك'}</Link></div>
 </div><div className="sofia-auth-visual"><div className="sofia-auth-visual-shape"><div><Atom size={76}/></div><span>✦</span><span><Beaker size={36}/></span></div><span className="sofia-auth-subtitle">Miss Sofia • مُدرِّسة العلوم</span><h2>الفضول أول خطوة<br/>لأي اكتشاف عظيم.</h2><p>افهم • جرّب • اكتشف</p><div className="sofia-auth-bottom"><CheckCircle2 size={18}/> مساحة تعلم تناسبك وتجمع مواعيدك ودوراتك</div></div></div></main>;
}
