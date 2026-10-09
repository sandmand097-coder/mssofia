import {RoomServiceClient} from 'livekit-server-sdk';
import {TrackSource} from '@livekit/protocol';

export const MAX_ACTIVE_SPEAKERS=6;
export const sourcesForMode=mode=>mode==='camera'?[TrackSource.MICROPHONE,TrackSource.CAMERA]:mode==='microphone'?[TrackSource.MICROPHONE]:[];
export const participantPermission=mode=>({
 canSubscribe:true,
 canPublish:mode==='microphone'||mode==='camera'||mode==='host',
 canPublishData:mode==='host',
 canPublishSources:mode==='host'?[]:sourcesForMode(mode)
});
export const videoGrant=(role,speakerMode='')=>{
 const host=role==='teacher'||role==='admin';
 return {...participantPermission(host?'host':speakerMode),roomAdmin:host};
};
export const getRoomService=()=>{
 const {LIVEKIT_URL,LIVEKIT_API_KEY,LIVEKIT_API_SECRET}=process.env;
 if(!LIVEKIT_URL||!LIVEKIT_API_KEY||!LIVEKIT_API_SECRET)return null;
 let host;
 try{
  const url=new URL(LIVEKIT_URL);
  if(url.protocol!=='wss:'&&url.protocol!=='ws:')return null;
  url.protocol=url.protocol==='wss:'?'https:':'http:';
  host=url.toString().replace(/\/$/,'');
 }catch{return null}
 return new RoomServiceClient(host,LIVEKIT_API_KEY,LIVEKIT_API_SECRET);
};
