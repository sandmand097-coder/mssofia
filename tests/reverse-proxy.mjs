// Fully isolated test: never touches Render, real accounts or rate limits.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import express from 'express';
import rateLimit from 'express-rate-limit';
import {configureReverseProxy} from '../server/reverse-proxy.js';

const source=readFileSync(new URL('../server/index.js',import.meta.url),'utf8');
assert.match(source,/configureReverseProxy\(app\);/,'real API initialises proxy trust before adding rate limiters');
assert.ok(!source.includes("\\napp.set('trust proxy'"),'literal backslash-n must not comment out proxy configuration');

const app=express();
configureReverseProxy(app,{production:true});
assert.equal(app.get('trust proxy'),1,'only the nearest Render reverse proxy may be trusted');
assert.equal(app.get('x-powered-by'),false,'do not leak the Express application signature');
app.use('/probe',rateLimit({windowMs:60000,limit:2,standardHeaders:'draft-8',legacyHeaders:false}));
app.get('/probe',(req,res)=>res.json({ip:req.ip}));

const local=express();
configureReverseProxy(local,{production:false});
assert.equal(local.get('trust proxy'),false,'direct local development must not trust forwarded headers');

const server=await new Promise((resolve,reject)=>{
 const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));
 instance.once('error',reject);
});
const url='http://127.0.0.1:'+server.address().port+'/probe';
const simulatedRequest=async (nearest,untrusted='203.0.113.100')=>{
 const response=await fetch(url,{headers:{'X-Forwarded-For':untrusted+', '+nearest}});
 let payload;
 try{payload=await response.json()}catch{payload={}}
 return{status:response.status,body:payload,headers:response.headers};
};
try{
 const a=await simulatedRequest('198.51.100.40','203.0.113.200');
 assert.equal(a.status,200);
 assert.equal(a.body.ip,'198.51.100.40','do not trust the spoofable leftmost forwarding address');
 assert.equal(a.headers.get('x-powered-by'),null);
 const b=await simulatedRequest('198.51.100.40','203.0.113.201');
 assert.equal(b.status,200);
 assert.equal(b.body.ip,a.body.ip,'different untrusted prefixes must share the same rate limit');
 const limited=await simulatedRequest('198.51.100.40','203.0.113.202');
 assert.equal(limited.status,429,'third request from same nearest address is rejected');
 const other=await simulatedRequest('198.51.100.41','203.0.113.202');
 assert.equal(other.status,200,'separate addresses have independent local rate limits');
 console.log('PASS trusted Render single-hop proxy configuration, per-address rate limits, spoofed prefix isolation, local defaults and no Express disclosure');
}finally{
 await new Promise(resolve=>server.close(resolve));
}
