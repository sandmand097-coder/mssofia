// Safe, user-initiated broadcaster device preflight. The tracks are NEVER
// published; test permissions separately and release the tracks immediately.
export async function inspectPresenterDevices(mediaDevices){
 const result={supported:typeof mediaDevices?.getUserMedia==='function',microphone:false,camera:false};
 if(!result.supported)return result;
 for(const [field,kind,constraints] of [
  ['microphone','audio',{audio:true,video:false}],
  ['camera','video',{audio:false,video:true}]
 ]){
  let stream;
  try{
   stream=await mediaDevices.getUserMedia(constraints);
   result[field]=Boolean(stream?.getTracks?.().some(track=>track?.kind===kind&&track.readyState!=='ended'));
  }catch{/* A denied or missing device is an individual failure, not a crash. */}
  finally{
   for(const track of stream?.getTracks?.()||[]){
    try{track.stop()}catch{/* Do not retain microphone or camera tracks. */}
   }
  }
 }
 return result;
}

export function presenterPreflightMessage({supported,microphone,camera}){
 if(!supported)return 'المتصفح لا يدعم اختبار الأجهزة. استخدمي رابط HTTPS مع متصفح حديث.';
 if(microphone&&camera)return 'اختبار ناجح: الميكروفون والكاميرا متاحان. أُغلقت الأجهزة بعد الاختبار، ولن يبدأ البث إلا عندما تضغطين بدء البث.';
 if(microphone)return 'الميكروفون يعمل، لكن الكاميرا غير متاحة. يمكنك بدء الحصة بالصوت فقط، أو مراجعة إذن الكاميرا من إعدادات الهاتف.';
 if(camera)return 'الكاميرا تعمل، لكن الميكروفون غير متاح. يمكنك بدء الشرح بالصورة ومراجعة إذن الميكروفون قبل الحصة.';
 return 'تعذر الوصول إلى الميكروفون والكاميرا. تحققي من الأذونات والاتصال الآمن HTTPS، ثم أعيدي الاختبار.';
}

// Sequential rather than concurrent getUserMedia calls improves reliability on
// mobile Safari/Chrome. Still only called after an explicit host click.
export async function enablePresenterMedia(participant,cameraOptions,{audioOnly=false}={}){
 if(!participant||typeof participant.setMicrophoneEnabled!=='function'||typeof participant.setCameraEnabled!=='function')
  throw Error('Invalid presenter device controller');
 const outcome={microphone:false,camera:false};
 try{await participant.setMicrophoneEnabled(true);outcome.microphone=true}catch{}
 if(!audioOnly){
  try{await participant.setCameraEnabled(true,cameraOptions);outcome.camera=true}catch{}
 }
 return outcome;
}
