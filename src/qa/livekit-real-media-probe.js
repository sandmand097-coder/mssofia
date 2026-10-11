// Isolated test only, not imported by production. Local self-hosted LiveKit
// dev server; generated identities; fake media; no school's accounts or tokens.
import {Room,RoomEvent,Track} from 'livekit-client';

let room=null;
const remoteTracks={video:null,audio:null};
const errors=[];

export async function connectProbe({serverUrl,token,publisher=false}){
 if(room)await disconnectProbe();
 const next=new Room({adaptiveStream:false,dynacast:false});
 room=next;
 errors.length=0;
 remoteTracks.video=null;remoteTracks.audio=null;
 const holder=document.getElementById('remote-tracks');
 if(holder)holder.replaceChildren();

 next.on(RoomEvent.TrackSubscribed,(track)=>{
  if(track.kind===Track.Kind.Video||track.kind==='video'){
   remoteTracks.video=track;
   const video=track.attach();
   video.muted=true;
   video.autoplay=true;
   video.playsInline=true;
   video.dataset.remoteKind='video';
   holder?.appendChild(video);
   void video.play().catch(err=>errors.push('video autoplay: '+err.message));
  }else if(track.kind===Track.Kind.Audio||track.kind==='audio'){
   remoteTracks.audio=track;
   const audio=track.attach();
   audio.muted=true;
   audio.autoplay=true;
   audio.dataset.remoteKind='audio';
   holder?.appendChild(audio);
   void audio.play().catch(()=>{});
  }
 });
 next.on(RoomEvent.TrackSubscriptionFailed,()=>errors.push('subscription-failed'));
 next.on(RoomEvent.Disconnected,()=>errors.push('disconnected'));
 await next.connect(serverUrl,token,{autoSubscribe:true});
 if(publisher){
  await next.localParticipant.setCameraEnabled(true,{resolution:{width:320,height:180},frameRate:12});
  await next.localParticipant.setMicrophoneEnabled(true);
 }
 return {connected:next.state,publishedCamera:next.localParticipant.isCameraEnabled,
  publishedMicrophone:next.localParticipant.isMicrophoneEnabled};
}

export async function captureProbeStats(){
 const video=remoteTracks.video,audio=remoteTracks.audio;
 const videoStats=await video?.getReceiverStats?.().catch(()=>undefined);
 const audioStats=await audio?.getReceiverStats?.().catch(()=>undefined);
 const element=document.querySelector('video[data-remote-kind="video"]');
 return {
  connected:room?.state==='connected',
  remoteVideo:!!video,
  remoteAudio:!!audio,
  videoBytes:Number(videoStats?.bytesReceived??0),
  videoFramesDecoded:Number(videoStats?.framesDecoded??0),
  videoPacketsReceived:Number(videoStats?.packetsReceived??0),
  videoPacketsLost:Number(videoStats?.packetsLost??0),
  audioBytes:Number(audioStats?.bytesReceived??0),
  audioPacketsReceived:Number(audioStats?.packetsReceived??0),
  videoWidth:element?.videoWidth||0,
  videoHeight:element?.videoHeight||0,
  videoReadyState:element?.readyState??0,
  errors:errors.slice(0,5),
  identity:room?.localParticipant?.identity||null,
  peerCount:room?.remoteParticipants?.size??0
 };
}

export async function tryIllegalViewerPublish(){
 if(!room)throw Error('room not connected');
 try{
  await room.localParticipant.setMicrophoneEnabled(true);
  await room.localParticipant.setMicrophoneEnabled(false);
  return {rejected:false};
 }catch(error){
  return {rejected:true,reason:String(error?.message||'').slice(0,120)};
 }
}

export async function disconnectProbe(){
 if(room){
  const old=room;room=null;
  await old.disconnect();
 }
 for(const kind of Object.keys(remoteTracks)){
  remoteTracks[kind]?.detach?.();
  remoteTracks[kind]=null;
 }
 document.getElementById('remote-tracks')?.replaceChildren();
 return true;
}
