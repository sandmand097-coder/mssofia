import React,{useEffect,useState} from 'react';
import {Send,RefreshCw,ShieldCheck} from 'lucide-react';

const api=async(path,options={})=>{
 const result=await fetch('/api'+path,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...options});
 const body=await result.json().catch(()=>({}));
 if(!result.ok)throw Error(body.error||'تعذر الاتصال بدردشة الدرس');
 return body;
};
export default function ClassroomQuestions({lessonId,host}){
 const [questions,setQuestions]=useState([]),[draft,setDraft]=useState(''),[answers,setAnswers]=useState({});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[updated,setUpdated]=useState(false);
 const path='/lessons/'+encodeURIComponent(lessonId)+'/questions';
 useEffect(()=>{
  let mounted=true,timer=null,inflight=false,failures=0;
  const base=host?9000:17000;
  const refresh=async()=>{
   if(!mounted)return;
   // Do not poll while the tab is hidden or when a previous request is pending.
   if(document.visibilityState==='hidden'||inflight){schedule(15000);return}
   inflight=true;
   try{
    const result=await api(path);
    if(mounted){setQuestions(result.questions||[]);setUpdated(true);setError('');failures=0}
   }catch(err){
    if(mounted){setError(err.message);failures=Math.min(failures+1,4)}
   }finally{
    inflight=false;
    if(mounted)schedule(Math.min(60000,base*Math.pow(2,failures)));
   }
  };
  const schedule=ms=>{
   clearTimeout(timer);
   timer=setTimeout(refresh,Math.round(ms*(.85+Math.random()*.3)));
  };
  const focus=()=>{if(document.visibilityState==='visible'&&!inflight){clearTimeout(timer);void refresh()}};
  document.addEventListener('visibilitychange',focus);
  void refresh();
  return()=>{mounted=false;clearTimeout(timer);document.removeEventListener('visibilitychange',focus)};
 },[path,host]);
 const ask=async e=>{
  e.preventDefault();if(busy||!draft.trim())return;
  setBusy(true);setError('');
  try{
   await api(path,{method:'POST',body:JSON.stringify({message:draft.trim()})});
   setDraft('');const r=await api(path);setQuestions(r.questions||[]);
  }catch(err){setError(err.message)}finally{setBusy(false)}
 };
 const reply=async item=>{
  const response=String(answers[item.id]||'').trim();
  if(!response||busy)return;
  setBusy(true);setError('');
  try{
   await api(path+'/'+encodeURIComponent(item.id),{method:'PATCH',body:JSON.stringify({answer:response})});
   setAnswers(v=>({...v,[item.id]:''}));
   const r=await api(path);setQuestions(r.questions||[]);
  }catch(err){setError(err.message)}finally{setBusy(false)}
 };
 return <section className="sofia-meeting-qa" aria-label="أسئلة الطلاب داخل الحصة">
  <h3>{host?'أسئلة الطلاب الخاصة بالمعلمة':'اسأل المعلمة كتابةً'}</h3>
  <p className="sofia-meeting-safety"><ShieldCheck size={15}/> الأسئلة الخاصة تظهر للمعلمة فقط، وردها يظهر لصاحب السؤال فقط. لا ترسل رقم هاتف أو معلومات شخصية.</p>
  {error&&<p role="alert" className="sofia-meeting-error">{error}</p>}
  {!updated?<p>جارٍ تحميل الدردشة...</p>:questions.length===0?<p>لا توجد أسئلة حتى الآن.</p>:null}
  <div className="sofia-meeting-chat-list">{questions.map(item=><div className="sofia-meeting-chat" key={item.id}>
   <strong>{host?item.student_name:'سؤالك'}</strong>
   <p>{item.body}</p>
   {item.answer?<p><strong>رد المعلمة: </strong>{item.answer}</p>:host?
    <div className="sofia-meeting-compose">
     <label>رد على السؤال
      <textarea maxLength={500} rows={2} value={answers[item.id]||''} onChange={e=>setAnswers(v=>({...v,[item.id]:e.target.value}))} placeholder="اكتبي ردًا واضحًا"/>
     </label>
     <button type="button" disabled={busy||!String(answers[item.id]||'').trim()} onClick={()=>reply(item)}><Send size={14}/> إرسال الرد</button>
    </div>:<small>بانتظار رد المعلمة</small>}
  </div>)}</div>
  {!host&&<form className="sofia-meeting-compose" onSubmit={ask}>
   <label htmlFor="sofia-question">سؤالك للمعلمة</label>
   <textarea id="sofia-question" rows={3} maxLength={300} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="اكتب سؤالًا متعلقًا بالدرس، بدون بيانات شخصية"/>
   <button type="submit" disabled={busy||!draft.trim()}><Send size={15}/>{busy?'جارٍ الإرسال...':'إرسال السؤال'}</button>
  </form>}
  <button className="portal-text-button" type="button" onClick={()=>api(path).then(r=>setQuestions(r.questions||[])).catch(e=>setError(e.message))}><RefreshCw size={14}/> تحديث الأسئلة</button>
 </section>;
}
