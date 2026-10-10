// Browser-only layout regression. Uses built CSS with simulated camera formats;
 // no school sessions, WebRTC devices, or student records.
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const root=path.dirname(fileURLToPath(import.meta.url));
const dist=path.join(root,'dist','assets');
const files=readdirSync(dist).filter(x=>x.endsWith('.css'));
const css=files.map(x=>readFileSync(path.join(dist,x),'utf8')).join('\n');
assert.match(css,/sofia-meeting-stage/,'classroom stylesheet present after build');
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 for(const width of [390,768,1366]){
  const page=await browser.newPage({viewport:{width,height:850},deviceScaleFactor:1});
  await page.setContent(`<!doctype html><html lang="ar" dir="rtl"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#0f292d"><div class="sofia-meeting"><div class="sofia-meeting-layout"><section class="sofia-meeting-main has-video"><div id="stage" class="sofia-meeting-stage has-video is-portrait" style="--sofia-source-aspect:0.5625"><div class="sofia-video-surface"><video id="live-video" playsinline muted style="width:100%;height:100%"></video></div></div></section><aside class="sofia-meeting-sidebar"></aside></div></div></body></html>`);
  await page.addStyleTag({content:css});
  for(const [format,ratio] of [['portrait',9/16],['square',1],['landscape',16/9]]){
   const state=await page.evaluate(({format,ratio})=>{
    const stage=document.getElementById('stage');
    stage.className='sofia-meeting-stage has-video is-'+format;
    stage.style.setProperty('--sofia-source-aspect',String(ratio));
    const s=stage.getBoundingClientRect(),v=document.getElementById('live-video');
    return {stageWidth:s.width,stageHeight:s.height,objectFit:getComputedStyle(v).objectFit,
     overflow:document.documentElement.scrollWidth>window.innerWidth+2,stageLeft:s.left,stageRight:s.right};
   },{format,ratio});
   assert.equal(state.objectFit,'contain','video must never crop camera '+format);
   assert.equal(state.overflow,false,'no horizontal overflow '+width+' '+format+' '+JSON.stringify(state));
   assert.ok(state.stageLeft>=-2&&state.stageRight<=width+2,'video stage fits viewport '+width+' '+format+' '+JSON.stringify(state));
   assert.ok(state.stageWidth>50&&state.stageHeight>50,'video stage visible '+width+' '+format);
   if(format!=='landscape'){
    assert.ok(Math.abs(state.stageWidth/state.stageHeight-ratio)<.07,'true mobile camera aspect ratio '+width+' '+format+' '+JSON.stringify(state));
   }
  }
  console.log('PASS portrait, square and landscape WebRTC camera layout ('+width+'px)');
  await page.close();
 }
 console.log('PASS classroom aspect-aware video layout across mobile, tablet and laptop');
}finally{await browser?.close()}
