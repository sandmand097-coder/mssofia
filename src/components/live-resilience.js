// Bounded, privacy-preserving retries for *joining* an authorized live classroom.
// Do not retry rejected subscriptions or moderation decisions.
export const TRANSIENT_STATUSES=new Set([408,429,500,502,503,504]);
export function isRetryableJoinError(error){
 if(!error||error.name==='AbortError')return false;
 if(TRANSIENT_STATUSES.has(Number(error.status)))return true;
 return error.status===0||error.code==='NETWORK_ERROR';
}
export function retryDelayMs(attempt,{retryAfterSeconds=0,random=.5}={}){
 const number=Math.max(1,Math.floor(Number(attempt)||1));
 const jitter=Math.max(0,Math.min(1,Number(random)||0));
 const exponential=Math.min(10000,450*Math.pow(2,Math.min(5,number-1)));
 const serverDelay=Math.min(30000,Math.max(0,Number(retryAfterSeconds)||0)*1000);
 return Math.round(Math.max(serverDelay,exponential*(.75+.5*jitter)));
}
export function shouldRecoverDisconnect(reason,DisconnectReason={}){
 return !new Set([
  DisconnectReason.CLIENT_INITIATED,DisconnectReason.DUPLICATE_IDENTITY,
  DisconnectReason.PARTICIPANT_REMOVED,DisconnectReason.ROOM_DELETED,
  DisconnectReason.ROOM_CLOSED,DisconnectReason.USER_REJECTED,
  DisconnectReason.JOIN_FAILURE
 ]).has(reason);
}
function cancelled(signal){
 const error=new Error('Cancelled classroom join');error.name='AbortError';return error;
}
export function delayAbortable(duration,signal){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted)return reject(cancelled(signal));
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',stop);resolve()},duration);
  const stop=()=>{clearTimeout(timer);signal?.removeEventListener('abort',stop);reject(cancelled(signal))};
  signal?.addEventListener('abort',stop,{once:true});
 });
}
export async function joinWithBackoff(request,{signal,maxAttempts=4,onRetry=()=>{},sleep=delayAbortable,random=Math.random}={}){
 const attempts=Math.max(1,Math.min(6,Math.floor(Number(maxAttempts)||4)));
 for(let i=1;i<=attempts;i++){
  if(signal?.aborted)throw cancelled(signal);
  try{return await request({signal,attempt:i})}
  catch(error){
   if(signal?.aborted)throw cancelled(signal);
   if(!isRetryableJoinError(error)||i===attempts)throw error;
   const ms=retryDelayMs(i,{retryAfterSeconds:error.retryAfterSeconds,random:random()});
   onRetry({attempt:i,nextAttempt:i+1,maxAttempts:attempts,delayMs:ms});
   await sleep(ms,signal);
  }
 }
 throw Error('Joining attempts exhausted');
}
