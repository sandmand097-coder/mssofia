import {Pool} from 'pg';

// Run this before starting the production API. Never log secret values or
// database errors: only the result of the readiness decision is public.
const EXPECTED_REF='jtluslevdmcpxxkngomj';
const EXPECTED_ROLE='mssofia_backend';
const EXPECTED_ORIGIN='https://mssofia.pages.dev';
const authorizedClientId=/^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/;

export function validAdminEnvironment(env){
 if(env.PUBLIC_LAUNCH_MODE!=='admin')return false;
 if(env.REGISTRATION_ENABLED==='true')return false;
 if(env.GOOGLE_ADMIN_LOGIN_ENABLED!=='true'||!authorizedClientId.test(env.GOOGLE_OAUTH_CLIENT_ID||''))return false;
 if(env.APP_ORIGIN!==EXPECTED_ORIGIN||!env.GOOGLE_ADMIN_EMAIL)return false;
 // A random 32-byte secret is a minimum; reject the example placeholder.
 if(!/^[a-fA-F0-9]{64,}$/.test(env.JWT_SECRET||''))return false;
 let url;
 try{url=new URL(env.DATABASE_URL)}catch{return false}
 if(!['postgres:','postgresql:'].includes(url.protocol))return false;
 if(!/^aws-[0-9]+-eu-central-1\.pooler\.supabase\.com$/.test(url.hostname))return false;
 if(url.port!=='5432'||url.pathname!=='/postgres'||decodeURIComponent(url.username)!==EXPECTED_ROLE+'.'+EXPECTED_REF)return false;
 if(!url.password||url.password.includes('YOUR_RANDOM_PASSWORD'))return false;
 if(url.searchParams.get('sslmode')==='disable')return false;
 if(env.PGSSL==='disable')return false;
 return true;
}

export async function adminProductionReady(env,createPool=options=>new Pool(options)){
 if(!validAdminEnvironment(env))return false;
 const pool=createPool({
  connectionString:env.DATABASE_URL,
  ssl:{rejectUnauthorized:true},
  max:1,
  connectionTimeoutMillis:6000,
  statement_timeout:5000
 });
 try{
  // Checking this row prevents silently connecting to another Supabase
  // project, even if a valid but incorrect DATABASE_URL is supplied.
  const response=await pool.query(
   "SELECT current_user AS login, EXISTS(SELECT 1 FROM public.users WHERE role='admin' AND status='active' AND lower(email)=lower($1)) AS approved",
   [env.GOOGLE_ADMIN_EMAIL]
  );
  return response.rows?.[0]?.login===EXPECTED_ROLE&&response.rows?.[0]?.approved===true;
 }catch{return false}
 finally{try{await pool.end()}catch{}}
}
