// Pure, browser-independent choices used by the instructor's phone studio.
// Never request a learner's microphone or camera from these helpers.
export const CAMERA_PRESETS=Object.freeze({
 balanced:{label:'متوازنة HD',resolution:{width:1280,height:720},frameRate:24},
 high:{label:'عالية Full HD',resolution:{width:1920,height:1080},frameRate:30},
 economical:{label:'اقتصادية',resolution:{width:640,height:360},frameRate:20}
});
export function initialCameraQuality({touchscreen=false,saveData=false}={}){
 return touchscreen||saveData?'economical':'balanced';
}
export function nextFacingMode(current){
 return current==='environment'?'user':'environment';
}
export function canShareScreen(devices){
 return typeof devices?.getDisplayMedia==='function';
}
export function cameraCaptureOptions(quality,facingMode='user'){
 const preset=CAMERA_PRESETS[quality]||CAMERA_PRESETS.balanced;
 return {resolution:preset.resolution,frameRate:preset.frameRate,facingMode:facingMode==='environment'?'environment':'user'};
}
export async function restartPublishedCamera(track,options){
 if(typeof track?.restartTrack!=='function')throw Error('Camera track restart unsupported');
 return track.restartTrack(options);
}
