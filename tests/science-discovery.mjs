import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SCIENCE_DISCOVERIES,evaluateDiscovery,nextDiscoveryIndex} from '../src/components/science-discoveries.js';

assert.equal(SCIENCE_DISCOVERIES.length,3,'three curated, small science discoveries');
assert.equal(new Set(SCIENCE_DISCOVERIES.map(s=>s.id)).size,SCIENCE_DISCOVERIES.length,'unique topics');
for(const [index,discovery] of SCIENCE_DISCOVERIES.entries()){
 assert.ok(discovery.title.length>=20,'complete science question '+index);
 assert.equal(discovery.choices.length,2,'small age-friendly set of answers');
 assert.ok(Number.isInteger(discovery.correctIndex)&&discovery.correctIndex>=0&&discovery.correctIndex<2);
 assert.ok(discovery.explanation.length>=35,'show age-friendly reason after answer');
 assert.equal(evaluateDiscovery(discovery,discovery.correctIndex),true);
 assert.equal(evaluateDiscovery(discovery,1-discovery.correctIndex),false);
 assert.equal(evaluateDiscovery(discovery,-1),null);
 assert.equal(evaluateDiscovery(discovery,null),null);
}
assert.equal(nextDiscoveryIndex(0),1);
assert.equal(nextDiscoveryIndex(2),0);
assert.equal(nextDiscoveryIndex(-1),0);
const page=readFileSync(new URL('../src/pages/MrsSofiaSite.jsx',import.meta.url),'utf8');
const component=readFileSync(new URL('../src/components/ScienceDiscoveryLab.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/science-discovery.css',import.meta.url),'utf8');
assert.match(page,/<ScienceDiscoveryLab\s*\/>/,'homepage includes interactive public discovery');
assert.match(page,/href="#sofia-discovery"/,'hero invites students to explore');
assert.match(component,/aria-live="polite"/,'nonintrusive accessibility feedback');
assert.match(component,/aria-pressed=\{selected===i\}/,'choice state available to assistive tech');
assert.match(component,/disabled=\{correct!==true\}/,'no accidental auto advance');
assert.match(component,/type="button"/,'never submits a form');
assert.doesNotMatch(component,/localStorage|sessionStorage|fetch\(|navigator\.mediaDevices|document\.cookie|Audio\(/,'no persistent data, network or device use');
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/,'respect reduced motion');
assert.doesNotMatch(css,/@import|url\(https?:/,'no remote asset dependencies');
assert.match(css,/sofia-hero \.sofia-illustration\{animation:sofia-float-lab/,'hero artwork moves gently');
assert.match(css,/scroll-margin-top:/,'anchor accounts for sticky navigation');
console.log('PASS curated science questions, accessible interactions, no tracking, reduced motion and no third-party assets');
