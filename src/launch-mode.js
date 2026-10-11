// The browser must never interpret a malformed/failed health response as full
// launch mode. Account and classroom authorization also remains server-side.
export function launchModeFromHealth(health){
 if(health?.ok!==true)return 'offline';
 return ['full','admin','preview'].includes(health.mode)?health.mode:'offline';
}
