// Isolated regression: no production accounts, money or network services.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import express from 'express';
import {isPasswordLoginAllowed} from '../server/google-admin-auth.js';
import {attachEmailReview} from '../server/payment-email-review.js';
import {evaluateMonthlyAccess,countActiveMembersByCourse} from '../server/monthly-access.js';

assert.equal(isPasswordLoginAllowed({role:'admin'},{NODE_ENV:'production'}),false);
assert.equal(isPasswordLoginAllowed({role:'student'},{NODE_ENV:'production'}),true);
assert.equal(isPasswordLoginAllowed({role:'teacher'},{NODE_ENV:'production'}),true);
assert.equal(isPasswordLoginAllowed({role:'admin'},{NODE_ENV:'test'}),true);

const now=Date.parse('2026-10-13T00:00:00Z'),day=86400000;
const rows=[
 {course_id:'free',booking_status:'approved',course_price:0,payment_status:null},
 {course_id:'paid',booking_status:'approved',course_price:170,payment_status:'approved',payment_reviewed_at:new Date(now-12*day).toISOString(),confirmed_on_phone:1},
 {course_id:'paid',booking_status:'approved',course_price:170,payment_status:'approved',payment_reviewed_at:new Date(now-45*day).toISOString(),confirmed_on_phone:1,renewal_end:new Date(now+10*day).toISOString()},
 {course_id:'paid',booking_status:'approved',course_price:170,payment_status:'approved',payment_reviewed_at:new Date(now-45*day).toISOString(),confirmed_on_phone:1},
 {course_id:'paid',booking_status:'approved',course_price:170,payment_status:'pending',confirmed_on_phone:0}
];
let calls=0;
const counts=await countActiveMembersByCourse(async(sql,...ids)=>{
 calls++;
 assert.match(sql,/b\.course_id IN \(/);
 assert.equal((sql.match(/\?/g)||[]).length,ids.length);
 return rows.filter(row=>ids.includes(row.course_id));
},['free','paid','empty','paid'],now);
assert.equal(calls,1,'batch query prevents N+1 DB calls');
assert.equal(counts.get('free'),1);
assert.equal(counts.get('paid'),2,'valid renewal counts, expired and unverified payments do not');
assert.equal(counts.get('empty'),0);
assert.equal(evaluateMonthlyAccess(rows[3],now).active,false);
assert.equal((await countActiveMembersByCourse(async()=>{throw Error('empty list must not query')},[],now)).size,0);

const staticHeaders=readFileSync(new URL('../public/_headers',import.meta.url),'utf8');
assert.match(staticHeaders,/Content-Security-Policy:/);
assert.match(staticHeaders,/script-src 'self' https:\/\/accounts\.google\.com/);
assert.ok(!/script-src[^;]*'unsafe-inline'/.test(staticHeaders),'no inline script bypass');
const index=readFileSync(new URL('../server/index.js',import.meta.url),'utf8');
assert.match(index,/productionCsp/);
assert.match(index,/WHERE c\.id=\? AND c\.status='published' AND u\.status='active'/);
assert.match(index,/app\.get\('\/api\/ready'/);

const original=process.env.NODE_ENV;
process.env.NODE_ENV='production';
let touched=0;
const app=express();
attachEmailReview(app,{
 get:async()=>{touched++;throw Error('no DB reads allowed via legacy email links')},
 run:async()=>{throw Error('no DB writes allowed')},uid:()=> 'mock',
 now:()=>new Date(now).toISOString(),
 loadProof:async()=>{throw Error('no private receipt access')},
 withTransaction:async()=>{throw Error('no financial decision allowed')},
 isCloudDatabase:false
});
const server=await new Promise((resolve,reject)=>{
 const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));
 instance.once('error',reject);
});
try{
 const origin='http://127.0.0.1:'+server.address().port;
 for(const [path,opts] of [
  ['/payment-review?token='+'a'.repeat(64),{}],
  ['/payment-review/proof?token='+'a'.repeat(64),{}],
  ['/payment-review/decision',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'decision=approved&token='+'a'.repeat(64)}]
 ]){
  const res=await fetch(origin+path,opts);
  assert.equal(res.status,410,'all former email bearer routes are closed in production');
  assert.equal(res.headers.get('cache-control'),'no-store, private');
 }
 assert.equal(touched,0);
}finally{
 await new Promise(resolve=>server.close(resolve));
 if(original===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=original;
}
console.log('PASS production admin login, email review, CSP, unpublished courses and batched enrollments');
