// Per-process admission backpressure. This is not a LiveKit concurrency quota.
// Reserve a small fast lane for instructors during simultaneous student logins.
const bounded=(value,fallback,max)=>{const n=Number(value);return Number.isSafeInteger(n)&&n>0?Math.min(max,n):fallback};
export function createLiveAdmission({studentLimit=14,totalLimit=20}={}){
 const studentsMax=bounded(studentLimit,14,64);
 const allMax=Math.max(studentsMax+1,bounded(totalLimit,20,72));
 let active=0,activeStudents=0,accepted=0,throttled=0,peak=0;
 const middleware=(req,res,next)=>{
  const host=req.user?.role==='admin'||req.user?.role==='teacher';
  if(active>=allMax||(!host&&activeStudents>=studentsMax)){
   throttled++;
   res.set('Retry-After','2');
   res.set('Cache-Control','no-store');
   return res.status(503).json({
    code:'CLASSROOM_BUSY',
    error:'هناك ضغط مؤقت على دخول الحصة؛ سيحاول الموقع إعادة الاتصال تلقائيًا.',
    retryAfterSeconds:2
   });
  }
  active++;if(!host)activeStudents++;accepted++;peak=Math.max(peak,active);
  let released=false;
  const release=()=>{if(released)return;released=true;active=Math.max(0,active-1);if(!host)activeStudents=Math.max(0,activeStudents-1)};
  res.once('finish',release);res.once('close',release);
  next();
 };
 return{middleware,snapshot:()=>({
  scope:'this-server-instance',active,activeStudents,peak,accepted,throttled,
  studentLimit:studentsMax,totalLimit:allMax,
  note:'This limits simultaneous token issuance only; LiveKit billing and participant quotas are separate.'
 })};
}
