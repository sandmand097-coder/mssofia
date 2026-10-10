// Payment enrollment is disabled until the configured wallet and PRIVATE
// receipt bucket are both demonstrably available. Cache checks to keep the
// booking screen fast and avoid hammering the Storage API.
export function createPaymentStorageGate({configured,development,verify,now=Date.now,ttlMs=60000}){
 let current=null,validUntil=0,pending=null;
 return async()=>{
  if(!configured())return false;
  if(development())return true;
  if(current!==null&&now()<validUntil)return current;
  if(pending)return pending;
  pending=Promise.resolve().then(verify)
   .then(result=>{current=result===true;validUntil=now()+ttlMs;return current})
   .catch(()=>{current=false;validUntil=now()+ttlMs;return false})
   .finally(()=>{pending=null});
  return pending;
 };
}
