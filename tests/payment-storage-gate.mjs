import assert from 'node:assert/strict';
import {createPaymentStorageGate} from '../server/payment-storage-gate.js';

let configured=false,development=false,verified=false,calls=0,time=100;
const gate=createPaymentStorageGate({
 configured:()=>configured,development:()=>development,
 verify:async()=>{calls++;return verified},
 now:()=>time,ttlMs:60
});
assert.equal(await gate(),false,'no wallet/storage configuration means disabled');
assert.equal(calls,0,'unconfigured site must not probe storage');
configured=true;
assert.equal(await gate(),false,'private receipt storage not verified');
assert.equal(await gate(),false,'failed probe is cached');
assert.equal(calls,1);
verified=true;
assert.equal(await gate(),false,'cannot claim readiness from changing a flag before cache expiry');
time+=61;
assert.equal(await gate(),true,'private receipt bucket verified before taking money');
assert.equal(calls,2);
development=true;
assert.equal(await gate(),true,'isolated test storage is allowed');
development=false;
configured=false;
assert.equal(await gate(),false,'configuration revocation immediately blocks payments even with cache');
configured=true;
time+=61;
let concurrent=0;
const merged=createPaymentStorageGate({
 configured:()=>true,development:()=>false,
 verify:async()=>{concurrent++;await new Promise(r=>setTimeout(r,5));return true}
});
const [x,y,z]=await Promise.all([merged(),merged(),merged()]);
assert.deepEqual([x,y,z],[true,true,true]);
assert.equal(concurrent,1,'concurrent requests share verification');
const broken=createPaymentStorageGate({configured:()=>true,development:()=>false,verify:async()=>{throw Error('secret connection issue')}});
assert.equal(await broken(),false,'storage exceptions fail closed');
console.log('PASS payment only enabled with verified private receipt storage; cached and fail-closed');
