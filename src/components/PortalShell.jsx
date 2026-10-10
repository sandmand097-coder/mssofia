import React from 'react';
import {Link} from 'react-router-dom';
import {GraduationCap,ShieldCheck,ArrowUpLeft,ChevronLeft,CalendarClock,BookOpen,FlaskConical,Presentation} from 'lucide-react';

export const dateLabel=value=>value?new Intl.DateTimeFormat('ar-EG',{day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Cairo'}).format(new Date(value)):'غير محدد';
export const timeLabel=value=>value?new Intl.DateTimeFormat('ar-EG',{hour:'numeric',minute:'2-digit',timeZone:'Africa/Cairo'}).format(new Date(value)):'—';
export const dateTimeLabel=value=>value?dateLabel(value)+' • '+timeLabel(value):'غير محدد';

export function StatusPill({status}){
 const labels={active:'نشط',blocked:'موقوف',pending:'قيد المراجعة',approved:'مقبول',rejected:'مرفوض',published:'منشورة',scheduled:'مجدولة',ended:'منتهية'};
 return <span className={'portal-status status-'+status}>{labels[status]||status}</span>;
}
export function PanelEmpty({title='لا توجد بيانات بعد',description='ستظهر التفاصيل هنا عند توفرها',icon:Icon=BookOpen}){
 return <div className="portal-empty"><span className="portal-empty-icon"><Icon size={25}/></span><strong>{title}</strong><p>{description}</p></div>;
}
export function PanelHeading({title,description,action}){
 return <div className="portal-panel-heading"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{action}</div>;
}
export function Metric({icon:Icon,label,value,sub,tone='purple'}){
 return <div className="portal-metric"><span className={'portal-metric-icon '+tone}><Icon size={22}/></span><div><span className="portal-metric-label">{label}</span><strong>{Number(value||0).toLocaleString('ar-EG')}</strong><small>{sub}</small></div></div>;
}

export default function PortalShell({variant='student',user,nav,active,onNavigate,title,subtitle,toolbar,children}){
 const isAdmin=variant==='admin',isTeacher=variant==='teacher';
 return <main className={'portal-page portal-'+variant}>
  <div className="portal-frame">
   <aside className="portal-rail">
    <div className="portal-rail-head"><span className="portal-rail-logo">{isAdmin?<ShieldCheck size={24}/>:isTeacher?<Presentation size={24}/>:<FlaskConical size={24}/>}</span>
      <div><strong>{isAdmin?'مركز الإدارة':isTeacher?'مساحة المعلم':'مساحة الطالب'}</strong><span>MISS SOFIA SCIENCE</span></div></div>
    <div className="portal-rail-caption">القائمة الرئيسية</div>
    <nav className="portal-menu" aria-label={isAdmin?'قائمة الإدارة':isTeacher?'قائمة المعلم':'قائمة الطالب'}>
     {nav.map(item=>{const Icon=item.icon;return <button key={item.id} type="button" className={'portal-menu-item '+(active===item.id?'is-active':'')} aria-current={active===item.id?'page':undefined} onClick={()=>onNavigate(item.id)}><Icon size={19}/><span>{item.label}</span>{item.count>0&&<em>{item.count}</em>}</button>})}
    </nav>
    <div className="portal-rail-bottom">
      <div className="portal-person"><span>{user.name?.trim().charAt(0)||'م'}</span><div><strong>{user.name}</strong><small>{isAdmin?'مسؤول المنصة':isTeacher?'حساب معلم':'حساب طالب'}</small></div></div>
      <Link to="/courses" className="portal-back-link">استكشف الدورات <ArrowUpLeft size={17}/></Link>
    </div>
   </aside>
   <section className="portal-workspace">
    <div className="portal-topline"><div className="portal-breadcrumb"><Link to="/">Miss Sofia</Link><ChevronLeft size={14}/><span>{isAdmin?'لوحة الإدارة':isTeacher?'لوحة المعلم':'لوحة الطالب'}</span></div><div className="portal-today"><CalendarClock size={16}/>{new Intl.DateTimeFormat('ar-EG',{weekday:'long',day:'numeric',month:'long',timeZone:'Africa/Cairo'}).format(new Date())}</div></div>
    <header className="portal-heading"><div><div className="portal-kicker">{isAdmin?'ADMINISTRATOR WORKSPACE':isTeacher?'TEACHER WORKSPACE':'STUDENT LEARNING SPACE'}</div><h1>{title}</h1><p>{subtitle}</p></div>{toolbar&&<div className="portal-heading-action">{toolbar}</div>}</header>
    <div className="portal-workspace-body">{children}</div>
    <footer className="portal-page-footer">Miss Sofia — مُدرِّسة العلوم <span>•</span> مساحة آمنة ومنظمة للتعلم والمتابعة</footer>
   </section>
  </div>
 </main>;
}
