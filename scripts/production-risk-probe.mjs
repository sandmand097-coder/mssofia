// Read-only production checks. NEVER send cookies, post data, display
// student/payment records, generate LiveKit tokens, or wake private endpoints.
// This module is also testable with an isolated mock fetch implementation.
const SAFE_TRANSIENT=new Set([408,429,502,503,504]);
export const PROBES=Object.freeze([
 {path:'/',expected:200,kind:'html',critical:true},
 {path:'/guide',expected:200,kind:'html',critical:true},
 {path:'/terms',expected:200,kind:'html',critical:true},
 {path:'/api/health',expected:200,kind:'health',critical:true},
 {path:'/api/auth/registration-status',expected:200,kind:'registration',critical:true},
 {path:'/api/auth/google/config',expected:200,kind:'google',critical:true},
 {path:'/api/courses',expected:200,kind:'courses',critical:true},
 {path:'/api/auth/me',expected:401,kind:'denied',critical:true},
 {path:'/api/admin/dependencies',expected:401,kind:'denied',critical:true},
 {path:'/api/payments/config',expected:401,kind:'denied',critical:true}
]);

export function validateSiteOrigin(origin){
 if(typeof origin!=='string'||origin.length>180)throw Error('SITE_ORIGIN must be an HTTPS origin');
 let parsed;
 try{parsed=new URL(origin)}catch{throw Error('SITE_ORIGIN must be an HTTPS origin')}
 if(parsed.protocol!=='https:'||!parsed.hostname||parsed.username||parsed.password
  ||parsed.pathname!=='/'||parsed.search||parsed.hash||parsed.port
  ||!/^[a-z0-9.-]+$/i.test(parsed.hostname))
  throw Error('SITE_ORIGIN must be an HTTPS origin with no path or credentials');
 return parsed.origin;
}
function safeTimeout(timeoutMs){
 const n=Number(timeoutMs);
 return Number.isFinite(n)?Math.max(1000,Math.min(30000,Math.floor(n))):21000;
}
function delayFor(attempt,retryHeader){
 const seconds=Number(retryHeader);
 const explicit=Number.isFinite(seconds)&&seconds>0?Math.min(seconds*1000,10000):0;
 return Math.max(explicit,[2200,4600,9200][Math.min(attempt-1,2)]);
}
function validateBody(spec,response,body,{expectedMode}){
 const contentType=response.headers?.get('content-type')||'';
 if(spec.kind==='html'){
  if(!contentType.toLowerCase().includes('text/html'))return 'NOT_HTML';
  if(typeof body!=='string'||!body.includes('id="root"'))return 'APP_ROOT_MISSING';
  return null;
 }
 if(!contentType.toLowerCase().includes('application/json'))return 'NOT_JSON';
 if(spec.kind==='denied')return null; // Never parse or print an unauthorized body.
 let parsed;
 try{parsed=JSON.parse(body)}catch{return 'MALFORMED_JSON'}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return 'INVALID_PAYLOAD';
 if(spec.kind==='health'){
  if(parsed.ok!==true)return 'BACKEND_NOT_READY';
  if(parsed.mode!==expectedMode)return 'UNEXPECTED_LAUNCH_MODE';
  if(expectedMode==='full'&&(parsed.videoConfigured!==true||parsed.videoMode!=='remote'))
   return 'LIVE_VIDEO_NOT_CONFIGURED';
 }
 if(spec.kind==='registration'&&typeof parsed.registrationAvailable!=='boolean')return 'REGISTRATION_STATUS_INVALID';
 if(spec.kind==='google'&&typeof parsed.enabled!=='boolean')return 'GOOGLE_STATUS_INVALID';
 if(spec.kind==='courses'&&!Array.isArray(parsed.courses))return 'COURSES_RESPONSE_INVALID';
 const cache=response.headers?.get('cache-control')||'';
 if(!/no-store/i.test(cache))return 'PRIVATE_API_CACHE_POLICY_MISSING';
 return null;
}
export async function checkProductionRisk({
 origin='https://mssofia.pages.dev',
 expectedMode='full',
 fetchImpl=fetch,
 sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
 timeoutMs=21000,
 maxAttempts=3
}={}){
 const site=validateSiteOrigin(origin);
 if(!['full','preview','admin'].includes(expectedMode))throw Error('Invalid EXPECTED_LAUNCH_MODE');
 const attemptsLimit=Math.max(1,Math.min(4,Math.floor(Number(maxAttempts)||3)));
 const results=[];
 for(const spec of PROBES){
  let attempt=0,status=null,issue='UNKNOWN',lastRetryAfter=null,passed=false;
  for(;attempt<attemptsLimit;){
   attempt++;
   let response;
   try{
    response=await fetchImpl(site+spec.path,{
     method:'GET',redirect:'manual',credentials:'omit',
     headers:{'Accept':'application/json,text/html;q=0.9','Cache-Control':'no-store','User-Agent':'MissSofia-ReadOnly-Availability/1.0'},
     signal:AbortSignal.timeout(safeTimeout(timeoutMs))
    });
   }catch{
    issue='NETWORK_OR_TIMEOUT';status=null;
    if(attempt<attemptsLimit){await sleep(delayFor(attempt,null));continue}
    break;
   }
   status=response.status;
   lastRetryAfter=response.headers?.get('retry-after');
   if(status!==spec.expected){
    issue=spec.kind==='denied'&&status===200?'PRIVATE_API_ACCESS_EXPOSED':'UNEXPECTED_HTTP_STATUS';
    if(attempt<attemptsLimit&&SAFE_TRANSIENT.has(status)){
     await sleep(delayFor(attempt,lastRetryAfter));continue;
    }
    break;
   }
   let body='';
   if(spec.kind!=='denied'){
    try{body=await response.text()}catch{issue='UNREADABLE_RESPONSE';break}
   }
   const problem=validateBody(spec,response,body,{expectedMode});
   if(problem){issue=problem;break}
   issue=null;passed=true;break;
  }
  results.push({
   path:spec.path,
   status,attempts:attempt,ok:passed,
   code:passed?(attempt>1?'RECOVERED_AFTER_RETRY':'OK'):issue,
   critical:spec.critical
  });
 }
 const failures=results.filter(r=>!r.ok);
 const recovered=results.filter(r=>r.ok&&r.attempts>1);
 return{
  site,
  expectedMode,
  checkedAt:new Date().toISOString(),
  ok:failures.length===0,
  passed:results.length-failures.length,
  total:results.length,
  failures:failures.length,
  transientRecoveries:recovered.length,
  results
 };
}
