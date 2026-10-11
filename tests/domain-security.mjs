import assert from 'node:assert/strict';
import {allowedApiOrigins,corsForRequest,sessionCookieOptions} from '../server/origin-security.js';
const prod={NODE_ENV:'production',APP_ORIGIN:'https://mssofia.pages.dev',COOKIE_DOMAIN:'mssofia.com'};
const origins=allowedApiOrigins(prod);
assert.ok(origins.has('https://mssofia.pages.dev'));
assert.ok(origins.has('https://mssofia.com'));
assert.ok(!origins.has('https://www.mssofia.com'));
assert.ok(!origins.has('https://evil.mssofia.com'));
assert.ok(!origins.has('https://mssofia.com.evil.test'));
assert.ok(!origins.has('http://127.0.0.1:5173'));
let nexts=0,headers={},code=200;
function response(){
 headers={};code=200;
 return{
  vary(x){headers.vary=x},
  set(x,y){headers[x]=y},
  status(v){code=v;return this},
  json(o){return o},
  end(){return null}
 };
}
function request(origin,method='GET'){
 return{method,hostname:'api.mssofia.com',headers:{origin},
  get(key){return key==='origin'?origin:null}};
}
corsForRequest(request('https://mssofia.com','OPTIONS'),response(),()=>nexts++,{env:prod});
assert.equal(code,204);
assert.equal(headers['Access-Control-Allow-Credentials'],'true');
assert.equal(headers['Access-Control-Allow-Origin'],'https://mssofia.com');
assert.ok(headers['Access-Control-Allow-Methods'].includes('PATCH'));
corsForRequest(request('https://evil.mssofia.com','POST'),response(),()=>nexts++,{env:prod});
assert.equal(code,403);
assert.equal(headers['Access-Control-Allow-Origin'],undefined);
corsForRequest(request('https://mssofia.pages.dev','POST'),response(),()=>nexts++,{env:prod});
assert.equal(nexts,1);
assert.equal(headers['Access-Control-Allow-Origin'],'https://mssofia.pages.dev');
const noOrigin=request(undefined,'POST');
corsForRequest(noOrigin,response(),()=>nexts++,{env:prod});
assert.equal(nexts,2,'machine cron may request without browser Origin but must have separate bearer authentication');
const reqFromCustom=request('https://mssofia.com','POST');
const scoped=sessionCookieOptions(reqFromCustom,{env:prod});
assert.equal(scoped.domain,'mssofia.com');
assert.equal(scoped.sameSite,'lax');
assert.equal(scoped.secure,true);
assert.equal(scoped.httpOnly,true);
assert.equal(scoped.maxAge,604800000);
const clear=sessionCookieOptions(reqFromCustom,{env:prod,clear:true});
assert.equal(clear.domain,'mssofia.com');
assert.equal(clear.maxAge,undefined);
const fromPreview=sessionCookieOptions(request('https://mssofia.pages.dev'),{env:prod});
assert.equal(fromPreview.domain,undefined,'pages.dev cannot accept a .mssofia.com cookie');
const fromUnknown=sessionCookieOptions(request('https://evil.mssofia.com'),{env:prod});
assert.equal(fromUnknown.domain,undefined);
assert.equal(sessionCookieOptions(request('https://mssofia.com'),{env:{...prod,COOKIE_DOMAIN:''}}).domain,undefined,'host-only safest default');
const local=sessionCookieOptions(request('http://127.0.0.1:5173'),{env:{NODE_ENV:'test'}});
assert.equal(local.secure,false);
assert.equal(local.domain,undefined);
console.log('PASS exact-origin credentialed CORS, preflight and host-only/custom-domain sessions');
