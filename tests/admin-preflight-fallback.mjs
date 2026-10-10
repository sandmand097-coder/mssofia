import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';

const freePort=()=>new Promise((resolve,reject)=>{
 const socket=net.createServer();
 socket.once('error',reject);
 socket.listen(0,'127.0.0.1',()=>{
  const port=socket.address().port;
  socket.close(()=>resolve(port));
 });
});
const port=await freePort();
const env={
 ...process.env,
 PORT:String(port),NODE_ENV:'production',PUBLIC_LAUNCH_MODE:'admin',
 DATABASE_URL:'postgresql://mssofia_backend.wnkewiulyobbjftckfqb:YOUR_RANDOM_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres',
 JWT_SECRET:'a'.repeat(96),GOOGLE_ADMIN_LOGIN_ENABLED:'true',
 GOOGLE_OAUTH_CLIENT_ID:'12345-test.apps.googleusercontent.com',
 GOOGLE_ADMIN_EMAIL:'sandmand097@gmail.com',APP_ORIGIN:'https://mssofia.pages.dev',
 REGISTRATION_ENABLED:'false',LIVEKIT_URL:'',LIVEKIT_API_KEY:'',LIVEKIT_API_SECRET:''
};
const processRun=spawn(process.execPath,['server/start.js'],{env,windowsHide:true});
let error='';
processRun.stderr.on('data',x=>{error+=String(x).slice(0,700)});
let result;
try{
 for(let i=0;i<50;i++){
  if(processRun.exitCode!==null)throw Error('Fallback failed to start: '+error.slice(0,200));
  try{
   const response=await fetch('http://127.0.0.1:'+port+'/api/health');
   if(response.ok){result=await response.json();break}
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.ok(result,'fallback HTTP endpoint never became available');
 assert.equal(result.mode,'preview');
 assert.equal(result.registrationAvailable,false);
 const disabled=await fetch('http://127.0.0.1:'+port+'/api/auth/google/config');
 assert.equal(disabled.status,503);
 console.log('PASS production admin mode safely falls back to preview on missing DB credential');
}finally{
 processRun.kill();
 await Promise.race([new Promise(resolve=>processRun.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,1500))]);
}
