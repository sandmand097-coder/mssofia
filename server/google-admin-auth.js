import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {randomBytes} from 'node:crypto';
import {OAuth2Client} from 'google-auth-library';

const normalized=value=>typeof value==='string'?value.trim().toLowerCase():'';
const trustedIssuers=new Set(['https://accounts.google.com','accounts.google.com']);
const isValidClientId=id=>/^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/.test(id||'');
const validParentProfile=profile=>Boolean(profile&&trustedIssuers.has(profile.iss)&&profile.email_verified===true
 &&typeof profile.sub==='string'&&profile.sub.length>0
 &&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized(profile.email)));

export function googleAdminConfig(env=process.env){
 const clientId=String(env.GOOGLE_OAUTH_CLIENT_ID||'').trim();
 const email=normalized(env.GOOGLE_ADMIN_EMAIL);
 const origin=String(env.APP_ORIGIN||'').trim();
 return{
  enabled:env.GOOGLE_ADMIN_LOGIN_ENABLED==='true'
   &&isValidClientId(clientId)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
   &&(env.NODE_ENV!=='production'||origin.startsWith('https://')),
  clientId,email
 };
}

// Student accounts are managed by the holder of the verified guardian Google
// account. Enabling student Google sign-in alone NEVER enables sign-up.
export function googleStudentConfig(env=process.env){
 const clientId=String(env.GOOGLE_OAUTH_CLIENT_ID||'').trim();
 const origin=String(env.APP_ORIGIN||'').trim();
 const enabled=env.GOOGLE_STUDENT_LOGIN_ENABLED==='true'
  &&env.PUBLIC_LAUNCH_MODE==='full'
  &&isValidClientId(clientId)
  &&(env.NODE_ENV!=='production'||origin.startsWith('https://'));
 const registrationEnabled=enabled&&env.REGISTRATION_ENABLED==='true'
  &&env.SCHOOL_PRIVACY_APPROVED==='true'
  &&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.SCHOOL_CONTACT_EMAIL||'');
 return{enabled,registrationEnabled,clientId};
}

export function eligibleGoogleAdmin(payload,user,approvedEmail){
 if(!validParentProfile(payload)||!user)return false;
 const email=normalized(payload.email),allowed=normalized(approvedEmail);
 if(!email||email!==allowed||normalized(user.email)!==email)return false;
 if(user.role!=='admin'||user.status!=='active')return false;
 if(user.google_sub&&user.google_sub!==payload.sub)return false;
 return true;
}

export function eligibleGoogleStudent(payload,user){
 if(!validParentProfile(payload)||!user)return false;
 const email=normalized(payload.email);
 // The parent's Google email is the account email. Never bind someone else's
 // email or permit a student identity to inherit teacher/administrator rights.
 return user.role==='student'&&user.status==='active'&&normalized(user.email)===email
  &&normalized(user.guardian_email)===email
  &&Boolean(user.guardian_consent_at&&user.email_verified_at)
  &&(!user.google_sub||user.google_sub===payload.sub);
}

