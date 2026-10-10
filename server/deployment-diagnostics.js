// Read-only operations verification. Called only by the authenticated director.
// NEVER include environment values, SQL errors, tokens, emails or URLs in the API.
import {schoolReadiness} from './release-readiness.js';

const VERIFIED_PROJECT='wnkewiulyobbjftckfqb';
const PRIVATE_BUCKET='mrsofia-payment-proofs';

function withTimeout(promise,ms=9000){
 let task;
 return Promise.race([
  Promise.resolve().then(promise),
  new Promise((_,reject)=>{task=setTimeout(()=>reject(Error('deadline')),ms)})
 ]).finally(()=>clearTimeout(task));
}

export async function verifyPrivateStorage(env=process.env,request=fetch){
 const key=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
 if(!key||!env.SUPABASE_URL)return false;
 let origin;
 try{
  const u=new URL(env.SUPABASE_URL);
  if(u.protocol!=='https:'||u.hostname!==VERIFIED_PROJECT+'.supabase.co'||u.username||u.password)return false;
  origin=u.origin;
 }catch{return false}
 try{
  const response=await request(origin+'/storage/v1/bucket/'+PRIVATE_BUCKET,{
   method:'GET',
   headers:key.startsWith('sb_secret_')?{apikey:key}:{apikey:key,Authorization:'Bearer '+key},
   signal:AbortSignal.timeout(8000)
  });
  if(!response.ok)return false;
  const data=await response.json();
  return data?.id===PRIVATE_BUCKET && data?.name===PRIVATE_BUCKET && data?.public===false;
 }catch{return false}
}

// The outcome is always a flat, allow-listed object of booleans and UTC time.
// A green "configured" flag is NOT passed off as evidence of service operation.
export async function testProductionConnections({env=process.env,checkDatabase=async()=>false,roomService=null,request=fetch}={}){
 const flags=schoolReadiness(env);
 const verified=async fn=>{try{return (await withTimeout(fn))===true}catch{return false}};
 const [database,livekit,receiptBucket]=await Promise.all([
  verified(checkDatabase),
  flags.livekitCredentialsConfigured &&roomService?
   verified(async()=>{await roomService.listRooms();return true}):Promise.resolve(false),
  flags.privateReceiptStorageConfigured?
   verified(()=>verifyPrivateStorage(env,request)):Promise.resolve(false)
 ]);
 return{
  checkedAt:new Date().toISOString(),
  launchMode:flags.launchMode,
  databaseConnected:database,
  livekitApiVerified:livekit,
  receiptBucketPrivateVerified:receiptBucket,
  privateReceiptStorageConfigured:flags.privateReceiptStorageConfigured,
  guardianGoogleConfigured:flags.studentGoogleEnabled,
  guardianRegistrationAllowed:flags.studentGoogleRegistrationEnabled,
  privacyApproved:flags.guardianPrivacyApproved,
  schoolContactConfigured:flags.schoolContactConfigured,
  walletConfigured:flags.paymentWalletConfigured,
  mailProviderConfigured:flags.outboundMailConfigured,
  mailDeliveryTested:false,
  mediaTwoDeviceTested:false,
  paymentVerifiedManually:false
 };
}

// Limits repeated paid API/DB calls and shares one inflight check among requests.
export function createDiagnosticReader(options,{cacheMs=60000}={}){
 let cached=null,validUntil=0,pending=null;
 return async()=>{
  if(cached&&Date.now()<validUntil)return cached;
  if(pending)return pending;
  pending=testProductionConnections(options).then(result=>{
   cached=result;validUntil=Date.now()+cacheMs;return result
  }).finally(()=>{pending=null});
  return pending;
 };
}
