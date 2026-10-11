// MISS SOFIA: 50-participant real-media soak, real wall-clock minutes.
//
// This is a NON-PRODUCTION 120-minute test of self-hosted LiveKit OSS on one
// GitHub Actions Linux runner. 1 simulated presenter publishes camera + audio;
// 50 browser clients decode subscribed RTP over a loopback WebRTC connection.
// No school database, sessions, payment gateway, Render, Cloudflare, real child,
// LiveKit Cloud account, recording or user secret is ever used.
//
// PASS only if we measure the ENTIRE specified wall-clock duration, every
// learner receives advancing audio bytes and decoded video frames with the
// documented continuity threshold, the SFU stays up and logs no browser crash.
// Loopback/320x180@12fps is not equivalent to Egypt mobile network/720p/phones.

import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdirSync,appendFileSync,writeFileSync,readFileSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {performance} from 'node:perf_hooks';
import {chromium} from 'playwright-core';
import {AccessToken,RoomServiceClient} from 'livekit-server-sdk';

const minutes=Number(process.env.SOFIA_SOAK_MINUTES??120);
const count=Number(process.env.SOFIA_SOAK_VIEWERS??50);
const intervalSeconds=Number(process.env.SOFIA_SOAK_INTERVAL_SECONDS??30);
assert.ok(Number.isFinite(minutes)&&minutes>=0.5&&minutes<=130,'minutes must be 0.5..130');
assert.ok(Number.isInteger(count)&&count>=2&&count<=50,'student count 2..50');
assert.ok(Number.isInteger(intervalSeconds)&&intervalSeconds>=10&&intervalSeconds<=60,'sample every 10..60 seconds');

const durationMs=minutes*60000;
const periodMs=intervalSeconds*1000;
const sampleCount=Math.ceil(durationMs/periodMs);
const suiteId=randomUUID();
const roomName='mssofia-soak-'+suiteId;
const serverUrl='ws://127.0.0.1:7880';
const artifacts=path.join(process.cwd(),'qa-artifacts','soak-'+count+'-'+String(minutes).replace('.','_')+'m');
mkdirSync(artifacts,{recursive:true});
const samplesPath=path.join(artifacts,'samples.ndjson');
const reportPath=path.join(artifacts,'summary.json');
const startedUtc=new Date().toISOString();

