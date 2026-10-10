import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {videoPresentation} from './video-presentation.js';
import {
 LiveKitRoom,RoomAudioRenderer,StartAudio,VideoTrack,useTracks,
 useParticipants,useRoomContext,useLocalParticipant,useLocalParticipantPermissions,useChat
} from '@livekit/components-react';
import {Track} from 'livekit-client';
import {
 Video,VideoOff,Mic,MicOff,MonitorUp,Hand,Users,ShieldCheck,Radio,
 Volume2,LogOut,UserX,CheckCircle2,RefreshCw,LockKeyhole,MessageCircle,
 Send,Camera,CameraOff,AlertTriangle,Expand,BookOpen,Wifi,Clock3
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
export function MeetingStudio({connection,onDisconnected}){
 const room=useRoomContext();
 const {localParticipant,isMicrophoneEnabled,isCameraEnabled,isScreenShareEnabled}=useLocalParticipant();
 const permission=useLocalParticipantPermissions();
 const peers=useParticipants();
 const videoTracks=useTracks([Track.Source.ScreenShare,Track.Source.Camera],{onlySubscribed:true});
 const audioTracks=useTracks([Track.Source.Microphone,Track.Source.ScreenShareAudio],{onlySubscribed:true});
 const {chatMessages,send,isSending}=useChat();
 const host=connection.isHost;
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
   if(type==='camera')await localParticipant.setCameraEnabled(!isCameraEnabled);
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
   localParticipant.setCameraEnabled(true)
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
    <div className="sofia-meeting-info"><div className="sofia-meeting-live"><span className="sofia-live-led"/> {liveNow?'البث مباشر • Mrs Sofia':host?'استوديو المعلمة جاهز':'في انتظار بدء بث المعلمة'}</div><div className="sofia-meeting-count"><Users size={16}/> {onlineCount.toLocaleString('ar-EG')} مشارك</div></div>
    <div className={'sofia-meeting-stage '+(stage?'has-video is-'+stageLayout.orientation:'')} style={stage?{'--sofia-source-aspect':stageLayout.ratio}:undefined}>
     <VideoSurface refTrack={stage} onDimensions={setVideoDimensions} emptyText={host?'شغّلي الكاميرا أو مشاركة الشاشة للشرح':audioStreaming?'صوت المعلمة مباشر — في انتظار الفيديو':'في انتظار بث المعلمة'} icon={host?Camera:BookOpen}/>
     {screen&&camera&&<div className="sofia-meeting-picture" style={{'--sofia-pip-aspect':pictureLayout.ratio}}><VideoSurface refTrack={camera} onDimensions={setPictureVideoDimensions} small emptyText="المعلمة"/></div>}
     <div className="sofia-meeting-stage-bottom"><span><Radio size={15}/> {screen?'مشاركة شاشة المعلمة':camera?'فيديو المعلمة':'جاهز للدرس'}</span><span>{connection.isHost?'أنتِ تديرين الفصل':'تستمع إلى درس Mrs Sofia'}</span></div>
    </div>
    {host&&<div className="sofia-director-broadcast" role="status"><div><strong>{liveNow?'البث قيد التشغيل':'أنتِ المعلمة المسؤولة عن البث'}</strong><small>{liveNow?'يمكنك تغيير الكاميرا أو الصوت أو مشاركة الشاشة، والطلاب يشاهدون ما تنشرينه فقط.':'اضغطي «بدء البث» لتشغيل الكاميرا والميكروفون بموافقتك. ويمكنك استخدام مشاركة الشاشة بدل الكاميرا.'}</small></div>{!liveNow&&<button type="button" className="sofia-director-start" onClick={startTeaching} disabled={busy}><Radio size={17}/>{busy?'جارٍ تشغيل الأجهزة...':'ابدئي البث الآن'}</button>}</div>}
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
     </div>:<div className="sofia-meeting-listener"><span><BookOpen size={30}/></span><h3>أهلاً بك في فصل Mrs Sofia</h3><p>ركّز في الفيديو والشرح، وارفع إيدك لما تحب تسأل المعلمة. مش هتحتاج تشغل كاميرتك عشان تستمع.</p></div>)}
    {tab==='messages'&&<div className="sofia-meeting-messages"><div className="sofia-meeting-chat-list">{announcements.length?announcements.map((msg,i)=><div className="sofia-meeting-chat" key={msg.id||i}><strong>المعلمة</strong><p>{msg.message}</p></div>):<div className="sofia-meeting-empty">الإعلانات اللي بتكتبها المعلمة هتظهر هنا.</div>}</div>{host&&<form className="sofia-meeting-compose" onSubmit={publishAnnouncement}><label htmlFor="sofia-announcement">رسالة للطلاب</label><textarea id="sofia-announcement" rows={3} maxLength={240} value={announcement} onChange={e=>setAnnouncement(e.target.value)} placeholder="اكتبي تعليمات أو ملحوظة للطلاب..."/><button disabled={isSending||!announcement.trim()} type="submit"><Send size={15}/> إرسال للجميع</button></form>}</div>}
   {tab==='messages'&&roomInfo?.qaEnabled&&<ClassroomQuestions lessonId={roomId} host={host}/>}
   </aside>
  </div>
 );
 return <section className={'sofia-meeting '+(expanded?'expanded':'')} dir="rtl"><div className="sofia-meeting-heading"><div><span><ShieldCheck size={16}/> فصل آمن تحت إدارة المعلمة</span><strong>Mrs Sofia — قاعة العلوم المباشرة</strong></div><button type="button" onClick={()=>setExpanded(!expanded)}><Expand size={17}/> {expanded?'العرض العادي':'توسيع العرض'}</button></div>{error&&<div role="alert" className="sofia-meeting-error"><AlertTriangle size={17}/>{error}<button onClick={()=>setError('')}>إغلاق</button></div>}{view}</section>;
}
export function ClassroomPreview({isHost=false}){
 return <div className="sofia-class-preview" dir="rtl"><div className="sofia-class-preview-top"><span><span className="sofia-live-led"/> معاينة التصميم — البث غير مفعل</span><strong>Mrs Sofia • الفصل الافتراضي</strong></div><div className="sofia-class-preview-body"><div className="sofia-class-preview-stage"><span><Video size={52}/></span><h3>شاشة شرح المعلمة</h3><p>ستُعرض هنا كاميرا المعلمة أو الشاشة التي تشاركها مع الطلاب.</p></div><aside><h3>{isHost?'لوحة تحكم المعلمة':'مساحة الطالب'}</h3><p>{isHost?'رفع اليد • السماح بالصوت • قفل الجميع • استبعاد الطالب • إنهاء الحصة':'استمع للشرح، وشاهد الفيديو، وارفع يدك لطلب الكلام.'}</p><div><MicOff size={20}/><Users size={20}/><Hand size={20}/></div></aside></div></div>;
}
export default function Classroom({connection,onDisconnected,onConnectionError}){
 return <div className="live-frame sofia-classroom-live">
  <LiveKitRoom token={connection.token} serverUrl={connection.serverUrl} connect audio={false} video={false} options={{adaptiveStream:true,dynacast:true}} onDisconnected={onDisconnected} onError={e=>{console.error('Classroom connection:',e?.message);onConnectionError?.('تعذر الاتصال بغرفة البث. تحققي من الإنترنت ثم اضغطي «فتح استوديو البث» للمحاولة مرة أخرى.')}} data-lk-theme="default">
   <MeetingStudio connection={connection} onDisconnected={onDisconnected}/>
  </LiveKitRoom>
 </div>;
}
