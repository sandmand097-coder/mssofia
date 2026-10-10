import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=execFileSync('git',['ls-files','-z'],{cwd:root}).toString('utf8').split('\0').filter(Boolean);
let checks=0;
const check=(v,label)=>{assert.ok(v,label);checks++;console.log('PASS '+label)};
const oldBrand=[];
for(const file of files){
 if(!/\.(?:m?js|jsx|md|html|css|txt|cmd|ya?ml)$/i.test(file))continue;
 if(/\bMrs\.?\s+Sofia\b/i.test(readFileSync(path.join(root,file),'utf8')))oldBrand.push(file);
}
check(oldBrand.length===0,'legacy honorific branding is absent from website and documentation');
const html=readFileSync(path.join(root,'index.html'),'utf8');
const logo=readFileSync(path.join(root,'src/components/MrsSofiaBrand.jsx'),'utf8');
const app=readFileSync(path.join(root,'src/App.jsx'),'utf8');
check(html.includes('Miss Sofia'),'public page metadata names Miss Sofia');
check(html.includes('المُدرِّسة'),'metadata identifies the female teacher');
check(logo.includes('<b>Miss<span> Sofia</span>'),'logo spells Miss Sofia with space');
check(logo.includes('المُدرِّسة'),'logo correctly spells Arabic teacher');
check(!logo.includes('<b>mrs<span>sofia</span>'),'old visual logo removed');
check(app.includes('Miss Sofia'),'public page titles use Miss Sofia');
check(html.includes('https://mssofia.pages.dev/'),'stable production domain preserved');
console.log('RESULT '+checks+' brand identity compatibility checks passed');
