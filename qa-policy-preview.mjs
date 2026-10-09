import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--no-first-run']});
try{
 for(const width of [390,1366]){
  const page=await browser.newPage({viewport:{width,height:820},locale:'ar-EG'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [url,title]of [['/privacy','الخصوصية وحماية الطلاب'],['/terms','شروط الدراسة والاشتراك'],['/','عرض خاص على اشتراك شرح العلوم']]){
   await page.goto('http://127.0.0.1:5173'+url,{waitUntil:'networkidle'});
   await page.getByText(title,{exact:url!=='/'}).first().waitFor({timeout:12000});
   const size=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
   assert.ok(size.scrollWidth<=size.width+2,'Horizontal overflow at '+url+' '+width);
   console.log('PASS '+url+' at '+width+'px');
  }
  assert.equal(errors.length,0,'No JavaScript errors');
  await page.close();
 }
 console.log('PASS privacy, conditions, and promotion render in desktop and mobile');
}finally{await browser.close()}
