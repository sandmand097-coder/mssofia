import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/[[path]].js';

let assertions=0;
function check(v,label){assert.ok(v,label);assertions++;console.log('PASS '+label)}
const edgeOrigin='https://mssofia.pages.dev';
const call=(pathname,{method='GET',env={},headers={},body}={})=>onRequest({
 env,request:new Request(edgeOrigin+pathname,{
  method,headers,body:body?JSON.stringify(body):undefined
 })
});

const originalFetch=globalThis.fetch;
let invoked=0;
try{
 globalThis.fetch=async()=>{invoked++;throw Error('Render should be asleep during public preview')};
 const health=await call('/api/health');
 check(health.status===200&&(await health.json()).mode==='preview','preview health is served entirely at Cloudflare edge');
 check((await call('/api/auth/me')).status===401,'preview never creates a session');
 check((await call('/api/auth/registration-status')).status===200,'preview registration-status is available immediately');
 check((await call('/api/auth/google/config')).status===200,'Google login stays disabled during preview');
 check((await call('/api/courses?subject=%D8%B9%D9%84%D9%88%D9%85')).status===200,'course page responds without waking Render');
 check((await call('/api/lessons/secret/token',{method:'POST'})).status===503,'LiveKit room tokens are disabled in preview');
 check((await call('/api/admin/payments')).status===503,'private payment data cannot be exposed in preview');
 check((await call('/api/health',{env:{PUBLIC_LAUNCH_MODE:'full'}})).status===200,'setting full mode alone cannot activate upstream');
 check((await call('/api/health',{env:{PUBLIC_LAUNCH_MODE:'full',FULL_BACKEND_READY:'true',API_ORIGIN:'https://evil.example.com'}})).status===200,'invalid API origin fails closed');
 check(invoked===0,'no Render requests issued in preview mode');
 let seen;
 globalThis.fetch=async request=>{
  invoked++;seen=request;
  return new Response(JSON.stringify({ok:true,mode:'full'}),{status:200,headers:{
   'content-type':'application/json',
   'set-cookie':'session=securetoken; Path=/; Secure; HttpOnly; SameSite=Strict',
   'cache-control':'public,max-age=600'
  }});
 };
 const full={PUBLIC_LAUNCH_MODE:'full',FULL_BACKEND_READY:'true',API_ORIGIN:'https://mssofia.onrender.com'};
 const proxied=await call('/api/auth/me?detail=1',{env:full,headers:{cookie:'session=securetoken','x-forwarded-host':'evil.test','origin':edgeOrigin}});
 check(invoked===1&&proxied.status===200,'authorized full mode invokes backend exactly once');
 check(new URL(seen.url).host==='mssofia.onrender.com'&&new URL(seen.url).pathname==='/api/auth/me','proxy is fixed to the legitimate backend origin');
 check(seen.headers.get('cookie')==='session=securetoken','same-origin HttpOnly session cookie is forwarded');
 check(!seen.headers.get('x-forwarded-host'),'client-supplied forwarded host is stripped');
 check(seen.headers.get('origin')===edgeOrigin,'original browser Origin is forwarded for CSRF checks');
 check(proxied.headers.get('set-cookie')?.includes('HttpOnly'),'HttpOnly session cookie propagates to Pages origin');
 check(proxied.headers.get('cache-control')==='no-store, private','authenticated API responses cannot be cached at the edge');
 globalThis.fetch=async request=>{
  seen=request;invoked++;
  const body=await request.json();
  return new Response(JSON.stringify(body),{status:202,headers:{'content-type':'application/json'}});
 };
 const post=await call('/api/admin/payments/a/review',{env:full,method:'POST',
  headers:{'content-type':'application/json','origin':edgeOrigin},
  body:{decision:'approved',confirmedOnPhone:true}});
 check(post.status===202,'payment moderation method and upstream status are preserved');
 check((await post.json()).decision==='approved','payment moderation JSON passes upstream unmodified');
 globalThis.fetch=async()=>Response.redirect('https://mssofia.onrender.com/login?reason=again',302);
 const redirected=await call('/api/logout',{env:full});
 check(redirected.headers.get('location')===edgeOrigin+'/login?reason=again','backend-owned redirects remain on Cloudflare domain');
 globalThis.fetch=async()=>{throw Error('Render is waking')};
 const error=await call('/api/me',{env:full});
 check(error.status===503&&!!(await error.json()).error,'upstream connectivity failures show safe response');
 console.log('RESULT '+assertions+' Cloudflare Pages preview and protected proxy checks passed');
}finally{globalThis.fetch=originalFetch}