let sfu,vite,browser,context,presenter;
let serverExit=null;
const students=[],pageErrors=[];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,Math.max(0,ms)));
function bounded(promise,ms,label){
 let timer;
 return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),ms)})])
  .finally(()=>clearTimeout(timer));
}
function appendSample(line){
 appendFileSync(samplesPath,JSON.stringify(line)+'\n');
}
function rssMB(pid){
 if(!pid)return null;
 try{
  const text=readFileSync('/proc/'+pid+'/status','utf8');
  const match=text.match(/^VmRSS:\s+(\d+)\s+kB/m);
  return match?Math.round(Number(match[1])/1024):null;
 }catch{return null}
}
const percentile=(values,q)=>values.length?values.slice().sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*q)-1)]:null;
const rounded=(n,places=3)=>Number(n.toFixed(places));
const stable=child=>child&&child.exitCode===null&&!child.killed;
async function waitFor(url,check){
 for(let retry=0;retry<100;retry++){
  if(check&&!check())throw Error('Ephemeral test server exited early');
  try{
   await fetch(url,{signal:AbortSignal.timeout(850)});
   return;
  }catch{}
  await pause(170);
 }
 throw Error('Could not start local test endpoint');
}
const tmpPort=await new Promise((resolve,reject)=>{
 const server=net.createServer().once('error',reject);
 server.listen(0,'127.0.0.1',()=>{
  const port=server.address().port;
  server.close(()=>resolve(port));
 });
});
const website='http://127.0.0.1:'+tmpPort;
const admin=new RoomServiceClient('http://127.0.0.1:7880','devkey','secret');
async function createToken(identity,host=false){
 const token=new AccessToken('devkey','secret',{
  identity,
  name:host?'synthetic-teacher':'synthetic-viewer',
  ttl:'4h'
 });
 token.addGrant({
  roomJoin:true,room:roomName,
  canPublish:host,canSubscribe:!host,canPublishData:false
 });
 return token.toJwt();
}
async function join(identity,host=false){
 const page=await context.newPage();
 page.on('pageerror',e=>pageErrors.push({student:identity,reason:String(e.message).slice(0,160)}));
 page.on('crash',()=>pageErrors.push({student:identity,reason:'browser page crashed'}));
 await page.goto(website+'/qa-webrtc.html',{waitUntil:'domcontentloaded',timeout:35000});
 await page.waitForFunction(()=>document.documentElement.dataset.ready==='true',{timeout:20000});
 const jwt=await createToken(identity,host);
 const before=performance.now();
 const result=await bounded(page.evaluate(({url,token,publisher})=>
  window.sofiaMediaProbe.connectProbe({serverUrl:url,token,publisher}),
 {url:serverUrl,token:jwt,publisher:host}),30000,'WebRTC join '+identity);
 assert.equal(result.connected,'connected','Client not connected '+identity);
 if(host)assert.ok(result.publishedCamera&&result.publishedMicrophone,'Synthetic teacher must publish BOTH media types');
 return {page,identity,joinMs:rounded(performance.now()-before)};
}
async function allStats(){
 const output=new Array(students.length);
 // Bounded concurrency prevents measurement itself creating artificial stalls.
 for(let start=0;start<students.length;start+=10){
  await Promise.all(students.slice(start,start+10).map(async(student,offset)=>{
   const index=start+offset;
   try{
    const stats=await bounded(student.page.evaluate(()=>
     window.sofiaMediaProbe.captureProbeStats()),10000,'RTP stats '+student.identity);
    output[index]={...stats,identity:student.identity};
   }catch(error){
    output[index]={identity:student.identity,error:String(error.message).slice(0,135)};
   }
  }));
 }
 return output;
}
async function roomParticipants(){
 try{return (await bounded(admin.listParticipants(roomName),9000,'SFU participant check')).length}
 catch{return -1}
}
const startRecord={
 test:'Miss Sofia isolated 120-minute WebRTC load and decode soak',
 configuration:{minutes,students:count,presenters:1,intervalSeconds,
  teacherVideo:'synthetic 320x180@12fps',
  network:'loopback (same GitHub runner)',
  browser:'headless Chromium (not iOS Safari or hardware Android)',
  provider:'LiveKit OSS --dev; NO LiveKit Cloud',
  serviceUnderTest:'isolated SFU + subscriber browser RTP; NOT production web API',
  thresholds:{
   minEachViewerHealthyRate:0.99,
   minAllViewersHealthySampleRate:0.95,
   maxConsecutiveUnhealthyIntervalsPerViewer:2,
   minParticipantsOnPeriodicSfuCheck:count+1
  }
 },
 startUtc:startedUtc
};
writeFileSync(path.join(artifacts,'test-plan.json'),JSON.stringify(startRecord,null,2));
console.log('SOFIA_SOAK_PLAN '+JSON.stringify(startRecord));

