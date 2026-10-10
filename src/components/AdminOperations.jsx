import React from 'react';
import {Link} from 'react-router-dom';
import {BookOpen,CalendarDays,Video,Users,Smartphone,ShieldCheck,CheckCircle2,AlertCircle,ArrowLeft,MailCheck} from 'lucide-react';
import {PanelHeading} from './PortalShell.jsx';

const steps=[
 {title:'١. أنشئي دورة علوم',detail:'اختاري المادة والمرحلة والسعر وعدد المقاعد؛ يمكنك إسناد الدورة لحساب المديرة نفسه.',icon:BookOpen,tab:'courses',action:'إنشاء الدورات'},
 {title:'٢. حددي حصة داخل الدورة',detail:'من الدورات اضغطي إضافة حصة واختاري الموعد والمدة. الحصة تظهر تلقائيًا في جدول الإدارة.',icon:CalendarDays,tab:'courses',action:'إضافة حصة'},
 {title:'٣. افتحي الفصل وابدئي البث',detail:'من تبويب الحصص اختاري «استوديو البث الخاص بي»، واختبري الأجهزة. قبل الموعد بـ15 دقيقة افتحي الاستوديو واضغطي «ابدئي البث الآن»؛ ويمكنك مشاركة الشاشة بدل الكاميرا.',icon:Video,tab:'lessons',action:'جدول الحصص'},
 {title:'٤. تسجيل ولي الأمر والطالب',detail:'ولي الأمر يدخل بحساب Google المؤكد وينشئ ملف الطالب بعد الموافقة على الخصوصية. التسجيل لا يمنح دخول الحصص قبل اعتماد الحجز.',icon:Users,tab:'users',action:'سجل الحسابات'},
 {title:'٥. يختار الطالب الدورة ويرفع الإيصال',detail:'من صفحة الكورسات يحجز مكانًا، ثم من لوحة الطالب ← «فودافون كاش» يرفع الإيصال ويكتب رقم الموبايل الذي حوّل منه.',icon:Smartphone,tab:'bookings',action:'طلبات الحجز'},
 {title:'٦. راجعي تحويل فودافون كاش',detail:'من «تحويلات فودافون كاش» افتحي الإيصال، وقارني المبلغ ورقم الهاتف مع ما وصل فعلًا، ثم فعّلي مربع التأكيد واضغطي «تأكيد التحويل وقبول الطالب».',icon:ShieldCheck,tab:'payments',action:'مراجعة التحويلات'},
 {title:'٧. الحضور والمشاركة داخل الفصل',detail:'بعد الموافقة يظهر جدول الحصص في لوحة الطالب. يبدأ الاستماع فقط، ويرفع يده، والمعلمة تمنح إذن الميكروفون أو الكاميرا وتتابع الحضور.',icon:CheckCircle2,tab:'attendance',action:'سجل الحضور'},
 {title:'٨. تابعي مدة الاشتراك والتجديد',detail:'من الاشتراكات الشهرية تابعي الطلاب الذين اقترب انتهاء مدة الثلاثين يومًا لديهم. يرسل ولي الأمر إيصال تجديد مستقلًا، ولا يمتد الاشتراك إلا بعد مطابقة التحويل وقبوله من الإدارة.',icon:CalendarDays,tab:'subscriptions',action:'الاشتراكات الشهرية'}
];
const liveVerification=[
 {key:'databaseConnected',label:'اتصال قاعدة بيانات الطلاب والمديرة',description:'استعلام فعلي بقاعدة PostgreSQL وبصلاحية تطبيق المدرسة'},
 {key:'livekitApiVerified',label:'الاتصال السحابي بغرف البث LiveKit',description:'طلب فعلي إلى LiveKit Cloud، بدون إنشاء غرفة أو فتح كاميرا'},
 {key:'receiptBucketPrivateVerified',label:'المخزن الخاص لإيصالات فودافون كاش',description:'فحص مخزن Supabase الصحيح والتأكد أنه غير متاح للعامة'}
];
const readiness=[
 {key:'adminGoogleEnabled',label:'Google دخول المديرة'},
 {key:'studentGoogleEnabled',label:'Google لولي الأمر / الطالب'},
 {key:'studentGoogleRegistrationEnabled',label:'فتح إنشاء الطلاب باستخدام Google'},
 {key:'guardianPrivacyApproved',label:'اعتماد سياسة الخصوصية وموافقة ولي الأمر'},
 {key:'schoolContactConfigured',label:'بريد التواصل الرسمي للمدرسة'},
 {key:'outboundMailConfigured',label:'إعداد مزود إرسال بريد التأكيد (إن استُخدمت كلمات المرور)'},
 {key:'paymentWalletConfigured',label:'إعداد رقم محفظة فودافون كاش'},
 {key:'privateReceiptStorageConfigured',label:'إعداد مخزن إيصالات الدفع الخاص'},
 {key:'livekitCredentialsConfigured',label:'إعداد LiveKit للبث المباشر'},
 {key:'monthlyRenewalsEnabled',label:'تفعيل تجديد الاشتراكات الشهرية بعد ترحيل قاعدة البيانات'},
 {key:'classroomQuestionsEnabled',label:'تفعيل الأسئلة المكتوبة الخاصة داخل الحصة'}
];
export default function AdminOperations({setup,diagnostics,onRefresh,onNavigate}){
 return <div className="sofia-operations" dir="rtl">
  <section className="portal-panel">
   <PanelHeading title="خريطة تشغيل مدرسة Mrs Sofia" description="خطوات الإدارة والطالب من أول إنشاء الدورة حتى قبول الاشتراك ودخول البث المباشر."/>
   <div className="portal-list">
    {steps.map((item,i)=>{const Icon=item.icon;return <div className="portal-list-item" key={item.title}>
     <span className="portal-list-icon"><Icon size={21}/></span>
     <div className="portal-list-copy"><strong>{item.title}</strong><small style={{display:'block',lineHeight:1.9,marginTop:6}}>{item.detail}</small></div>
     <button className="portal-soft-btn" onClick={()=>onNavigate(item.tab)}>{item.action} <ArrowLeft size={15}/></button>
    </div>})}
   </div>
  </section>
  <section className="portal-panel">
   <PanelHeading title="اختبار الخدمات الفعلي" description="نتائج من خادم المدرسة، وليست مجرد وجود مفاتيح إعدادات." action={<button type="button" className="portal-soft-btn" onClick={onRefresh}>إعادة فحص الخدمات</button>}/>
   <div className="portal-list">
    {liveVerification.map(item=><div className="portal-list-item" key={item.key}>
     <span className="portal-list-icon">{diagnostics?.[item.key]?<CheckCircle2 size={20}/>:<AlertCircle size={20}/>}</span>
     <div className="portal-list-copy"><strong>{item.label}</strong><small>{!diagnostics?'جارٍ إجراء الفحص الآمن...':diagnostics[item.key]?'تم التحقق من الاتصال': 'لم يجتز الفحص بعد'}</small><small>{item.description}</small></div>
    </div>)}
   </div>
   {diagnostics?.checkedAt&&<p className="sofia-auth-hint">آخر فحص: {new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Cairo'}).format(new Date(diagnostics.checkedAt))}. لا يثبت الفحص وحده إرسال بريد تأكيد أو استلام تحويل مالي أو جودة بث بجهازين.</p>}
  </section>
  <section className="portal-panel">
   <PanelHeading title="التحقق من التجهيز للإطلاق العام" description="هذه حالات إعدادات الخادم؛ وجود المفتاح لا يعني وحده أن تحويل الأموال أو تسليم البريد اختُبر عمليًا."/>
   <div className="portal-list">
    {readiness.map(item=><div className="portal-list-item" key={item.key}>
     <span className="portal-list-icon">{setup?.[item.key]?<CheckCircle2 size={18}/>:<AlertCircle size={18}/>}</span>
     <div className="portal-list-copy"><strong>{item.label}</strong><small>{!setup?'جارٍ التحقق من إعدادات الخادم...':setup[item.key]?'الإعداد موجود':'لم يُفعّل بعد'}</small></div>
    </div>)}
   </div>
   <p className="sofia-auth-hint">تنبيه التشغيل: لا تُفعّلي تجديد الاشتراكات أو دردشة الأسئلة إلا بعد تطبيق ترحيل قاعدة البيانات والتحقق من الصلاحيات. خدمة إرسال البريد منفصلة عن تسجيل Google، ونجاح فحص LiveKit API لا يغني عن تجربة حصة صوت وصورة على جهازين.</p>
   <p className="sofia-auth-hint">لن يُفتح التسجيل العام قبل تأكيد الخصوصية، تفعيل وسائل تسجيل ولي الأمر، حماية الإيصالات، واختبار الحصص من جهازين. لا تطلبي من ولي الأمر تحويل أي مبلغ قبل ظهور تعليمات الدفع الرسمية داخل لوحة الطالب.</p>
   <Link className="portal-soft-btn" to="/privacy"><ShieldCheck size={16}/> راجعي سياسة الخصوصية</Link>
   <Link className="portal-soft-btn" to="/terms"><MailCheck size={16}/> شروط الدراسة والاسترداد</Link>
  </section>
 </div>;
}
