import assert from 'node:assert/strict';
import {checkAvailability} from '../scripts/monitor-production-availability.mjs';
const origins=[{name:'origin',url:'https://example.test/health'},{name:'edge',url:'https://edge.test/health'}];
const payload=(ok,status=200,mode='full')=>new Response(JSON.stringify({ok,mode}),{status,headers:{'content-type':'application/json'}});
let requests=[],delays=[];
const success=await checkAvailability({
 origins,attempts:3,sleep:async ms=>delays.push(ms),
 fetcher:async (url,options)=>{
  requests.push(url);
  assert.equal(options.method,'GET');
  assert.ok(options.signal instanceof AbortSignal);
  if(requests.length<=2)return payload(false,503);
  return payload(true);
 }
});
assert.equal(success.healthy,true);
assert.equal(success.attempts,2);
assert.equal(requests.length,4);
assert.deepEqual(delays,[20000],'wait before retrying an asleep backend');
requests=[];delays=[];
const outage=await checkAvailability({
 origins,attempts:3,pauseMs:1,sleep:async ms=>delays.push(ms),
 fetcher:async()=>payload(false,503)
});
assert.equal(outage.healthy,false);
assert.equal(outage.history.length,3);
assert.equal(requests.length,0);
assert.deepEqual(delays,[1,1]);
const blocked=await checkAvailability({
 origins,attempts:1,fetcher:async()=>payload(true,200,'preview')
});
assert.equal(blocked.healthy,false,'preview status cannot masquerade as production healthy');
const partial=await checkAvailability({
 origins,attempts:1,
 fetcher:async url=>url.includes('edge')?payload(false,503):payload(true)
});
assert.equal(partial.healthy,false,'one failing component is a degraded platform');
const network=await checkAvailability({
 origins,attempts:1,fetcher:async()=>{throw Error('transient network failure')}
});
assert.equal(network.healthy,false);
assert.ok(network.history[0].samples.every(v=>v.reason==='network-error'));
console.log('PASS transient cold-start grace, sustained outage, preview/edge isolation and network failures');
