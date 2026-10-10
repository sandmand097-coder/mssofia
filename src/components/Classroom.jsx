import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {videoPresentation} from './video-presentation.js';
import {
 LiveKitRoom,RoomAudioRenderer,StartAudio,VideoTrack,useTracks,
 useParticipants,useRoomContext,useLocalParticipant,useLocalParticipantPermissions,useChat
} from '@livekit/components-react';
import {Track,RoomEvent,DisconnectReason,ConnectionQuality,VideoQuality} from 'livekit-client';
import {shouldRecoverDisconnect} from './live-resilience.js';
import {
 Video,VideoOff,Mic,MicOff,MonitorUp,Hand,Users,ShieldCheck,Radio,
 Volume2,LogOut,UserX,CheckCircle2,RefreshCw,LockKeyhole,MessageCircle,
 Send,Camera,CameraOff,AlertTriangle,Expand,BookOpen,Wifi,Clock3,Bell,BellOff,SlidersHorizontal,Sun,TimerReset,Volume1
} from 'lucide-react';
import '@livekit/components-styles';
import './ClassroomStudio.css';
import {broadcasterIdentity} from './broadcast-presenter.js';
import ClassroomQuestions from './ClassroomQuestions.jsx';

const api=async(path,opts={})=>{
 const res=await fetch('/api'+path,{credentials:'same-origin',...opts,headers:{'Content-Type':'application/json',...opts.headers}});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(data.error||'حدث خطأ أثناء الاتصال');
 return data;
};
const modes={microphone:'مسموح بالصوت',camera:'مسموح بالصوت والكاميرا'};
const CAMERA_PRESETS={
 balanced:{label:'متوازنة HD',resolution:{width:1280,height:720},frameRate:24},
 high:{label:'عالية Full HD',resolution:{width:1920,height:1080},frameRate:30},
 economical:{label:'اقتصادية',resolution:{width:640,height:360},frameRate:20}
};
function gentleArrivalChime(context){
 const at=context.currentTime+.015;
 for(const [frequency,offset] of [[660,0],[880,.13]]){
  const oscillator=context.createOscillator(),gain=context.createGain();
  oscillator.type='sine';oscillator.frequency.value=frequency;
  gain.gain.setValueAtTime(.0001,at+offset);
  gain.gain.exponentialRampToValueAtTime(.035,at+offset+.016);
  gain.gain.exponentialRampToValueAtTime(.0001,at+offset+.13);
  oscillator.connect(gain);gain.connect(context.destination);
  oscillator.start(at+offset);oscillator.stop(at+offset+.15);
 }
}

