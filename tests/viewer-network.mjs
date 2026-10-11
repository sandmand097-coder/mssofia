import assert from 'node:assert/strict';
import {safeViewerMode,updateViewerSubscriptions,networkNotice} from '../src/components/viewer-network.js';
const calls=[];
function publication(source,id){
 return{source,trackSid:id,setSubscribed(v){calls.push(id+':sub:'+v)},setVideoQuality(v){calls.push(id+':quality:'+v)}};
}
const pubCam=publication('camera','cam');
const pubShare=publication('screen_share','screen');
const fake={remoteParticipants:new Map([['teacher',{videoTrackPublications:new Map([['c',pubCam],['s',pubShare]])}]])};
const audio=updateViewerSubscriptions(fake,'audio');
assert.equal(audio.length,1);
assert.deepEqual(calls,['cam:sub:false'],'must never unsubscribe screen share');
calls.length=0;
updateViewerSubscriptions(fake,'low');
assert.deepEqual(calls,['cam:sub:true','cam:quality:low']);
calls.length=0;
updateViewerSubscriptions(fake,'auto');
assert.deepEqual(calls,['cam:sub:true','cam:quality:high']);
assert.equal(safeViewerMode('bogus'),'auto');
assert.equal(updateViewerSubscriptions(null,'audio').length,0);
assert.match(networkNotice('reconnecting','good'),/إعادة الاتصال/);
assert.match(networkNotice('connected','poor'),/صوت المعلمة فقط/);
console.log('PASS student video unsubscribed and screen share remains available in audio-only mode');
