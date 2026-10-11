import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PUBLIC_SEO,SEO_ORIGIN} from '../src/public-seo.js';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const policy=read('src/pages/SchoolPolicies.jsx');
const catalogue=read('src/pages/MrsSofiaSite.jsx');
const cards=read('src/components/MrsSofiaBrand.jsx');
const offer=read('src/components/LaunchOffer.jsx');
const payment=read('server/payment-routes.js');
const renewal=read('server/subscription-renewals.js');
const readiness=read('server/release-readiness.js');
const env=read('.env.example');
const sitemap=read('public/sitemap.xml');

for(const term of [
 'شروط الدراسة والاشتراك والاسترداد',
 'إلغاء الاشتراك بواسطة ولي الأمر',
 'إلغاء الحصص أو انقطاع البث من جهة المُدرِّسة',
 'استرداد القيمة النسبية',
 'مجموع دقائق الحصص',
 'خلال 3 أيام عمل',
 'خلال 14 يوم عمل',
 'لا تحوّل أي مبلغ',
 'سياسة الخصوصية'
])assert.ok(policy.includes(term),'public terms address: '+term);
assert.ok(!policy.includes('سيتم الإعلان عن سياسة الاسترداد'),'no indefinite refund-policy placeholder');
assert.match(policy,/WHATSAPP_CONTACT_URL/,'guardian can reach official support destination');
assert.match(payment,/SCHOOL_REFUND_POLICY_APPROVED==='true'/,'new paid subscriptions need explicit production approval');
assert.match(payment,/refundPolicyReady\(\)/,'financial activation must be fail-closed');
assert.match(renewal,/SCHOOL_REFUND_POLICY_APPROVED/,'manual renewals must not bypass refund policy sign-off');
assert.match(readiness,/refundPolicyApproved/,'admin setup status reports approval gate');
assert.match(env,/^SCHOOL_REFUND_POLICY_APPROVED=false$/m,'refund policy is off by default');
assert.match(offer,/لا تحوّل أي مبلغ/,'visitor still sees clear payment safety notice');
assert.match(cards,/sofia-footer-bottom[\\s\\S]*?<Link to="\\/terms"/,'full legal terms remain linked unobtrusively at the bottom');
assert.ok(!catalogue.includes('<h3>حقوق واضحة</h3>'),'course marketing does not prominently advertise refund policy');
assert.match(catalogue,/تجربة رقمية متطورة/,'course marketing emphasizes digital learning improvement');
assert.match(catalogue,/بنطوّر تجربة تعليم العلوم/,'homepage uses a technology development message');
assert.ok(!/ليلة الامتحان|نزول الأطفال بالليل|كلهم عارفين بعض/.test(catalogue),'private educational motivation is not displayed to visitors');
assert.match(catalogue,/معلومات قبل الحجز/,'catalogue explains purchase journey');
assert.match(catalogue,/لم يُعلن موعد حصة قادمة/,'missing lesson dates are not fabricated');
assert.match(catalogue,/introductoryOfferApplies\(c\)/,'course pricing never applies promotional figures to unrelated courses');
assert.match(cards,/introductoryOfferApplies\(course\)/,'cards show only the currently verified offer');
assert.match(cards,/publicCourseDescription\(course\)/,'short production course descriptions receive clear human-facing explanation');
assert.match(cards,/publicTeacherName\(course.teacher_name\)/,'internal school admin account label is not promoted as teacher name');
assert.ok(sitemap.includes('<loc>'+SEO_ORIGIN+'/courses/443b2d26-faba-464a-984b-8a823fddd146</loc>'));
assert.equal(PUBLIC_SEO['/courses/443b2d26-faba-464a-984b-8a823fddd146'].courseName,'دورة العلوم');
console.log('PASS refund, compensation, payment approval, factual course offer and course SEO tests');
