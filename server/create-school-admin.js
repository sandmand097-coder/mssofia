import {randomBytes} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import {get,run,uid,now} from './db.js';

if(process.env.NODE_ENV==='production')throw Error('Admin creation in production must use the controlled deployment process, not this local bootstrap script.');
const option=name=>{const i=process.argv.indexOf('--'+name);return i>=0?process.argv[i+1]:null};
const email=(option('email')||'admin@mrsofia.local').trim().toLowerCase();
const displayName=option('name')||'Mrs Sofia — مدرسة العلوم';
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Specify a valid admin email using --email');
const current=get('SELECT id,role FROM users WHERE email=?',email);
if(current)throw Error('Admin email already exists. No existing account was changed.');
const password=randomBytes(26).toString('base64url');
const dir=path.join(os.homedir(),'Documents','mrssofia-local-tools');
fs.mkdirSync(dir,{recursive:true});
const filename=path.join(dir,'private-mrsofia-admin-'+Date.now()+'.txt');
const body=['LOCAL DEVELOPMENT ACCOUNT — do not upload publicly','Admin name: '+displayName,'Email: '+email,'Temporary password: '+password,'Login URL: http://127.0.0.1:5173/login','Change email to the teacher\'s actual address before launching.','Created: '+new Date().toISOString()].join('\r\n');
fs.writeFileSync(filename,body,{mode:0o600,flag:'wx'});
try{
 run('INSERT INTO users(id,name,email,password_hash,role,status,specialty,created_at,email_verified_at,session_version) VALUES(?,?,?,?,?,?,?,?,?,?)',uid(),displayName,email,bcrypt.hashSync(password,12),'admin','active','العلوم',now(),now(),0);
}catch(err){fs.rmSync(filename,{force:true});throw err}
console.log('SCHOOL_ADMIN_ACCOUNT_CREATED=true');
console.log('ROLE=admin_and_classroom_host');
console.log('CREDENTIALS_STORED_LOCALLY_AT='+filename);
console.log('NO_PASSWORD_PRINTED=true');
