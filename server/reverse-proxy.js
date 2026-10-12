// Configure the one known Render reverse-proxy hop before Express routers
// and rate limiters. Never trust every X-Forwarded-For entry with boolean true.
// The Cloudflare Pages Worker strips client-supplied forwarded headers before
// proxying to Render. Validate actual proxy hops after rollout if topology changes.
export function configureReverseProxy(app,{production=process.env.NODE_ENV==='production'}={}){
 app.set('trust proxy',production?1:false);
 app.disable('x-powered-by');
}
