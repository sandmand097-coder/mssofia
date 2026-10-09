import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/[[path]].js';
const mode={PUBLIC_LAUNCH_MODE:'admin',FULL_BACKEND_READY:'true',API_ORIGIN:'https://mssofia.onrender.com'};
const origin='https://mssofia.pages.dev';
let calls=0, lastRequest;
const previousFetch=globalThis.fetch;
const invoke=(path,{method='GET',env=mode,cookie='',body}={})=>onRequest({
 env,request:new Request(origin+path,{method,headers:{...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})
});
try {
 globalThis.fetch=async request=>{calls++;lastRequest=request;return new Response(JSON.stringify({enabled:true,clientId:'test.apps.googleusercontent.com'}),{headers:{'content-type':'application/json'}})};
 const health=await invoke('/api/health');
 assert.equal((await health.json()).mode,'admin');
 assert.equal((await invoke('/api/auth/me')).status,401);
 assert.equal((await invoke('/api/courses')).status,200);
 assert.equal((await invoke('/api/auth/register',{method:'POST',body:{}})).status,503);
 assert.equal((await invoke('/api/auth/login',{method:'POST',body:{}})).status,503);
 assert.equal((await invoke('/api/payments/config')).status,401);
 assert.equal((await invoke('/api/auth/registration-status')).status,200);
 assert.equal(calls,0,'anonymous visitors must never awaken Render');
 const g=await invoke('/api/auth/google/config');
 assert.equal(g.status,200);
 assert.equal(calls,1,'Google configuration is forwarded only on login');
 assert.equal(new URL(lastRequest.url).origin,'https://mssofia.onrender.com');
 const signed=await invoke('/api/admin/dashboard',{cookie:'session=fake-test-token'});
 assert.equal(signed.status,200);
 assert.equal(lastRequest.headers.get('cookie'),'session=fake-test-token');
 assert.equal(signed.headers.get('cache-control'),'no-store, private');
 assert.equal(calls,2);
 assert.equal((await invoke('/api/auth/google/login',{method:'POST',body:{credential:'test'}})).status,200);
 assert.equal(calls,3);
 const failClosed=await invoke('/api/health',{env:{PUBLIC_LAUNCH_MODE:'admin'}});
 assert.equal((await failClosed.json()).mode,'preview');
 const wrongOrigin=await invoke('/api/health',{env:{...mode,API_ORIGIN:'https://attacker.example'}});
 assert.equal((await wrongOrigin.json()).mode,'preview');
 assert.equal(calls,3,'missing safeguards never trigger proxy');
 console.log('PASS 18 administrator-only Cloudflare edge security checks');
}finally{globalThis.fetch=previousFetch}
