// Shared by browser metadata and the post-build Cloudflare Pages HTML snapshots.
// Branding and canonical URLs must never disagree between the static HTML and SPA.
export const SEO_ORIGIN='https://mssofia.pages.dev';
export const PUBLIC_SEO=Object.freeze({
 '/':{
  title:'مس صوفيا للعلوم | شرح العلوم أونلاين مع Miss Sofia',
  description:'مس صوفيا للعلوم — نطوّر تجربة تعليم العلوم أونلاين من خلال منصة رقمية تجمع شرح العلوم للمرحلة الابتدائية، والكورسات والحصص التفاعلية ومتابعة المواعيد في مكان واحد.'
 },
 '/courses':{
  title:'دورة العلوم للمرحلة الابتدائية | مس صوفيا للعلوم',
  description:'تعرف على دورة العلوم للمرحلة الابتدائية مع مس صوفيا: شرح مبسط بالأمثلة وحصص مباشرة داخل المنصة. اطلع على المحتوى والمواعيد المنشورة قبل تقديم طلب الحجز.'
 },
  '/courses/443b2d26-faba-464a-984b-8a823fddd146':{
  title:'دورة العلوم للمرحلة الابتدائية — 60 دقيقة | مس صوفيا للعلوم',
  description:'تفاصيل دورة العلوم للمرحلة الابتدائية مع مس صوفيا، بحصص مدتها 60 دقيقة ومتابعة المواعيد المنشورة. التسجيل بإشراف ولي الأمر والحجز بعد مراجعة الإدارة.',
  courseName:'دورة العلوم'
 },
 '/privacy':{
  title:'سياسة الخصوصية وحماية الطلاب | مس صوفيا للعلوم',
  description:'تعرف على سياسة الخصوصية وحماية بيانات الطلاب وأولياء الأمور وكيفية التعامل مع الحسابات والحصص المباشرة في منصة مس صوفيا للعلوم.'
 },
 '/terms':{
  title:'شروط الاشتراك والحصص المباشرة | مس صوفيا للعلوم',
  description:'تعرّف على شروط الاشتراك ودفع فودافون كاش ومراجعة الإيصال وإجراءات إلغاء الحصص والتعويض والاسترداد والتواصل مع مس صوفيا.'
 }
});
export function publicSeoMeta(pathname){
 if(typeof pathname!=='string')return null;
 const path=pathname.replace(/\/+$/,'')||'/';
 return Object.hasOwn(PUBLIC_SEO,path)?{...PUBLIC_SEO[path],pathname:path,canonical:SEO_ORIGIN+path}:null;
}
