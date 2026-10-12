import assert from 'node:assert/strict';
import {CLASSROOM_HEARTBEAT_MS,shouldHeartbeat} from '../src/components/classroom-heartbeat.js';
assert.equal(CLASSROOM_HEARTBEAT_MS,420000);
assert.equal(CLASSROOM_HEARTBEAT_MS<15*60*1000,true,'active classes get health traffic before free idle');
assert.equal(shouldHeartbeat({isHost:true,connected:true,visible:true,online:true}),true);
for(const field of ['isHost','connected','visible','online']){
 const args={isHost:true,connected:true,visible:true,online:true};
 args[field]=false;
 assert.equal(shouldHeartbeat(args),false,'disabled when '+field+' is false');
}
console.log('PASS teacher-only, active-session read-only heartbeat gates');
