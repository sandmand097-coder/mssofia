import jwt from 'jsonwebtoken';
import {OAuth2Client} from 'google-auth-library';

const normalized=value=>typeof value==='string'?value.trim().toLowerCase():'';
const trustedIssuers=new Set(['https://accounts.google.com','accounts.google.com']);

export function googleAdminConfig(env=process.env){
 const clientId=String(env.GOOGLE_OAUTH_CLIENT_ID||'').trim();
 const email=normalized(env.GOOGLE_ADMIN_EMAIL);
 const origin=String(env.APP_ORIGIN||'').trim();
 return {
  enabled:env.GOOGLE_ADMIN_LOGIN_ENABLED==='true'
   && /^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/.test(clientId)
   && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
   && (env.NODE_ENV!=='production'||origin.startsWith('https://')),
  clientId,email
 };
}

export function eligibleGoogleAdmin(payload,user,approvedEmail){
 if(!payload||!user||typeof payload.sub!=='string'||!payload.sub||!trustedIssuers.has(payload.iss))return false;
 if(payload.email_verified!==true)return false;
 const email=normalized(payload.email),allowed=normalized(approvedEmail);
 if(!email||email!==allowed||normalized(user.email)!==email)return false;
 if(user.role!=='admin'||user.status!=='active')return false;
 if(user.google_sub&&user.google_sub!==payload.sub)return false;
 return true;
}

export function attachGoogleAdminAuth(app,{get,run,now,publicUser,secret,limiter}){
 const verifier=new OAuth2Client();
 app.get('/api/auth/google/config',(req,res)=>{
  const settings=googleAdminConfig();
  return res.json({enabled:settings.enabled,...(settings.enabled?{clientId:settings.clientId}:{})});
 });
 app.post('/api/auth/google/login',limiter,async(req,res)=>{
  const config=googleAdminConfig();
  if(!config.enabled)return res.status(503).json({error:'تسجيل الدخول باستخدام Google غير مُفعّل حتى الآن'});
  const credential=req.body?.credential;
  if(typeof credential!=='string'||credential.length<100||credential.length>12000)return res.status(400).json({error:'استجابة Google غير صالحة'});
  try{
   const ticket=await verifier.verifyIdToken({idToken:credential,audience:config.clientId});
   const profile=ticket.getPayload();
   if(!profile||normalized(profile.email)!==config.email||profile.email_verified!==true||!trustedIssuers.has(profile.iss)){
    return res.status(403).json({error:'هذا الحساب غير مصرح له بإدارة المدرسة'});
   }
   const user=await get('SELECT * FROM users WHERE email=?',config.email);
   if(!eligibleGoogleAdmin(profile,user,config.email)){
    return res.status(403).json({error:'حساب الإدارة غير معتمد لهذا البريد. تواصل مع مسؤول المدرسة'});
   }
   // Bind the verified, immutable Google subject to a PRE-EXISTING admin record.
   // A Gmail address by itself can never create or elevate any administrator.
   const binding=await run('UPDATE users SET google_sub=?,email_verified_at=COALESCE(email_verified_at,?) WHERE id=? AND (google_sub IS NULL OR google_sub=?)',profile.sub,now(),user.id,profile.sub);
   if(!binding.changes)return res.status(403).json({error:'هذا الحساب مرتبط بهوية Google مختلفة'});
   const token=jwt.sign({sub:user.id,role:'admin',version:user.session_version||0},secret,{algorithm:'HS256',expiresIn:'7d'});
   res.cookie('session',token,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:7*24*3600*1000,path:'/'});
   return res.json({user:publicUser({...user,email_verified_at:user.email_verified_at||now(),google_sub:profile.sub})});
  }catch(error){
   // Never log the Google credential, access tokens, personal information or external response.
   console.warn('Google admin authentication rejected:',error?.name||'verification_failed');
   return res.status(401).json({error:'تعذر تأكيد تسجيل الدخول عبر Google. حاول مرة أخرى'});
  }
 });
}
