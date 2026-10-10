import React,{useEffect,useState} from 'react';
import {Link,NavLink,useLocation} from 'react-router-dom';
import {FlaskConical,Atom,BookOpen,Menu,X,ArrowUpLeft,ArrowLeft,LogOut,UserCircle2,Instagram,Microscope,Dna,Beaker,Sparkles,Play,GraduationCap,Clock3,CalendarDays,ChevronLeft} from 'lucide-react';

export const scienceSubjects=['الكل','علوم','أحياء','فيزياء','كيمياء'];
export const scienceSubject=name=>/(علوم|فيزياء|أحياء|كيمياء|science|physics|biology|chemistry)/i.test(name||'');
export const currency=n=>Number(n)===0?'مجاناً':Number(n).toLocaleString('ar-EG')+' ج.م';
export const formatDate=d=>new Intl.DateTimeFormat('ar-EG',{day:'numeric',month:'short',year:'numeric',timeZone:'Africa/Cairo'}).format(new Date(d));
export const formatDateTime=d=>new Intl.DateTimeFormat('ar-EG',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Africa/Cairo'}).format(new Date(d));
export const dashboardPath=user=>user?.role==='admin'?'/admin':user?.role==='teacher'?'/teacher':'/student';

export function BrandLogo({light=false}){
 return <Link className={'sofia-logo '+(light?'sofia-logo-light':'')} to="/" aria-label="مس صوفيا للعلوم — الرئيسية">
  <span className="sofia-logo-symbol"><FlaskConical size={25} strokeWidth={2.3}/><i/></span>
  <span className="sofia-logo-copy"><b>mrs<span>sofia</span><em>.</em></b><small>مس صوفيا للعلوم</small></span>
 </Link>;
}

export function BrandHeader({user,logout,previewMode=false,adminOnly=false}){
 const [open,setOpen]=useState(false),location=useLocation();
 useEffect(()=>setOpen(false),[location.pathname,location.hash]);
 const links=[{to:'/',label:'الرئيسية',end:true},{to:'/courses',label:'الكورسات'},{to:'/#method',label:'طريقة التعلم',anchor:true},{to:'/#about',label:'عن مس صوفيا',anchor:true}];
 return <header className="sofia-header"><div className="sofia-container sofia-nav">
  <BrandLogo/>
  <nav className={'sofia-nav-links '+(open?'is-open':'')} aria-label="القائمة الرئيسية">
   {links.map(item=>item.anchor?<a key={item.to} href={item.to} onClick={()=>setOpen(false)}>{item.label}</a>:<NavLink key={item.to} to={item.to} end={item.end} onClick={()=>setOpen(false)}>{item.label}</NavLink>)}
   {adminOnly&&<Link to="/login" className="sofia-admin-mobile-link" onClick={()=>setOpen(false)}>دخول مديرة المدرسة</Link>}
  </nav>
  <div className="sofia-nav-actions">
   {user?<><Link to={dashboardPath(user)} className="sofia-nav-account"><UserCircle2 size={17}/> لوحتي</Link><button className="sofia-logout" title="تسجيل الخروج" aria-label="تسجيل الخروج" onClick={logout}><LogOut size={18}/></button></>:<>{previewMode?<><a href="/#offer" className="sofia-login">عرض أول شهر</a><a href="/#offer" className="sofia-cta sofia-cta-sm">شوف العرض <ArrowLeft size={17}/></a></>:adminOnly?<><Link to="/login" className="sofia-login">دخول المديرة</Link><a href="/#offer" className="sofia-cta sofia-cta-sm">عرض أول شهر <ArrowLeft size={17}/></a></>:<><Link to="/login" className="sofia-login">تسجيل الدخول</Link><Link to="/register" className="sofia-cta sofia-cta-sm">ابدأ رحلتك <ArrowLeft size={17}/></Link></>}</>}
   <button type="button" className="sofia-menu-toggle" aria-label={open?'إغلاق القائمة':'فتح القائمة'} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<X size={25}/>:<Menu size={25}/>}</button>
  </div>
 </div></header>;
}

