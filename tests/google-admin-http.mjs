import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const isolated=mkdtempSync(path.join(tmpdir(),'mrsofia-google-noadmin-'));
const port=await new Promise((resolve,reject)=>{
 const s=net.createServer();
 s.once('error',reject);
 s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>resolve(n))});
});
const base='http://127.0.0.1:'+port;
const processApp=spawn(process.execPath,['server/index.js'],{
 cwd:root,windowsHide:true,
 env:{...process.env,NODE_ENV:'test',PUBLIC_LAUNCH_MODE:'',DATABASE_URL:'',
  PORT:String(port),MADRASATI_DB_PATH:path.join(isolated,'test.sqlite'),
  JWT_SECRET:randomBytes(64).toString('hex'),APP_ORIGIN:base,
  LIVEKIT_URL:'',LIVEKIT_API_KEY:'',LIVEKIT_API_SECRET:'',
  GOOGLE_ADMIN_LOGIN_ENABLED:'false',
  GOOGLE_OAUTH_CLIENT_ID:'12345-test.apps.googleusercontent.com',
  GOOGLE_ADMIN_EMAIL:'director@example.com'}
});
let stderr='';processApp.stderr.on('data',c=>stderr+=String(c));
const wait=ms=>new Promise(done=>setTimeout(done,ms));
try{
 let ready=false;
 for(let i=0;i<80;i++){
  if(processApp.exitCode!==null)throw Error('Server exited before health check');
  try{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(300)});if(r.ok){ready=true;break}}catch{}
  await wait(100);
 }
 assert.ok(ready,'isolated school API started');
 const cfg=await fetch(base+'/api/auth/google/config');
 assert.equal(cfg.status,200);
 const value=await cfg.json();
 assert.deepEqual(value,{enabled:false},'disabled Google login does not expose a client ID');
 const attempt=await fetch(base+'/api/auth/google/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential:'fake'})});
 assert.equal(attempt.status,503,'disabled Google login fails closed');
 const logged=await fetch(base+'/api/auth/me');
 assert.equal(logged.status,401,'unauthenticated caller receives no admin session');
 const {DatabaseSync}=await import('node:sqlite');
 const db=new DatabaseSync(path.join(isolated,'test.sqlite'),{readOnly:true});
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get().n,0,'Google endpoints never self-provision an admin');
 db.close();
 console.log('PASS isolated Google HTTP: flag, client concealment, no session, no admin creation');
}finally{
 processApp.kill();
 await Promise.race([new Promise(done=>processApp.once('exit',done)),wait(4000)]);
 try{rmSync(isolated,{recursive:true,force:true})}catch{}
}
