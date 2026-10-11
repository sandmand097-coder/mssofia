// Read-only planning utility. Does not contact LiveKit, Render or Supabase.
import {estimateClassroomCapacity} from '../server/media-capacity.js';
const args=process.argv.slice(2);
if(args.includes('--help')){
 console.log('Usage: node scripts/classroom-capacity.mjs [students] [lessonMinutes] [videoKbps] [classesPerMonth] [optionalParticipantMinuteAllowance]');
 console.log('Example: node scripts/classroom-capacity.mjs 50 120 1200 8 5000');
 process.exit(0);
}
if(args.length>5){console.error('Expected at most 5 positional arguments');process.exit(2)}
const names=['students','lessonMinutes','videoKbps','classesPerMonth','participantMinuteAllowance'];
const options=Object.fromEntries(args.map((value,i)=>[names[i],Number(value)]));
try{
 const plan=estimateClassroomCapacity(options);
 console.log(JSON.stringify(plan,null,2));
}catch(error){
 console.error('Invalid planning input: '+error.message);
 process.exitCode=2;
}