export function BrandFooter({previewMode=false}){
 return <footer className="sofia-footer"><div className="sofia-container">
  <div className="sofia-footer-main">
   <div className="sofia-footer-about"><BrandLogo light/><p>العلوم أسهل لما نفهمها. مكان واحد للتعلّم، التجربة، وتنظيم رحلتك مع مس صوفيا للعلوم.</p></div>
   <div><h4>استكشف</h4><Link to="/">الرئيسية</Link><Link to="/courses">الكورسات المتاحة</Link><a href="/#method">طريقة التعلم</a><Link to="/privacy">الخصوصية وحماية الطلاب</Link><Link to="/terms">شروط الاشتراك</Link></div>
   <div><h4>{previewMode?'الإطلاق التعريفي':'حسابك'}</h4>{previewMode?<><a href="/#offer">عرض الشهر الأول</a><Link to="/courses">المواد والدورات</Link><small>فتح حسابات الطلاب قريبًا</small></>:<><Link to="/login">تسجيل الدخول</Link><Link to="/register">إنشاء حساب</Link><Link to="/dashboard">لوحة التحكم</Link></>}</div>
   <div className="sofia-footer-note"><span className="sofia-footer-mini"><Atom size={20}/></span><b>التواصل مع إدارة مدرسة العلوم</b><a href="tel:01027661546" dir="ltr" style={{fontWeight:900,fontSize:20,color:'#d9f7ed',display:'inline-block',margin:'8px 0'}}>01027661546</a><small>رقم التواصل والاستفسارات. لا ترسل أي تحويل مالي قبل ظهور طريقة دفع مفعّلة وآمنة داخل حساب الطالب؛ قبول الاشتراك بقرار الإدارة فقط.</small></div>
  </div>
  <div className="sofia-footer-bottom"><span>© {new Date().getFullYear()} مس صوفيا للعلوم | Mrs Sofia. جميع الحقوق محفوظة.</span><span>Made for curious minds <span aria-hidden="true">✦</span></span></div>
 </div></footer>;
}

