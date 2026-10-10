// Cloudflare Pages edge API. Public preview never wakes Render.
// When the school's backend and parental-safety checks are complete,
// switch both PUBLIC_LAUNCH_MODE=full and FULL_BACKEND_READY=true in Pages
// (and the corresponding safe settings on the Render application).
// All API calls remain same-origin to preserve HttpOnly session cookies.
const RENDER_ORIGIN='https://mssofia.onrender.com';
const JSON_HEADERS={
 'content-type':'application/json; charset=utf-8',
 'cache-control':'no-store, private',
 'x-content-type-options':'nosniff'
};

function json(status,data){
 return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});
}

function inFullMode(env){
 return env?.PUBLIC_LAUNCH_MODE==='full'
  &&env?.FULL_BACKEND_READY==='true'
  &&env?.API_ORIGIN===RENDER_ORIGIN;
}
function inAdminMode(env){
 return env?.PUBLIC_LAUNCH_MODE==='admin'
  &&env?.FULL_BACKEND_READY==='true'
  &&env?.API_ORIGIN===RENDER_ORIGIN;
}

export async function onRequest(context){
 const request=context.request;
 const url=new URL(request.url);
 const pathname=url.pathname;
 if(!pathname.startsWith('/api/'))return json(404,{error:'المسار غير موجود'});
 const fullMode=inFullMode(context.env),adminMode=inAdminMode(context.env);

 // Fail-closed default. All responses are local to Cloudflare and cost
 // no Render compute time, so the landing page is not blocked by cold starts.
 if(!fullMode&&!adminMode){
  if(request.method==='GET'&&pathname==='/api/health')
   return json(200,{ok:true,mode:'preview',registrationAvailable:false,
    videoConfigured:false,videoCloudReady:false,videoMode:'preview-disabled'});
  if(request.method==='GET'&&pathname==='/api/auth/registration-status')
   return json(200,{registrationAvailable:false,emailMode:'disabled'});
  if(request.method==='GET'&&pathname==='/api/auth/google/config')
   return json(200,{enabled:false});
  if(request.method==='GET'&&pathname==='/api/auth/me')
   return json(401,{error:'لم يتم تسجيل الدخول'});
  if(request.method==='GET'&&pathname==='/api/courses')
   return json(200,{courses:[]});
  return json(503,{error:'التسجيل والحجز والبث المباشر غير متاحين بعد في النسخة التعريفية'});
 }

 // Preparation phase: only the verified director can reach private school APIs.
 // Visitors still get fast local responses; registration and payments fail closed.
 if(adminMode){
  if(request.method==='GET'&&pathname==='/api/health')
   return json(200,{ok:true,mode:'admin',registrationAvailable:false,
    videoConfigured:false,videoCloudReady:false,videoMode:'admin-setup'});
  if(request.method==='GET'&&pathname==='/api/auth/registration-status')
   return json(200,{registrationAvailable:false,emailMode:'disabled'});
  if(request.method==='POST'&&(/^\/api\/admin\/payments\/[^/]+\/review$/.test(pathname)||/^\/api\/bookings\/[^/]+\/payment$/.test(pathname)))
   return json(503,{error:'التحويلات وقبول الاشتراكات غير مفتوحين خلال تجهيز الإدارة'});
  const hasSession=(request.headers.get('cookie')||'').split(';').some(c=>c.trim().startsWith('session='));
  if(request.method==='GET'&&pathname==='/api/auth/me'&&!hasSession)
   return json(401,{error:'لم يتم تسجيل الدخول'});
  if(request.method==='GET'&&pathname==='/api/courses'&&!hasSession)
   return json(200,{courses:[]});
  const googleAuth=(request.method==='GET'&&pathname==='/api/auth/google/config')
   ||(request.method==='POST'&&pathname==='/api/auth/google/login');
  const allowedAuth=googleAuth
   ||(request.method==='GET'&&pathname==='/api/auth/me')
   ||(request.method==='POST'&&pathname==='/api/auth/logout');
  if(pathname.startsWith('/api/auth/')&&!allowedAuth)
   return json(503,{error:'دخول المديرة عبر Google فقط. حسابات الطلاب غير متاحة بعد'});
  if(!hasSession&&!googleAuth)
   return json(401,{error:'يجب تسجيل دخول المديرة أولاً'});
 }

 // The upstream address is constant (no user-supplied host or open proxy).
 const upstream=new URL(pathname+url.search,RENDER_ORIGIN);
 const headers=new Headers(request.headers);
 for(const key of ['host','content-length','connection','transfer-encoding',
  'x-forwarded-host','x-forwarded-proto','x-forwarded-for','x-real-ip','forwarded']){
  headers.delete(key);
 }
 headers.set('cache-control','no-store');
 const hasBody=!['GET','HEAD'].includes(request.method);
 try{
  const upstreamRequest=new Request(upstream.toString(),{
   method:request.method,headers,body:hasBody?request.body:undefined,
   ...(hasBody?{duplex:'half'}:{}),redirect:'manual'
  });
  const response=await fetch(upstreamRequest);
  const out=new Response(response.body,response);
  out.headers.set('cache-control','no-store, private');
  out.headers.set('x-content-type-options','nosniff');
  out.headers.delete('content-length');
  // Keep visitors on the Pages domain if the backend redirects to its own host.
  const destination=out.headers.get('location');
  if(destination){
   const redirect=new URL(destination,RENDER_ORIGIN);
   if(redirect.origin===RENDER_ORIGIN)
    out.headers.set('location',url.origin+redirect.pathname+redirect.search+redirect.hash);
  }
  return out;
 }catch{
  // Do not disclose backend details or credentials to the public.
  return json(503,{error:'خدمة الطلاب غير متاحة مؤقتًا. يُرجى المحاولة بعد قليل'});
 }
}
