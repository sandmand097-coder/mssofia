import assert from 'node:assert/strict';
import {checkBootstrap,recoveryRetryDelay} from '../src/bootstrap-recovery.js';

const requestError=status=>Object.assign(new Error('upstream unavailable'),{status});
let paths=[];
const mock=callback=>async(path,options)=>{
 paths.push(path);
 assert.equal(options?.signal instanceof AbortSignal,true,'read probes must be bounded');
 return callback(path);
};

paths=[];
assert.deepEqual(await checkBootstrap(mock(path=>{
 if(path==='/health')throw requestError(503);
 throw Error('session should not be queried while origin is asleep');
})),{launchMode:'offline',user:null});
assert.deepEqual(paths,['/health'],'do not send an extra account request during cold start');

for(const bad of [{ok:false,mode:'full'}, {ok:true,mode:'unknown'}, null]){
 paths=[];
 assert.deepEqual(await checkBootstrap(mock(()=>bad)),{launchMode:'offline',user:null});
 assert.deepEqual(paths,['/health'],'unexpected health cannot open sessions');
}

paths=[];
const actualUser={id:'student-1',role:'student'};
assert.deepEqual(await checkBootstrap(mock(path=>path==='/health'?{ok:true,mode:'full'}:{user:actualUser})),{launchMode:'full',user:actualUser});
assert.deepEqual(paths,['/health','/auth/me'],'healthy path authenticates after readiness');

paths=[];
assert.deepEqual(await checkBootstrap(mock(path=>{
 if(path==='/health')return {ok:true,mode:'full'};
 throw requestError(401);
})),{launchMode:'full',user:null},'401 represents an anonymous visitor');
assert.deepEqual(paths,['/health','/auth/me']);

for(const status of [429,500,502,503,504]){
 paths=[];
 assert.deepEqual(await checkBootstrap(mock(path=>{
  if(path==='/health')return {ok:true,mode:'full'};
  throw requestError(status);
 })),{launchMode:'offline',user:null},`${status} must never be treated as anonymous`);
 assert.deepEqual(paths,['/health','/auth/me']);
}

paths=[];
assert.deepEqual(await checkBootstrap(mock(path=>{
 if(path==='/health')return {ok:true,mode:'full'};
 throw new TypeError('network disconnected');
})),{launchMode:'offline',user:null},'network outage must not force a logout');

for(const invalid of [{},null,{account:{id:1}}]){
 assert.deepEqual(await checkBootstrap(mock(path=>path==='/health'?{ok:true,mode:'full'}:invalid)),{launchMode:'offline',user:null},'malformed session fails closed');
}
for(const mode of ['preview','admin']){
 assert.deepEqual(await checkBootstrap(mock(path=>{
  if(path==='/health')return {ok:true,mode};
  throw requestError(401);
 })),{launchMode:mode,user:null},'previews remain restricted');
}
for(const attempt of [0,1,2,3,4,8]){
 const min=recoveryRetryDelay(attempt,0),max=recoveryRetryDelay(attempt,1);
 assert.ok(min>=4800&&max<=36000&&min<=max,'retry intervals bounded');
}
assert.ok(recoveryRetryDelay(0,0.5)<recoveryRetryDelay(1,0.5));
assert.equal(recoveryRetryDelay(100,0.5),30000,'retries do not grow without bound');
assert.equal(recoveryRetryDelay(-2,0.5),6000,'negative attempts are clamped');
console.log('PASS safe sequential readiness/auth bootstrap, transient session 503 preservation, bounded retry jitter');
