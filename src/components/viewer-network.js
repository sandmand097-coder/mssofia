// RemoteTrackPublication owns subscriptions; RemoteTrack.setEnabled() merely
// pauses/resumes an already subscribed track. Do not unsubscribe screen share:
// the teacher may be explaining a slide instead of showing a webcam.
export const VIEWER_MODES=Object.freeze(['auto','low','audio']);
export function safeViewerMode(mode){
 return VIEWER_MODES.includes(mode)?mode:'auto';
}
export function updateViewerSubscriptions(room,mode,{screenShareSource='screen_share',lowQuality='low',highQuality='high'}={}){
 const setting=safeViewerMode(mode),records=[];
 if(!room?.remoteParticipants)return records;
 for(const participant of room.remoteParticipants.values()){
  for(const publication of participant.videoTrackPublications?.values?.()||[]){
   if(publication.source===screenShareSource)continue;
   if(setting==='audio')publication.setSubscribed(false);
   else{
    publication.setSubscribed(true);
    if(setting==='low')publication.setVideoQuality(lowQuality);
    if(setting==='auto')publication.setVideoQuality(highQuality);
   }
   records.push({sid:publication.trackSid||'',subscribed:setting!=='audio'});
  }
 }
 return records;
}
export function networkNotice(state,quality){
 if(state==='reconnecting')return 'انقطع الاتصال مؤقتًا، يحاول الفصل العودة تلقائيًا. يمكنك إعادة الاتصال يدويًا.';
 if(state==='restored')return 'عاد الاتصال بالفصل بنجاح.';
 if(quality==='poor'||quality==='lost')return 'جودة الإنترنت منخفضة؛ يمكنك متابعة صوت المعلمة فقط لتقليل استهلاك البيانات.';
 return '';
}
