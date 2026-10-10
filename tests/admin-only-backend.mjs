import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=mkdtempSync(path.join(os.tmpdir(),'mrsofia-admin-only-'));
process.env.MADRASATI_DB_PATH=path.join(dir,'school.sqlite');
const {db,run,uid,now}=await import('../server/db.js');
const pass=randomBytes(16).toString('hex'),hash=bcrypt.hashSync(pass,10);
const add=(role)=>{const id=uid();run('INSERT INTO users(id,name,email,password_hash,role,status,created_at) VALUES(?,?,?,?,?,?,?)',id,role,role+'@test.local',hash,role,'active',now());return id;};
const admin=add('admin'),student=add('student');
db.close();
const port=await new Promise((resolve,reject)=>{const srv=net.createServer();srv.once('error',reject);srv.listen(0,'127.0.0.1',()=>{const value=srv.address().port;srv.close(()=>resolve(value))})});
const origin='http://127.0.0.1:'+port;
const secret=randomBytes(55).toString('hex');
const app=spawn(process.execPath,['server/index.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:String(port),NODE_ENV:'test',DATABASE_URL:'',PUBLIC_LAUNCH_MODE:'admin',APP_ORIGIN:origin,JWT_SECRET:secret,LIVEKIT_URL:'',LIVEKIT_API_KEY:'',LIVEKIT_API_SECRET:''}});
let logs='';
app.stderr.on('data',chunk=>{logs+=String(chunk)});
const cookieFor=(id,role)=>'session='+jwt.sign({sub:id,role,version:0},secret,{algorithm:'HS256',expiresIn:'15m'});
async function call(pathname,{method='GET',cookie,body}={}){
 const response=await fetch(origin+pathname,{method,headers:{...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 return{status:response.status,data:await response.json().catch(()=>({}))};
}
try {
 let started=false;
 for(let i=0;i<90;i++){if(app.exitCode!==null)throw Error('Backend exited unexpectedly: '+logs);try{if((await call('/api/health')).status===200){started=true;break}}catch{}await new Promise(r=>setTimeout(r,120))}
 assert.ok(started,'server running');
 const adminCookie=cookieFor(admin,'admin'),studentCookie=cookieFor(student,'student');
 assert.equal((await call('/api/health')).data.mode,'admin');
 assert.equal((await call('/api/auth/registration-status')).data.registrationAvailable,false);
 assert.equal((await call('/api/auth/register',{method:'POST',body:{name:'Student'}})).status,503);
 assert.equal((await call('/api/auth/login',{method:'POST',body:{email:'admin@test.local',password:pass}})).status,503);
 assert.equal((await call('/api/auth/login',{method:'POST',body:{email:'student@test.local',password:pass}})).status,503);
 assert.equal((await call('/api/auth/me')).status,401);
 assert.equal((await call('/api/auth/me',{cookie:studentCookie})).status,403);
 assert.equal((await call('/api/auth/me',{cookie:adminCookie})).status,200);
 assert.equal((await call('/api/admin/dashboard',{cookie:studentCookie})).status,403);
 assert.equal((await call('/api/admin/dashboard',{cookie:adminCookie})).status,200);
 assert.equal((await call('/api/courses')).status,401);
 assert.equal((await call('/api/courses',{cookie:adminCookie})).status,200);
 assert.equal((await call('/payment-review?token=not-real')).status,503);
 assert.equal((await call('/api/admin/payments/test/review',{method:'POST',cookie:adminCookie,body:{decision:'approved',confirmedOnPhone:true}})).status,503,'admin cannot approve payments before financial release');
 const created=await call('/api/courses',{method:'POST',cookie:adminCookie,body:{title:'علوم التجربة',description:'برنامج علمي للاختبار',subject:'علوم',level:'الابتدائي',price:170,capacity:10,duration_minutes:60,teacher_id:admin}});
 assert.equal(created.status,201,'administrator can prepare course while registration is closed');
 assert.equal((await call('/api/courses/'+created.data.id+'/book',{method:'POST',cookie:studentCookie,body:{}})).status,403);
 console.log('PASS 15 isolated administrator-only backend checks');
}finally{
 app.kill();
 await Promise.race([new Promise(r=>app.once('exit',r)),new Promise(r=>setTimeout(r,4000))]);
 rmSync(dir,{recursive:true,force:true});
}
