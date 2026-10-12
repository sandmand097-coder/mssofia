import assert from 'node:assert/strict';
import {publicCatalogRequest,sanitizeCatalog,servePublicCatalog} from '../src/edge/public-catalog-cache.js';
import {onRequest} from '../functions/api/[[path]].js';

const site='https://mssofia.pages.dev';
const origin='https://mssofia.onrender.com/api/courses';
const r=(path='/api/courses',options={})=>new Request(site+path,options);
const sample={courses:[{id:'science-1',status:'published',title:'علوم ابتدائي',subject:'علوم',level:'الصف الأول',price:100,capacity:50,enrolled:13,teacher_name:'Miss Sofia',description:'علوم تفاعلية',next_date:'2026-10-18T13:00:00Z',guardian_phone:'SECRET-PHONE',student_email:'private@example.com',teacher_id:'private-id'}]};

assert.equal(publicCatalogRequest(r()),true);
assert.equal(publicCatalogRequest(r('/api/courses?q=abc')),false);
assert.equal(publicCatalogRequest(r('/api/courses/12')),false);
assert.equal(publicCatalogRequest(r('/api/auth/me')),false);
assert.equal(publicCatalogRequest(r('/api/courses',{method:'POST'})),false);
assert.equal(publicCatalogRequest(r('/api/courses',{headers:{authorization:'Bearer token'}})),false);
const cleaned=sanitizeCatalog(sample);
assert.equal(cleaned.courses.length,1);
assert.equal(cleaned.courses[0].title,'علوم ابتدائي');
assert.equal(cleaned.courses[0].student_email,undefined);
assert.equal(cleaned.courses[0].guardian_phone,undefined);
assert.equal(cleaned.courses[0].teacher_id,undefined);
assert.equal(sanitizeCatalog({courses:[null]}),null);
assert.equal(sanitizeCatalog({courses:[{id:'c',title:'unpublished',status:'draft'}]}),null,'never cache unpublished catalogue rows');
assert.equal(sanitizeCatalog({courses:'oops'}),null);
assert.equal(sanitizeCatalog({courses:Array.from({length:151},()=>({id:'x',title:'x'}))}),null);

class FakeCache{
 constructor(){this.db=new Map()}
 async match(key){const v=this.db.get(key.url);return v?.clone()}
 async put(key,value){this.db.set(key.url,value.clone())}
 remove(kind){this.db.delete(site+'/__mssofia_public_catalog_cache__/'+kind)}
}
const cache=new FakeCache();
const ctx=[];let calls=0,lastRequest,fail=false;
const fetchImpl=async request=>{
 calls++;lastRequest=request;
 if(fail)throw new Error('Origin asleep');
 return new Response(JSON.stringify(sample),{status:200,headers:{'content-type':'application/json'}});
};
const options={request:r(),upstreamUrl:origin,cache,waitUntil:promise=>ctx.push(promise),fetchImpl};
let response=await servePublicCatalog(options);
assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store, private');
let result=await response.json();
assert.equal(result.availability.source,'live');assert.equal(result.courses[0].student_email,undefined);
assert.equal(lastRequest.headers.get('cookie'),null,'do not forward account cookie into cache');
assert.equal(calls,1);

response=await servePublicCatalog(options);
assert.equal((await response.json()).availability.source,'fresh');
assert.equal(calls,1,'fresh public cache avoids origin');
cache.remove('fresh');
fail=true;
response=await servePublicCatalog(options);
result=await response.json();
assert.equal(result.availability.source,'stale');
assert.equal(result.availability.stale,true);
assert.equal(result.courses[0].guardian_phone,undefined);
assert.equal(ctx.length,1,'stale schedules a single refresh');
await Promise.all(ctx.splice(0));
response=await servePublicCatalog(options);
assert.equal((await response.json()).availability.source,'stale');
assert.equal(ctx.length,0,'short guard avoids repeated wake stampede');
cache.remove('refresh-guard');
fail=false;
response=await servePublicCatalog(options);
assert.equal((await response.json()).availability.source,'stale','render old copy while background refresh runs');
await Promise.all(ctx.splice(0));
response=await servePublicCatalog(options);
assert.equal((await response.json()).availability.source,'fresh','background success restores fresh cache');

// Do not mistake private/auth API endpoints for a public catalogue: the edge
// proxy still rejects or proxies those without touching the catalogue cache.
const prevFetch=globalThis.fetch,prevCaches=globalThis.caches;
try{
 globalThis.caches={default:new FakeCache()};
 let downstreamCalls=0;
 globalThis.fetch=async(request)=>{
  downstreamCalls++;
  if(new URL(request.url).pathname==='/api/courses')
   return new Response(JSON.stringify(sample),{status:200,headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({ok:true,mode:'full'}),{status:200,headers:{'content-type':'application/json'}});
 };
 const env={PUBLIC_LAUNCH_MODE:'full',FULL_BACKEND_READY:'true',API_ORIGIN:'https://mssofia.onrender.com'};
 const on=path=>onRequest({env,request:r(path),waitUntil:promise=>ctx.push(promise)});
 response=await on('/api/courses');
 result=await response.json();
 assert.equal(result.courses[0].guardian_phone,undefined);
 assert.equal(result.availability.source,'live');
 response=await on('/api/courses');
 assert.equal((await response.json()).availability.source,'fresh');
 assert.equal(downstreamCalls,1,'edge-level cached catalog response');
 response=await on('/api/health');
 assert.equal((await response.json()).mode,'full');
 assert.equal(downstreamCalls,2,'health is never served through catalog cache');
 response=await on('/api/auth/me');
 assert.equal(response.headers.get('x-mssofia-catalog-source'),null);
 assert.equal(downstreamCalls,3,'auth is not cached');
}finally{
 globalThis.fetch=prevFetch;
 if(prevCaches===undefined)delete globalThis.caches;
 else globalThis.caches=prevCaches;
}
const noCache=await servePublicCatalog({...options,cache:undefined,fetchImpl:async()=>{throw Error('network')}})
assert.equal(noCache.status,503,'no cached data must fail safely');
console.log('PASS public catalogue stale-while-revalidate, stampede guard, private data removal and uncached auth');
