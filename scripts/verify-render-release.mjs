// Safe release gate: read-only GETs, no login cookies, no customer data.
const ORIGIN='https://mssofia.onrender.com';
export async function verifyRenderRelease({sha,fetchImpl=fetch,origin=ORIGIN,attempts=3,pause=async(ms)=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 if(!/^[a-f0-9]{40}$/i.test(String(sha||'')))return{ok:false,reason:'invalid-expected-sha'};
 for(let i=0;i<attempts;i++){
  try{
   const release=await fetchImpl(origin+'/api/release',{
    method:'GET',headers:{accept:'application/json','cache-control':'no-store'},
    signal:AbortSignal.timeout(33000),redirect:'error'
   });
   if(release.ok){
    const identity=await release.json();
    if(identity?.commit!==sha)return{ok:false,reason:'render-commit-mismatch'};
    const ready=await fetchImpl(origin+'/api/ready',{
     method:'GET',headers:{accept:'application/json','cache-control':'no-store'},
     signal:AbortSignal.timeout(12000),redirect:'error'
    });
    if(ready.ok&&(await ready.json())?.ok===true)return{ok:true,reason:'ready'};
   }
  }catch{/* Free Render cold start can exceed the first read-only attempt. */}
  if(i<attempts-1)await pause(3500);
 }
 return{ok:false,reason:'render-unavailable-or-db-unready'};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const result=await verifyRenderRelease({sha:process.env.EXPECTED_RENDER_SHA});
 if(!result.ok){
  console.error('BLOCKED Cloudflare production publication: '+result.reason);
  process.exitCode=1;
 }else console.log('PASS: Render commit and PostgreSQL readiness match the audited frontend');
}
