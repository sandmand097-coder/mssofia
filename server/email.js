import {mkdir,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import {guardianRegistrationReleaseReady} from './school-contact.js';

const configured=()=>Boolean((process.env.RESEND_API_KEY||process.env.SMTP_HOST)&&process.env.MAIL_FROM);
export const mailMode=()=>configured()?'provider':process.env.NODE_ENV==='production'?'disabled':'local-preview';
export const canRegister=()=>process.env.NODE_ENV==='production'?(mailMode()==='provider'&&guardianRegistrationReleaseReady()):mailMode()!=='disabled';
const sender=()=>process.env.MAIL_FROM||'Miss Sofia <no-reply@localhost>';

export async function sendAccountEmail({to,subject,text,url,kind}){
 const mode=mailMode();
 const safeUrl=String(url||'');
 if(!safeUrl.startsWith('https://')&&!safeUrl.startsWith('http://127.0.0.1:')&&!safeUrl.startsWith('http://localhost:'))throw Error('Unsafe email verification link');
 const message=text+'\n\n'+safeUrl+'\n\nلو لم تطلب هذا الإجراء، تجاهل الرسالة.';
 if(mode==='provider'&&process.env.RESEND_API_KEY){
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:sender(),to:[to],subject,text:message})});
  if(!r.ok)throw Error('Email service rejected message: '+r.status);
  return 'sent';
 }
 if(mode==='provider'&&process.env.SMTP_HOST){
  const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:String(process.env.SMTP_PORT)==='465',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined});
  await transport.sendMail({from:sender(),to,subject,text:message});
  transport.close();
  return 'sent';
 }
 if(mode==='local-preview'){
  const directory=process.env.TEST_EMAIL_CAPTURE_DIR||path.join(os.homedir(),'Documents','mrssofia-local-tools','private-email-preview');
  await mkdir(directory,{recursive:true});
  // Local-only preview file. Never return activation links in API responses.
  const file=path.join(directory,Date.now()+'-'+crypto.randomBytes(6).toString('hex')+'-'+kind+'.txt');
  await writeFile(file,'To: '+to+'\nSubject: '+subject+'\n\n'+message,{encoding:'utf8',mode:0o600,flag:'wx'});
  return 'local-preview';
 }
 throw Error('Configure MAIL_FROM and Resend or SMTP before accepting registration');
}
