// Public catalogue: bounded, read-only stale-while-revalidate at Cloudflare.
// Never cache sessions, lessons, student data, payments, booking decisions, or
// any response containing Set-Cookie. Cloudflare Cache API is POP-local/best-effort.
const FRESH_SECONDS=180;
const STALE_SECONDS=6*60*60;
const REFRESH_GUARD_SECONDS=45;
const fields=['id','status','title','description','subject','level','price','capacity','enrolled','teacher_name','teacher_specialty','next_date','duration_minutes'];
const allowedTypes=new Set(['string','number','boolean']);

export function publicCatalogRequest(request){
 const url=new URL(request.url);
 return request.method==='GET'&&url.pathname==='/api/courses'&&!url.search
  &&!request.headers.has('authorization');
}
export function sanitizeCatalog(raw){
 if(!raw||!Array.isArray(raw.courses)||raw.courses.length>150)return null;
 const clean=[];
 for(const row of raw.courses){
  if(!row||typeof row!=='object'||Array.isArray(row)||row.status!=='published'||typeof row.title!=='string'
   ||!(typeof row.id==='string'||typeof row.id==='number'))return null;
  const course={};
  for(const field of fields){
   const value=row[field];
   if(value===null||allowedTypes.has(typeof value))course[field]=value;
  }
  if(String(course.id).length>150||course.title.length>500)return null;
  clean.push(course);
 }
 const serialized=JSON.stringify({courses:clean});
 return serialized.length<=250000?{courses:clean}:null;
}
function response(payload,source,savedAt){
 return new Response(JSON.stringify({...payload,availability:{source,stale:source==='stale',savedAt}}),{
  status:200,headers:{
   'content-type':'application/json; charset=utf-8',
   'cache-control':'no-store, private',
   'x-content-type-options':'nosniff',
   'x-mssofia-catalog-source':source
  }
 });
}
function unavailable(){
 return new Response(JSON.stringify({code:'UPSTREAM_UNAVAILABLE',error:'الخدمة تستعيد اتصالها تلقائيًا. حاول بعد قليل.',retryAfterSeconds:6}),{
  status:503,headers:{
   'content-type':'application/json; charset=utf-8','cache-control':'no-store, private',
   'retry-after':'6','x-content-type-options':'nosniff'
  }
 });
}
function cacheKey(url,kind){
 return new Request(url.origin+'/__mssofia_public_catalog_cache__/'+kind,{method:'GET'});
}
async function match(cache,key){
 try{return cache?await cache.match(key):undefined}catch{return undefined}
}
async function save(cache,url,data){
 if(!cache)return;
 const payload={...data,savedAt:new Date().toISOString()};
 for(const [kind,seconds] of [['fresh',FRESH_SECONDS],['stale',STALE_SECONDS]]){
  try{
   await cache.put(cacheKey(url,kind),new Response(JSON.stringify(payload),{
    headers:{'content-type':'application/json','cache-control':'public,max-age='+seconds}
   }));
  }catch{/* Cache API is optional; never fail a public request for it. */}
 }
}
async function readCached(cache,key){
 const hit=await match(cache,key);
 if(!hit)return null;
 try{
  const parsed=await hit.json();
  if(!sanitizeCatalog(parsed))return null;
  return {courses:parsed.courses,savedAt:parsed.savedAt};
 }catch{return null}
}

// Only read GET /api/courses in FULL launch mode. Safe account routes always
// continue through the original uncached reverse proxy.
export async function servePublicCatalog({request,upstreamUrl,cache,waitUntil,fetchImpl}){
 const url=new URL(request.url);
 const fresh=await readCached(cache,cacheKey(url,'fresh'));
 if(fresh)return response({courses:fresh.courses},'fresh',fresh.savedAt);
 const stale=await readCached(cache,cacheKey(url,'stale'));

 const update=async()=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),18500);
  try{
   const upstream=await fetchImpl(new Request(upstreamUrl,{
    method:'GET',headers:{accept:'application/json','cache-control':'no-store'},signal:controller.signal,
    redirect:'manual'
   }));
   if(upstream.status!==200||upstream.headers.has('set-cookie'))return null;
   const size=Number(upstream.headers.get('content-length')||0);
   if(size>250000)return null;
   let raw;
   try{raw=await upstream.json()}catch{return null}
   const sanitized=sanitizeCatalog(raw);
   if(!sanitized)return null;
   // In background, cache persistence is part of the waitUntil task.
   await save(cache,url,sanitized);
   return sanitized;
  }catch{return null}
  finally{clearTimeout(timer)}
 };

 // Serve stale immediately, and asynchronously ask the origin for a fresh copy.
 // A short POP-local guard limits stampedes during Render cold starts.
 if(stale&&typeof waitUntil==='function'&&cache){
  const guard=cacheKey(url,'refresh-guard');
  if(!await match(cache,guard)){
   try{
    await cache.put(guard,new Response('1',{headers:{'cache-control':'public,max-age='+REFRESH_GUARD_SECONDS}}));
    waitUntil(update().catch(()=>null));
   }catch{/* Keep the known safe copy even when cache writes are unavailable. */}
  }
  return response({courses:stale.courses},'stale',stale.savedAt);
 }

 const live=await update();
 if(live)return response(live,'live',new Date().toISOString());
 if(stale)return response({courses:stale.courses},'stale',stale.savedAt);
 return unavailable();
}
