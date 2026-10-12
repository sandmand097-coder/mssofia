import {launchModeFromHealth} from './launch-mode.js';

const OFFLINE={launchMode:'offline',user:null};

// Query readiness first. A sleeping Render instance needs only one wake-up
// request; account status must not be inferred from a transient 503.
export async function checkBootstrap(api){
 let health;
 try{
  health=await api('/health',{signal:AbortSignal.timeout(12000)});
 }catch{
  return OFFLINE;
 }
 const launchMode=launchModeFromHealth(health);
 if(launchMode==='offline')return OFFLINE;
 try{
  const session=await api('/auth/me',{signal:AbortSignal.timeout(12000)});
  if(!session||!Object.prototype.hasOwnProperty.call(session,'user'))return OFFLINE;
  return {launchMode,user:session.user??null};
 }catch(error){
  // A genuine 401 means anonymous. Timeouts, 429 and 5xx do NOT mean logout.
  if(error?.status===401)return {launchMode,user:null};
  return OFFLINE;
 }
}

// Stagger recovery of parent/student tabs; do not stampede the shared server.
// Poll only after failed read-only probes, never replay writes or class tokens.
export function recoveryRetryDelay(attempt=0,sample=Math.random()){
 const backoff=[6000,10000,16000,24000,30000];
 const index=Math.min(backoff.length-1,Math.max(0,Math.trunc(Number(attempt)||0)));
 const jitter=Number.isFinite(sample)?Math.max(0,Math.min(1,sample)):0.5;
 return Math.round(backoff[index]*(0.8+0.4*jitter));
}