export function ScienceScene(){
 return <div className="sofia-scene" aria-label="رسم توضيحي عن عالم العلوم والذرات والتجارب">
  <div className="sofia-scene-ambient"/>
  <div className="sofia-illustration">
   <div className="sofia-illustration-toolbar"><div className="sofia-toolbar-dots"><i/><i/><i/></div><span>SOFIA'S SCIENCE LAB</span><span className="sofia-live-mark"><i/> EXPLORE</span></div>
   <svg className="sofia-illustration-svg" viewBox="0 0 520 410" role="img" aria-label="ذرة وأدوات تجارب علمية">
    <defs><linearGradient id="sceneGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b9f5df"/><stop offset="1" stopColor="#6ac7a9"/></linearGradient><linearGradient id="sceneLiquid" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffcd8b"/><stop offset="1" stopColor="#ef925e"/></linearGradient><radialGradient id="sceneGlow"><stop offset="0" stopColor="#5c9d9a" stopOpacity=".46"/><stop offset="1" stopColor="#173943" stopOpacity="0"/></radialGradient></defs>
    <circle cx="262" cy="180" r="177" fill="url(#sceneGlow)"/>
    <g opacity=".16" stroke="#a3dfcc" strokeWidth="1"><path d="M36 70 H480 M36 130 H480 M36 190 H480 M36 250 H480 M36 310 H480 M95 20 V340 M170 20 V340 M245 20 V340 M320 20 V340 M395 20 V340"/></g>
    <g transform="translate(265 173)" stroke="#9ee1ce" strokeWidth="3" fill="none" opacity=".85"><ellipse rx="146" ry="58" transform="rotate(25)"/><ellipse rx="146" ry="58" transform="rotate(-25)"/><ellipse rx="146" ry="58" transform="rotate(90)"/></g>
    <circle cx="265" cy="173" r="27" fill="#fbbf88"/><circle cx="254" cy="161" r="7" fill="#ffe5c7" opacity=".65"/>
    <g fill="#e7fcf5"><circle cx="147" cy="130" r="11"/><circle cx="381" cy="212" r="11"/><circle cx="265" cy="28" r="10"/><circle cx="280" cy="317" r="9"/></g>
    <g transform="translate(42 257) rotate(-9)"><path d="M57 0V54L15 121 Q7 139 28 144 H123 Q144 138 136 121 L93 54 V0" fill="#e6f8f3" opacity=".92"/><path d="M32 103 Q76 87 118 104 L137 132 Q133 145 118 145 H33 Q15 144 16 132Z" fill="url(#sceneLiquid)"/><path d="M52 0H99" stroke="#fff" strokeWidth="10" strokeLinecap="round"/><circle cx="59" cy="115" r="9" fill="#ffe3bb"/><circle cx="90" cy="122" r="5" fill="#fff0d4"/><circle cx="76" cy="85" r="5" fill="#f9bf80"/></g>
    <g transform="translate(390 260) rotate(8)"><rect x="0" y="0" width="25" height="108" rx="12" fill="#d5fcf2"/><rect x="39" y="-18" width="25" height="126" rx="12" fill="#d5fcf2"/><path d="M3 72H22V94Q22 103 12 103 Q3 103 3 94Z" fill="#ffa26e"/><path d="M42 34H61V94Q61 103 51 103 Q42 103 42 94Z" fill="#75d7c5"/><rect x="-5" y="-5" width="34" height="11" rx="4" fill="#fff"/><rect x="34" y="-23" width="34" height="11" rx="4" fill="#fff"/></g>
    <g fill="#d0f5e9" opacity=".6"><circle cx="50" cy="77" r="4"/><circle cx="455" cy="70" r="4"/><circle cx="449" cy="183" r="8"/><circle cx="88" cy="205" r="5"/></g>
    <path d="M363 43l5 14 14 5-14 5-5 14-5-14-14-5 14-5Z" fill="#ffca9a"/><path d="M126 48l3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" fill="#9ce8d9"/>
   </svg>
   <div className="sofia-lab-bottom"><span><Atom size={17}/> اكتشفها بنفسك</span><span className="sofia-lab-wave"><i/><i/><i/><i/><i/><i/><i/></span></div>
  </div>
  <div className="sofia-scene-tag sofia-tag-top"><span><Sparkles size={18}/></span><div><b>العلوم بقت ممتعة!</b><small>تجارب وفهم مش مجرد حفظ</small></div></div>
  <div className="sofia-scene-tag sofia-tag-bottom"><span><BookOpen size={18}/></span><div><b>كل حصة خطوة لقدّام</b><small>شرح منظم ومتابعة واضحة</small></div></div>
  <div className="sofia-scene-spark sofia-spark-one">✳</div><div className="sofia-scene-spark sofia-spark-two">✦</div>
 </div>;
}

const palettes={
 'علوم':{icon:FlaskConical,tone:'mint',eyebrow:'SCIENCE'},
 'فيزياء':{icon:Atom,tone:'blue',eyebrow:'PHYSICS'},
 'أحياء':{icon:Dna,tone:'rose',eyebrow:'BIOLOGY'},
 'كيمياء':{icon:Beaker,tone:'sun',eyebrow:'CHEMISTRY'}
};
export function ScienceCourseCard({course}){
 const subject=course.subject||'علوم';const setting=palettes[subject]||{icon:Microscope,tone:'mint',eyebrow:'DISCOVER'};const Icon=setting.icon;
 return <Link className="sofia-course-card" to={'/courses/'+course.id}>
  <div className={'sofia-course-cover tone-'+setting.tone}><span className="sofia-course-grid-art"/><span className="sofia-course-english">{setting.eyebrow}</span><Icon size={86} strokeWidth={1.2}/><span className="sofia-course-live"><span/> حصص تفاعلية</span></div>
  <div className="sofia-course-content"><div className="sofia-course-tags"><span>{subject}</span><span>{course.level}</span></div><h3>{course.title}</h3><p>{course.description}</p><div className="sofia-course-meta"><span><GraduationCap size={15}/> {course.teacher_name}</span><span><Clock3 size={15}/> {course.duration_minutes} دقيقة</span></div><div className="sofia-course-price">{scienceSubject(course.subject)&&Number(course.price)>0?<strong>أول شهر 100 ج.م <del style={{fontSize:'.72em',opacity:.65}}>170 ج.م</del></strong>:<strong>{currency(course.price)}</strong>}<span>تفاصيل الدورة <ArrowLeft size={17}/></span></div></div>
 </Link>;
}
