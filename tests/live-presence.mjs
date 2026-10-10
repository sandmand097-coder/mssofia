import assert from 'node:assert/strict';
import {createEarlyLiveInspector,isPublishingTrack} from '../server/live-presence.js';

let passed=0;
const check=(condition,label)=>{assert.ok(condition,label);passed++;console.log('PASS '+label)};
check(isPublishingTrack({source:2,muted:false}),'unmuted microphone is an active broadcast');
check(isPublishingTrack({source:'CAMERA',muted:false}),'camera track can open live class');
check(!isPublishingTrack({source:2,muted:true}),'muted microphone cannot unlock early admission');
check(!isPublishingTrack(null),'empty media never broadcasts');
let ticks=100,lookups=0,listed=0,participants=[];
const people={
 director:{role:'admin',status:'active'},
 teacher1:{role:'teacher',status:'active'},
 otherTeacher:{role:'teacher',status:'active'},
 blocked:{role:'admin',status:'blocked'},
 student1:{role:'student',status:'active'}
};
const roomService={listParticipants:async()=>{listed++;return participants}};
const checker=createEarlyLiveInspector({
 roomService,lookupUser:async identity=>{lookups++;return people[identity]},
 clock:()=>ticks,ttlMs:5000,timeoutMs:1500
});
const lesson={id:'lesson1',room_key:'room1',teacher_id:'teacher1'};
participants=[{identity:'student1',metadata:'{"mrsSofiaRole":"director"}',tracks:[{source:1,muted:false}]}];
check(await checker.isBroadcasting(lesson)===false,'student spoofing broadcaster metadata cannot open room');
check(await checker.isHostConnected(lesson)===false,'spoofed student cannot open private waiting lobby');
const cached=await checker.isBroadcasting(lesson);
check(!cached&&listed===1,'short-term negative cache prevents repeated LiveKit API calls');
ticks+=5100;
participants=[{identity:'otherTeacher',tracks:[{source:2,muted:false}]}];
check(await checker.isBroadcasting(lesson)===false,'teacher assigned to another class cannot open this lesson');
check(await checker.isHostConnected(lesson)===false,'unassigned teacher cannot open private waiting room');
ticks+=5100;
participants=[{identity:'blocked',tracks:[{source:1,muted:false}]}];
check(await checker.isBroadcasting(lesson)===false,'suspended admin cannot open classroom');
check(await checker.isHostConnected(lesson)===false,'blocked admin cannot unlock waiting room');
ticks+=5100;
participants=[{identity:'teacher1',tracks:[{source:2,muted:true}]}];
check(await checker.isBroadcasting(lesson)===false,'instructor without active media is not broadcasting yet');
check(await checker.isHostConnected(lesson)===true,'instructor opening studio grants private lobby access without media');
ticks+=5100;
participants=[{identity:'teacher1',tracks:[{source:2,muted:false}]}];
check(await checker.isBroadcasting(lesson),'active assigned teacher starts live media');
check((await checker.getStatus(lesson)).connected,'teacher stays connected while broadcasting');
ticks+=5100;
participants=[{identity:'director',tracks:[{source:1,muted:false}]}];
check(await checker.isBroadcasting(lesson),'school director may broadcast on an older course');
check(await checker.isHostConnected(lesson),'school director can open studio without changing course owner');
ticks+=5100;
participants=[];
check(!(await checker.isBroadcasting(lesson)),'broadcast media stops when instructor leaves');
check(!(await checker.isHostConnected(lesson)),'early private lobby closes when instructor disconnects');
const fresh=createEarlyLiveInspector({
 roomService:{listParticipants:async()=>{throw Error('provider failed')}},
 lookupUser:async()=>people.teacher1
});
check(!(await fresh.isBroadcasting({id:'other',room_key:'private',teacher_id:'teacher1'})),'provider failure safely refuses early admission');
check(!(await fresh.isHostConnected({id:'other',room_key:'private',teacher_id:'teacher1'})),'LiveKit API outage fails closed for private lobby');
const coalesce=createEarlyLiveInspector({
 roomService:{listParticipants:async()=>{listed++;await new Promise(done=>setTimeout(done,30));return[{identity:'director',tracks:[{source:1}]}]}},
 lookupUser:async id=>people[id],ttlMs:5000
});
const before=listed;
const busy=await Promise.all(Array.from({length:45},(_,i)=>i%2===0?coalesce.isBroadcasting({id:'flood',room_key:'flood-room',teacher_id:'teacher1'}):coalesce.isHostConnected({id:'flood',room_key:'flood-room',teacher_id:'teacher1'})));
check(busy.every(Boolean)&&listed===before+1,'45 simultaneous early viewers generate one LiveKit request');
check(lookups>0,'role checks come from authoritative server-side accounts');
console.log('RESULT '+passed+' early-broadcast authorization checks passed');
