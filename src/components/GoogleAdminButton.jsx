import React,{useEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ShieldCheck} from 'lucide-react';

let googleScriptPromise=null;
function loadGoogleIdentity(){
 if(window.google?.accounts?.id)return Promise.resolve();
 if(googleScriptPromise)return googleScriptPromise;
 googleScriptPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://accounts.google.com/gsi/client';
  script.async=true;
  script.defer=true;
  script.onload=()=>resolve();
  script.onerror=()=>reject(new Error('تعذر تحميل صفحة الدخول من Google'));
  document.head.appendChild(script);
 }).catch(error=>{googleScriptPromise=null;throw error});
 return googleScriptPromise;
}
export default function GoogleAdminButton({api,setUser}){
 const navigate=useNavigate(),container=useRef(null);
 const [config,setConfig]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  let mounted=true;
  api('/auth/google/config').then(v=>{if(mounted)setConfig(v?.enabled?v:null)}).catch(()=>{if(mounted)setConfig(null)});
  return()=>{mounted=false};
 },[api]);
 useEffect(()=>{
  if(!config?.clientId)return;
  let mounted=true;
  loadGoogleIdentity().then(()=>{
   if(!mounted||!container.current||!window.google?.accounts?.id)return;
   window.google.accounts.id.initialize({
    client_id:config.clientId,
    auto_select:false,
    callback:async result=>{
     if(!mounted||!result?.credential)return;
     setBusy(true);setError('');
     try{
      const response=await api('/auth/google/login',{method:'POST',body:JSON.stringify({credential:result.credential})});
      if(mounted){setUser(response.user);navigate('/admin',{replace:true})}
     }catch(err){if(mounted)setError(err.message||'تعذر تسجيل الدخول عبر Google')}
     finally{if(mounted)setBusy(false)}
    }
   });
   container.current.replaceChildren();
   window.google.accounts.id.renderButton(container.current,{
    theme:'outline',size:'large',shape:'pill',text:'signin_with',locale:'ar',width:290
   });
  }).catch(err=>{if(mounted)setError(err.message||'تعذر الاتصال بـ Google')});
  return()=>{mounted=false};
 },[config?.clientId,api,setUser,navigate]);
 if(!config)return null;
 return <section className="sofia-google-admin-entry" aria-label="تسجيل دخول المديرة من Google">
  <span className="sofia-google-divider">أو دخول إدارة المدرسة بحساب Google</span>
  <div ref={container} aria-busy={busy} className="sofia-google-signin-mount"/>
  <small><ShieldCheck size={14}/> متاح فقط لبريد المديرة المعتمد، ولا ينشئ حساب إدارة جديدًا</small>
  {error&&<div role="alert" className="sofia-alert">{error}</div>}
 </section>;
}
