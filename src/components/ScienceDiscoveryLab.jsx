import React,{useState} from 'react';
import {ArrowLeft,CheckCircle2,FlaskConical,Lightbulb,Moon,RotateCcw,Sparkles,Sprout,Zap} from 'lucide-react';
import {SCIENCE_DISCOVERIES,evaluateDiscovery,nextDiscoveryIndex} from './science-discoveries.js';

const SCIENCE_ICONS=Object.freeze({lightning:Zap,plant:Sprout,moon:Moon});

/**
 * A tiny interactive science lab on the PUBLIC home page only.
 * No scoring, account, cookies, analytics, auto-advance or network calls.
 * The child must choose an answer; content never moves on a timer.
 */
export function ScienceDiscoveryLab(){
 const [index,setIndex]=useState(0);
 const [selected,setSelected]=useState(null);
 const discovery=SCIENCE_DISCOVERIES[index];
 const Icon=SCIENCE_ICONS[discovery.icon]||FlaskConical;
 const correct=evaluateDiscovery(discovery,selected);
 const next=()=>{
  setIndex(i=>nextDiscoveryIndex(i));
  setSelected(null);
 };

 return <section className="sofia-discovery-section" id="sofia-discovery" aria-labelledby="sofia-discovery-title">
  <div className="sofia-container sofia-discovery-grid">
   <div className="sofia-discovery-intro">
    <span className="sofia-kicker"><i/> استراحة علمية صغيرة</span>
    <h2 id="sofia-discovery-title">كل سؤال وراه <em>اكتشاف!</em></h2>
    <p>قبل ما تبدأ رحلتك مع مس صوفيا، جرب تفكر زي العلماء: اسأل، اختار إجابة، وشوف العلم بيحكي إيه.</p>
    <div className="sofia-discovery-art" aria-hidden="true">
     <svg className="sofia-discovery-orbits" viewBox="0 0 320 230" focusable="false">
      <ellipse cx="160" cy="112" rx="109" ry="40" transform="rotate(-28 160 112)"/>
      <ellipse cx="160" cy="112" rx="109" ry="40" transform="rotate(28 160 112)"/>
      <ellipse cx="160" cy="112" rx="109" ry="40" transform="rotate(90 160 112)"/>
      <circle cx="160" cy="112" r="28" className="sofia-discovery-nucleus"/>
      <circle cx="160" cy="112" r="12" className="sofia-discovery-nucleus-light"/>
      <circle cx="70" cy="63" r="8" className="sofia-discovery-electron"/>
      <circle cx="252" cy="159" r="8" className="sofia-discovery-electron second"/>
     </svg>
     <span className="sofia-discovery-art-icon"><Icon size={37} strokeWidth={1.7}/></span>
     <span className="sofia-discovery-art-tag"><Sparkles size={15}/> SCIENCE IS MAGIC!</span>
    </div>
    <div className="sofia-discovery-note"><Lightbulb size={19}/><span>مفيش درجات هنا… مجرد فضول وتجربة ممتعة!</span></div>
   </div>

   <div className="sofia-discovery-card" data-discovery-index={index} data-answer-result={correct===null?'unanswered':correct?'correct':'retry'}>
    <div className="sofia-discovery-card-top">
     <span className="sofia-discovery-card-eyebrow"><FlaskConical size={17}/> مختبر الفضول</span>
     <span className="sofia-discovery-count" aria-label={'السؤال '+(index+1)+' من '+SCIENCE_DISCOVERIES.length} dir="ltr">
      {String(index+1).padStart(2,'0')} <span>/</span> {String(SCIENCE_DISCOVERIES.length).padStart(2,'0')}
     </span>
    </div>
    <div className="sofia-discovery-progress" aria-hidden="true">
     {SCIENCE_DISCOVERIES.map((item,i)=><span key={item.id} className={i===index?'active':''}/>)}
    </div>
    <div className="sofia-discovery-subject"><span className="sofia-discovery-subject-icon"><Icon size={22}/></span>{discovery.subject} • اختبر تفكيرك</div>
    <h3 id="sofia-discovery-question" className="sofia-discovery-question">{discovery.title}</h3>
    <div className="sofia-discovery-answers" role="group" aria-labelledby="sofia-discovery-question">
     {discovery.choices.map((choice,i)=><button
      key={choice}
      type="button"
      aria-pressed={selected===i}
      disabled={correct===true}
      className={'sofia-discovery-answer'+(selected===i?' selected '+(correct?'right':'try-again'):'')}
      onClick={()=>setSelected(i)}>
      <span className="sofia-discovery-answer-mark" aria-hidden="true">{String.fromCharCode(65+i)}</span>
      <span>{choice}</span>
      {selected===i&&correct===true&&<CheckCircle2 size={20} aria-hidden="true"/>}
     </button>)}
    </div>
    <div className={'sofia-discovery-feedback '+(correct===true?'is-correct':correct===false?'is-try-again':'')} aria-live="polite" aria-atomic="true" role="status">
     {correct===true?<><CheckCircle2 size={20} aria-hidden="true"/><div><strong>{discovery.discovery}</strong><p>{discovery.explanation}</p></div></>:
      correct===false?<><Lightbulb size={19} aria-hidden="true"/><span>فكّر فيها تاني! جرب الإجابة التانية.</span></>:
      <><Sparkles size={18} aria-hidden="true"/><span>اختار إجابة وشوف سرّ المعلومة.</span></>}
    </div>
    <div className="sofia-discovery-card-footer">
     <span><Sparkles size={15}/> اتعلم وأنت بتستكشف</span>
     <button type="button" className="sofia-discovery-next" onClick={next} disabled={correct!==true}>
      {index===SCIENCE_DISCOVERIES.length-1?<><RotateCcw size={17}/> جولة جديدة</>:<>السؤال اللي بعده <ArrowLeft size={17}/></>}
     </button>
    </div>
   </div>
  </div>
 </section>;
}
