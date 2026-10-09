// Production preview smoke test. No database, real students, payment secrets, or video provider are required.
import assert from 'node:assert/strict';
import net from 'node:net';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})});
const origin='http://127.0.0.1:'+port;
const proc=spawn(process.execPath,['server/start.js'],{cwd:root,windowsHide:true,env:{...process.env,NODE_ENV:'production',PUBLIC_LAUNCH_MODE:'preview',PORT:String(port),DATABASE_URL:'',JWT_SECRET:'',APP_ORIGIN:'',LIVEKIT_URL:'',VODAFONE_CASH_NUMBER:''}});
let browser;const pause=ms=>new Promise(r=>setTimeout(r,ms));const errors=[];
try{
 let ready=false;
 for(let i=0;i<65;i++){await pause(110);try{const r=await fetch(origin+'/api/health');if(r.ok&&(await r.json()).mode==='preview'){ready=true;break}}catch{}if(proc.exitCode!==null)break}
 assert.ok(ready,'preview launches without unsafe secrets');
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const desktop=await browser.newPage({viewport:{width:1440,height:900},locale:'ar-EG'});
 desktop.on('pageerror',e=>errors.push('desktop '+e.message));
 await desktop.goto(origin,{waitUntil:'networkidle'});
 await desktop.getByRole('heading',{name:/العلوم مش حفظ/}).waitFor({timeout:14000});
 await desktop.getByText('100', {exact:false}).first().waitFor();
 await desktop.getByText('170 جنيه',{exact:false}).first().waitFor();
 assert.equal(await desktop.getByText(/تسجيل الطلاب والبث المباشر هيفتحوا/).count(),1,'preview displays registration limitation');
 console.log('PASS public home and 100/170 EGP promotional banner');
 await desktop.goto(origin+'/login',{waitUntil:'networkidle'});
 await desktop.getByRole('heading',{name:'التسجيل هيفتح قريبًا'}).waitFor();
 await desktop.goto(origin+'/register',{waitUntil:'networkidle'});
 await desktop.getByRole('heading',{name:'التسجيل هيفتح قريبًا'}).waitFor();
 const auth=await fetch(origin+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'test'})});
 assert.equal(auth.status,503);
 console.log('PASS public auth inaccessible before secure provider activation');
 await desktop.goto(origin+'/courses',{waitUntil:'networkidle'});
 await desktop.getByText('100',{exact:false}).first().waitFor();
 console.log('PASS offer appears in public course catalogue');
 await desktop.screenshot({path:path.join(root,'mssofia-public-preview-desktop.png'),fullPage:true});
 const mobile=await browser.newPage({viewport:{width:390,height:844},locale:'ar-EG'});
 mobile.on('pageerror',e=>errors.push('mobile '+e.message));
 await mobile.goto(origin,{waitUntil:'networkidle'});
 await mobile.getByText('100',{exact:false}).first().waitFor();
 const size=await mobile.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
 assert.ok(size.scrollWidth<=size.width+2,'no horizontal overflow');
 await mobile.screenshot({path:path.join(root,'mssofia-public-preview-mobile.png'),fullPage:true});
 console.log('PASS mobile promotional page responsive, no horizontal overflow');
 assert.equal(errors.length,0,errors.join('; '));
 console.log('PASS no uncaught JavaScript errors in public browser flows');
}finally{
 if(browser)await browser.close().catch(()=>{});
 proc.kill();await Promise.race([new Promise(r=>proc.once('exit',r)),pause(3000)]);
}
