import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isPublicBootstrapRoute} from '../src/public-bootstrap.js';
import {publicSeoMeta,SEO_ORIGIN} from '../src/public-seo.js';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const app=read('src/App.jsx');
const guide=read('src/pages/GettingStartedGuide.jsx');
const brand=read('src/components/MrsSofiaBrand.jsx');
const home=read('src/pages/MrsSofiaSite.jsx');
const auth=read('src/pages/MrsSofiaAuth.jsx');
const student=read('src/pages/StudentPortal.jsx');
const css=read('src/getting-started-guide.css');
const boot=read('src/main.jsx');
const scroll=read('src/components/RouteScrollManager.jsx');
const payments=read('server/payment-routes.js');
const sitemap=read('public/sitemap.xml');

assert.ok(isPublicBootstrapRoute('/guide'),'guide works while backend boots');
assert.ok(!isPublicBootstrapRoute('/student'),'private student pages stay gated');
assert.ok(!isPublicBootstrapRoute('/lesson/123'),'private lessons stay gated');
assert.match(app,/<Route path="\/guide" element=\{<GettingStartedGuide\/>\}/,'guide routed');
assert.match(app,/<RouteScrollManager\/>/,'scroll restoration installed inside router');
assert.match(boot,/scrollRestoration='manual'/,'disable browser native scroll restoration before hydration');
assert.match(scroll,/scrollTo\(\{top:0,left:0,behavior:'instant'\}\)/,'refresh and navigation start at top immediately');
assert.match(scroll,/decodeURIComponent\(hash\.slice\(1\)\)/,'anchor names decode correctly');
assert.match(scroll,/scrollIntoView/,'hash sections still work');
assert.match(brand,/to:'\/guide',label:'ابدأ هنا'/,'main navigation has guide');
assert.match(brand,/<Link to="\/guide">دليل الاستخدام<\/Link>/,'footer shows walkthrough');
assert.match(home,/sofia-guide-home-strip/,'prominent first-time callout on homepage');
assert.match(home,/to="\/guide"/,'home CTA linked to guide');
assert.match(auth,/to="\/guide"/,'guardian can seek help while registering');
assert.match(student,/to="\/guide"/,'student can access help inside dashboard');

const required=[
 'تسجيل الطالب باستخدام حساب ولي الأمر Google',
 'طلب الحجز','فودافون كاش','رقم المحفظة',
 'PNG أو JPEG أو WebP','8 ميجابايت','لا تكرر التحويل',
 'قيد المراجعة','قبل الموعد بـ15 دقيقة','مشاهدة البث',
 'قاعة انتظار الحصة','اضغط هنا لتشغيل صوت الدرس',
 'ارفع إيدك','تشغيل ميكروفوني','30 يومًا','تجديد الاشتراك'
];
for(const label of required)assert.ok(guide.includes(label),'guide explicitly explains '+label);
assert.equal((guide.match(/previewItems:/g)||[]).length,7,'seven progressive, illustrated onboarding steps');
assert.match(guide,/منصة Miss Sofia نفسها/,'lessons stay within school');
assert.ok(!/خروج الأطفال بالليل|ليلة الامتحان|كلهم عارفين بعض/.test(guide),'private motivation not disclosed');
assert.match(guide,/لا تحوّل أي مبلغ/,'payment safety warning');
assert.match(payments,/SCHOOL_REFUND_POLICY_APPROVED==='true'/,'paid registration remains fail-closed');
assert.match(css,/prefers-reduced-motion/,'animation accessibility');
assert.match(css,/sofia-guide-step-tab:focus-visible/,'keyboard focus visibility');
assert.ok(sitemap.includes('<loc>'+SEO_ORIGIN+'/guide</loc>'),'sitemap includes guide');
assert.equal(publicSeoMeta('/guide').canonical,SEO_ORIGIN+'/guide');
assert.equal(publicSeoMeta('/guide').pathname,'/guide');
console.log('PASS newcomer guide covers real registration, payment and LiveKit controls, safe payments, navigation and scroll routing');
