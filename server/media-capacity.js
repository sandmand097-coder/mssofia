// Transparent planning numbers, NOT a LiveKit quota lookup and NOT a WebRTC
// stress-test result. Audio, signaling, TURN relay, retries and simulcast add
// network overhead; monitor real media metrics before choosing a provider.
const integer=(name,value,min,max)=>{
 if(!Number.isSafeInteger(value)||value<min||value>max)throw RangeError(name+' must be an integer from '+min+' to '+max);
 return value;
};
const rounded=(value,places=2)=>Number(value.toFixed(places));
export function estimateClassroomCapacity({
 students=50,lessonMinutes=120,videoKbps=1200,classesPerMonth=1,
 participantMinuteAllowance=null
}={}){
 const viewers=integer('students',students,1,500);
 const minutes=integer('lessonMinutes',lessonMinutes,15,240);
 const kbps=integer('videoKbps',videoKbps,100,5000);
 const sessions=integer('classesPerMonth',classesPerMonth,1,150);
 const allowance=participantMinuteAllowance===null?null:integer('participantMinuteAllowance',participantMinuteAllowance,1,1e10);
 const participantMinutes=(viewers+1)*minutes;
 // Decimal GB, assuming every viewer continuously receives just one camera
 // track at the nominated nominal bitrate for the ENTIRE class.
 const downstreamMbps=viewers*kbps/1000;
 const transferGB=downstreamMbps*1000000*(minutes*60)/8/1e9;
 return{
  participants: viewers+1,
  viewers,
  minutesPerClass:minutes,
  classesPerMonth:sessions,
  estimatedViewerVideoKbps:kbps,
  participantMinutesPerClass:participantMinutes,
  participantMinutesPerMonth:participantMinutes*sessions,
  nominalServerDownstreamMbps:rounded(downstreamMbps),
  nominalVideoTransferGBPerClass:rounded(transferGB),
  nominalVideoTransferGBPerMonth:rounded(transferGB*sessions),
  allowanceMinutes:allowance,
  allowanceSufficient:allowance===null?null:participantMinutes*sessions<=allowance,
  disclaimer:'Planning only. Excludes audio, signaling, transport/TURN overhead, bitrate adaptation, additional student publishers, storage and real-world failures. No provider quota or actual live test was checked.'
 };
}
