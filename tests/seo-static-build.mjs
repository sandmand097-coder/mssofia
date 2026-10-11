import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PUBLIC_SEO,SEO_ORIGIN} from '../src/public-seo.js';
const read=file=>readFileSync(new URL('../dist/'+file,import.meta.url),'utf8');
const names=new Set();
for(const [route,meta] of Object.entries(PUBLIC_SEO)){
 const file=route==='/'?'index.html':route.slice(1)+'.html';
 const html=read(file);
 const title=html.match(/<title>([^<]+)<\/title>/i)?.[1];
 assert.equal(title,meta.title,'route title '+route);
 assert.ok(!names.has(title),'unique HTML title '+route);names.add(title);
 assert.ok(html.includes('<link rel="canonical" href="'+SEO_ORIGIN+route+'"/>'),'canonical HTTP snapshot '+route);
 assert.ok(html.includes('<meta name="description" content="'+meta.description+'"/>'),'unique HTML description '+route);
 assert.ok(html.includes('<meta property="og:url" content="'+SEO_ORIGIN+route+'"/>'),'OG URL '+route);
 assert.ok(html.includes('<meta name="twitter:description" content="'+meta.description+'"/>'),'social description '+route);
 assert.ok(html.includes('"@type":"'+(route==='/courses'?'CollectionPage':'WebPage')+'"'),'structured data '+route);
 assert.match(html,/src="\/assets\//,'built JS entry preserved '+route);
}
assert.ok(!readdirSync(new URL('../dist/',import.meta.url)).includes('student.html'),'student dashboard must remain private');
const image=readFileSync(new URL('../dist/miss-sofia-social.png',import.meta.url));
assert.ok(image.length>10000,'usable social image');
assert.deepEqual([...image.subarray(0,8)],[137,80,78,71,13,10,26,10],'PNG signature');
console.log('PASS all four static SEO snapshots, protected route exclusion and social image');