let summary={result:'INCOMPLETE',startUtc:startedUtc,configuration:startRecord.configuration};
try{
 sfu=spawn('livekit-server',['--dev'],{stdio:'ignore'});
 sfu.once('exit',(code,signal)=>{serverExit={code,signal,at:new Date().toISOString()}});
 await waitFor('http://127.0.0.1:7880/',()=>stable(sfu));
 vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(tmpPort),'--strictPort'],{stdio:'ignore'});
 await waitFor(website+'/qa-webrtc.html',()=>stable(vite));
 browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',
  '--autoplay-policy=no-user-gesture-required',
  '--disable-background-timer-throttling','--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows'
 ]});
 context=await browser.newContext({
  viewport:{width:390,height:844},hasTouch:true,isMobile:true,
  permissions:['camera','microphone']
 });
 presenter=await join('teacher-'+suiteId,true);
 for(let step=0;step<count;step+=5){
  const names=Array.from({length:Math.min(5,count-step)},(_,i)=>
   'student-'+String(step+i+1).padStart(2,'0'));
  const attempts=await Promise.allSettled(names.map(name=>join(name)));
  for(const attempt of attempts){
   if(attempt.status==='fulfilled')students.push(attempt.value);
   else throw Error('WebRTC student join failed: '+String(attempt.reason?.message||attempt.reason).slice(0,170));
  }
 }
 assert.equal(students.length,count);
 assert.equal(await roomParticipants(),count+1,'SFU must register every real participant');
 console.log('SOFIA_SOAK_JOINED '+JSON.stringify({viewers:students.length,participants:count+1,
  p95JoinMs:percentile(students.map(s=>s.joinMs),0.95)}));

 // Warmup ensures baseline arrives only after media decoding starts.
 let previous;
 for(let retry=0;retry<8;retry++){
  await pause(2000);
  previous=await allStats();
  const ready=previous.every(r=>r.connected&&r.remoteVideo&&r.remoteAudio
   &&r.videoBytes>0&&r.audioBytes>0&&r.videoFramesDecoded>0);
  if(ready)break;
 }
 assert.ok(previous.every(r=>r.connected&&r.remoteVideo&&r.remoteAudio
  &&r.videoBytes>0&&r.audioBytes>0&&r.videoFramesDecoded>0),
 '50 viewers must decode real audio/video before starting 2-hour soak');

 // The TWO-HOUR CLOCK begins only after all 50 students decode media.
 const t0=performance.now();
 const viewers=Object.fromEntries(students.map(s=>[s.identity,{
  healthy:0,unhealthy:0,streak:0,maxStreak:0,
  videoFrames:0,audioBytes:0
 }]));
 let healthyAllSamples=0,participantChecks=0,minParticipants=count+1,maxSfuRssMB=0;
 let maxSampleDelayMs=0;
 let firstFrameSum=0;
 console.log('SOFIA_SOAK_WALL_CLOCK_START '+new Date().toISOString());

 for(let n=1;n<=sampleCount;n++){
  const scheduledAt=t0+n*periodMs;
  await pause(scheduledAt-performance.now());
  const late=Math.max(0,performance.now()-scheduledAt);
  maxSampleDelayMs=Math.max(maxSampleDelayMs,late);
  const after=await allStats();
  let healthyCount=0,connectedCount=0,audioCount=0,videoCount=0;
  const bad=[];
  for(let k=0;k<count;k++){
   const before=previous[k],now=after[k],id=students[k].identity;
   const score=viewers[id];
   const videoDelta=(Number(now.videoFramesDecoded)||0)-(Number(before.videoFramesDecoded)||0);
   const audioDelta=(Number(now.audioBytes)||0)-(Number(before.audioBytes)||0);
   const videoByteDelta=(Number(now.videoBytes)||0)-(Number(before.videoBytes)||0);
   const online=now.connected===true&&now.remoteVideo&&now.remoteAudio;
   if(now.connected)connectedCount++;
   if(videoDelta>0)videoCount++;
   if(audioDelta>0)audioCount++;
   const good=Boolean(online&&videoDelta>0&&audioDelta>0&&videoByteDelta>0&&!now.error&&!(now.errors?.length));
   if(good){healthyCount++;score.healthy++;score.streak=0}
   else{
    score.unhealthy++;score.streak++;
    score.maxStreak=Math.max(score.maxStreak,score.streak);
    if(bad.length<15)bad.push({student:k+1,videoDelta,audioDelta,connected:!!now.connected,error:now.error||now.errors?.[0]||null});
   }
   score.videoFrames+=Math.max(0,videoDelta);
   score.audioBytes+=Math.max(0,audioDelta);
  }
  previous=after;
  if(healthyCount===count)healthyAllSamples++;
  // Include minute-by-minute resource use. `load1` includes browser decoders
  // and the local media server on ONE host, not a real production VM.
  const resource={
   load1:rounded(os.loadavg()[0],2),
   freeRamMB:Math.round(os.freemem()/1048576),
   sfuRssMB:rssMB(sfu.pid),
   driverRssMB:Math.round(process.memoryUsage().rss/1048576)
  };
  maxSfuRssMB=Math.max(maxSfuRssMB,resource.sfuRssMB||0);
  let sfuCount=null;
  if(n===1||n%10===0||n===sampleCount){
   sfuCount=await roomParticipants();
   participantChecks++;
   minParticipants=Math.min(minParticipants,sfuCount);
  }
  const record={sample:n,elapsedMinutes:rounded((performance.now()-t0)/60000,2),
   connectedCount,videoCount,audioCount,healthyCount,unhealthyCount:count-healthyCount,
   sfuParticipants:sfuCount,resource,lateMs:Math.round(late),bad};
  appendSample(record);
  if(n===1||n%10===0||n===sampleCount){
   console.log('SOFIA_SOAK_HEARTBEAT '+JSON.stringify({
    sample:n,total:sampleCount,elapsedMinutes:record.elapsedMinutes,
    connected:connectedCount,video:videoCount,audio:audioCount,healthy:healthyCount,
    sfuParticipants:sfuCount,resource
   }));
  }
  if(!stable(sfu))throw Error('Local media server exited unexpectedly');
  if(pageErrors.length)throw Error('Browser page error/crash detected: '+pageErrors[0].reason);
 }
 const elapsed=performance.now()-t0;
 const counts=Object.values(viewers);
 const minimumHealthyRate=Math.min(...counts.map(v=>v.healthy/sampleCount));
 const worstBadStreak=Math.max(...counts.map(v=>v.maxStreak));
 const allHealthyRate=healthyAllSamples/sampleCount;
 const mediaFrames=counts.reduce((sum,v)=>sum+v.videoFrames,0);
 const audioBytes=counts.reduce((sum,v)=>sum+v.audioBytes,0);
 const failures=[];
 if(elapsed<durationMs)failures.push('Measured less than configured wall-clock duration');
 if(minimumHealthyRate<0.99)failures.push('At least one viewer received active AV below 99% sampled intervals');
 if(allHealthyRate<0.95)failures.push('All 50 simultaneously healthy in less than 95% of sampled intervals');
 if(worstBadStreak>2)failures.push('A viewer stalled longer than two sampling intervals');
 if(minParticipants<count+1)failures.push('SFU had fewer than 51 participants during periodic room check');
 if(pageErrors.length)failures.push('Unexpected browser exceptions or crashes');
 if(!stable(sfu))failures.push('LiveKit media server crashed');
 summary={
  result:failures.length?'FAIL':'PASS',
  configuration:startRecord.configuration,startUtc:startedUtc,endUtc:new Date().toISOString(),
  wallClockMinutes:rounded(elapsed/60000,3),samples:sampleCount,
  intervalSeconds,healthyAllSamples,allHealthySampleRate:rounded(allHealthyRate,4),
  minViewerHealthyRate:rounded(minimumHealthyRate,4),
  worstConsecutiveUnhealthyIntervals:worstBadStreak,
  totalFramesDecodedSinceBaseline:mediaFrames,
  totalAudioBytesSinceBaseline:audioBytes,
  p95JoinMs:percentile(students.map(s=>s.joinMs),0.95),
  minObservedSfuParticipants:minParticipants,periodicParticipantChecks:participantChecks,
  maxSfuRssMB,maxSamplingStartDelayMs:Math.round(maxSampleDelayMs),
  viewerSummary:counts,errors:failures,
  browserErrors:pageErrors.slice(0,5),
  importantLimitations:[
   'Exactly one runner and loopback WebRTC, not a distributed internet load test',
   '320x180 at 12fps synthetic presenter stream is lower than a professional 720p class',
   'Headless Chromium with fake camera and microphone, not real iPhone/Android devices',
   'No TURN relay, packet loss, throttled mobile networks, recording, payments or production API'
  ]
 };
 if(failures.length)throw Error('Soak acceptance criteria not met: '+failures.join('; '));
 console.log('SOFIA_SOAK_PASS '+JSON.stringify({
  wallClockMinutes:summary.wallClockMinutes,viewers:count,
  allHealthySampleRate:summary.allHealthySampleRate,
  minViewerHealthyRate:summary.minViewerHealthyRate,
  maxSfuRssMB:summary.maxSfuRssMB
 }));
}catch(error){
 summary.result='FAIL';
 summary.error=String(error?.message||error).slice(0,650);
 summary.endUtc=new Date().toISOString();
 summary.serverExit=serverExit;
 summary.browserErrorCount=pageErrors.length;
 console.error('SOFIA_SOAK_FAILED '+summary.error);
 process.exitCode=1;
}finally{
 writeFileSync(reportPath,JSON.stringify(summary,null,2));
 // Always leave a machine-readable result for failed/aborted tests.
 if(context)await bounded(context.close(),8000,'context cleanup').catch(()=>{});
 if(browser)await bounded(browser.close(),8000,'browser cleanup').catch(()=>{});
 for(const child of [vite,sfu]){
  if(child&&!child.killed)child.kill('SIGTERM');
 }
 console.log('SOFIA_SOAK_REPORT '+reportPath);
}
