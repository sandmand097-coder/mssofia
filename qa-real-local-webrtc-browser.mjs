// TRUE short real-media test, isolated to ephemeral LiveKit OSS --dev on the
// GitHub runner. Unlike waiting-room mocks, every fake student subscribes
// through WebRTC and we check inbound audio bytes + decoded VIDEO FRAMES.
// This is NOT an iOS device test, NOT a public LiveKit Cloud test, NOT a
// 120-minute endurance test, and NOT proof of commercial-host suitability.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import net from 'node:net';
import {chromium} from 'playwright-core';
import {AccessToken,RoomServiceClient} from 'livekit-server-sdk';

const roomName='mssofia-isolated-qa-'+randomUUID();
const serverUrl='ws://127.0.0.1:7880';
const target=Number(process.env.SOFIA_REAL_MEDIA_TARGET||10);
const holdMs=Number(process.env.SOFIA_REAL_MEDIA_HOLD_MS||10000);
assert.ok(Number.isInteger(target)&&target>=2&&target<=50,'test target 2..50');
assert.ok(Number.isInteger(holdMs)&&holdMs>=5000&&holdMs<=60000,'hold 5..60 seconds');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const withTimeout=(promise,ms,label)=>Promise.race([
 promise,
 new Promise((_,reject)=>setTimeout(()=>reject(Error(label+' exceeded '+ms+'ms')),ms))
]);
const port=await new Promise((resolve,reject)=>{
 const socket=net.createServer().once('error',reject);
 socket.listen(0,'127.0.0.1',()=>{const number=socket.address().port;socket.close(()=>resolve(number))});
});
const origin='http://127.0.0.1:'+port;
let mediaServer,vite,browser,context,publisher;
const students=[],failures=[];
let serverLog='';
const cleanups=[];
const pidAlive=child=>child&&child.exitCode===null&&!child.killed;
async function waitFor(url,check,attempts=80){
 for(let i=0;i<attempts;i++){
  if(check&&!check())throw Error('Test service unexpectedly stopped');
  try{await fetch(url,{signal:AbortSignal.timeout(750)});return}catch{}
  await pause(175);
 }
 throw Error('Unable to start local service '+url);
}
async function token(identity,canPublish){
 const jwt=new AccessToken('devkey','secret',{identity,name:identity,ttl:'25m'});
 jwt.addGrant({roomJoin:true,room:roomName,canPublish,canSubscribe:!canPublish,canPublishData:false});
 return await jwt.toJwt();
}
async function loadPage(id,canPublish=false){
 const page=await context.newPage();
 page.on('pageerror',error=>failures.push(id+': '+String(error.message).slice(0,160)));
 await page.goto(origin+'/qa-webrtc.html',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>document.documentElement.dataset.ready==='true',{timeout:20000});
 const jwt=await token(id,canPublish);
 const started=Date.now();
 const connected=await withTimeout(page.evaluate(async({serverUrl,token,publisher})=>
  window.sofiaMediaProbe.connectProbe({serverUrl,token,publisher}),
 {serverUrl,token:jwt,publisher:canPublish}),30000,'LiveKit join '+id);
 assert.equal(connected.connected,'connected','Room failed to connect for '+id);
 if(canPublish){
  assert.equal(connected.publishedCamera,true,'fake teacher video publication');
  assert.equal(connected.publishedMicrophone,true,'fake teacher audio publication');
 }
 return {id,page,joinedMs:Date.now()-started};
}
async function readStats(list){
 const values=[];
 for(const entry of list){
  try{
   const stats=await withTimeout(entry.page.evaluate(()=>window.sofiaMediaProbe.captureProbeStats()),12000,'stats '+entry.id);
   values.push({...stats,id:entry.id,joinMs:entry.joinedMs});
  }catch(error){values.push({id:entry.id,error:String(error.message).slice(0,140)})}
 }
 return values;
}
try{
 // On GitHub Actions the official installer puts this binary on PATH.
 mediaServer=spawn('livekit-server',['--dev'],{stdio:['ignore','pipe','pipe']});
 mediaServer.stdout.on('data',buf=>{serverLog=(serverLog+buf.toString()).slice(-13000)});
 mediaServer.stderr.on('data',buf=>{serverLog=(serverLog+buf.toString()).slice(-13000)});
 await waitFor('http://127.0.0.1:7880/',()=>pidAlive(mediaServer),110);
 console.log('PASS ephemeral LiveKit SFU available on loopback only');
 vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});
 await waitFor(origin+'/qa-webrtc.html',()=>pidAlive(vite),100);
 browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',
  '--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling',
  '--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'
 ]});
 context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,permissions:['microphone','camera']});
 publisher=await loadPage('teacher-'+randomUUID(),true);
 const admin=new RoomServiceClient('http://127.0.0.1:7880','devkey','secret');
 const firstRooms=await admin.listRooms();
 assert.ok(firstRooms.some(r=>r.name===roomName),'teacher created a real LiveKit room');
 console.log('PASS real teacher video+audio publish through SFU, not a disconnected UI sandbox');
 const phases=[2,10,25,50].filter(n=>n<=target);
 if(phases.at(-1)!==target)phases.push(target);
 for(const phase of phases){
  while(students.length<phase){
   const group=Array.from({length:Math.min(5,phase-students.length)},
    (_,offset)=>'student-'+String(students.length+offset+1).padStart(2,'0'));
   const settled=await Promise.allSettled(group.map(id=>loadPage(id,false)));
   for(const result of settled){
    if(result.status==='fulfilled')students.push(result.value);
    else failures.push('join '+String(result.reason?.message||result.reason).slice(0,170));
   }
   if(settled.some(r=>r.status==='rejected'))break;
  }
  assert.equal(students.length,phase,'all '+phase+' students must have a unique real WebRTC connection: '+JSON.stringify(failures.slice(-4)));
  console.log('PASS '+phase+' separate student browser WebRTC connections');
 }
 await pause(holdMs);
 const first=await readStats(students);
 await pause(Math.max(6000,Math.min(12000,Math.floor(holdMs*.8))));
 const second=await readStats(students);
 let success=0,receivedAudio=0,decodedVideo=0;
 const sampleFailures=[];
 for(let i=0;i<students.length;i++){
  const a=first[i],b=second[i];
  const valid=b.connected===true&&b.remoteVideo&&b.remoteAudio
   &&b.videoBytes>0&&b.audioBytes>0
   &&b.videoFramesDecoded>0&&b.videoFramesDecoded>a.videoFramesDecoded
   &&b.videoBytes>a.videoBytes&&b.audioBytes>a.audioBytes;
  if(b.videoFramesDecoded>0)decodedVideo++;
  if(b.audioBytes>0)receivedAudio++;
  if(valid)success++;
  else sampleFailures.push({id:b.id,baselineVideo:a.videoFramesDecoded,videoFrames:b.videoFramesDecoded,
   videoBytes:b.videoBytes,audioBytes:b.audioBytes,error:b.error||b.errors?.join(';')});
 }
 const participants=(await admin.listParticipants(roomName)).length;
 const summary={
  kind:'real-WebRTC-short-run',
  targetStudents:target,
  connectedStudents:students.length,
  sfuParticipants:participants,
  studentsWithDecodedVideo:decodedVideo,
  studentsWithInboundAudio:receivedAudio,
  studentsWithContinuouslyIncreasingVideoFramesAndAudioBytes:success,
  holdMs,measuredDurationMs:holdMs+Math.max(6000,Math.min(12000,Math.floor(holdMs*.8))),
  p95JoinMs:students.map(s=>s.joinedMs).sort((a,b)=>a-b)[Math.ceil(students.length*.95)-1],
  browser:'headless Chromium on GitHub Actions Ubuntu',
  server:'self-hosted LiveKit OSS --dev, loopback only',
  usesLiveKitCloud:false,
  provesTwoHourSoak:false,
  failedSamples:sampleFailures.slice(0,8),
  runtimeErrors:failures.slice(0,8)
 };
 // Deliberately print no access tokens, real participant data or secrets.
 console.log('SOFIA_REAL_MEDIA_RESULT '+JSON.stringify(summary));
 assert.equal(participants,target+1,'actual SFU room participant count includes one teacher');
 assert.equal(success,target,'all listeners must actually receive decoded frames and incoming audio over time');
 assert.deepEqual(failures,[],'browser errors');
 const negative=await students[0].page.evaluate(()=>window.sofiaMediaProbe.tryIllegalViewerPublish());
 assert.equal(negative.rejected,true,'subscribe-only learner must not publish microphone');
 console.log('PASS SFU rejects learner microphone publishing without teacher permission');
 console.log('PASS short real-media test. This does not replace a 120-minute soak or real phone tests.');
}catch(error){
 console.error('SOFIA_REAL_MEDIA_FAILED '+String(error.message||error).slice(0,700));
 // Server log lines can contain room details, so disclose only counts in CI.
 console.error('LOCAL_LIVEKIT_LOG_BYTES '+serverLog.length);
 process.exitCode=1;
}finally{
 const started=Date.now();
 if(context){try{
  for(const entry of students){void entry.page.evaluate(()=>window.sofiaMediaProbe.disconnectProbe()).catch(()=>{})}
  await Promise.race([context.close(),pause(5000)]);
 }catch{}}
 if(browser)await browser.close().catch(()=>{});
 for(const child of [vite,mediaServer])if(child&&!child.killed)child.kill('SIGTERM');
 console.log('SOFIA_QA_CLEANUP_COMPLETED '+(Date.now()-started)+'ms');
}