function VideoSurface({refTrack,emptyText,icon:Icon=Video,small=false,onDimensions}){
 const element=useRef(null);
 useEffect(()=>{
  if(!refTrack||!onDimensions||!element.current)return;
  const container=element.current;
  let current=null;
  const update=()=>{
   const width=current?.videoWidth,height=current?.videoHeight;
   if(width>0&&height>0)onDimensions({width,height});
  };
  const sync=()=>{
   const video=container.querySelector('video');
   if(video===current)return;
   if(current){current.removeEventListener('loadedmetadata',update);current.removeEventListener('resize',update);}
   current=video;
   if(current){current.addEventListener('loadedmetadata',update);current.addEventListener('resize',update);update();}
  };
  const observer=new MutationObserver(sync);
  observer.observe(container,{childList:true,subtree:true});
  sync();
  return()=>{
   observer.disconnect();
   if(current){current.removeEventListener('loadedmetadata',update);current.removeEventListener('resize',update);}
  };
 },[refTrack?.publication?.trackSid,refTrack?.source,onDimensions]);
 return <div ref={element} className={'sofia-video-surface '+(small?'small':'')}>
  {refTrack?<VideoTrack trackRef={refTrack} manageSubscription={false}/>:<div className="sofia-video-idle"><span><Icon size={small?22:51} strokeWidth={1.5}/></span><strong>{emptyText}</strong>{!small&&<small>الصوت والفيديو هيظهروا هنا وقت الشرح</small>}</div>}
 </div>;
}
function ClassButton({icon:Icon,children,onClick,disabled=false,active=false,danger=false,title}){
 return <button title={title} type="button" disabled={disabled} onClick={onClick} className={'sofia-class-button '+(active?'is-active ':'')+(danger?'danger ':'')}><Icon size={19}/><span>{children}</span></button>;
}
export function MeetingStudio({connection,onDisconnected,onTimingChange}){
 const room=useRoomContext();
 const {localParticipant,isMicrophoneEnabled,isCameraEnabled,isScreenShareEnabled}=useLocalParticipant();
 const permission=useLocalParticipantPermissions();
 const peers=useParticipants();
 const videoTracks=useTracks([Track.Source.ScreenShare,Track.Source.Camera],{onlySubscribed:true});
 const audioTracks=useTracks([Track.Source.Microphone,Track.Source.ScreenShareAudio],{onlySubscribed:true});
 const {chatMessages,send,isSending}=useChat();
 const host=connection.isHost;
 const soundContext=useRef(null);
 const [joinSound,setJoinSound]=useState(true),[arrivalNotice,setArrivalNotice]=useState('');
 const [networkState,setNetworkState]=useState('connected'),[networkQuality,setNetworkQuality]=useState('unknown');
 const [viewerMode,setViewerMode]=useState('auto'),[mediaWarning,setMediaWarning]=useState('');
 const videoChoiceManual=useRef(false),weakSamples=useRef(0),goodSamples=useRef(0);
 const [durationDraft,setDurationDraft]=useState(''),[cameraQuality,setCameraQuality]=useState('balanced');
 const [exposureRange,setExposureRange]=useState(null),[exposureValue,setExposureValue]=useState(0);
 const hostId=host?localParticipant.identity:broadcasterIdentity(peers,connection.teacherId);
 const camera=videoTracks.find(t=>t.participant.identity===hostId&&t.source===Track.Source.Camera);
 const screen=videoTracks.find(t=>t.participant.identity===hostId&&t.source===Track.Source.ScreenShare);
 const stage=screen||camera;
 const [stageDimensions,setStageDimensions]=useState(null);
 const [pictureDimensions,setPictureDimensions]=useState(null);
 const stageLayout=useMemo(()=>videoPresentation(stageDimensions?.width,stageDimensions?.height),[stageDimensions]);
 const pictureLayout=useMemo(()=>videoPresentation(pictureDimensions?.width,pictureDimensions?.height),[pictureDimensions]);
 const setVideoDimensions=useCallback(dimensions=>setStageDimensions(previous=>previous?.width===dimensions.width&&previous?.height===dimensions.height?previous:dimensions),[]);
 const setPictureVideoDimensions=useCallback(dimensions=>setPictureDimensions(previous=>previous?.width===dimensions.width&&previous?.height===dimensions.height?previous:dimensions),[]);
 useEffect(()=>setStageDimensions(null),[stage?.publication?.trackSid,stage?.source]);
 useEffect(()=>setPictureDimensions(null),[camera?.publication?.trackSid]);
 const audioStreaming=audioTracks.some(t=>t.participant.identity===hostId&&!t.publication?.isMuted);
 const liveNow=host?(isMicrophoneEnabled||isCameraEnabled||isScreenShareEnabled):(Boolean(stage)||audioStreaming);
 const [roomInfo,setRoomInfo]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[tab,setTab]=useState('participants'),[query,setQuery]=useState(''),[listLimit,setListLimit]=useState(40),[announcement,setAnnouncement]=useState(''),[onlineCount,setOnlineCount]=useState(1),[expanded,setExpanded]=useState(false);
 // LiveKit performs media and signalling reconnection internally first.
 useEffect(()=>{
  const reconnecting=()=>setNetworkState('reconnecting');
  const reconnected=()=>{setNetworkState('restored');setMediaWarning('')};
  const quality=(value,participant)=>{
   if(participant?.identity!==localParticipant.identity)return;
   setNetworkQuality(value);
   if(host||videoChoiceManual.current)return;
   if(value===ConnectionQuality.Poor||value===ConnectionQuality.Lost){
    goodSamples.current=0;
    if(++weakSamples.current>=2)setViewerMode('low');
   }else if(value===ConnectionQuality.Good||value===ConnectionQuality.Excellent){
    weakSamples.current=0;
    if(++goodSamples.current>=3)setViewerMode('auto');
   }
  };
  const subscriptionFailed=()=>setMediaWarning('تعذر استقبال إحدى قنوات الفيديو. يمكنك التحويل إلى وضع الصوت فقط مع بقاء الحصة متصلة.');
  const deviceFailed=()=>{if(host)setMediaWarning('فُقد الاتصال بالكاميرا أو الميكروفون. جرّبي تشغيل الجهاز من أزرار الاستوديو.')};
  room.on(RoomEvent.Reconnecting,reconnecting);
  room.on(RoomEvent.Reconnected,reconnected);
  room.on(RoomEvent.ConnectionQualityChanged,quality);
  room.on(RoomEvent.TrackSubscriptionFailed,subscriptionFailed);
  room.on(RoomEvent.MediaDevicesError,deviceFailed);
  return()=>{
   room.off(RoomEvent.Reconnecting,reconnecting);
   room.off(RoomEvent.Reconnected,reconnected);
   room.off(RoomEvent.ConnectionQualityChanged,quality);
   room.off(RoomEvent.TrackSubscriptionFailed,subscriptionFailed);
   room.off(RoomEvent.MediaDevicesError,deviceFailed);
  };
 },[room,host,localParticipant]);
 useEffect(()=>{
  if(networkState!=='restored')return;
  const timeout=setTimeout(()=>setNetworkState('connected'),5200);
  return()=>clearTimeout(timeout);
 },[networkState]);
 // Student-only audio-first fallback. No microphone/camera is enabled by this.
 useEffect(()=>{
  if(host)return;
  const update=()=>{
   for(const remote of room.remoteParticipants.values()){
    for(const publication of remote.videoTrackPublications.values()){
     publication.setEnabled(viewerMode!=='audio');
     if(viewerMode==='low')publication.setVideoQuality(VideoQuality.LOW);
     if(viewerMode==='auto')publication.setVideoQuality(VideoQuality.HIGH);
    }
   }
  };
  update();
  room.on(RoomEvent.TrackPublished,update);
  return()=>room.off(RoomEvent.TrackPublished,update);
 },[room,host,viewerMode,peers.length]);
 const selectViewerMode=mode=>{videoChoiceManual.current=true;setViewerMode(mode);setMediaWarning('')};
 const cameraOptions=CAMERA_PRESETS[cameraQuality];
 const getCameraTrack=()=>localParticipant.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack;
 const playArrivalSound=async()=>{
  const Ctor=window.AudioContext||window.webkitAudioContext;
  if(!Ctor)return;
  try{
   const audio=soundContext.current||new Ctor();
   soundContext.current=audio;
   if(audio.state==='suspended')await audio.resume();
   if(audio.state==='running')gentleArrivalChime(audio);
  }catch{/* Visual notification stays available if autoplay policy blocks audio. */}
 };
 useEffect(()=>{
  if(!host)return;
  const onArrival=participant=>{
   let role='';
   try{role=JSON.parse(participant.metadata||'{}').mrsSofiaRole}catch{}
   if(role!=='viewer')return;
   setArrivalNotice((participant.name||'طالب')+' انضم إلى الحصة');
   if(joinSound)void playArrivalSound();
  };
  room.on(RoomEvent.ParticipantConnected,onArrival);
  return()=>room.off(RoomEvent.ParticipantConnected,onArrival);
 },[room,host,joinSound]);
 useEffect(()=>{
  if(!arrivalNotice)return;
  const timer=setTimeout(()=>setArrivalNotice(''),6500);
  return()=>clearTimeout(timer);
 },[arrivalNotice]);
 useEffect(()=>()=>{const audio=soundContext.current;soundContext.current=null;if(audio)void audio.close().catch(()=>{});},[]);
 useEffect(()=>{
  if(!host||!isCameraEnabled){setExposureRange(null);return}
  const track=getCameraTrack();
  const range=track?.getCapabilities?.()?.exposureCompensation;
  setExposureRange(Number.isFinite(range?.min)&&Number.isFinite(range?.max)&&range.max>range.min?range:null);
 },[host,isCameraEnabled,localParticipant]);
 const setQuality=async(next)=>{
  if(!host||!CAMERA_PRESETS[next]||busy)return;
  setCameraQuality(next);
  if(!isCameraEnabled)return;
  setBusy(true);setError('');
  try{
   await localParticipant.setCameraEnabled(false);
   await localParticipant.setCameraEnabled(true,{resolution:CAMERA_PRESETS[next].resolution,frameRate:CAMERA_PRESETS[next].frameRate});
  }catch(e){setError('تعذّر تغيير الجودة. يمكنك تجربة المستوى المتوازن: '+(e.message||''))}
  finally{setBusy(false)}
 };
 const changeExposure=async(next)=>{
  const value=Number(next);setExposureValue(value);
  const track=getCameraTrack();if(!exposureRange||!track)return;
  try{
   const capabilities=track.getCapabilities?.();
   const constraint={exposureCompensation:Math.max(exposureRange.min,Math.min(exposureRange.max,value))};
   if(capabilities?.exposureMode?.includes('manual'))constraint.exposureMode='manual';
   await track.applyConstraints({advanced:[constraint]});
  }catch{setError('الكاميرا لا تدعم تغيير التعريض من المتصفح. استخدمي إضاءة أمامية مناسبة.')}
 };
 const updateDuration=async(e)=>{
  e.preventDefault();if(!host||busy)return;
  const minutes=Number(durationDraft||roomInfo?.duration_minutes);
  if(!Number.isInteger(minutes)||minutes<15||minutes>240){setError('حددي مدة من 15 إلى 240 دقيقة');return}
  setBusy(true);setError('');
  try{
   const result=await api('/lessons/'+roomId+'/duration',{method:'PATCH',body:JSON.stringify({duration_minutes:minutes})});
   setRoomInfo(old=>({...old,...result}));
   onTimingChange?.(result);
   setDurationDraft('');
  }catch(e){setError(e.message)}
  finally{setBusy(false)}
 };
 const micAllowed=host||Boolean(permission?.canPublish&&(permission.canPublishSources?.length===0||permission.canPublishSources?.includes(2)));
 const cameraAllowed=host||Boolean(permission?.canPublish&&(permission.canPublishSources?.length===0||permission.canPublishSources?.includes(1)));
 const students=peers.filter(p=>p.identity!==hostId&&!p.isLocal);
 const hands=roomInfo?.hands||[];
 const speakers=roomInfo?.speakers||[];
 const permitted=new Map(speakers.map(p=>[p.student_id,p.mode]));
 const raisedIds=new Set(hands.map(h=>h.student_id));
 const roomId=connection.lessonId;
 const loadInfo=async(silent=true)=>{try{const data=await api('/lessons/'+roomId+'/classroom');setRoomInfo(data);if(!silent)setError('')}catch(e){if(!silent)setError(e.message)}};
 useEffect(()=>{let alive=true;const refresh=()=>{if(!alive)return;api('/lessons/'+roomId+'/classroom').then(data=>{if(alive)setRoomInfo(data)}).catch(e=>{if(alive)setError(e.message)})};refresh();if(host){const id=setInterval(refresh,6000);return()=>{alive=false;clearInterval(id)}}return()=>{alive=false}},[roomId,host]);
 useEffect(()=>{const update=()=>setOnlineCount(Math.max(room.numParticipants||0,peers.length||1));update();const id=setInterval(update,7000);return()=>clearInterval(id)},[room,peers.length]);
 const toggle=async(type)=>{
  setBusy(true);setError('');
  try{
   if(type==='mic')await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
   if(type==='camera')await localParticipant.setCameraEnabled(!isCameraEnabled,isCameraEnabled?undefined:{resolution:cameraOptions.resolution,frameRate:cameraOptions.frameRate});
   if(type==='share')await localParticipant.setScreenShareEnabled(!isScreenShareEnabled,{audio:true});
  }catch(e){setError('تعذر تشغيل الجهاز: '+(e.message||'تحقق من الأذونات'))}finally{setBusy(false)}
 };
 const startTeaching=async()=>{
  if(!host||busy)return;
  setBusy(true);setError('');
  // These two explicit enable calls request permission from the director's
  // own browser; students' devices can never be switched on remotely.
  const results=await Promise.allSettled([
   localParticipant.setMicrophoneEnabled(true),
   localParticipant.setCameraEnabled(true,{resolution:cameraOptions.resolution,frameRate:cameraOptions.frameRate})
  ]);
  if(results.every(r=>r.status==='rejected'))
   setError('تعذر تشغيل الميكروفون والكاميرا؛ تحققي من أذونات المتصفح أو استخدمي مشاركة الشاشة.');
  else if(results.some(r=>r.status==='rejected'))
   setError('بدأ جزء من البث؛ تحققي من السماح بالكاميرا والميكروفون. يمكنك متابعة الشرح بالصوت أو الشاشة.');
  setBusy(false);
 };
 const changeHand=async()=>{
  if(busy)return;
  setBusy(true);setError('');
  const newValue=!roomInfo?.handRaised;
  try{await api('/lessons/'+roomId+'/hand',{method:'POST',body:JSON.stringify({raised:newValue})});setRoomInfo(s=>({...s,handRaised:newValue}))}
  catch(e){setError(e.message)}
  finally{setBusy(false)}
 };
 const moderate=async(action,student_id)=>{
  if(busy)return;
  if(action==='remove'&&!window.confirm('استبعاد الطالب من الحصة ومنع عودته إليها؟'))return;
  if(action==='end_room'&&!window.confirm('إنهاء الحصة الآن وفصل جميع المشاركين؟ لا يمكن التراجع.'))return;
  setBusy(true);setError('');
  try{
   await api('/lessons/'+roomId+'/moderate',{method:'POST',body:JSON.stringify({action,student_id})});
   if(action==='end_room'){room.disconnect();onDisconnected?.();return}
   await loadInfo(false);
  }catch(e){setError(e.message)}
  finally{setBusy(false)}
 };
 const publishAnnouncement=async(e)=>{
  e.preventDefault();
  if(!host||!announcement.trim())return;
  try{await send(announcement.trim().slice(0,240));setAnnouncement('');setError('')}
  catch(e){setError(e.message)}
 };
 const visibleStudents=students.filter(p=>(p.name||p.identity).toLowerCase().includes(query.toLowerCase())).slice(0,listLimit);
 const announcements=chatMessages.filter(m=>m.from?.identity===hostId).slice(-35);
 const view=(
  <div className="sofia-meeting-layout">
   <section className={"sofia-meeting-main "+(stage?"has-video":"")}>
    {networkState==='reconnecting'&&<div className="sofia-network-banner" role="status" aria-live="assertive"><Wifi size={16}/> جارٍ استعادة اتصال البث تلقائيًا؛ انتظر قليلًا ولا تُعد تحميل الصفحة.</div>}
    {networkState==='restored'&&<div className="sofia-network-banner restored" role="status"><CheckCircle2 size={16}/> تمت استعادة البث دون مغادرة الحصة.</div>}
    {(networkQuality==='poor'||networkQuality==='lost')&&networkState!=='reconnecting'&&
     <div className="sofia-network-banner degraded" role="status"><Wifi size={16}/> الاتصال ضعيف. نخفض جودة الفيديو للمحافظة على صوت الشرح.</div>}
    {mediaWarning&&<div className="sofia-network-banner degraded" role="status"><AlertTriangle size={16}/>{mediaWarning}</div>}
    {!host&&<div className="sofia-viewer-recovery-tools">
     <label htmlFor="sofia-viewer-mode">وضع المشاهدة</label>
     <select id="sofia-viewer-mode" value={viewerMode} onChange={e=>selectViewerMode(e.target.value)}>
      <option value="auto">تلقائي — الجودة تتكيف مع الإنترنت</option>
      <option value="low">توفير الإنترنت — فيديو منخفض الجودة</option>
      <option value="audio">الصوت فقط — عند ضعف الإنترنت جدًا</option>
     </select>
    </div>}
    {host&&arrivalNotice&&<div className="sofia-meeting-arrival" role="status" aria-live="polite"><Bell size={17}/>{arrivalNotice}</div>}
    <div className="sofia-meeting-info"><div className="sofia-meeting-live"><span className="sofia-live-led"/> {liveNow?'البث مباشر • Miss Sofia':host?'استوديو المعلمة جاهز':'في انتظار بدء بث المعلمة'}</div><div className="sofia-meeting-count"><Users size={16}/> {onlineCount.toLocaleString('ar-EG')} مشارك</div></div>
    <div className={'sofia-meeting-stage '+(stage?'has-video is-'+stageLayout.orientation:'')} style={stage?{'--sofia-source-aspect':stageLayout.ratio}:undefined}>
     <VideoSurface refTrack={stage} onDimensions={setVideoDimensions} emptyText={host?'شغّلي الكاميرا أو مشاركة الشاشة للشرح':audioStreaming?'صوت المعلمة مباشر — في انتظار الفيديو':'في انتظار بث المعلمة'} icon={host?Camera:BookOpen}/>
     {screen&&camera&&<div className="sofia-meeting-picture" style={{'--sofia-pip-aspect':pictureLayout.ratio}}><VideoSurface refTrack={camera} onDimensions={setPictureVideoDimensions} small emptyText="المعلمة"/></div>}
     <div className="sofia-meeting-stage-bottom"><span><Radio size={15}/> {screen?'مشاركة شاشة المعلمة':camera?'فيديو المعلمة':'جاهز للدرس'}</span><span>{connection.isHost?'أنتِ تديرين الفصل':'تستمع إلى درس Miss Sofia'}</span></div>
    </div>
    {host&&<div className="sofia-director-broadcast" role="status"><div><strong>{liveNow?'البث قيد التشغيل':'أنتِ المعلمة المسؤولة عن البث'}</strong><small>{liveNow?'يمكنك تغيير الكاميرا أو الصوت أو مشاركة الشاشة، والطلاب يشاهدون ما تنشرينه فقط.':'اضغطي «بدء البث» لتشغيل الكاميرا والميكروفون بموافقتك. ويمكنك استخدام مشاركة الشاشة بدل الكاميرا.'}</small></div>{!liveNow&&<button type="button" className="sofia-director-start" onClick={startTeaching} disabled={busy}><Radio size={17}/>{busy?'جارٍ تشغيل الأجهزة...':'ابدئي البث الآن'}</button>}</div>}
    {host&&<div className="sofia-meeting-professional">
      <div className="sofia-meeting-settings-head">
       <strong><SlidersHorizontal size={18}/> إعدادات الاستوديو</strong>
       <div className="sofia-meeting-alert-tools">
        <button type="button" className="sofia-meeting-sound-toggle" onClick={()=>setJoinSound(v=>!v)}>
         {joinSound?<Bell size={15}/>:<BellOff size={15}/>}
         {joinSound?'تنبيه الدخول: مفعّل':'تنبيه الدخول: صامت'}
        </button>
        <button type="button" className="sofia-meeting-sound-toggle" onClick={()=>void playArrivalSound()}><Volume1 size={15}/> تجربة النغمة</button>
       </div>
      </div>
      <form className="sofia-meeting-duration" onSubmit={updateDuration}>
       <label htmlFor="lesson-live-duration"><TimerReset size={17}/> مدة الحصة (دقيقة)</label>
       <input id="lesson-live-duration" type="number" min="15" max="240" step="1"
        value={durationDraft!==''?durationDraft:roomInfo?.duration_minutes??60}
        onChange={e=>setDurationDraft(e.target.value)} inputMode="numeric"/>
       <button type="submit" disabled={busy||!roomInfo||Number(durationDraft||roomInfo.duration_minutes)===Number(roomInfo.duration_minutes)}>حفظ المدة</button>
       {roomInfo?.ends_at&&<small>النهاية المجدولة: {new Intl.DateTimeFormat('ar-EG',{hour:'numeric',minute:'2-digit',timeZone:'Africa/Cairo'}).format(new Date(roomInfo.ends_at))} بتوقيت القاهرة</small>}
      </form>
      <div className="sofia-meeting-camera-controls">
       <label htmlFor="sofia-camera-quality">جودة الكاميرا</label>
       <select id="sofia-camera-quality" value={cameraQuality} disabled={busy} onChange={e=>void setQuality(e.target.value)}>
        {Object.entries(CAMERA_PRESETS).map(([value,item])=><option value={value} key={value}>{item.label}</option>)}
       </select>
       <small>تتكيف الجودة الفعلية مع سرعة الاتصال وقدرة الكاميرا؛ تغيير المستوى أثناء البث قد يوقف الصورة لحظة.</small>
      </div>
      {isCameraEnabled&&exposureRange?
       <label className="sofia-meeting-exposure"><Sun size={16}/> تحسين التعريض المدعوم بالكاميرا
        <input type="range" min={exposureRange.min} max={exposureRange.max} step={exposureRange.step||.1} value={exposureValue} onChange={e=>void changeExposure(e.target.value)}/>
       </label>:
       <small className="sofia-meeting-light-tip"><Sun size={15}/> لأفضل إضاءة: ضعي مصدر الضوء أمام وجهك، وابتعدي عن النافذة خلفك. التحكم الإلكتروني في التعريض يظهر فقط إذا دعمته الكاميرا.</small>}
      <small className="sofia-meeting-duration-note">تغيير المدة يحدّث نهاية الحصة؛ ولإنهائها فورًا افصلي الجميع من لوحة الطلاب.</small>
     </div>}
    <div className="sofia-meeting-tools"><div className="sofia-meeting-tool-group">
     {host&&<ClassButton icon={isMicrophoneEnabled?Mic:MicOff} onClick={()=>toggle('mic')} active={isMicrophoneEnabled} disabled={busy}>{isMicrophoneEnabled?'إيقاف صوتي':'تشغيل صوتي'}</ClassButton>}
     {!host&&micAllowed&&<ClassButton icon={isMicrophoneEnabled?Mic:MicOff} onClick={()=>toggle('mic')} active={isMicrophoneEnabled} disabled={busy}>{isMicrophoneEnabled?'إغلاق ميكروفوني':'تشغيل ميكروفوني'}</ClassButton>}
     {!host&&!micAllowed&&<ClassButton icon={LockKeyhole} disabled>الميكروفون بإذن المعلمة</ClassButton>}
     {(host||cameraAllowed)&&<ClassButton icon={isCameraEnabled?Video:VideoOff} onClick={()=>toggle('camera')} active={isCameraEnabled} disabled={busy}>{isCameraEnabled?'إغلاق الكاميرا':'تشغيل الكاميرا'}</ClassButton>}
     {host&&<ClassButton icon={MonitorUp} onClick={()=>toggle('share')} active={isScreenShareEnabled} disabled={busy}>{isScreenShareEnabled?'إيقاف العرض':'مشاركة الشاشة'}</ClassButton>}
     {!host&&<ClassButton icon={Hand} onClick={changeHand} active={Boolean(roomInfo?.handRaised)} disabled={busy||Boolean(roomInfo?.speakerMode)}>{roomInfo?.handRaised?'إلغاء رفع اليد':'ارفع إيدك'}</ClassButton>}
    </div><ClassButton icon={LogOut} danger onClick={()=>{room.disconnect();onDisconnected?.()}}>مغادرة الحصة</ClassButton></div>
    {!host&&<div className="sofia-meeting-student-hint"><ShieldCheck size={18}/>{micAllowed?'المعلمة سمحت لك بالمشاركة. اضغط تشغيل ميكروفوني للتحدث بعد موافقتك ومنح المتصفح الإذن.':'هتشوف شرح المعلمة وتسمع صوتها. ارفع إيدك لو حابب تسأل.'}</div>}
    <StartAudio label="اضغط هنا لتشغيل صوت الدرس" className="sofia-audio-unlock"/>
    <RoomAudioRenderer/>
   </section>
   <aside className="sofia-meeting-sidebar">
    <div className="sofia-meeting-tabs"><button className={tab==='participants'?'active':''} onClick={()=>setTab('participants')}><Users size={16}/> {host?'الطلاب':'الفصل'} {host&&hands.length>0&&<em>{hands.length}</em>}</button><button className={tab==='messages'?'active':''} onClick={()=>setTab('messages')}><MessageCircle size={16}/> رسائل المعلمة</button></div>
    {tab==='participants'&&(host?<div className="sofia-meeting-roster">
      <div className="sofia-meeting-summary"><span><CheckCircle2 size={17}/> {speakers.length} مسموح لهم بالمشاركة</span><span><Hand size={17}/> {hands.length} رافعين إيدهم</span></div>
      <div className="sofia-meeting-safety"><ShieldCheck size={19}/> كل الطلاب مشاهدون فقط حتى تسمحي لهم بالصوت أو الكاميرا.</div>
      {hands.length>0&&<div className="sofia-meeting-requests"><h3>طلبات رفع اليد</h3>{hands.map(h=><div className="sofia-meeting-request" key={h.student_id}><span>{h.name}</span><div><button disabled={busy} onClick={()=>moderate('allow_audio',h.student_id)}><Mic size={15}/> اسمحي بالصوت</button><button disabled={busy} title="إزالة طلب رفع اليد" onClick={()=>moderate('clear_hand',h.student_id)}><UserX size={15}/></button></div></div>)}</div>}
      <div className="sofia-meeting-roster-head"><h3>الطلاب المتصلون</h3><small>حتى {roomInfo?.maxActiveSpeakers||6} مشاركات صوتية في نفس الوقت</small></div>
      <input className="sofia-meeting-search" placeholder="ابحثي عن اسم الطالب..." aria-label="البحث عن الطالب" value={query} onChange={e=>{setQuery(e.target.value);setListLimit(40)}}/>
      <div className="sofia-meeting-students">{visibleStudents.map(p=>{const mode=permitted.get(p.identity)||'';return <div className="sofia-meeting-student" key={p.identity}><div className="sofia-meeting-student-label"><span className="sofia-meeting-avatar">{(p.name||'ط').charAt(0)}</span><div><strong>{p.name||'طالب'}</strong><small>{mode?modes[mode]:raisedIds.has(p.identity)?'رافع إيده':'وضع الاستماع'}</small></div></div><div className="sofia-meeting-student-actions">{mode?<><button disabled={busy} title="قفل الصوت والكاميرا" onClick={()=>moderate('revoke',p.identity)}><MicOff size={15}/></button>{mode==='microphone'&&<button disabled={busy} title="السماح للطالب بفتح كاميرته بموافقته" onClick={()=>moderate('allow_camera',p.identity)}><Camera size={15}/></button>}</>:<button disabled={busy} title="السماح بالصوت" onClick={()=>moderate('allow_audio',p.identity)}><Mic size={15}/></button>}<button disabled={busy} className="sofia-danger-icon" title="استبعاد الطالب" onClick={()=>moderate('remove',p.identity)}><UserX size={15}/></button></div></div>})}</div>
      {!students.length&&<div className="sofia-meeting-empty">هيظهر الطلاب هنا عند دخولهم الفصل</div>}
      {students.length>listLimit&&<button className="sofia-meeting-more" onClick={()=>setListLimit(x=>x+40)}>عرض مزيد من الطلاب</button>}
      <div className="sofia-meeting-host-actions"><button disabled={busy} onClick={()=>moderate('mute_all')}><MicOff size={17}/> قفل كل ميكروفونات الطلاب</button><button disabled={busy} className="danger" onClick={()=>moderate('end_room')}><LogOut size={17}/> إنهاء الحصة للجميع</button></div>
     </div>:<div className="sofia-meeting-listener"><span><BookOpen size={30}/></span><h3>أهلاً بك في فصل Miss Sofia</h3><p>ركّز في الفيديو والشرح، وارفع إيدك لما تحب تسأل المعلمة. مش هتحتاج تشغل كاميرتك عشان تستمع.</p></div>)}
    {tab==='messages'&&<div className="sofia-meeting-messages"><div className="sofia-meeting-chat-list">{announcements.length?announcements.map((msg,i)=><div className="sofia-meeting-chat" key={msg.id||i}><strong>المعلمة</strong><p>{msg.message}</p></div>):<div className="sofia-meeting-empty">الإعلانات اللي بتكتبها المعلمة هتظهر هنا.</div>}</div>{host&&<form className="sofia-meeting-compose" onSubmit={publishAnnouncement}><label htmlFor="sofia-announcement">رسالة للطلاب</label><textarea id="sofia-announcement" rows={3} maxLength={240} value={announcement} onChange={e=>setAnnouncement(e.target.value)} placeholder="اكتبي تعليمات أو ملحوظة للطلاب..."/><button disabled={isSending||!announcement.trim()} type="submit"><Send size={15}/> إرسال للجميع</button></form>}</div>}
   {tab==='messages'&&roomInfo?.qaEnabled&&<ClassroomQuestions lessonId={roomId} host={host}/>}
   </aside>
  </div>
 );
 return <section className={'sofia-meeting '+(expanded?'expanded':'')} dir="rtl"><div className="sofia-meeting-heading"><div><span><ShieldCheck size={16}/> فصل آمن تحت إدارة المعلمة</span><strong>Miss Sofia — قاعة العلوم المباشرة</strong></div><button type="button" onClick={()=>setExpanded(!expanded)}><Expand size={17}/> {expanded?'العرض العادي':'توسيع العرض'}</button></div>{error&&<div role="alert" className="sofia-meeting-error"><AlertTriangle size={17}/>{error}<button onClick={()=>setError('')}>إغلاق</button></div>}{view}</section>;
}
export function ClassroomPreview({isHost=false}){
 return <div className="sofia-class-preview" dir="rtl"><div className="sofia-class-preview-top"><span><span className="sofia-live-led"/> معاينة التصميم — البث غير مفعل</span><strong>Miss Sofia • الفصل الافتراضي</strong></div><div className="sofia-class-preview-body"><div className="sofia-class-preview-stage"><span><Video size={52}/></span><h3>شاشة شرح المعلمة</h3><p>ستُعرض هنا كاميرا المعلمة أو الشاشة التي تشاركها مع الطلاب.</p></div><aside><h3>{isHost?'لوحة تحكم المعلمة':'مساحة الطالب'}</h3><p>{isHost?'رفع اليد • السماح بالصوت • قفل الجميع • استبعاد الطالب • إنهاء الحصة':'استمع للشرح، وشاهد الفيديو، وارفع يدك لطلب الكلام.'}</p><div><MicOff size={20}/><Users size={20}/><Hand size={20}/></div></aside></div></div>;
}
export default function Classroom({connection,onDisconnected,onConnectionError,onTimingChange,onRecover}){
 const done=useRef(false);
 const leave=()=>{if(done.current)return;done.current=true;onDisconnected?.()};
 const disconnected=reason=>{
  if(done.current)return;
  done.current=true;
  if(shouldRecoverDisconnect(reason,DisconnectReason))onRecover?.();
  else onDisconnected?.();
 };
 const failed=error=>{
  if(done.current)return;
  done.current=true;
  console.error('Classroom initial connection:',error?.message);
  onConnectionError?.('تعذر بدء الاتصال بالغرفة. تحقق من الإنترنت أو حد LiveKit، ثم حاول مجددًا.');
 };
 return <div className="live-frame sofia-classroom-live">
  <LiveKitRoom token={connection.token} serverUrl={connection.serverUrl} connect audio={false} video={false}
   options={{adaptiveStream:true,dynacast:true}} onDisconnected={disconnected} onError={failed} data-lk-theme="default">
   <MeetingStudio connection={connection} onDisconnected={leave} onTimingChange={onTimingChange}/>
  </LiveKitRoom>
 </div>;
}
