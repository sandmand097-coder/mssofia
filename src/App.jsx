import React,{useEffect,useState,useCallback,lazy,Suspense,createContext,useContext} from 'react';
import {Routes,Route,Link,Navigate,useLocation,useNavigate,useParams} from 'react-router-dom';
import {LockKeyhole,ChevronLeft,ShieldCheck,Video,Play,ArrowLeft} from 'lucide-react';
import {BrandHeader,BrandFooter,dashboardPath} from './components/MrsSofiaBrand.jsx';

const MrsHome=lazy(()=>import('./pages/MrsSofiaSite.jsx').then(m=>({default:m.MrsHome})));
const MrsCourses=lazy(()=>import('./pages/MrsSofiaSite.jsx').then(m=>({default:m.MrsCourses})));
const MrsCourseDetails=lazy(()=>import('./pages/MrsSofiaSite.jsx').then(m=>({default:m.MrsCourseDetails})));
const SignInPage=lazy(()=>import('./pages/MrsSofiaAuth.jsx').then(m=>({default:m.SignInPage})));
const RegisterPage=lazy(()=>import('./pages/MrsSofiaAuth.jsx').then(m=>({default:m.RegisterPage})));
const VerifyEmailPage=lazy(()=>import('./pages/MrsSofiaAuth.jsx').then(m=>({default:m.VerifyEmailPage})));
const ForgotPasswordPage=lazy(()=>import('./pages/MrsSofiaAuth.jsx').then(m=>({default:m.ForgotPasswordPage})));
const ResetPasswordPage=lazy(()=>import('./pages/MrsSofiaAuth.jsx').then(m=>({default:m.ResetPasswordPage})));
const PrivacyPolicy=lazy(()=>import('./pages/SchoolPolicies.jsx').then(m=>({default:m.PrivacyPolicy})));
const SchoolTerms=lazy(()=>import('./pages/SchoolPolicies.jsx').then(m=>({default:m.SchoolTerms})));
const StudentPortal=lazy(()=>import('./pages/StudentPortal.jsx'));
const TeacherPortal=lazy(()=>import('./pages/TeacherPortal.jsx'));
const AdminPortal=lazy(()=>import('./pages/AdminPortal.jsx'));
const Classroom=lazy(()=>import('./components/Classroom.jsx'));
const ClassroomPreview=lazy(()=>import('./components/Classroom.jsx').then(m=>({default:m.ClassroomPreview})));

