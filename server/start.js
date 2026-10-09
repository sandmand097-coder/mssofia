// In production, an incomplete administrator setup must never break the public
// school website or expose a temporary SQLite database to real students.
if(process.env.NODE_ENV==='production'&&process.env.PUBLIC_LAUNCH_MODE==='preview'){
 await import('./public-preview.js');
}else if(process.env.NODE_ENV==='production'&&process.env.PUBLIC_LAUNCH_MODE==='admin'){
 const {adminProductionReady}=await import('./admin-preflight.js');
 if(await adminProductionReady(process.env)){
  await import('./index.js');
 }else{
  console.warn('Mrs Sofia admin connection not ready; safe public preview remains available.');
  await import('./public-preview.js');
 }
}else{
 await import('./index.js');
}
