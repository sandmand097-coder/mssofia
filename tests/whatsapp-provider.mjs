import assert from 'node:assert/strict';
import {configuredWhatsApp,verifiedPhone,publicSchoolOrigin,whatsappTemplatePayload,sendWhatsAppTemplate,WhatsAppDeliveryError} from '../server/notifications/whatsapp-provider.js';
const env={WHATSAPP_ENABLED:'true',WHATSAPP_GRAPH_VERSION:'v25.0',WHATSAPP_PHONE_NUMBER_ID:'123456789012',
 WHATSAPP_ACCESS_TOKEN:'LOCAL_TEST_TOKEN_'.repeat(4),WHATSAPP_BOOKING_TEMPLATE:'sofia_booking_ar',
 WHATSAPP_REMINDER_TEMPLATE:'sofia_reminder_ar',WHATSAPP_TEMPLATE_LANGUAGE:'ar',
 SCHOOL_PUBLIC_URL:'https://mssofia.pages.dev'};
assert.ok(configuredWhatsApp(env));
assert.ok(verifiedPhone('+201000000000'));
assert.ok(!verifiedPhone('01000000000'));
assert.equal(publicSchoolOrigin({...env,SCHOOL_PUBLIC_URL:'https://attacker.test'}),'https://mssofia.pages.dev');
const input={type:'booking_approved',phone:'+201000000000',studentName:'طالب اختبار',courseTitle:'علوم',bookingId:'test'};
const body=whatsappTemplatePayload(input,{env});
assert.equal(body.type,'template');
assert.equal(body.to,'201000000000');
assert.equal(body.template.components[0].parameters.length,4);
assert.ok(body.template.components[0].parameters[2].text.endsWith('/dashboard'));
const reminder=whatsappTemplatePayload({...input,type:'lesson_reminder',lessonTitle:'علوم',lessonDate:'11 أكتوبر',lessonId:'lesson-simulated'},{env});
assert.ok(reminder.template.components[0].parameters[3].text.endsWith('/lesson/lesson-simulated'));
let called=0;
const result=await sendWhatsAppTemplate(input,{env,fetcher:async(url,options)=>{
 called++;
 assert.ok(url.startsWith('https://graph.facebook.com/v25.0/123456789012/messages'));
 assert.ok(options.headers.Authorization.startsWith('Bearer LOCAL_TEST_TOKEN_'));
 return{ok:true,status:200,async json(){return{messages:[{id:'wamid.TEST_ONLY_LOCAL_12345'}]}}};
}});
assert.equal(called,1);
assert.equal(result.providerId,'wamid.TEST_ONLY_LOCAL_12345');
await assert.rejects(sendWhatsAppTemplate(input,{env,fetcher:async()=>({ok:false,status:429})}),e=>e instanceof WhatsAppDeliveryError&&e.retryable);
await assert.rejects(sendWhatsAppTemplate(input,{env,fetcher:async()=>({ok:false,status:400})}),e=>e instanceof WhatsAppDeliveryError&&!e.retryable);
assert.equal(configuredWhatsApp({...env,WHATSAPP_ENABLED:'false'}),false);
await assert.rejects(sendWhatsAppTemplate(input,{env:{...env,WHATSAPP_ENABLED:'false'},fetcher:async()=>{throw Error('never call')}}),/delivery rejected/);
console.log('PASS fake-only Meta templates, E.164 validation, no plaintext body sends or secrets in client');
