// Inspects an actual publishing instructor in LiveKit without a schema change.
// The result is for ENROLLED students only; their paid access is checked first.
// Per-process short caching and in-flight deduplication prevent thundering herds.
const mediaSources=new Set([1,2,3,4,'CAMERA','MICROPHONE','SCREEN_SHARE','SCREEN_SHARE_AUDIO']);
export function isPublishingTrack(track){
 if(!track||track.muted===true)return false;
 return mediaSources.has(track.source)||mediaSources.has(String(track.source||'').toUpperCase());
}
export function createEarlyLiveInspector({
 roomService,lookupUser,clock=()=>Date.now(),ttlMs=5000,timeoutMs=2800
}={}){
 const cache=new Map();
 const limit=256;
 async function inspect(lesson){
  if(!roomService||!lesson?.id||!lesson.room_key||typeof lookupUser!=='function')return false;
  const key=lesson.id+':'+lesson.room_key;
  const moment=clock();
  const existing=cache.get(key);
  if(existing&&existing.expires>moment)return existing.value;
  if(existing?.pending)return existing.pending;
  const evaluate=async()=>{
   const participants=await roomService.listParticipants(lesson.room_key);
   for(const person of participants||[]){
    if(!person?.identity||!Array.isArray(person.tracks)||!person.tracks.some(isPublishingTrack))continue;
    // Never trust editable room metadata as proof of instructor authority.
    const account=await lookupUser(person.identity);
    if(account?.status!=='active')continue;
    if(account.role==='admin'||account.role==='teacher'&&person.identity===lesson.teacher_id)return true;
   }
   return false;
  };
  let timer;
  const pending=Promise.race([
   evaluate(),
   new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(Error('LiveKit instructor state timed out')),timeoutMs);
   })
  ]).catch(()=>false).then(value=>{
   const current=cache.get(key);
   if(current?.pending===pending)cache.set(key,{value,expires:clock()+ttlMs});
   return value;
  }).finally(()=>clearTimeout(timer));
  cache.set(key,{pending});
  if(cache.size>limit)cache.delete(cache.keys().next().value);
  return pending;
 }
 return{isBroadcasting:inspect,clear:()=>cache.clear()};
}
