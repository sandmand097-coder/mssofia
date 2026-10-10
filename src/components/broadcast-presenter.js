// The classroom may be scheduled against a teacher account while Miss Sofia's
// administrator is the actual broadcaster. Select the connected director's
// media first; fall back to the scheduled instructor for older session tokens.
// Role metadata is written by the authenticated token endpoint, not by the UI.
export function broadcasterIdentity(participants=[],scheduledTeacherId=''){
 let selected='',priority=0;
 for(const participant of participants){
  if(!participant?.identity)continue;
  let role;
  try{role=JSON.parse(participant.metadata||'{}')?.mrsSofiaRole}catch{}
  const score=role==='director'?4:
   role==='instructor'?3:
   participant.permissions?.canPublish&&participant.permissions?.canPublishData?2:
   participant.identity===scheduledTeacherId?1:0;
  if(score>priority){selected=participant.identity;priority=score}
 }
 return selected||scheduledTeacherId||'';
}

export function isDirectorBroadcaster(user){
 return user?.role==='admin';
}
