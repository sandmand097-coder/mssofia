import React,{useEffect,useState} from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import {FlaskConical,ArrowLeft,Eye,EyeOff,ShieldCheck,MailCheck,Mail,LockKeyhole,Send} from 'lucide-react';
import {dashboardPath} from '../components/MrsSofiaBrand.jsx';

function AuthLayout({tag,title,description,children}){
 return <main className="sofia-site sofia-auth-bg"><div className="sofia-container sofia-auth-layout"><section className="sofia-auth-card">
  <div className="sofia-auth-icon"><FlaskConical size={29}/></div>
  <span className="sofia-kicker"><i/> {tag}</span><h1>{title}</h1><p>{description}</p>{children}
 </section><aside className="sofia-auth-visual"><div className="sofia-auth-visual-shape"><div><FlaskConical size={72}/></div><span>✦</span></div><span className="sofia-auth-subtitle">MRS SOFIA • SCIENCE SCHOOL</span><h2>هنا العلوم تجربة<br/>وحكاية بتتفهم.</h2><p>افهم • جرّب • اكتشف</p><div className="sofia-auth-bottom"><ShieldCheck size={18}/> حصص مباشرة تحت إشراف المعلمة</div></aside></div></main>;
}
function ErrorMessage({message}){return message?<div role="alert" className="sofia-alert">{message}</div>:null}
function Notice({children}){return <div role="status" className="sofia-auth-notice"><MailCheck size={22}/><div>{children}</div></div>}
function PasswordInput({label,value,onChange,autoComplete='new-password'}){
 const [visible,setVisible]=useState(false);
 return <label>{label}<div className="sofia-password-field"><input required minLength={autoComplete==='current-password'?1:10} maxLength={128} value={value} onChange={e=>onChange(e.target.value)} type={visible?'text':'password'} autoComplete={autoComplete} placeholder="••••••••••"/><button type="button" aria-label={visible?'إخفاء كلمة المرور':'إظهار كلمة المرور'} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={19}/>:<Eye size={19}/>}</button></div></label>;
}
export function SignInPage({api,user,setUser}){
 const navigate=useNavigate(),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(user)navigate(dashboardPath(user),{replace:true})},[user,navigate]);
 const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{const r=await api('/auth/login',{method:'POST',body:JSON.stringify({email,password})});setUser(r.user);navigate(dashboardPath(r.user),{replace:true})}catch(err){setError(err.message)}finally{setBusy(false)}};
 return <AuthLayout tag="WELCOME TO MRS SOFIA" title="أهلاً بيك في مدرسة العلوم" description="سجّل دخولك سواء كنت طالبًا أو مديرة المدرسة للوصول لمساحتك الخاصة.">
  <ErrorMessage message={error}/>
  <form className="sofia-auth-form" onSubmit={submit}>
   <label>البريد الإلكتروني<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="example@gmail.com"/></label>
   <PasswordInput label="كلمة المرور" value={password} onChange={setPassword} autoComplete="current-password"/>
   <Link className="sofia-auth-forgot" to="/forgot-password">نسيت كلمة المرور؟</Link>
   <button type="submit" className="sofia-cta sofia-auth-submit" disabled={busy}>{busy?'جارٍ الدخول...':'تسجيل الدخول'}<ArrowLeft size={18}/></button>
  </form>
  <div className="sofia-auth-switch">طالب جديد؟ <Link to="/register">اعمل حساب بالبريد الإلكتروني</Link></div>
 </AuthLayout>;
}
export function RegisterPage({api,user}){
 const navigate=useNavigate(),[form,setForm]=useState({name:'',email:'',password:''}),[consent,setConsent]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false),[busy,setBusy]=useState(false),[mailMode,setMailMode]=useState('');
 useEffect(()=>{api('/auth/registration-status').then(s=>setMailMode(s.emailMode)).catch(()=>{})},[api]);
 useEffect(()=>{if(user)navigate(dashboardPath(user),{replace:true})},[user,navigate]);
 const update=(key,value)=>setForm(f=>({...f,[key]:value}));
 const submit=async e=>{e.preventDefault();setError('');if(!consent){setError('لازم تأكد إنك صاحب الحساب أو ولي الأمر موافق على التسجيل');return}
  setBusy(true);try{await api('/auth/register',{method:'POST',body:JSON.stringify({name:form.name,email:form.email,password:form.password,role:'student',guardian_email:form.email,guardian_consent:true})});setDone(true)}catch(err){setError(err.message)}finally{setBusy(false)}};
 const resend=async()=>{setBusy(true);setError('');try{await api('/auth/resend-verification',{method:'POST',body:JSON.stringify({email:form.email})});setDone(true)}catch(err){setError(err.message)}finally{setBusy(false)}};
 return <AuthLayout tag="STUDENT REGISTRATION" title="ابدأ رحلتك مع Mrs Sofia" description="سجّل بريدك الإلكتروني، وافتح رسالة التأكيد لتفعيل حسابك قبل حجز الكورسات.">
  <ErrorMessage message={error}/>
  {done?<><Notice>تم إرسال رابط تفعيل حسابك إلى <strong dir="ltr">{form.email}</strong>. افتح البريد (وجرب مجلد Spam) واضغط رابط التفعيل؛ بعدها ارجع لتسجيل الدخول.</Notice>
   {mailMode==='local-preview'&&<p className="sofia-auth-hint">هذه نسخة محلية للاختبار: رسالة التأكيد موجودة في مجلد private-email-preview على جهاز تشغيل الموقع، وليست رسالة بريد خارجية.</p>}
   <button className="sofia-auth-linkbtn" disabled={busy} onClick={resend}>إعادة إرسال رابط التفعيل</button>
   <div className="sofia-auth-switch"><Link to="/login">العودة لتسجيل الدخول</Link></div></>:
  <form className="sofia-auth-form" onSubmit={submit}>
   {mailMode==='disabled'&&<ErrorMessage message="تسجيل الطلاب متوقف مؤقتًا حتى تفعيل خدمة إرسال البريد الإلكتروني."/>}
   <label>اسم الطالب بالكامل<input required autoComplete="name" maxLength={80} value={form.name} onChange={e=>update('name',e.target.value)} placeholder="الاسم كما يظهر للمعلمة"/></label>
   <label>بريد ولي الأمر المسؤول عن الطالب<input required type="email" autoComplete="email" value={form.email} onChange={e=>update('email',e.target.value)} placeholder="example@gmail.com"/></label>
   <PasswordInput label="كلمة مرور قوية (10 أحرف على الأقل)" value={form.password} onChange={v=>update('password',v)}/>
   <label className="sofia-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> <span>أُقرّ أنني ولي أمر الطالب وصاحب هذا البريد الإلكتروني، وأوافق على إنشاء حساب تعليمي للطالب وفق <Link to="/privacy">سياسة الخصوصية</Link> و<Link to="/terms">شروط الاشتراك</Link>.</span></label>
   <button type="submit" className="sofia-cta sofia-auth-submit" disabled={busy||mailMode==='disabled'}>{busy?'جارٍ التسجيل...':'إنشاء حساب الطالب'}<ArrowLeft size={17}/></button>
  </form>}
  <div className="sofia-auth-switch">عندك حساب؟ <Link to="/login">سجّل دخولك</Link></div>
 </AuthLayout>;
}
const verificationRequests=new Map();
export function VerifyEmailPage({api}){
 const [params]=useSearchParams(),[state,setState]=useState('checking'),[error,setError]=useState('');
 const token=params.get('token')||'';
 useEffect(()=>{let alive=true;if(!/^[0-9a-f]{64}$/.test(token)){setState('failed');setError('رابط التفعيل غير صحيح');return}
  let promise=verificationRequests.get(token);
  if(!promise){promise=api('/auth/verify-email',{method:'POST',body:JSON.stringify({token})});verificationRequests.set(token,promise)}
  promise.then(()=>{if(alive)setState('verified')}).catch(e=>{if(alive){setState('failed');setError(e.message)}});return()=>{alive=false}},[api,token]);
 return <AuthLayout tag="EMAIL VERIFICATION" title="تأكيد البريد الإلكتروني" description="دي خطوة لحماية حسابك قبل دخول الفصل التعليمي.">
  {state==='checking'&&<p>بنراجع رابط التفعيل...</p>}
  {state==='verified'&&<><Notice>تم تأكيد البريد وتفعيل حسابك بنجاح. تقدر تسجّل دخولك دلوقتي.</Notice><Link className="sofia-cta sofia-auth-submit" to="/login">تسجيل الدخول <ArrowLeft size={17}/></Link></>}
  {state==='failed'&&<><ErrorMessage message={error}/><p>لو انتهت صلاحية الرابط اطلب إعادة إرسال رسالة التفعيل من صفحة إنشاء الحساب.</p><Link className="sofia-auth-linkbtn" to="/register">رجوع للتسجيل</Link></>}
 </AuthLayout>;
}
export function ForgotPasswordPage({api}){
 const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 const submit=async e=>{e.preventDefault();setBusy(true);try{await api('/auth/forgot-password',{method:'POST',body:JSON.stringify({email})});setDone(true)}catch(err){setError(err.message)}finally{setBusy(false)}};
 return <AuthLayout tag="RESET PASSWORD" title="استعادة كلمة المرور" description="هنبعت لك رابط لإعادة تعيين كلمة المرور على بريدك المسجل.">
  <ErrorMessage message={error}/>
  {done?<Notice>لو البريد مسجل عندنا هتوصلك رسالة فيها رابط لتغيير كلمة المرور.</Notice>:<form className="sofia-auth-form" onSubmit={submit}><label>البريد الإلكتروني<input required type="email" value={email} autoComplete="email" onChange={e=>setEmail(e.target.value)}/></label><button type="submit" className="sofia-cta sofia-auth-submit" disabled={busy}>{busy?'جارٍ الإرسال...':'إرسال رابط الاستعادة'}<Send size={17}/></button></form>}
  <div className="sofia-auth-switch"><Link to="/login">العودة لتسجيل الدخول</Link></div>
 </AuthLayout>;
}
export function ResetPasswordPage({api}){
 const [params]=useSearchParams(),token=params.get('token')||'',[password,setPassword]=useState(''),[again,setAgain]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 const submit=async e=>{e.preventDefault();if(password!==again){setError('كلمتا المرور غير متطابقتين');return}setBusy(true);setError('');try{await api('/auth/reset-password',{method:'POST',body:JSON.stringify({token,password})});setDone(true)}catch(err){setError(err.message)}finally{setBusy(false)}};
 return <AuthLayout tag="CHOOSE NEW PASSWORD" title="تغيير كلمة المرور" description="اكتب كلمة مرور قوية جديدة، وسيتم إلغاء صلاحية جلسات الدخول القديمة.">
  <ErrorMessage message={error}/>
  {done?<><Notice>تم تحديث كلمة المرور بنجاح.</Notice><Link to="/login" className="sofia-cta sofia-auth-submit">تسجيل الدخول <ArrowLeft size={17}/></Link></>:<form className="sofia-auth-form" onSubmit={submit}><PasswordInput label="كلمة المرور الجديدة" value={password} onChange={setPassword}/><PasswordInput label="تأكيد كلمة المرور" value={again} onChange={setAgain}/><button disabled={busy||!/^[a-f0-9]{64}$/.test(token)} className="sofia-cta sofia-auth-submit">{busy?'جارٍ التغيير...':'حفظ كلمة المرور'}<LockKeyhole size={17}/></button></form>}
 </AuthLayout>;
}
