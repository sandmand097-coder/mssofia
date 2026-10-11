import assert from 'node:assert/strict';
import {inspectPresenterDevices,presenterPreflightMessage,enablePresenterMedia} from '../src/components/broadcast-preflight.js';

const calls=[],released=[];
function track(kind){return {kind,readyState:'live',stop(){released.push(kind);this.readyState='ended'}}}
const all=await inspectPresenterDevices({async getUserMedia(options){
 calls.push({...options});
 return {getTracks:()=>[track(options.audio?'audio':'video')]};
}});
assert.deepEqual(all,{supported:true,microphone:true,camera:true});
assert.deepEqual(calls,[{audio:true,video:false},{audio:false,video:true}]);
assert.deepEqual(released,['audio','video'],'all temporary camera/mic tracks released');
assert.match(presenterPreflightMessage(all),/اختبار ناجح/);

let partialStops=0;
const partial=await inspectPresenterDevices({async getUserMedia(options){
 if(options.video)throw new Error('camera denied');
 return {getTracks:()=>[{kind:'audio',readyState:'live',stop(){partialStops++}}]};
}});
assert.equal(partial.microphone,true);
assert.equal(partial.camera,false);
assert.equal(partialStops,1);
assert.match(presenterPreflightMessage(partial),/الصوت فقط/);

const cameraOnly=await inspectPresenterDevices({async getUserMedia(options){
 if(options.audio)throw Error('mic blocked');
 return {getTracks:()=>[track('video')]};
}});
assert.deepEqual({microphone:cameraOnly.microphone,camera:cameraOnly.camera},{microphone:false,camera:true});
assert.match(presenterPreflightMessage(cameraOnly),/الميكروفون غير متاح/);

const missing=await inspectPresenterDevices(undefined);
assert.equal(missing.supported,false);
assert.match(presenterPreflightMessage(missing),/لا يدعم/);

const order=[];
const presenter={
 async setMicrophoneEnabled(state){order.push('mic-'+state)},
 async setCameraEnabled(state,options){order.push('camera-'+state+'-'+options.facingMode)}
};
const both=await enablePresenterMedia(presenter,{facingMode:'environment'});
assert.deepEqual(both,{microphone:true,camera:true});
assert.deepEqual(order,['mic-true','camera-true-environment'],'sequential mobile requests');
order.length=0;
const audioOnly=await enablePresenterMedia(presenter,{facingMode:'user'},{audioOnly:true});
assert.deepEqual(audioOnly,{microphone:true,camera:false});
assert.deepEqual(order,['mic-true'],'audio-only action must not access camera');

order.length=0;
const cameraAfterMicFail=await enablePresenterMedia({
 async setMicrophoneEnabled(){order.push('mic');throw Error('denied')},
 async setCameraEnabled(){order.push('cam')}
},{facingMode:'user'});
assert.deepEqual(cameraAfterMicFail,{microphone:false,camera:true});
assert.deepEqual(order,['mic','cam']);
await assert.rejects(enablePresenterMedia(null,{}),/Invalid presenter/);
console.log('PASS isolated camera/mic permission checks, track release, partial fallback and sequential mobile capture');
