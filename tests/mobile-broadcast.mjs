import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CAMERA_PRESETS,initialCameraQuality,nextFacingMode,canShareScreen,cameraCaptureOptions,restartPublishedCamera} from '../src/components/mobile-broadcast.js';

assert.equal(initialCameraQuality({touchscreen:true}), 'economical');
assert.equal(initialCameraQuality({saveData:true}), 'economical');
assert.equal(initialCameraQuality({}), 'balanced');
assert.equal(nextFacingMode('user'),'environment');
assert.equal(nextFacingMode('environment'),'user');
assert.equal(canShareScreen({getDisplayMedia:async()=>{}}),true);
assert.equal(canShareScreen({getUserMedia:async()=>{}}),false);
assert.equal(canShareScreen(undefined),false);
assert.deepEqual(cameraCaptureOptions('economical','environment'),{
 resolution:{width:640,height:360},frameRate:20,facingMode:'environment'
});
assert.deepEqual(cameraCaptureOptions('bad-value').resolution,CAMERA_PRESETS.balanced.resolution);
let calls=0;
await restartPublishedCamera({restartTrack:async o=>{calls++;assert.equal(o.facingMode,'environment')}},cameraCaptureOptions('balanced','environment'));
assert.equal(calls,1);
await assert.rejects(restartPublishedCamera(null,{}),/unsupported/);

const jsx=readFileSync(new URL('../src/components/Classroom.jsx',import.meta.url),'utf8');
assert.match(jsx,/host&&touchscreen&&<ClassButton icon=\{RefreshCw\}/,'host-only camera flipping');
assert.match(jsx,/host&&screenShareSupported&&<ClassButton icon=\{MonitorUp\}/,'hide unsupported screenshare');
assert.match(jsx,/onClick=\{\(\)=>void startTeaching\(true\)\}/,'explicit audio-only consent');
assert.match(jsx,/onClick=\{\(\)=>void startTeaching\(false\)\}/,'explicit camera and audio consent');
assert.match(jsx,/if\(!host\|\|busy\|\|!touchscreen\)return/,'students cannot flip teacher camera');
console.log('PASS mobile host camera, display share, audio-only and permission regression checks');