export async function resolveGoogleStudent(profile,input,{get,run,uid,now,env=process.env}){
 const flags=googleStudentConfig(env);
 if(!flags.enabled)return{status:503,error:'دخول ولي الأمر عبر Google لم يُفعّل بعد'};
 if(!validParentProfile(profile))return{status:403,error:'يجب استخدام بريد ولي الأمر المؤكد عبر Google'};
 const email=normalized(profile.email);
 if(email===normalized(env.GOOGLE_ADMIN_EMAIL))return{status:403,error:'استخدم حساب الإدارة من صفحة دخول المديرة'};
 let user=await get('SELECT * FROM users WHERE email=?',email);
 if(!user){
  if(!flags.registrationEnabled)return{status:503,error:'تسجيل حسابات الطلاب غير متاح حتى تعتمد المدرسة سياسة الخصوصية'};
  const name=typeof input?.student_name==='string'?input.student_name.trim():'';
  if(input?.register_student!==true||input?.guardian_consent!==true||name.length<2||name.length>80)
   return{status:400,error:'اكتب اسم الطالب وأكد أنك ولي أمره وتوافق على شروط التسجيل'};
  // Even a disabled password is stored as a strong hash; no known password
  // exists for accounts created using Google.
  const passwordHash=await bcrypt.hash(randomBytes(48).toString('hex'),12);
  await run('INSERT OR IGNORE INTO users(id,name,email,password_hash,role,status,specialty,created_at,guardian_email,guardian_consent_at,email_verified_at,google_sub) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
   uid(),name,email,passwordHash,'student','active','',now(),email,now(),now(),profile.sub);
  user=await get('SELECT * FROM users WHERE email=?',email);
 }
 if(!eligibleGoogleStudent(profile,user)){
  return{status:403,error:'هذا البريد مرتبط بحساب آخر أو لم تُستكمل موافقة ولي الأمر. تواصل مع المدرسة'};
 }
 // Identity subject is immutable on this record. A verified email match alone
 // can never replace a previously bound Google account.
 const bound=await run('UPDATE users SET google_sub=? WHERE id=? AND (google_sub IS NULL OR google_sub=?)',
  profile.sub,user.id,profile.sub);
 if(!bound.changes)return{status:403,error:'هوية Google مختلفة عن الحساب المرتبط سابقًا'};
 return{status:200,user:{...user,google_sub:profile.sub}};
}

export function attachGoogleAdminAuth(app,{get,run,uid,now,publicUser,secret,limiter}){
 const verifier=new OAuth2Client();
 app.get('/api/auth/google/config',(req,res)=>{
  const admin=googleAdminConfig(),student=googleStudentConfig();
  if(!admin.enabled&&!student.enabled)return res.json({enabled:false});
  return res.json({
   enabled:true,clientId:admin.enabled?admin.clientId:student.clientId,
   studentEnabled:student.enabled,studentRegistrationAvailable:student.registrationEnabled
  });
 });
 app.post('/api/auth/google/login',limiter,async(req,res)=>{
  const admin=googleAdminConfig(),student=googleStudentConfig();
  if(!admin.enabled&&!student.enabled)return res.status(503).json({error:'تسجيل الدخول باستخدام Google غير مُفعّل حتى الآن'});
  const credential=req.body?.credential;
  if(typeof credential!=='string'||credential.length<100||credential.length>12000)
   return res.status(400).json({error:'استجابة Google غير صالحة'});
  try{
   const ticket=await verifier.verifyIdToken({idToken:credential,audience:admin.enabled?admin.clientId:student.clientId});
   const profile=ticket.getPayload();
   if(!validParentProfile(profile))
    return res.status(403).json({error:'هذا البريد لم يتم التحقق منه عبر Google'});
   let user;
   if(normalized(profile.email)===admin.email){
    if(!admin.enabled||req.body?.register_student===true)return res.status(403).json({error:'حساب الإدارة لا يمكن تسجيله كطالب'});
    user=await get('SELECT * FROM users WHERE email=?',admin.email);
    if(!eligibleGoogleAdmin(profile,user,admin.email))
     return res.status(403).json({error:'هذا الحساب غير مصرح له بإدارة المدرسة'});
    const binding=await run('UPDATE users SET google_sub=?,email_verified_at=COALESCE(email_verified_at,?) WHERE id=? AND (google_sub IS NULL OR google_sub=?)',
     profile.sub,now(),user.id,profile.sub);
    if(!binding.changes)return res.status(403).json({error:'هوية Google غير متطابقة مع المديرة'});
   }else{
    const result=await resolveGoogleStudent(profile,req.body,{get,run,uid,now});
    if(result.error)return res.status(result.status).json({error:result.error});
    user=result.user;
   }
   const token=jwt.sign({sub:user.id,role:user.role,version:user.session_version||0},secret,{algorithm:'HS256',expiresIn:'7d'});
   res.cookie('session',token,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:7*24*3600*1000,path:'/'});
   return res.json({user:publicUser(user)});
  }catch(error){
   // Never log Google credentials, Google subject IDs or session tokens.
   console.warn('Google school authentication rejected:',error?.name||'verification_failed');
   return res.status(401).json({error:'تعذر تأكيد تسجيل الدخول عبر Google. حاول مرة أخرى'});
  }
 });
}
