// In production, administrator auth is enabled only with a tested Supabase
// session pooler login and the preapproved director's database record.
// Public school information must remain online if any dependency is unready.
if(process.env.NODE_ENV==='production'&&process.env.PUBLIC_LAUNCH_MODE==='preview'){
 await import('./public-preview.js');
}else if(process.env.NODE_ENV==='production'&&process.env.PUBLIC_LAUNCH_MODE==='admin'){
 const {adminProductionStatus}=await import('./admin-preflight.js');
 const result=await adminProductionStatus(process.env);
 if(result.ready){
  await import('./index.js');
 }else{
  console.warn('Miss Sofia admin setup pending ('+result.code+'); preserving secure public preview.');
  await import('./public-preview.js');
 }
}else{
 await import('./index.js');
}
