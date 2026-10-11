// Centralize the same-site Cloudflare proxy and future custom-domain rules.
// No wildcard subdomains: an attacker controlling an unrelated subdomain must
// not gain permission to read credentialed classroom or payment APIs.
const CUSTOM_SITE='mssofia.com';
const PROD_FRONTENDS=['https://mssofia.pages.dev','https://mssofia.com','https://www.mssofia.com'];
const DEV_FRONTENDS=['http://127.0.0.1:5173','http://localhost:5173'];

export function allowedApiOrigins(env=process.env){
 const production=env.NODE_ENV==='production';
 const origins=new Set(production?PROD_FRONTENDS:[...PROD_FRONTENDS,...DEV_FRONTENDS]);
 if(env.APP_ORIGIN){
  try{
   const origin=new URL(env.APP_ORIGIN);
   // Allow explicitly configured local development, but not arbitrary public
   // production origins configured by mistake.
   if(!production||PROD_FRONTENDS.includes(origin.origin))origins.add(origin.origin);
  }catch{/* invalid origin never becomes an allowlist entry */}
 }
 return origins;
}
export function corsForRequest(req,res,next,{env=process.env}={}){
 const origin=req.get?.('origin')||req.headers?.origin;
 res.vary('Origin');
 if(!origin)return next();
 if(!allowedApiOrigins(env).has(origin)){
  return res.status(403).json({error:'مصدر الطلب غير مسموح'});
 }
 res.set('Access-Control-Allow-Origin',origin);
 res.set('Access-Control-Allow-Credentials','true');
 if(req.method==='OPTIONS'){
  res.set('Access-Control-Allow-Methods','GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers','Content-Type, Accept');
  res.set('Access-Control-Max-Age','600');
  return res.status(204).end();
 }
 next();
}
function trustedCustomHost(hostname){
 return hostname===CUSTOM_SITE||hostname==='api.'+CUSTOM_SITE;
}
function requestIsCustomDomain(request){
 const host=String(request?.hostname||request?.headers?.host||'').split(':')[0].toLowerCase();
 const origin=String(request?.get?.('origin')||request?.headers?.origin||'');
 // Domain scope is only safe when BOTH browser origin and server host belong
 // to our custom site; pages.dev must retain a host-only proxy cookie.
 return trustedCustomHost(host)&&['https://mssofia.com','https://www.mssofia.com'].includes(origin);
}
export function sessionCookieOptions(request,{env=process.env,clear=false}={}){
 const production=env.NODE_ENV==='production';
 const base={httpOnly:true,sameSite:'lax',secure:production,path:'/'};
 // Leading '.' is equivalent to Domain=mssofia.com in modern browsers.
 // Off by default: a host-only cookie limits cross-subdomain fixation.
 if(env.COOKIE_DOMAIN==='mssofia.com'&&production&&requestIsCustomDomain(request))
  base.domain='mssofia.com';
 if(!clear)base.maxAge=7*24*60*60*1000;
 return base;
}
