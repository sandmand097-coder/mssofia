// After Vite builds the SPA, provide a distinct, crawlable HTML head at each
// public extensionless URL. Cloudflare Pages maps /courses to /courses.html.
// Private student, admin and lesson URLs are deliberately NOT generated here.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {PUBLIC_SEO,SEO_ORIGIN} from '../src/public-seo.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'dist');
const template=await readFile(path.join(out,'index.html'),'utf8');
const escapeHtml=value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function replaceRequired(html,pattern,value,label){
 if(!pattern.test(html))throw Error('Missing SEO tag: '+label);
 return html.replace(pattern,value);
}
function setMeta(html,kind,key,value){
 const attr=kind==='property'?'property':'name';
 const pattern=new RegExp('<meta\\s+'+attr+'="'+key+'"\\s+content="[^"]*"\\s*\\/?>','i');
 return replaceRequired(html,pattern,'<meta '+attr+'="'+key+'" content="'+escapeHtml(value)+'"/>',key);
}
function render(route,meta){
 const canonical=SEO_ORIGIN+route;
 let html=template;
 html=replaceRequired(html,/<title>[^<]*<\/title>/i,'<title>'+escapeHtml(meta.title)+'</title>','title');
 html=replaceRequired(html,/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,'<link rel="canonical" href="'+canonical+'"/>','canonical');
 for(const [kind,key,value] of [
  ['name','description',meta.description],
  ['property','og:title',meta.title],
  ['property','og:description',meta.description],
  ['property','og:url',canonical],
  ['name','twitter:title',meta.title],
  ['name','twitter:description',meta.description]
 ])html=setMeta(html,kind,key,value);
 const linked={
  '@context':'https://schema.org',
  '@type':route==='/courses'?'CollectionPage':'WebPage',
  name:meta.title,
  description:meta.description,
  url:canonical,
  inLanguage:'ar-EG',
  isPartOf:{'@id':SEO_ORIGIN+'/#school'}
 };
 const json=JSON.stringify(linked).replace(/</g,'\\u003c');
 html=replaceRequired(html,/<\/head>/i,'<script type="application/ld+json">'+json+'</script>\n</head>','head');
 return html;
}
// The root output and all public pages share one bundle but have unique,
// immediate HTTP response metadata without needing to execute JavaScript.
for(const [route,meta] of Object.entries(PUBLIC_SEO)){
 const filename=route==='/'?'index.html':route.slice(1)+'.html';
 await writeFile(path.join(out,filename),render(route,meta),'utf8');
}
// A public, static social card; no pupil photos, private metadata or third-party assets.
const socialSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
 <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#0b514b"/><stop offset="1" stop-color="#072d37"/></linearGradient></defs>
 <rect width="1200" height="630" fill="url(#bg)"/>
 <circle cx="1022" cy="112" r="217" fill="#20a889" opacity=".13"/>
 <circle cx="116" cy="542" r="220" fill="#79d9c1" opacity=".09"/>
 <g transform="translate(938 320)" fill="none" stroke="#97e6d1" stroke-width="10" opacity=".88">
  <ellipse rx="171" ry="73" transform="rotate(31)"/><ellipse rx="171" ry="73" transform="rotate(-31)"/><ellipse rx="171" ry="73" transform="rotate(90)"/>
  <circle r="34" fill="#ffd08b" stroke="none"/>
 </g>
 <text x="95" y="180" fill="#d9fff1" font-family="DejaVu Sans,Arial,sans-serif" font-weight="bold" font-size="74">Miss Sofia</text>
 <text x="95" y="305" fill="#ffffff" font-family="DejaVu Sans,Arial,sans-serif" font-weight="bold" font-size="66">مس صوفيا للعلوم</text>
 <text x="95" y="382" fill="#abddd1" font-family="DejaVu Sans,Arial,sans-serif" font-size="31">Science lessons • Live learning</text>
 <rect x="95" y="444" width="445" height="64" rx="32" fill="#f4b56e"/>
 <text x="318" y="488" fill="#173b3c" font-family="DejaVu Sans,Arial,sans-serif" font-size="28" font-weight="bold" text-anchor="middle">mssofia.pages.dev</text>
 </svg>`;
await sharp(Buffer.from(socialSvg)).png({compressionLevel:9}).toFile(path.join(out,'miss-sofia-social.png'));
console.log('PASS distinct SEO snapshots /, /courses, /privacy, /terms and public social image');
