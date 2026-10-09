// Default production mode remains the full authenticated API requiring a persistent database.
// Explicit preview mode serves public marketing without exposing broken sign-in flows.
if(process.env.NODE_ENV==='production'&&process.env.PUBLIC_LAUNCH_MODE==='preview'){
 await import('./public-preview.js');
}else{
 await import('./index.js');
}
