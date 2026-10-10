// Checks whether an authenticated, authorized teacher/director has entered the LiveKit room
// and separately whether their camera, microphone or screen is actually broadcasting.
// Call only after enrollment/payment checks. Ignore editable participant metadata.
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
  if(!roomService||!lesson?.id||!lesson.room_key||typeof lookupUser!=='function')return {connected:false,publishing:false};
  const key=lesson.id+':'+lesson.room_key;
  const moment=clock();
  const existing=cache.get(key);
  if(existing&&existing.expires>moment)return existing.value;
  if(existing?.pending)return existing.pending;
  const evaluate=async()=>{
   const participants=await roomService.listParticipants(lesson.room_key);
   const state={connected:false,publishing:false};
   for(const person of participants||[]){
    if(!person?.identity)continue;
    // Never trust editable LiveKit metadata. A student may imitate the school.
    const account=await lookupUser(person.identity);
    if(account?.status!=='active'||!(account.role==='admin'||account.role==='teacher'&&person.identity===lesson.teacher_id))continue;
    state.connected=true; // Merely opening the studio unlocks the private, non-media lobby.
    if(Array.isArray(person.tracks)&&person.tracks.some(isPublishingTrack))state.publishing=true;
    if(state.publishing)break;
   }
   return state;
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
 return{
  getStatus:inspect,
  isHostConnected:async lesson=>(await inspect(lesson)).connected,
  isBroadcasting:async lesson=>(await inspect(lesson)).publishing,
  clear:()=>cache.clear()
 };
}
