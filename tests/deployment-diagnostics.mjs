import assert from 'node:assert/strict';
import {testProductionConnections,verifyPrivateStorage,createDiagnosticReader} from '../server/deployment-diagnostics.js';

const env={
 NODE_ENV:'production',PUBLIC_LAUNCH_MODE:'admin',
 APP_ORIGIN:'https://mssofia.pages.dev',
 DATABASE_URL:'postgresql://local.example/test',
 GOOGLE_ADMIN_EMAIL:'director@example.com',
 GOOGLE_ADMIN_LOGIN_ENABLED:'true',
 GOOGLE_OAUTH_CLIENT_ID:'12345.apps.googleusercontent.com',
 REGISTRATION_ENABLED:'false',SCHOOL_PRIVACY_APPROVED:'false',
 SUPABASE_URL:'https://wnkewiulyobbjftckfqb.supabase.co',
 SUPABASE_SERVICE_ROLE_KEY:'mock-secret-do-not-print',
 LIVEKIT_URL:'wss://school.livekit.cloud',
 LIVEKIT_API_KEY:'mock-key',LIVEKIT_API_SECRET:'mock-value',
 VODAFONE_CASH_NUMBER:'01012345678'
};
let bucketRequests=0,dbCalls=0,roomCalls=0;
const request=async(url,{method,headers,signal}={})=>{
 bucketRequests++;
 assert.equal(url,'https://wnkewiulyobbjftckfqb.supabase.co/storage/v1/bucket/mrsofia-payment-proofs');
 assert.equal(method,'GET');
 assert.ok(headers.apikey&&headers.Authorization);
 assert.ok(signal);
 return{ok:true,json:async()=>({id:'mrsofia-payment-proofs',name:'mrsofia-payment-proofs',public:false})};
};
const options={
 env,
 request,
 checkDatabase:async()=>{dbCalls++;return true},
 roomService:{listRooms:async()=>{roomCalls++;return []}}
};
const healthy=await testProductionConnections(options);
assert.equal(healthy.databaseConnected,true);
assert.equal(healthy.livekitApiVerified,true);
assert.equal(healthy.receiptBucketPrivateVerified,true);
assert.equal(healthy.guardianRegistrationAllowed,false);
assert.equal(healthy.mailDeliveryTested,false);
assert.equal(healthy.mediaTwoDeviceTested,false);
assert.equal(healthy.paymentVerifiedManually,false);
assert.equal(bucketRequests,1);
assert.equal(dbCalls,1);
assert.equal(roomCalls,1);
assert.ok(!JSON.stringify(healthy).includes('mock-secret-do-not-print'));
assert.ok(!JSON.stringify(healthy).includes('01012345678'));
assert.ok(!JSON.stringify(healthy).includes('director@example.com'));
const wrongProject=await verifyPrivateStorage({...env,SUPABASE_URL:'https://jtluslevdmcpxxkngomj.supabase.co'},()=>{throw Error('Wrong project should be denied before fetching')});
assert.equal(wrongProject,false);
const publicBucket=await verifyPrivateStorage(env,async()=>({ok:true,json:async()=>({id:'mrsofia-payment-proofs',name:'mrsofia-payment-proofs',public:true})}));
assert.equal(publicBucket,false,'a public receipt bucket never passes');
const missing=await testProductionConnections({
 env:{...env,SUPABASE_SERVICE_ROLE_KEY:'',LIVEKIT_API_SECRET:''},
 checkDatabase:async()=>{throw Error('database password leaked if logged')},
 request:async()=>{throw Error('storage secret leaked')},
 roomService:{listRooms:async()=>{throw Error('LiveKit secret leaked')}}
});
assert.equal(missing.databaseConnected,false);
assert.equal(missing.livekitApiVerified,false);
assert.equal(missing.receiptBucketPrivateVerified,false);
assert.equal(missing.mailDeliveryTested,false);
assert.ok(!JSON.stringify(missing).includes('password leaked'));
let calls=0;
const read=createDiagnosticReader({...options,checkDatabase:async()=>{calls++;return true}},{cacheMs:60000});
const [first,second]=await Promise.all([read(),read()]);
assert.deepEqual(first,second);
await read();
assert.equal(calls,1,'cache and concurrent requests avoid unnecessary external probes');
console.log('PASS secure runtime verification, payment bucket privacy, no secrets, and rate-friendly cache');
