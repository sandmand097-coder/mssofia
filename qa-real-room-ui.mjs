// End-to-end React studio + actual local LiveKit RTP smoke.
// Synthetic accounts, ephemeral room, fake camera/mic. Never connects to the
// production API, real student records, payment provider or LiveKit Cloud.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import net from 'node:net';
import {chromium} from 'playwright-core';
import {AccessToken,RoomServiceClient} from 'livekit-server-sdk';

const room='sofia-live-react-ui-'+randomUUID();
const teacherId='director-'+randomUUID();
const studentId='learner-'+randomUUID();
const serverUrl='ws://127.0.0.1:7880';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const port=await new Promise((resolve,reject)=>{
 const s=net.createServer().once('error',reject);
 s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))});
});
const origin='http://127.0.0.1:'+port;
let sfu,vite,browser,teacher,student;
async function makeToken(identity,host){
 const at=new AccessToken('devkey','secret',{
  identity,name:host?'QA presenter':'QA listener',
  metadata:JSON.stringify({mrsSofiaRole:host?'director':'viewer'}),
  ttl:'15m'
 });
 at.addGrant({roomJoin:true,room,canPublish:host,canSubscribe:true,canPublishData:host});
 return at.toJwt();
}
async function waitReady(url,check){
 for(let i=0;i<100;i++){
  if(check&&!check())throw Error('Local test service exited');
  try{await fetch(url,{signal:AbortSignal.timeout(650)});return}catch{}
  await pause(170);
 }
 throw Error('Timed out starting '+url);
}
const roomService=new RoomServiceClient('http://127.0.0.1:7880','devkey','secret');
async function waitForConnectedParticipant(identity){
 for(let attempt=0;attempt<110;attempt++){
  try{
   const joined=await roomService.listParticipants(room);
   if(joined.some(item=>item.identity===identity))return;
  }catch{/* Room may not exist until the first LiveKit join. */}
  await pause(160);
 }
 throw Error('React LiveKit connection did not reach the actual SFU for '+identity);
}
async function connectPage(id,host){
 const page=await browser.newPage({
  viewport:{width:host?390:420,height:850},
  hasTouch:true,isMobile:true,
  permissions:['camera','microphone'],
  locale:'ar-EG'
 });
 const errors=[];
 page.on('pageerror',err=>errors.push(String(err.message).slice(0,170)));
 await page.route('**/api/**',async route=>{
  const uri=new URL(route.request().url()).pathname;
  const send=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(uri==='/api/health')return send(200,{ok:true,mode:'full',registrationAvailable:false,videoConfigured:true});
  if(uri==='/api/auth/me')return send(200,{user:null});
  if(uri==='/api/courses')return send(200,{courses:[]});
  if(uri==='/api/lessons/qa-lesson/classroom')return send(200,{
   duration_minutes:120,hands:[],speakers:[],maxActiveSpeakers:6,
   qaEnabled:false,handRaised:false,
   ends_at:new Date(Date.now()+120*60000).toISOString()
  });
  return send(403,{error:'Only fixtures allowed in isolated QA'});
 });
 await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:24000});
 const token=await makeToken(id,host);
 await page.evaluate(async opts=>{
  const m=await import('/src/qa/ConnectedRoomSandbox.jsx');
  m.mountConnectedRoomSandbox(opts);
 },{lessonId:'qa-lesson',isHost:host,teacherId,serverUrl,token});
 const frame=page.locator('#mssofia-connected-room-fixture');
 await frame.locator('.sofia-meeting-layout').waitFor({timeout:25000});
 return {page,frame,errors};
}
try{
 sfu=spawn('livekit-server',['--dev'],{stdio:'ignore'});
 await waitReady('http://127.0.0.1:7880/',()=>sfu.exitCode===null);
 vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});
 await waitReady(origin+'/qa-webrtc.html',()=>vite.exitCode===null);
 browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
  '--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling',
  '--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'
 ]});
 teacher=await connectPage(teacherId,true);
 await waitForConnectedParticipant(teacherId);
 await pause(300);
 await teacher.frame.getByRole('button',{name:'البدء بالصوت فقط'}).waitFor();
 await teacher.frame.getByRole('button',{name:'البدء بالصوت فقط'}).click();
 try{
  await teacher.frame.getByText('البث مباشر • Miss Sofia').waitFor({timeout:18000});
 }catch(e){
  const state=await teacher.frame.locator('.sofia-meeting').innerText().catch(()=>'(unavailable)');
  console.error('SOFIA_REACT_HOST_STATE '+state.slice(0,520).replace(/\s+/g,' '));
  throw e;
 }
 console.log('PASS React mobile teacher publishes real microphone-only track');
 student=await connectPage(studentId,false);
 await student.frame.getByRole('button',{name:'الميكروفون بإذن المعلمة'}).waitFor();
 assert.equal(await student.frame.getByRole('button',{name:'الميكروفون بإذن المعلمة'}).isDisabled(),true);
 assert.equal(await student.frame.getByRole('button',{name:'مشاركة الشاشة'}).count(),0);
 await student.frame.locator('audio').first().waitFor({timeout:20000});
 const audio=await student.frame.locator('audio').first().evaluate(el=>({tracks:el.srcObject?.getAudioTracks?.().length||0,readyState:el.readyState}));
 assert.ok(audio.tracks>0,'Real teacher audio MediaStream reached the learner interface');
 console.log('PASS listener subscribes to real host audio with student microphone locked');
 await teacher.frame.getByRole('button',{name:'تشغيل الكاميرا'}).click();
 await student.frame.locator('.sofia-meeting-stage video').first().waitFor({timeout:22000});
 await student.page.waitForFunction(()=>{
  const v=document.querySelector('#mssofia-connected-room-fixture .sofia-meeting-stage video');
  return v&&v.videoWidth>0&&v.videoHeight>0&&v.readyState>=2;
 },null,{timeout:26000});
 const before=await student.frame.locator('.sofia-meeting-stage video').first().evaluate(v=>v.getVideoPlaybackQuality?.().totalVideoFrames||v.webkitDecodedFrameCount||0);
 await pause(5000);
 const after=await student.frame.locator('.sofia-meeting-stage video').first().evaluate(v=>({
  frames:v.getVideoPlaybackQuality?.().totalVideoFrames||v.webkitDecodedFrameCount||0,
  width:v.videoWidth,height:v.videoHeight,ready:v.readyState
 }));
 assert.ok(after.frames>before,'decoded frames must continue increasing in actual React student stage');
 assert.ok(after.width>0&&after.height>0,'student video stage must show real camera dimensions');
 await teacher.frame.getByRole('button',{name:'الكاميرا الخلفية'}).waitFor();
 console.log('SOFIA_REACT_WEBRTC_RESULT '+JSON.stringify({
  realVideoFramesBefore:before,realVideoFramesAfter:after.frames,
  videoDimensions:[after.width,after.height],
  receivedAudioTracks:audio.tracks,
  presenterDevice:'simulated phone in Chromium with synthetic microphone and camera',
  actualIOSorAndroidHardware:false,
  usesPublicLiveKitCloud:false,
  endToEndReactAndSFU:true
 }));
 assert.deepEqual(teacher.errors,[]);
 assert.deepEqual(student.errors,[]);
 console.log('PASS React-based mobile presenter and learner view over REAL local SFU');
}catch(e){
 console.error('SOFIA_REACT_WEBRTC_FAILED '+String(e.message||e).slice(0,650));
 process.exitCode=1;
}finally{
 await browser?.close().catch(()=>{});
 if(vite&&!vite.killed)vite.kill('SIGTERM');
 if(sfu&&!sfu.killed)sfu.kill('SIGTERM');
 console.log('SOFIA_REACT_QA_CLEANUP_DONE');
}
