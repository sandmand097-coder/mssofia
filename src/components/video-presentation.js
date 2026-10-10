// Use the actual media dimensions rather than guessing the teacher's device.
// WebRTC video may change between portrait phone, landscape laptop and screen share.
export function videoPresentation(width,height){
 const w=Number(width),h=Number(height);
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)
  return {orientation:'landscape',ratio:16/9};
 const ratio=Math.max(0.3,Math.min(3.5,w/h));
 return {orientation:ratio<0.92?'portrait':ratio<=1.12?'square':'landscape',ratio:Number(ratio.toFixed(5))};
}
