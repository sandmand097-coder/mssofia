import assert from 'node:assert/strict';
import {PUBLIC_SEO,SEO_ORIGIN,publicSeoMeta} from '../src/public-seo.js';
const canonical=new Set();
for(const route of ['/','/courses','/courses/443b2d26-faba-464a-984b-8a823fddd146','/guide','/privacy','/terms']){
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
assert.equal(publicSeoMeta('/courses/x'),null);
assert.equal(publicSeoMeta('/courses/443b2d26-faba-464a-984b-8a823fddd146').courseName,'دورة العلوم');
assert.equal(Object.keys(PUBLIC_SEO).length,6);
console.log('PASS SEO metadata for public routes; no protected URLs indexed');
