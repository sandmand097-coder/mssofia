import React,{useEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ShieldCheck} from 'lucide-react';
import {dashboardPath} from './MrsSofiaBrand.jsx';

let googleScriptPromise=null;
function loadGoogleIdentity(){
 if(window.google?.accounts?.id)return Promise.resolve();
 if(googleScriptPromise)return googleScriptPromise;
 googleScriptPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://accounts.google.com/gsi/client';
  script.async=true;script.defer=true;
  script.onload=()=>resolve();
  script.onerror=()=>reject(new Error('تعذر تحميل Google. تحقق من الاتصال بالإنترنت'));
  document.head.appendChild(script);
 }).catch(error=>{googleScriptPromise=null;throw error});
 return googleScriptPromise;
}

export default function GoogleAdminButton({
 api,setUser,purpose='admin',registration=false,studentName='',guardianConsent=false
}){
 const navigate=useNavigate(),container=useRef(null);
 const latest=useRef({studentName,guardianConsent});
 latest.current={studentName,guardianConsent};
 const [config,setConfig]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const ready=registration?studentName.trim().length>=2&&guardianConsent:true;
 const studentSignupAvailable=Boolean(config?.studentRegistrationAvailable);
 useEffect(()=>{
  let mounted=true;
  api('/auth/google/config').then(v=>{if(mounted)setConfig(v?.enabled?v:null)})
   .catch(()=>{if(mounted)setConfig(null)});
  return()=>{mounted=false};
 },[api]);
 useEffect(()=>{
  if(!config?.clientId||!ready||registration&&!studentSignupAvailable)return;
  let mounted=true;
  loadGoogleIdentity().then(()=>{
   if(!mounted||!container.current||!window.google?.accounts?.id)return;
   window.google.accounts.id.initialize({
    client_id:config.clientId,auto_select:false,
    callback:async result=>{
     if(!mounted||!result?.credential)return;
     setBusy(true);setError('');
     try{
      const input={credential:result.credential};
      if(registration){
       input.register_student=true;
       input.student_name=latest.current.studentName.trim();
       input.guardian_consent=latest.current.guardianConsent===true;
      }
      const response=await api('/auth/google/login',{method:'POST',body:JSON.stringify(input)});
      if(mounted){setUser(response.user);navigate(dashboardPath(response.user),{replace:true})}
     }catch(err){if(mounted)setError(err.message||'تعذر تسجيل الدخول عبر Google')}
     finally{if(mounted)setBusy(false)}
    }
   });
   container.current.replaceChildren();
   window.google.accounts.id.renderButton(container.current,{
    theme:'outline',size:'large',shape:'pill',text:registration?'signup_with':'signin_with',locale:'ar',width:290
   });
  }).catch(err=>{if(mounted)setError(err.message||'تعذر الاتصال بـ Google')});
  return()=>{mounted=false};
 },[config?.clientId,api,setUser,navigate,ready,registration,studentSignupAvailable]);
 if(!config)return null;
 if(registration&&!studentSignupAvailable)return null;
 const label=registration?'تسجيل الطالب باستخدام حساب ولي الأمر Google'
  :purpose==='admin'?'دخول الإدارة بحساب Google':'دخول ولي الأمر أو المديرة بحساب Google';
 return <section className="sofia-google-admin-entry" aria-label={label}>
  <span className="sofia-google-divider">{label}</span>
  {!ready?<p className="sofia-auth-hint">أدخل اسم الطالب أولًا وحدد موافقة ولي الأمر أعلاه، ثم استخدم حساب Google الخاص بولي الأمر.</p>
   :<div ref={container} aria-busy={busy} className="sofia-google-signin-mount"/>}
  <small><ShieldCheck size={14}/>
   {registration?'يُنشأ ملف الطالب تحت بريد ولي الأمر المؤكد. الاشتراك في الكورس لا يتفعّل دون موافقة الإدارة على الحجز والدفع.'
    :purpose==='admin'?'حساب المُدرِّسة المعتمد فقط، ولا يُنشئ أي حساب إدارة جديد.'
    :'Google يثبت ملكية بريد ولي الأمر. يُسمح بدخول الحصص بعد موافقة الإدارة.'}
  </small>
  {error&&<div role="alert" className="sofia-alert">{error}</div>}
 </section>;
}