const Context=createContext(null);
const useApp=()=>useContext(Context);
const fmt=date=>new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Cairo'}).format(new Date(date));
async function api(path,options={}){
 const response=await fetch('/api'+path,{
  credentials:'same-origin',
  ...options,
  headers:{'Content-Type':'application/json',...options.headers}
 });
 let data={};
 try{data=await response.json()}catch{}
 if(!response.ok)throw Error(data.error||'تعذر إتمام العملية، حاول مجدداً');
 return data;
}
function RoutePortal(){
 const {user,setUser,show}=useApp(),{pathname}=useLocation();
 if(!user)return <Navigate to="/login" replace/>;
 const correct=dashboardPath(user);
 if(pathname!==correct)return <Navigate to={correct} replace/>;
 const props={user,setUser,show};
 if(user.role==='admin')return <AdminPortal {...props}/>;
 if(user.role==='teacher')return <TeacherPortal {...props}/>;
 if(user.role==='student')return <StudentPortal {...props}/>;
 return <Navigate to="/" replace/>;
}
function LessonRoom(){
 const {id}=useParams(),{show,user}=useApp(),[data,setData]=useState(null),[connection,setConnection]=useState(null),[error,setError]=useState(''),[joining,setJoining]=useState(false),[preview,setPreview]=useState(false),[deviceStatus,setDeviceStatus]=useState(''),[deviceChecking,setDeviceChecking]=useState(false),[clock,setClock]=useState(Date.now());
 useEffect(()=>{
  let live=true;
  setData(null);setConnection(null);setError('');setDeviceStatus('');
  api('/lessons/'+id).then(result=>{if(live)setData(result)}).catch(e=>{if(live)setError(e.message)});
  return ()=>{live=false};
 },[id]);
 useEffect(()=>{const interval=setInterval(()=>setClock(Date.now()),15000);return()=>clearInterval(interval)},[]);
 const isHost=user?.role==='admin'||(user?.role==='teacher'&&data?.lesson?.teacher_id===user.id);
 const begins=Date.parse(data?.lesson?.starts_at||'');
 const opensAt=begins-15*60000;
 const closesAt=begins+(Number(data?.lesson?.duration_minutes||0)+30)*60000;
 // Instructors can prepare their studio early; viewers still use the 15-minute entry window.
 const roomJoinable=Boolean(data?.lesson?.status==='scheduled'&&Number.isFinite(begins)&&clock<=closesAt&&(isHost||clock>=opensAt));
 const checkDevices=async()=>{
  if(!isHost)return;
  if(!navigator.mediaDevices?.getUserMedia){setDeviceStatus('المتصفح لا يدعم اختبار الأجهزة؛ استخدمي Chrome أو Edge من رابط HTTPS.');return}
  setDeviceChecking(true);setDeviceStatus('');
  let stream;
  try{
   stream=await navigator.mediaDevices.getUserMedia({audio:true,video:true});
   setDeviceStatus('اختبار ناجح: الميكروفون والكاميرا متاحان. اضغطي «فتح استوديو البث» عندما يقترب موعد الحصة.');
  }catch{
   setDeviceStatus('تعذر اختبار الكاميرا والميكروفون معًا. تحققي من صلاحيات المتصفح، ويمكنك بدء الشرح بالصوت فقط أو مشاركة الشاشة.');
  }finally{
   stream?.getTracks().forEach(track=>track.stop());
   setDeviceChecking(false);
  }
 };
 const join=async()=>{
  if(!roomJoinable){setError(isHost?'انتهى وقت الاستوديو لهذه الحصة.':'لم يبدأ وقت دخول الحصة بعد، أو انتهت الحصة.');return}
  setError('');setJoining(true);
  try{setConnection(await api('/lessons/'+id+'/token',{method:'POST'}))}
  catch(e){setError(e.message);show(e.message)}
  finally{setJoining(false)}
 };
 if(error&&!data)return <main className="container empty-state"><LockKeyhole size={40}/><h2>{error}</h2><Link to="/dashboard">العودة للوحة التحكم</Link></main>;
 if(!data)return <main className="loading">جارٍ تجهيز غرفة الدرس...</main>;
 return <main className="room-page"><div className="container">
  <div className="room-head"><div><Link className="breadcrumb" to="/dashboard">لوحة التحكم <ChevronLeft size={15}/> الحصة المباشرة</Link><h1>{data.lesson.title}</h1><p>{data.lesson.course_title} • {fmt(data.lesson.starts_at)}</p></div><span className="room-secure"><ShieldCheck size={17}/> غرفة خاصة بالطلاب المقبولين</span></div>
  {connection?<Suspense fallback={<div className="loading">جارٍ تحميل الفصل المباشر...</div>}><Classroom connection={connection} onDisconnected={()=>setConnection(null)} onConnectionError={message=>{setConnection(null);setError(message);show(message)}} onTimingChange={result=>setData(current=>current?{...current,lesson:{...current.lesson,duration_minutes:result.duration_minutes}}:current)}/></Suspense>:
  <div className="room-placeholder"><div className="video-illustration"><Video size={56}/><span className="video-ring"/></div><h2>{user?.role==='admin'?'استوديو بث المديرة':'غرفة الحصة المباشرة'}</h2><p>{user?.role==='admin'?'أنتِ مقدمة البث. بعد فتح الاستوديو اضغطي «ابدئي البث الآن» لتشغيل صوتك والكاميرا، أو اختاري مشاركة الشاشة. الطلاب يشاهدون ويستمعون فقط حتى تسمحي بالمشاركة.':'تابع شرح المعلمة بالصوت والفيديو ومشاركة الشاشة. الأطفال يبدأون في وضع الاستماع، والمعلمة وحدها تمنح إذن فتح الميكروفون والكاميرا بعد رفع اليد.'}</p>{!data.videoConfigured&&<div className="video-warning">البث المباشر يحتاج تفعيل LiveKit وإعداد المفاتيح على الخادم.</div>}{data.videoLocalOnly&&<div className="video-warning">تم تفعيل بث تجريبي محلي يعمل على هذا الكمبيوتر فقط. دخول الطلاب من خارج المنزل يحتاج ربط LiveKit Cloud ونشر الموقع بأمان.</div>}{error&&<div className="video-warning">{error}</div>}{isHost&&roomJoinable&&clock<opensAt&&<div className="video-warning" role="status">الاستوديو متاح لكِ الآن للتحضير وتجربة الكاميرا والميكروفون ومشاركة الشاشة. دخول الطلاب يظل مغلقًا حتى 15 دقيقة قبل موعد الحصة.</div>}{!roomJoinable&&<div className="video-warning" role="status">{data.lesson.status==='ended'||clock>closesAt?'انتهى وقت هذه الحصة.':'يُفتح دخول الطلاب قبل موعد الحصة بـ15 دقيقة. الوقت المتبقي: '+Math.max(1,Math.ceil((opensAt-clock)/60000))+' دقيقة.'}</div>}<button className="sofia-cta" onClick={join} disabled={joining||!data.videoConfigured||!roomJoinable}><Play size={17}/>{joining?'جارٍ الاتصال...':isHost?'فتح استوديو البث':'الدخول لمشاهدة الحصة'}</button><small>{isHost?'يمكنك فتح الاستوديو للتحضير قبل موعد الدرس. لن تعمل الكاميرا أو الميكروفون تلقائيًا، ولن يستطيع الطلاب الدخول قبل الموعد بـ15 دقيقة.':'دخول الطلاب متاح قبل موعد الحصة بـ15 دقيقة وبعد قبول اشتراكهم.'}</small>{isHost&&<div className="sofia-director-device-check"><button className="portal-soft-btn" type="button" disabled={deviceChecking} onClick={checkDevices}>{deviceChecking?'جارٍ اختبار الأجهزة...':'فحص الكاميرا والميكروفون قبل البث'}</button>{deviceStatus&&<small role="status">{deviceStatus}</small>}</div>}</div>}
  {!connection&&<div style={{textAlign:'center',marginTop:18}}><button type="button" className="portal-soft-btn" onClick={()=>setPreview(v=>!v)}>{preview?'إخفاء معاينة الفصل':'معاينة تصميم الفصل الجديد'}</button></div>}
  {!connection&&preview&&<Suspense fallback={<div className="loading">جارٍ عرض المعاينة...</div>}><ClassroomPreview isHost={user?.role==='teacher'||user?.role==='admin'}/></Suspense>}
 </div></main>;
}
function PublicUnavailable(){
 return <main className="sofia-site sofia-page-bg"><div className="sofia-container sofia-no-results"><LockKeyhole size={43}/><h1>التسجيل هيفتح قريبًا</h1><p>الموقع متاح حاليًا للتعرّف على مدرسة العلوم وعرض أول شهر. بنجهز تأمين حسابات الطلاب والبث المباشر قبل فتح الاشتراك.</p><Link className="sofia-cta" to="/">شوف عرض أول شهر <ArrowLeft size={17}/></Link></div></main>;
}
function NotFound(){
 return <main className="sofia-site sofia-page-bg"><div className="sofia-container sofia-no-results"><h1>الصفحة دي مش موجودة</h1><p>يمكن الرابط اتغير، لكن تقدر ترجع تكتشف كورسات العلوم.</p><Link className="sofia-cta" to="/">الرجوع للرئيسية <ArrowLeft size={17}/></Link></div></main>;
}
function PageTitle(){
 const {pathname}=useLocation();
 useEffect(()=>{
  const path=pathname.endsWith('/')&&pathname!=='/'?pathname.slice(0,-1):pathname;
  const label=path==='/privacy'?'الخصوصية':path==='/terms'?'شروط الاشتراك':path==='/courses'?'كورسات العلوم':path.startsWith('/courses/')?'تفاصيل كورس العلوم':path==='/login'?'تسجيل الدخول':path==='/register'?'إنشاء حساب':path==='/student'?'لوحة الطالب':path==='/admin'?'لوحة الإدارة':path==='/teacher'?'لوحة المعلم':path.startsWith('/lesson/')?'الفصل المباشر':'مدرسة العلوم أونلاين';
  document.title=path==='/'?'مس صوفيا للعلوم | مدرسة العلوم أونلاين — Mrs Sofia':label+' | مس صوفيا للعلوم';
  const publicPage=path==='/'||path==='/courses'||path==='/privacy'||path==='/terms'||path.startsWith('/courses/');
  const canonical=document.querySelector('link[rel="canonical"]');
  if(canonical)canonical.setAttribute('href','https://mssofia.pages.dev'+(publicPage?path:'/')+(publicPage&&path==='/'?'':''));
  const robots=document.querySelector('meta[name="robots"]');
  if(robots)robots.setAttribute('content',publicPage?'index, follow, max-image-preview:large':'noindex, nofollow');
  const ogUrl=document.querySelector('meta[property="og:url"]');
  if(ogUrl)ogUrl.setAttribute('content','https://mssofia.pages.dev'+(publicPage?path:'/' ));
 },[pathname]);
 return null;
}
export default function App(){
 const [user,setUser]=useState(undefined),[toast,setToast]=useState(''),[launchMode,setLaunchMode]=useState('checking');
 const navigate=useNavigate();
 useEffect(()=>{let active=true;Promise.allSettled([api('/auth/me'),api('/health')]).then(([session,health])=>{if(!active)return;setUser(session.status==='fulfilled'?session.value.user:null);setLaunchMode(health.status==='fulfilled'?(health.value.mode==='preview'?'preview':health.value.mode==='admin'?'admin':'full'):'offline')});return()=>{active=false}},[]);
 useEffect(()=>{if(!toast)return;const timeout=setTimeout(()=>setToast(''),4600);return()=>clearTimeout(timeout)},[toast]);
 const show=useCallback(message=>setToast(message),[]);
 const logout=async()=>{try{await api('/auth/logout',{method:'POST'});setUser(null);navigate('/')}catch(e){show(e.message)}};
 const publicOnly=launchMode==='preview'||launchMode==='offline';
 const adminOnly=launchMode==='admin';
 return <Context.Provider value={{user,setUser,show,logout}}>
  <PageTitle/>
  <BrandHeader user={user} logout={logout} previewMode={publicOnly} adminOnly={adminOnly}/>
  {(publicOnly)&&<div className="sofia-public-preview-notice" role="status">موقع Mrs Sofia متاح للتعرّف على المدرسة والعروض. تسجيل الطلاب والبث المباشر هيفتحوا بعد اكتمال التجهيز الآمن.</div>}
  {user===undefined?<div className="loading">جارٍ تجهيز مدرسة العلوم...</div>:
   <Suspense fallback={<div className="loading">جارٍ تحميل الصفحة...</div>}>
    <Routes>
     <Route path="/" element={<MrsHome api={api}/>}/>
     <Route path="/courses" element={<MrsCourses api={api}/>}/>
     <Route path="/privacy" element={<PrivacyPolicy/>}/>
     <Route path="/terms" element={<SchoolTerms/>}/>
     <Route path="/courses/:id" element={publicOnly||adminOnly?<PublicUnavailable/>:<MrsCourseDetails api={api} user={user} show={show}/>}/>
     <Route path="/login" element={publicOnly?<PublicUnavailable/>:<SignInPage api={api} user={user} setUser={setUser} show={show} adminOnly={adminOnly}/>}/>
     <Route path="/register" element={publicOnly||adminOnly?<PublicUnavailable/>:<RegisterPage api={api} user={user} setUser={setUser}/>}/>
     <Route path="/verify-email" element={publicOnly||adminOnly?<PublicUnavailable/>:<VerifyEmailPage api={api}/>}/>
     <Route path="/forgot-password" element={publicOnly||adminOnly?<PublicUnavailable/>:<ForgotPasswordPage api={api}/>}/>
     <Route path="/reset-password" element={publicOnly||adminOnly?<PublicUnavailable/>:<ResetPasswordPage api={api}/>}/>
     <Route path="/dashboard" element={publicOnly?<PublicUnavailable/>:<RoutePortal/>}/>
     <Route path="/admin" element={publicOnly?<PublicUnavailable/>:<RoutePortal/>}/>
     <Route path="/student" element={publicOnly||adminOnly?<PublicUnavailable/>:<RoutePortal/>}/>
     <Route path="/teacher" element={publicOnly||adminOnly?<PublicUnavailable/>:<RoutePortal/>}/>
     <Route path="/lesson/:id" element={publicOnly?<PublicUnavailable/>:<LessonRoom/>}/>
     <Route path="*" element={<NotFound/>}/>
    </Routes>
   </Suspense>}
  <BrandFooter previewMode={publicOnly||adminOnly}/>
  {toast&&<div className="toast" role="status" aria-live="polite"><ShieldCheck size={18}/>{toast}</div>}
 </Context.Provider>;
}
