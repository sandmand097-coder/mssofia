import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
// Hourly, read-only production watchdog. Free Render can sleep between visits:
// allow a bounded wake-up grace period before reporting sustained unavailability.
// NEVER restart production, change enrolments, or store authentication data here.
export const monitoredOrigins=[
 {name:'render-origin',url:'https://mssofia.onrender.com/api/health'},
 {name:'cloudflare-edge',url:'https://mssofia.pages.dev/api/health'}
];
export async function checkAvailability({
 fetcher=globalThis.fetch,
 origins=monitoredOrigins,
 attempts=3,
 timeoutMs=25000,
 pauseMs=20000,
 sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
}={}){
 const history=[];
 for(let attempt=1;attempt<=attempts;attempt++){
  const samples=await Promise.all(origins.map(async target=>{
   const start=Date.now();
   let status=0,ok=false,mode='',reason='';
   try{
    const response=await fetcher(target.url,{method:'GET',headers:{'cache-control':'no-cache'},redirect:'manual',signal:AbortSignal.timeout(timeoutMs)});
    status=response.status;
    if(response.status===200){
     const payload=await response.json();
     mode=typeof payload?.mode==='string'?payload.mode:'';
     ok=payload?.ok===true&&mode==='full';
    }else reason='non-200';
   }catch(error){reason=error?.name==='TimeoutError'?'timeout':'network-error'}
   return {origin:target.name,status,ok,mode,reason,latencyMs:Date.now()-start};
  }));
  history.push({attempt,samples});
  if(samples.every(v=>v.ok))return {healthy:true,attempts:attempt,history};
  if(attempt<attempts)await sleep(pauseMs);
 }
 return {healthy:false,attempts,history};
}
async function main(){
 const report=await checkAvailability();
 for(const round of report.history){
  for(const row of round.samples){
   console.log(JSON.stringify({round:round.attempt,...row}));
  }
 }
 if(!report.healthy){
  console.error('SUSTAINED_OUTAGE: production origin/edge health failed after grace retries');
  process.exitCode=1;
 }else console.log('PASS: frontend proxy and Render recovered within free-plan grace period');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 await main();
}
