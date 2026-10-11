// Standalone production check, safe in CI and before a live lesson.
// Exits 1 on persistent outages/access-control regressions, with no PII,
// cookies, tokens, enrollment data, payment submissions or LiveKit minutes.
import {checkProductionRisk} from './production-risk-probe.mjs';

const origin=process.env.SITE_ORIGIN||'https://mssofia.pages.dev';
const expectedMode=process.env.EXPECTED_LAUNCH_MODE||'full';
try{
 const report=await checkProductionRisk({origin,expectedMode});
 for(const item of report.results){
  const prefix=item.ok?'PASS':'FAIL';
  console.log(prefix+' '+item.path+' status='+(item.status??'network')+
   ' attempts='+item.attempts+' code='+item.code);
  if(item.ok&&item.attempts>1)console.log('::warning::A transient read-only outage recovered at '+item.path);
  if(!item.ok)console.error('::error::Read-only site check failed: '+item.path+' code='+item.code);
 }
 console.log('SUMMARY passed='+report.passed+'/'+report.total+
  ' recovered='+report.transientRecoveries+
  ' failures='+report.failures+' expectedMode='+report.expectedMode);
 console.log('NOTE: This cannot certify signed-in class attendance, backup restore, private storage permissions or successful payments.');
 if(!report.ok)process.exitCode=1;
}catch{
 console.error('::error::Risk probe could not complete; check the origin and CI configuration.');
 process.exitCode=1;
}
