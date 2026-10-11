import assert from 'node:assert/strict';
import {PROBES,checkProductionRisk,validateSiteOrigin} from '../scripts/production-risk-probe.mjs';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store, private'}});
const html=()=>new Response('<!doctype html><div id="root"></div>',{status:200,headers:{'content-type':'text/html; charset=utf-8'}});
const baseline=path=>{
 if(path==='/api/health')return json({ok:true,mode:'full',videoConfigured:true,videoMode:'remote'});
 if(path==='/api/auth/registration-status')return json({registrationAvailable:true,googleRegistrationAvailable:true});
 if(path==='/api/auth/google/config')return json({enabled:true});
 if(path==='/api/courses')return json({courses:[]});
 if(['/api/auth/me','/api/admin/dependencies','/api/payments/config'].includes(path))return json({error:'Login required'},401);
 return html();
};
const requests=[];
const requestedUrl=(input,opts)=>{
 const url=new URL(input);requests.push({path:url.pathname,method:opts.method,credentials:opts.credentials,headers:opts.headers,redirect:opts.redirect});
 return url.pathname;
};
const sleepDelays=[];
const normal=await checkProductionRisk({
 fetchImpl:(input,opts)=>Promise.resolve(baseline(requestedUrl(input,opts))),
 sleep:ms=>{sleepDelays.push(ms);return Promise.resolve()},
 maxAttempts:2
});
assert.equal(normal.ok,true);
assert.equal(normal.total,PROBES.length);
assert.equal(normal.failures,0);
assert.equal(requests.length,PROBES.length);
assert.ok(requests.every(r=>r.method==='GET'&&r.credentials==='omit'&&r.redirect==='manual'
  &&!('cookie' in Object.fromEntries(Object.entries(r.headers).map(([k,v])=>[k.toLowerCase(),v])))),
 'all probes must remain read-only and must never send cookies');
assert.equal(sleepDelays.length,0);
let healthCalls=0;
const transient=await checkProductionRisk({
 fetchImpl:(input,opts)=>{
  const path=requestedUrl(input,opts);
  if(path==='/api/health'&&++healthCalls===1)return Promise.resolve(json({code:'UPSTREAM_UNAVAILABLE'},503));
  return Promise.resolve(baseline(path));
 },
 sleep:ms=>{sleepDelays.push(ms);return Promise.resolve()}
});
assert.equal(transient.ok,true,'temporary Render/Cloudflare 503 should recover');
assert.equal(transient.transientRecoveries,1);
assert.equal(transient.results.find(x=>x.path==='/api/health').attempts,2);
assert.ok(sleepDelays[0]>=2000,'bounded delay avoids hammering cold-started Render');
const exposed=await checkProductionRisk({
 fetchImpl:(input,opts)=>{
  const path=requestedUrl(input,opts);
  return Promise.resolve(path==='/api/auth/me'?json({user:{id:'test'}},200):baseline(path));
 },
 sleep:()=>Promise.resolve(),maxAttempts:1
});
assert.equal(exposed.ok,false,'unexpected anonymous access is a critical failure');
assert.equal(exposed.results.find(x=>x.path==='/api/auth/me').code,'PRIVATE_API_ACCESS_EXPOSED');
const wronglyCached=await checkProductionRisk({
 fetchImpl:(input,opts)=>{
  const path=requestedUrl(input,opts);
  return Promise.resolve(path==='/api/auth/me'
   ?new Response('{"error":"Login required"}',{status:401,headers:{'content-type':'application/json','cache-control':'public,max-age=300'}})
   :baseline(path));
 },
 sleep:()=>Promise.resolve(),maxAttempts:1
});
assert.equal(wronglyCached.results.find(x=>x.path==='/api/auth/me').code,'PRIVATE_API_CACHE_POLICY_MISSING');
const down=await checkProductionRisk({
 fetchImpl:(input,opts)=>{
  const path=requestedUrl(input,opts);
  return Promise.resolve(path==='/api/health'?json({code:'UPSTREAM_UNAVAILABLE'},503):baseline(path));
 },
 sleep:()=>Promise.resolve(),maxAttempts:3
});
assert.equal(down.ok,false);
assert.equal(down.results.find(x=>x.path==='/api/health').attempts,3);
assert.equal(down.results.find(x=>x.path==='/api/courses').code,'UPSTREAM_HEALTH_FAILED');
assert.equal(down.results.find(x=>x.path==='/api/auth/me').attempts,0);
const wrongMode=await checkProductionRisk({
 fetchImpl:(input,opts)=>{
  const path=requestedUrl(input,opts);
  return Promise.resolve(path==='/api/health'?json({ok:true,mode:'preview'}):baseline(path));
 },
 sleep:()=>Promise.resolve(),maxAttempts:1
});
assert.equal(wrongMode.results.find(x=>x.path==='/api/health').code,'UNEXPECTED_LAUNCH_MODE');
const degraded=await checkProductionRisk({
 fetchImpl:(input,opts)=>{
  const path=requestedUrl(input,opts);
  return Promise.resolve(path==='/api/health'?json({ok:true,mode:'full',videoConfigured:false,videoMode:'disabled'}):baseline(path));
 },
 sleep:()=>Promise.resolve(),maxAttempts:1
});
assert.equal(degraded.results.find(x=>x.path==='/api/health').code,'LIVE_VIDEO_NOT_CONFIGURED');
const malformed=await checkProductionRisk({
 fetchImpl:(input,opts)=>{
  const path=requestedUrl(input,opts);
  return Promise.resolve(path==='/api/courses'?new Response('<html>Proxy error</html>',{status:200,headers:{'content-type':'text/html'}}):baseline(path));
 },
 sleep:()=>Promise.resolve(),maxAttempts:1
});
assert.equal(malformed.results.find(x=>x.path==='/api/courses').code,'NOT_JSON');
for(const origin of ['http://mssofia.pages.dev','https://evil.example.com/path','https://a:b@mssofia.pages.dev','https://mssofia.pages.dev:444','file:///tmp/a']){
 assert.throws(()=>validateSiteOrigin(origin));
}
assert.equal(validateSiteOrigin('https://mssofia.pages.dev/'),'https://mssofia.pages.dev');
console.log('PASS safe read-only monitoring, transient recovery, persistent outage, video/readiness failure and unauthenticated access checks');
