import assert from 'node:assert/strict';
import {videoPresentation} from '../src/components/video-presentation.js';
const cases=[
 [1080,1920,'portrait',.5625],
 [720,1280,'portrait',.5625],
 [1920,1080,'landscape',1.77778],
 [1280,720,'landscape',1.77778],
 [800,800,'square',1],
 [0,0,'landscape',16/9]
];
for(const [w,h,orientation,ratio] of cases){
 const value=videoPresentation(w,h);
 assert.equal(value.orientation,orientation,'orientation '+w+'x'+h);
 assert.ok(Math.abs(value.ratio-ratio)<.0001,'ratio '+w+'x'+h);
}
assert.ok(videoPresentation(10000,1).ratio<=3.5,'large ratio clamped');
assert.ok(videoPresentation(1,10000).ratio>=.3,'small ratio clamped');
console.log('PASS',cases.length+2,'camera format and responsive video checks');
