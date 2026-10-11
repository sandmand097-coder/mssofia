import assert from 'node:assert/strict';
import {estimateClassroomCapacity} from '../server/media-capacity.js';
const forty=estimateClassroomCapacity({students:40,lessonMinutes:120,videoKbps:1000,classesPerMonth:1,participantMinuteAllowance:5000});
assert.equal(forty.participants,41);
assert.equal(forty.participantMinutesPerClass,4920);
assert.equal(forty.allowanceSufficient,true);
assert.equal(forty.nominalServerDownstreamMbps,40);
assert.equal(forty.nominalVideoTransferGBPerClass,36);
const fifty=estimateClassroomCapacity({students:50,lessonMinutes:120,videoKbps:1200,classesPerMonth:8,participantMinuteAllowance:5000});
assert.equal(fifty.participants,51);
assert.equal(fifty.participantMinutesPerClass,6120);
assert.equal(fifty.participantMinutesPerMonth,48960);
assert.equal(fifty.nominalServerDownstreamMbps,60);
assert.equal(fifty.nominalVideoTransferGBPerClass,54);
assert.equal(fifty.nominalVideoTransferGBPerMonth,432);
assert.equal(fifty.allowanceSufficient,false);
assert.equal(estimateClassroomCapacity().allowanceSufficient,null,'do not claim to know actual account quota');
for(const invalid of [
 {students:0},{students:501},{students:3.1},{lessonMinutes:0},
 {lessonMinutes:241},{videoKbps:0},{videoKbps:9000},
 {classesPerMonth:0},{participantMinuteAllowance:-1}
])assert.throws(()=>estimateClassroomCapacity(invalid),RangeError);
assert.match(fifty.disclaimer,/No provider quota or actual live test was checked/);
console.log('PASS provider-neutral egress arithmetic, multiple sessions and honest cost caveats');
