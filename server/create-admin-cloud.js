// One-time invitation for the real school director. Requires production DB and a verified email sender.
// No admin password or activation URL is printed in logs or API responses.
import {randomBytes,createHash} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {get,run,uid,now,checkConnection,isCloudDatabase,closeConnection} from './db-adapter.js';
import {sendAccountEmail,mailMode} from './email.js';

const flag=name=>{const i=process.argv.indexOf('--'+name);return i<0?null:process.argv[i+1]};
const email=flag('email')?.trim().toLowerCase(),name=flag('name')||'Mrs Sofia — مدرسة العلوم';
if(process.argv.includes('--confirm')===false)throw Error('Requires --confirm to create a school administrator');
if(!isCloudDatabase)throw Error('Cloud admin creation requires DATABASE_URL and persistent PostgreSQL');
if(mailMode()!=='provider')throw Error('Configure verified MAIL_FROM and Resend/SMTP before inviting the school admin');
if(!process.env.APP_ORIGIN?.startsWith('https://'))throw Error('Configure a public HTTPS APP_ORIGIN before inviting the administrator');
if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||/\.(local|invalid)$/.test(email))throw Error('Use the real school director email with --email');
try{
 await checkConnection();
 const existing=await get('SELECT id,role FROM users WHERE email=?',email);
 if(existing)throw Error('Account already exists. Contact support rather than overwriting an existing account.');
 const id=uid(),token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex');
 await run('INSERT INTO users(id,name,email,password_hash,role,status,specialty,created_at,email_verified_at,session_version) VALUES(?,?,?,?,?,?,?,?,?,?)',id,name,email,await bcrypt.hash(randomBytes(48).toString('hex'),12),'admin','active','العلوم',now(),null,0);
 await run('INSERT INTO auth_tokens(id,user_id,token_hash,purpose,expires_at,created_at) VALUES(?,?,?,?,?,?)',uid(),id,hash,'reset_password',new Date(Date.now()+20*60000).toISOString(),now());
 await sendAccountEmail({to:email,kind:'school-admin-invitation',subject:'دعوة مديرة مدرسة Mrs Sofia',text:'هذه رسالة دعوة شخصية لحساب مديرة المدرسة. افتحي الرابط واضبطي كلمة المرور خلال 20 دقيقة.',url:process.env.APP_ORIGIN+'/reset-password?token='+token});
 console.log('INVITATION_SENT=true');
 console.log('ADMIN_EMAIL='+email);
 console.log('PASSWORD_NOT_EXPOSED=true');
}catch(error){console.error('Admin invite failed:',error.message);process.exitCode=1}
finally{await closeConnection()}
