import assert from 'node:assert/strict';
import {verifyRenderRelease} from '../scripts/verify-render-release.mjs';
const sha='a'.repeat(40),other='b'.repeat(40),origin='https://mssofia.onrender.com';
const response=(status,obj)=>new Response(JSON.stringify(obj),{status,headers:{'content-type':'application/json'}});
const calls=[];
const success=await verifyRenderRelease({sha,attempts:1,origin,fetchImpl:async(url,opts)=>{
 calls.push({url,method:opts.method,headers:opts.headers});
 return response(200,url.endsWith('/api/release')?{commit:sha}:{ok:true});
}});
assert.equal(success.ok,true);
assert.deepEqual(calls.map(x=>x.url),[origin+'/api/release',origin+'/api/ready']);
assert.ok(calls.every(x=>x.method==='GET'&&!('cookie' in x.headers)),'release probes never send cookies or mutations');
const bad=await verifyRenderRelease({sha,attempts:1,origin,fetchImpl:async()=>response(200,{commit:other})});
assert.deepEqual(bad,{ok:false,reason:'render-commit-mismatch'});
const unhealthy=await verifyRenderRelease({sha,attempts:1,origin,fetchImpl:async(url)=>
 url.endsWith('/api/release')?response(200,{commit:sha}):response(503,{ok:false})});
assert.equal(unhealthy.ok,false,'healthy Node process is insufficient without database readiness');
let attempts=0;
const recovered=await verifyRenderRelease({sha,origin,attempts:2,pause:async()=>{},fetchImpl:async(url)=>{
 if(url.endsWith('/api/release')&&attempts++===0)throw Error('cold start');
 return response(200,url.endsWith('/api/release')?{commit:sha}:{ok:true});
}});
assert.equal(recovered.ok,true,'a cold start may recover only after a bounded read-only retry');
assert.equal((await verifyRenderRelease({sha:'bad',fetchImpl:async()=>{throw Error('must not fetch')}})).reason,'invalid-expected-sha');
console.log('PASS production release is gated by exact Render SHA, database readiness, and read-only bounded probes');
