import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createLiveAdmission} from '../server/live-admission.js';

let passed=0;
const check=(ok,label)=>{assert.ok(ok,label);passed++;console.log('PASS '+label)};
class FakeResponse extends EventEmitter{
 constructor(){super();this.headers={};this.statusCode=200;this.body=null}
 set(key,value){this.headers[key]=value;return this}
 status(value){this.statusCode=value;return this}
 json(value){this.body=value;this.emit('finish');return this}
}
const gate=createLiveAdmission({studentLimit:3,totalLimit:5});
const make=(role)=>{
 const res=new FakeResponse(),req={user:{role}},next=()=>{res.admitted=true};
 gate.middleware(req,res,next);
 return res;
};
const student=[make('student'),make('student'),make('student')];
check(student.every(r=>r.admitted),'students enter until soft allocation is reached');
const fourth=make('student');
check(fourth.statusCode===503&&fourth.headers['Retry-After']==='2'&&fourth.body.code==='CLASSROOM_BUSY','extra student receives retryable backpressure instead of server overload');
const teacher=make('teacher'),director=make('admin');
check(teacher.admitted&&director.admitted,'teacher and director enter reserved fast lane');
const exhausted=make('admin');
check(exhausted.statusCode===503,'overall bounded work in flight');
let snapshot=gate.snapshot();
check(snapshot.active===5&&snapshot.activeStudents===3&&snapshot.throttled===2,'counters are exact without personal student data');
student[0].emit('close');student[0].emit('finish');
check(gate.snapshot().active===4&&gate.snapshot().activeStudents===2,'close and finish free resources exactly once');
const resumed=make('student');
check(resumed.admitted,'student can enter once another request has completed');
for(const response of [...student,teacher,director,resumed])response.emit('finish');
snapshot=gate.snapshot();
check(snapshot.active===0&&snapshot.activeStudents===0,'all counters return to zero after load');
check(snapshot.peak===5&&snapshot.accepted===6,'peak and successful admissions are observable to the director');
check(snapshot.scope==='this-server-instance','admission metrics never claim distributed global scale');
check(createLiveAdmission({studentLimit:-99,totalLimit:0}).snapshot().totalLimit===20,'invalid deployment limits safely fall back');
console.log('RESULT '+passed+' admission/backpressure checks passed');
