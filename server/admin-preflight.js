import {Pool} from 'pg';

// Backend-only readiness gate. Diagnostics are intentionally non-sensitive.
const PROJECT_REF='jtluslevdmcpxxkngomj';
const DATABASE_ROLE='mssofia_backend';
const CLIENT_ID_PATTERN=/^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/;
const HOST_PATTERN=/^aws-[0-9]+-eu-central-1\.pooler\.supabase\.com$/;

export function adminConfigurationStatus(env) {
 if(env.PUBLIC_LAUNCH_MODE!=='admin')return 'MODE_NOT_ADMIN';
 if(env.REGISTRATION_ENABLED==='true'||env.SCHOOL_PRIVACY_APPROVED==='true')return 'PUBLIC_REGISTRATION_NOT_LOCKED';
 if(env.GOOGLE_ADMIN_LOGIN_ENABLED!=='true'||!CLIENT_ID_PATTERN.test(env.GOOGLE_OAUTH_CLIENT_ID||'')||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.GOOGLE_ADMIN_EMAIL||''))return 'GOOGLE_ADMIN_CONFIG_INCOMPLETE';
 if(env.APP_ORIGIN!=='https://mssofia.pages.dev')return 'APP_ORIGIN_MISMATCH';
 if(!/^[a-fA-F0-9]{64,}$/.test(env.JWT_SECRET||''))return 'JWT_SECRET_NOT_STRONG_RANDOM_HEX';
 let url;
 try{url=new URL(env.DATABASE_URL)}catch{return 'DATABASE_URL_MISSING_OR_INVALID'}
 let username;
 try{username=decodeURIComponent(url.username)}catch{return 'DATABASE_URL_WRONG_PROJECT_OR_POOLER'}
 if(!['postgres:','postgresql:'].includes(url.protocol)||
  !HOST_PATTERN.test(url.hostname)||url.port!=='5432'||url.pathname!=='/postgres'||
  username!==DATABASE_ROLE+'.'+PROJECT_REF)return 'DATABASE_URL_WRONG_PROJECT_OR_POOLER';
 if(!url.password||url.password.includes('YOUR_RANDOM_PASSWORD'))return 'DATABASE_PASSWORD_MISSING';
 if(url.searchParams.get('sslmode')==='disable'||env.PGSSL==='disable')return 'DATABASE_TLS_DISABLED';
 return 'CONFIG_READY';
}

export function validAdminEnvironment(env) {
 return adminConfigurationStatus(env)==='CONFIG_READY';
}

export async function adminProductionStatus(env,createPool=opts=>new Pool(opts)){
 const configuration=adminConfigurationStatus(env);
 if(configuration!=='CONFIG_READY')return {ready:false,code:configuration};
 let pool;
 try{
  pool=createPool({
   connectionString:env.DATABASE_URL,ssl:{rejectUnauthorized:true},
   max:1,connectionTimeoutMillis:6000,statement_timeout:5000
  });
  const response=await pool.query(
   "SELECT current_user AS login, EXISTS(SELECT 1 FROM public.users WHERE role='admin' AND status='active' AND lower(email)=lower($1)) AS approved",
   [env.GOOGLE_ADMIN_EMAIL]
  );
  if(response.rows?.[0]?.login!==DATABASE_ROLE)return {ready:false,code:'DATABASE_ROLE_MISMATCH'};
  if(response.rows?.[0]?.approved!==true)return {ready:false,code:'DIRECTOR_ACCOUNT_NOT_APPROVED'};
  return {ready:true,code:'READY'};
 }catch(error){
  // No stack, SQL, connection string, server host, or credentials in logs.
  return {ready:false,code:'DATABASE_TLS_AUTH_OR_NETWORK_FAILED'};
 }finally{
  if(pool){try{await pool.end()}catch{}}
 }
}

export async function adminProductionReady(env,createPool){
 return (await adminProductionStatus(env,createPool)).ready;
}
