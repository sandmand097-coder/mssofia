import React,{useEffect,useState,useCallback,useRef,lazy,Suspense,createContext,useContext} from 'react';
import {joinWithBackoff} from './components/live-resilience.js';
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
 let response;
 try{
  response=await fetch('/api'+path,{
   credentials:'same-origin',
   ...options,
   headers:{'Content-Type':'application/json',...options.headers}
  });
 }catch(error){
  if(error?.name!=='AbortError')error.code='NETWORK_ERROR';
  throw error;
 }
 let data={};
 try{data=await response.json()}catch{}
 if(!response.ok){
  const issue=new Error(data.error||'تعذر إتمام العملية، حاول مجدداً');
  issue.status=response.status;issue.code=data.code||'';
  issue.retryAfterSeconds=Number(data.retryAfterSeconds||response.headers.get('Retry-After')||0);
  throw issue;
 }
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
 const {id}=useParams(),{show,user}=useApp(),[data,setData]=useState(null),[connection,setConnection]=useState(null),[error,setError]=useState(''),[joining,setJoining]=useState(false),[preview,setPreview]=useState(false),[deviceStatus,setDeviceStatus]=useState(''),[deviceChecking,setDeviceChecking]=useState(false),[clock,setClock]=useState(Date.now()),[recoveryNotice,setRecoveryNotice]=useState(''),[waitingRoom,setWaitingRoom]=useState(false);
 const requestRef=useRef(null),recoveryRef=useRef({timer:null,attempts:0}),autoAttemptRef=useRef(false);
 useEffect(()=>{
  let live=true;
  setData(null);setConnection(null);setError('');setDeviceStatus('');setWaitingRoom(false);autoAttemptRef.current=false;
  api('/lessons/'+id).then(result=>{if(live)setData(result)}).catch(e=>{if(live)setError(e.message)});
  return ()=>{live=false;requestRef.current?.abort();clearTimeout(recoveryRef.current.timer);recoveryRef.current.attempts=0};
 },[id]);
 useEffect(()=>{const interval=setInterval(()=>setClock(Date.now()),15000);return()=>clearInterval(interval)},[]);
 const isHost=user?.role==='admin'||(user?.role==='teacher'&&data?.lesson?.teacher_id===user.id);
 const begins=Date.parse(data?.lesson?.starts_at||'');
 const opensAt=begins-15*60000;
 const closesAt=begins+(Number(data?.lesson?.duration_minutes||0)+30)*60000;
 // When an authorized instructor enters the LiveKit studio, enrolled students
 // can wait on the website without using LiveKit participant-minutes.
 const teacherBroadcasting=Boolean(data?.hostPublishing??data?.studentEarlyLive);
 const studioOpen=Boolean(data?.studentRoomOpen||data?.hostConnected||data?.studentEarlyLive);
 const roomJoinable=Boolean(data?.lesson?.status==='scheduled'&&Number.isFinite(begins)&&clock<=closesAt&&(isHost||clock>=opensAt||studioOpen));
 useEffect(()=>{
  // Keep a paid student's waiting screen updated without allocating WebRTC
  // participant-minutes before the teacher begins streaming.
  if(!data||isHost||connection||!Number.isFinite(opensAt)||(!waitingRoom&&clock>=opensAt)||clock>closesAt||data.lesson.status!=='scheduled')return;
  let closed=false,pending=false;
  const timer=setInterval(async()=>{
   if(pending||document.visibilityState==='hidden')return;
   pending=true;
   try{
    const next=await api('/lessons/'+id);
    if(!closed)setData(current=>current?.lesson?.id===next.lesson.id?next:current);
   }catch(err){
    if(!closed&&[401,403,404].includes(err.status)){setData(null);setError(err.message)}
   }finally{pending=false}
  },8500);
  return()=>{closed=true;clearInterval(timer)};
 },[id,isHost,Boolean(connection),Boolean(data),waitingRoom,Number.isFinite(opensAt)&&clock<opensAt,closesAt]);
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
 const join=async(auto=false)=>{
  if(!roomJoinable){setError(isHost?'انتهى وقت الاستوديو لهذه الحصة.':'لم يبدأ وقت دخول الحصة بعد، أو انتهت الحصة.');return}
  if(requestRef.current&&!requestRef.current.signal.aborted)return;
  const controller=new AbortController();
  requestRef.current=controller;
  if(!auto)recoveryRef.current.attempts=0;
  setError('');setJoining(true);
  try{
   const result=await joinWithBackoff(
    ({signal})=>api('/lessons/'+id+'/token',{method:'POST',signal}),
    {signal:controller.signal,maxAttempts:4,onRetry:({nextAttempt,delayMs})=>
     setRecoveryNotice('خادم الحصة مشغول مؤقتًا؛ إعادة المحاولة '+nextAttempt+' خلال '+Math.ceil(delayMs/1000)+' ثانية...')}
   );
   if(!controller.signal.aborted){setConnection(result);setRecoveryNotice('')}
  }catch(e){
   if(e.name!=='AbortError'){setRecoveryNotice('');setError(e.message);if(!auto)show(e.message)}
  }finally{
   if(requestRef.current===controller)requestRef.current=null;
   setJoining(false);
  }
 };
 const enterRoom=()=>{
  if(isHost){void join(false);return}
  if(!roomJoinable){setError('الاستوديو لم يُفتح بعد. انتظر دخول المعلمة أو موعد الحصة.');return}
  setError('');setWaitingRoom(true);autoAttemptRef.current=false;
 };
 // Join the actual SFU only when the teacher is publishing media, never for
 // idle viewers in the waiting lobby. Prevent retries on permanent failures.
 useEffect(()=>{
  if(!waitingRoom||isHost||connection||!data?.hostPublishing){
   if(!data?.hostPublishing)autoAttemptRef.current=false;
   return;
  }
  if(joining||autoAttemptRef.current)return;
  // Spread 40-50 students over a short randomized window so their browser
  // requests do not all hit the single Render worker at the same instant.
  const timeout=setTimeout(()=>{
   if(autoAttemptRef.current||requestRef.current)return;
   autoAttemptRef.current=true;
   void join(true);
  },Math.floor(Math.random()*1700));
  return()=>clearTimeout(timeout);
 },[waitingRoom,isHost,Boolean(connection),Boolean(data?.hostPublishing),joining]);
 const recover=()=>{
  setConnection(null);
  if(!roomJoinable)return;
  if(recoveryRef.current.attempts>=3){setRecoveryNotice('تعذر استعادة الاتصال بعد عدة محاولات. اضغط زر الدخول مجددًا.');return}
  recoveryRef.current.attempts++;
  const delay=1500+recoveryRef.current.attempts*1400+Math.floor(Math.random()*750);
  setRecoveryNotice('انقطع الاتصال؛ نحاول إعادة الانضمام تلقائيًا مع الحفاظ على الاشتراك...');
  clearTimeout(recoveryRef.current.timer);
  recoveryRef.current.timer=setTimeout(()=>{if(navigator.onLine)void join(true);else setRecoveryNotice('الإنترنت غير متصل. بعد عودته اضغط زر دخول الحصة.')},delay);
 };
 useEffect(()=>{
  if(!connection)return;
  const stable=setTimeout(()=>{recoveryRef.current.attempts=0},90000);
  return()=>clearTimeout(stable);
 },[connection]);

 if(error&&!data)return <main className="container empty-state"><LockKeyhole size={40}/><h2>{error}</h2><Link to="/dashboard">العودة للوحة التحكم</Link></main>;
 if(!data)return <main className="loading">جارٍ تجهيز غرفة الدرس...</main>;
 return <main className="room-page"><div className="container">
  <div className="room-head"><div><Link className="breadcrumb" to="/dashboard">لوحة التحكم <ChevronLeft size={15}/> الحصة المباشرة</Link><h1>{data.lesson.title}</h1><p>{data.lesson.course_title} • {fmt(data.lesson.starts_at)}</p></div><span className="room-secure"><ShieldCheck size={17}/> غرفة خاصة بالطلاب المقبولين</span></div>
  {connection?<Suspense fallback={<div className="loading">جارٍ تحميل الفصل المباشر...</div>}><Classroom connection={connection} onDisconnected={()=>{setConnection(null);setRecoveryNotice('')}} onRecover={recover} onConnectionError={message=>{setConnection(null);setError(message);setRecoveryNotice('')}} onTimingChange={result=>setData(current=>current?{...current,lesson:{...current.lesson,duration_minutes:result.duration_minutes}}:current)}/></Suspense>:
  waitingRoom&&!isHost?<div className="room-placeholder sofia-waiting-lobby" role="region" aria-label="قاعة انتظار الحصة">
   <div className="video-illustration"><Video size={53}/><span className="video-ring"/></div>
   <h2>أنت الآن في قاعة انتظار الحصة</h2>
   <p>{teacherBroadcasting?'المعلمة بدأت الشرح؛ جارٍ تجهيز اتصال الفيديو الآمن...':studioOpen?'المعلمة فتحت الاستوديو. يمكنك الانتظار هنا إلى أن تبدأ الشرح.':'في انتظار دخول المعلمة للاستوديو أو بدء موعد الحصة.'}</p>
   <p>اشتراكك ساري. لن تُستخدم الكاميرا أو الميكروفون من جهازك بدون إذنك، ولن يُفتح اتصال الفيديو أثناء انتظار المعلمة.</p>
   {joining&&<div className="video-warning" role="status">جارٍ الاتصال ببث المعلمة...</div>}
   {recoveryNotice&&<div className="video-warning" role="status">{recoveryNotice}</div>}
   {error&&<div className="video-warning" role="alert">{error}</div>}
   <div className="sofia-waiting-actions">
    <button className="portal-soft-btn" type="button" onClick={()=>{setWaitingRoom(false);autoAttemptRef.current=false;setError('')}}>مغادرة قاعة الانتظار</button>
    {teacherBroadcasting&&<button className="sofia-cta" type="button" disabled={joining} onClick={()=>{autoAttemptRef.current=true;void join(false)}}>إعادة محاولة الاتصال بالبث</button>}
   </div>
   <small>عندما تبدأ المعلمة بث الصوت أو الفيديو سينتقل الفصل تلقائيًا إلى العرض المباشر. لا تغلق هذه الصفحة.</small>
  </div>:
  <div className="room-placeholder"><div className="video-illustration"><Video size={56}/><span className="video-ring"/></div><h2>{user?.role==='admin'?'استوديو بث المديرة':'غرفة الحصة المباشرة'}</h2><p>{user?.role==='admin'?'أنتِ مقدمة البث. بعد فتح الاستوديو اضغطي «ابدئي البث الآن» لتشغيل صوتك والكاميرا، أو اختاري مشاركة الشاشة. الطلاب يشاهدون ويستمعون فقط حتى تسمحي بالمشاركة.':'تابع شرح المعلمة بالصوت والفيديو ومشاركة الشاشة. الأطفال يبدأون في وضع الاستماع، والمعلمة وحدها تمنح إذن فتح الميكروفون والكاميرا بعد رفع اليد.'}</p>{!data.videoConfigured&&<div className="video-warning">البث المباشر يحتاج تفعيل LiveKit وإعداد المفاتيح على الخادم.</div>}{data.videoLocalOnly&&<div className="video-warning">تم تفعيل بث تجريبي محلي يعمل على هذا الكمبيوتر فقط. دخول الطلاب من خارج المنزل يحتاج ربط LiveKit Cloud ونشر الموقع بأمان.</div>}{error&&<div className="video-warning">{error}</div>}{recoveryNotice&&<div className="video-warning" role="status" aria-live="polite">{recoveryNotice}</div>}{isHost&&roomJoinable&&clock<opensAt&&<div className="video-warning" role="status">الاستوديو متاح لكِ الآن للتحضير وتجربة الكاميرا والميكروفون ومشاركة الشاشة. يمكن للطلاب المشتركين الدخول إلى قاعة الانتظار بمجرد فتح الاستوديو، حتى قبل بدء الفيديو.</div>}{!isHost&&teacherBroadcasting&&clock<opensAt&&<div className="video-warning" role="status">فتحت المعلمة الاستوديو وبدأت الشرح، ويمكنك الدخول لأن اشتراكك ساري.</div>}{!roomJoinable&&<div className="video-warning" role="status">{data.lesson.status==='ended'||clock>closesAt?'انتهى وقت هذه الحصة.':'يُفتح دخول الطلاب قبل موعد الحصة بـ15 دقيقة. الوقت المتبقي: '+Math.max(1,Math.ceil((opensAt-clock)/60000))+' دقيقة.'}</div>}<button className="sofia-cta" onClick={enterRoom} disabled={joining||!data.videoConfigured||!roomJoinable}><Play size={17}/>{joining?'جارٍ الاتصال...':isHost?'فتح استوديو البث':'الدخول لمشاهدة الحصة'}</button><small>{isHost?'يمكنك فتح الاستوديو للتحضير قبل موعد الدرس. لن تعمل الكاميرا أو الميكروفون تلقائيًا، ولن يستطيع الطلاب الدخول قبل الموعد بـ15 دقيقة.':'قاعة الانتظار متاحة عند فتح استوديو المعلمة أو قبل الموعد بـ15 دقيقة؛ يبدأ الفيديو تلقائيًا مع بدء الشرح.'}</small>{isHost&&<div className="sofia-director-device-check"><button className="portal-soft-btn" type="button" disabled={deviceChecking} onClick={checkDevices}>{deviceChecking?'جارٍ اختبار الأجهزة...':'فحص الكاميرا والميكروفون قبل البث'}</button>{deviceStatus&&<small role="status">{deviceStatus}</small>}</div>}</div>}
  {!connection&&<div style={{textAlign:'center',marginTop:18}}><button type="button" className="portal-soft-btn" onClick={()=>setPreview(v=>!v)}>{preview?'إخفاء معاينة الفصل':'معاينة تصميم الفصل الجديد'}</button></div>}
  {!connection&&preview&&<Suspense fallback={<div className="loading">جارٍ عرض المعاينة...</div>}><ClassroomPreview isHost={user?.role==='teacher'||user?.role==='admin'}/></Suspense>}
 </div></main>;
}
function PublicUnavailable(){
 return <main className="sofia-site sofia-page-bg"><div className="sofia-container sofia-no-results"><LockKeyhole size={43}/><h1>التسجيل هيفتح قريبًا</h1><p>الموقع متاح حاليًا للتعرّف على مُدرِّسة العلوم وعرض أول شهر. بنجهز تأمين حسابات الطلاب والبث المباشر قبل فتح الاشتراك.</p><Link className="sofia-cta" to="/">شوف عرض أول شهر <ArrowLeft size={17}/></Link></div></main>;
}
function NotFound(){
 return <main className="sofia-site sofia-page-bg"><div className="sofia-container sofia-no-results"><h1>الصفحة دي مش موجودة</h1><p>يمكن الرابط اتغير، لكن تقدر ترجع تكتشف كورسات العلوم.</p><Link className="sofia-cta" to="/">الرجوع للرئيسية <ArrowLeft size={17}/></Link></div></main>;
}
function PageTitle(){
 const {pathname}=useLocation();
 useEffect(()=>{
  const path=pathname.endsWith('/')&&pathname!=='/'?pathname.slice(0,-1):pathname;
  const label=path==='/privacy'?'الخصوصية':path==='/terms'?'شروط الاشتراك':path==='/courses'?'كورسات العلوم':path.startsWith('/courses/')?'تفاصيل كورس العلوم':path==='/login'?'تسجيل الدخول':path==='/register'?'إنشاء حساب':path==='/student'?'لوحة الطالب':path==='/admin'?'لوحة الإدارة':path==='/teacher'?'لوحة المعلم':path.startsWith('/lesson/')?'الفصل المباشر':'مُدرِّسة العلوم أونلاين';
  document.title=path==='/'?'مس صوفيا للعلوم | مُدرِّسة العلوم أونلاين — Miss Sofia':label+' | مس صوفيا للعلوم';
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
  {(publicOnly)&&<div className="sofia-public-preview-notice" role="status">موقع Miss Sofia متاح للتعرّف على المُدرِّسة والعروض. تسجيل الطلاب والبث المباشر هيفتحوا بعد اكتمال التجهيز الآمن.</div>}
  {user===undefined?<div className="loading">جارٍ تجهيز موقع Miss Sofia...</div>:
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
