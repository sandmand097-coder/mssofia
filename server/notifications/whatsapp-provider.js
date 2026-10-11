// Approved Meta WhatsApp Cloud API UTILITY templates, never arbitrary bulk
// messages. The template body must be approved with EXACTLY four placeholders.
// Each outbound recipient needs separately verified, revocable guardian opt-in.
export function configuredWhatsApp(env=process.env){
 return env.WHATSAPP_ENABLED==='true'
  &&/^v\d+\.\d+$/.test(env.WHATSAPP_GRAPH_VERSION||'')
  &&/^\d{5,25}$/.test(env.WHATSAPP_PHONE_NUMBER_ID||'')
  &&typeof env.WHATSAPP_ACCESS_TOKEN==='string'&&env.WHATSAPP_ACCESS_TOKEN.length>30
  &&/^[a-z0-9_]{3,80}$/i.test(env.WHATSAPP_BOOKING_TEMPLATE||'')
  &&/^[a-z0-9_]{3,80}$/i.test(env.WHATSAPP_REMINDER_TEMPLATE||'');
}
export function verifiedPhone(number){
 return typeof number==='string'&&/^\+[1-9]\d{7,14}$/.test(number);
}
export function publicSchoolOrigin(env=process.env){
 const origin=env.SCHOOL_PUBLIC_URL||'https://mssofia.pages.dev';
 return ['https://mssofia.pages.dev','https://mssofia.com'].includes(origin)?origin:'https://mssofia.pages.dev';
}
export function whatsappTemplatePayload({type,phone,studentName,courseTitle,lessonTitle,lessonDate,bookingId,lessonId},{env=process.env}={}){
 if(!verifiedPhone(phone))throw Error('Recipient is not verified E.164');
 if(!['booking_approved','lesson_reminder'].includes(type))throw Error('Unknown notification type');
 const origin=publicSchoolOrigin(env);
 const clean=(text,max=180)=>String(text||'').replace(/[\r\n\t]/g,' ').trim().slice(0,max);
 const values=type==='booking_approved'
  ?[clean(studentName,80),clean(courseTitle),clean(origin+'/dashboard'), 'تم تأكيد الاشتراك']
  :[clean(studentName,80),clean(lessonTitle),clean(lessonDate,60),clean(origin+'/lesson/'+encodeURIComponent(String(lessonId||'')))];
 const name=type==='booking_approved'?env.WHATSAPP_BOOKING_TEMPLATE:env.WHATSAPP_REMINDER_TEMPLATE;
 return {
  messaging_product:'whatsapp',
  recipient_type:'individual',
  to:phone.slice(1),
  type:'template',
  template:{
   name,
   language:{code:env.WHATSAPP_TEMPLATE_LANGUAGE||'ar'},
   components:[{type:'body',parameters:values.map(text=>({type:'text',text}))}]
  }
 };
}
export class WhatsAppDeliveryError extends Error{
 constructor(code,retryable=false){super('WhatsApp delivery rejected');this.code=code;this.retryable=retryable}
}
export async function sendWhatsAppTemplate(input,{env=process.env,fetcher=fetch}={}){
 if(!configuredWhatsApp(env))throw new WhatsAppDeliveryError('PROVIDER_DISABLED');
 const payload=whatsappTemplatePayload(input,{env});
 const url='https://graph.facebook.com/'+env.WHATSAPP_GRAPH_VERSION+'/'+env.WHATSAPP_PHONE_NUMBER_ID+'/messages';
 let result;
 try{
  result=await fetcher(url,{
   method:'POST',
   signal:AbortSignal.timeout(12000),
   headers:{Authorization:'Bearer '+env.WHATSAPP_ACCESS_TOKEN,'Content-Type':'application/json'},
   body:JSON.stringify(payload)
  });
 }catch{throw new WhatsAppDeliveryError('PROVIDER_NETWORK',true)}
 if(!result.ok)throw new WhatsAppDeliveryError('PROVIDER_HTTP_'+result.status,[408,429,500,502,503,504].includes(result.status));
 const body=await result.json().catch(()=>({}));
 const messageId=body.messages?.[0]?.id;
 if(typeof messageId!=='string'||messageId.length<10)throw new WhatsAppDeliveryError('PROVIDER_MISSING_RECEIPT',true);
 return {providerId:messageId};
}
