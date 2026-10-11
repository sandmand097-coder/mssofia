// Deploy as a SEPARATE Cloudflare Worker (not a Pages Function).
// Running this file locally/committing it creates NO production scheduler.
// Secret: wrangler secret put NOTIFICATION_CRON_SECRET.
// Required Worker var: NOTIFICATION_TICK_URL should target trusted API backend.
const APPROVED_TICKS=new Set([
 'https://api.mssofia.com/api/internal/notifications/tick',
 'https://mssofia.onrender.com/api/internal/notifications/tick'
]);
export default{
 async scheduled(controller,env,ctx){
  const endpoint=env.NOTIFICATION_TICK_URL;
  if(!APPROVED_TICKS.has(endpoint)||!env.NOTIFICATION_CRON_SECRET||env.NOTIFICATION_CRON_SECRET.length<40){
   console.error('Miss Sofia notifications cron not configured');
   return;
  }
  ctx.waitUntil((async()=>{
   try{
    const response=await fetch(endpoint,{
     method:'POST',
     signal:AbortSignal.timeout(45000),
     headers:{Authorization:'Bearer '+env.NOTIFICATION_CRON_SECRET,'Content-Type':'application/json'},
     body:'{}'
    });
    if(!response.ok)console.error('Miss Sofia notification tick failed: HTTP '+response.status);
   }catch{console.error('Miss Sofia notification tick unavailable')}
  })());
 }
};
