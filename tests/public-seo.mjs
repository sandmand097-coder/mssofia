import assert from 'node:assert/strict';
import {PUBLIC_SEO,SEO_ORIGIN,publicSeoMeta} from '../src/public-seo.js';
const canonical=new Set();
for(const route of ['/','/courses','/courses/443b2d26-faba-464a-984b-8a823fddd146','/courses/d2955d15-1e4a-427f-820e-9f7f8de9d515','/courses/2de5fa24-3a69-47ae-af43-156f32e284b0','/guide','/contact','/privacy','/terms']){
 const meta=publicSeoMeta(route);
 assert.ok(meta,'public route indexed '+route);
 assert.equal(meta.canonical,SEO_ORIGIN+route);
 assert.ok(meta.title.includes('مس صوفيا للعلوم'));
 assert.ok(meta.description.length>65);
 assert.ok(!canonical.has(meta.canonical),'unique canonical');
 canonical.add(meta.canonical);
}
assert.equal(publicSeoMeta('/login'),null);
assert.equal(publicSeoMeta('/dashboard'),null);
assert.equal(publicSeoMeta('/lesson/any-lesson'),null);
assert.ok(publicSeoMeta('/courses/x'),'generic public course route receives safe metadata');
assert.equal(publicSeoMeta('/courses/443b2d26-faba-464a-984b-8a823fddd146').courseName,'دورة العلوم');
assert.equal(Object.keys(PUBLIC_SEO).length,9);
console.log('PASS SEO metadata for public routes; no protected URLs indexed');
