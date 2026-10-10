// Safe read-only production smoke checks. No logins, school records, payments,
// or meeting sessions are created or changed. Run against the deployed site:
// SITE_ORIGIN=https://mssofia.pages.dev node scripts/production-launch-smoke.mjs
import assert from 'node:assert/strict';

const origin=(process.env.SITE_ORIGIN||'https://mssofia.pages.dev').replace(/\/$/,'');
if(!/^https:\/\/[a-zA-Z0-9.-]+$/.test(origin))throw Error('SITE_ORIGIN must be an HTTPS host');
const items=[];
const check=(description,assertion)=>{assertion();items.push(description);console.log('PASS '+description)};
const fetchWithRetries=async(location)=>{
 let error;
 for(let attempt=0;attempt<2;attempt++){
  try{return await fetch(new URL(location,origin),{redirect:'manual',headers:{'Cache-Control':'no-store'},signal:AbortSignal.timeout(30000)})}
  catch(e){error=e;if(attempt===0)await new Promise(r=>setTimeout(r,1000))}
 }
 throw error;
};
const request=async path=>{
 const res=await fetchWithRetries(path);
 const type=res.headers.get('content-type')||'';
 const payload=type.includes('application/json')?await res.json():await res.text();
 return{status:res.status,type,body:payload,headers:res.headers};
};
const page=await request('/');
check('HTTPS homepage responds with HTML',()=>{
 assert.equal(page.status,200);assert.match(page.type,/text\/html/);
 assert.match(page.body,/id="root"/);
});
const match=page.body.match(/src="(\/assets\/index-[^"]+\.js)"/);
assert.ok(match,'versioned index bundle present');
const main=await request(match[1]);
check('versioned frontend JavaScript is deployed',()=>{
 assert.equal(main.status,200);assert.match(main.type,/javascript/);
});
const adminChunk=main.body.match(/AdminPortal-[\w-]+\.js/);
assert.ok(adminChunk,'administrator route bundle reference');
const admin=await request('/assets/'+adminChunk[0]);
check('latest administrator subscriptions UI is deployed',()=>{
 assert.equal(admin.status,200);
 assert.ok(admin.body.includes('/api/admin/subscriptions'));
 assert.ok(admin.body.includes('/api/admin/renewals'));
});
const health=await request('/api/health');
check('school API is active on public domain',()=>{
 assert.equal(health.status,200);assert.equal(health.body.ok,true);assert.equal(health.body.mode,'full');
});
check('video conferencing is configured server-side',()=>{
 assert.equal(health.body.videoConfigured,true);assert.equal(health.body.videoMode,'remote');
});
const registration=await request('/api/auth/registration-status');
check('guardian registration endpoint is healthy',()=>{
 assert.equal(registration.status,200);assert.equal(typeof registration.body.registrationAvailable,'boolean');
});
const google=await request('/api/auth/google/config');
check('Google sign-in public configuration is accessible',()=>{
 assert.equal(google.status,200);assert.equal(typeof google.body.enabled,'boolean');
});
const courses=await request('/api/courses');
check('public courses endpoint responds with a list',()=>{
 assert.equal(courses.status,200);assert.ok(Array.isArray(courses.body.courses));
});
for(const endpoint of [
 '/api/auth/me','/api/my/overview','/api/student/renewals',
 '/api/admin/renewals','/api/admin/subscriptions','/api/admin/dependencies',
 '/api/payments/config','/api/lessons/00000000-0000-4000-8000-000000000000/classroom'
]){
 const result=await request(endpoint);
 check('private access denied anonymously: '+endpoint,()=>{
  assert.equal(result.status,401);
  assert.match(result.type,/json/);
 });
}
for(const endpoint of ['/privacy','/terms','/login','/register']){
 const result=await request(endpoint);
 check('SPA route reachable: '+endpoint,()=>{
  assert.equal(result.status,200);assert.match(result.type,/html/);
 });
}
console.log('PASS '+items.length+' deployment checks');
console.log('NOTE: This cannot prove private storage readiness, real paid approvals, or actual two-device media.');
