// Shared by browser metadata and the post-build Cloudflare Pages HTML snapshots.
// Branding and canonical URLs must never disagree between the static HTML and SPA.
export const SEO_ORIGIN='https://mssofia.pages.dev';
export const PUBLIC_SEO=Object.freeze({
 '/':{
  title:'مس صوفيا للعلوم | شرح العلوم أونلاين مع Miss Sofia',
  description:'مس صوفيا للعلوم — شرح مبسط للعلوم والفيزياء والأحياء والكيمياء، وحصص مباشرة داخل الموقع، ومتابعة للطلاب واشتراكات شهرية تعتمدها الإدارة بعد التحقق من الدفع.'
 },
 '/courses':{
  title:'كورسات العلوم والفيزياء والأحياء والكيمياء | مس صوفيا للعلوم',
  description:'استكشف كورسات مس صوفيا للعلوم في العلوم والفيزياء والأحياء والكيمياء، وتعرّف على طريقة الشرح والحصص المباشرة ومواعيد الدروس.'
 },
 '/privacy':{
  title:'سياسة الخصوصية وحماية الطلاب | مس صوفيا للعلوم',
  description:'تعرف على سياسة الخصوصية وحماية بيانات الطلاب وأولياء الأمور وكيفية التعامل مع الحسابات والحصص المباشرة في منصة مس صوفيا للعلوم.'
 },
 '/terms':{
  title:'شروط الاشتراك والحصص المباشرة | مس صوفيا للعلوم',
  description:'اطلع على شروط التسجيل والاشتراك الشهري والحصص المباشرة وسياسة حجز الدروس في منصة مس صوفيا للعلوم.'
 }
});
export function publicSeoMeta(pathname){
 if(typeof pathname!=='string')return null;
 const path=pathname.replace(/\/+$/,'')||'/';
 return Object.hasOwn(PUBLIC_SEO,path)?{...PUBLIC_SEO[path],pathname:path,canonical:SEO_ORIGIN+path}:null;
}
