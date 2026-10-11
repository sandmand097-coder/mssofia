import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 WHATSAPP_CONTACT_LOCAL,WHATSAPP_CONTACT_E164,WHATSAPP_CONTACT_MESSAGE,
 WHATSAPP_CONTACT_URL,showWhatsAppContact
} from '../src/components/whatsapp-contact.js';

assert.equal(WHATSAPP_CONTACT_LOCAL,'01027662546','owner-provided WhatsApp number must be exact');
assert.equal(WHATSAPP_CONTACT_E164,'+201027662546','Egypt +20, remove local trunk 0');
const url=new URL(WHATSAPP_CONTACT_URL);
assert.equal(url.protocol,'https:');
assert.equal(url.hostname,'wa.me');
assert.equal(url.pathname,'/201027662546');
assert.equal(url.searchParams.get('text'),WHATSAPP_CONTACT_MESSAGE);
assert.ok(!/\/lesson\/|token|password|vodafone|رقم الطالب|بيانات الطالب/i.test(url.searchParams.get('text')));
for(const path of ['/', '/courses','/courses/','/courses/123','/privacy','/terms','/login','/register','/forgot-password','/reset-password','/verify-email'])
 assert.equal(showWhatsAppContact(path),true,'public routes provide direct guardian contact: '+path);
for(const path of ['/student','/teacher','/admin','/dashboard','/lesson/123','/lesson','/courses/1/hidden','/api/auth/me','/unknown',null,undefined])
 assert.equal(showWhatsAppContact(path),false,'never obscure a protected/live page: '+path);
const component=readFileSync(new URL('../src/components/WhatsAppContact.jsx',import.meta.url),'utf8');
const brand=readFileSync(new URL('../src/components/MrsSofiaBrand.jsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/whatsapp-contact.css',import.meta.url),'utf8');
const exampleEnv=readFileSync(new URL('../.env.example',import.meta.url),'utf8');
assert.match(component,/target="_blank" rel="noopener noreferrer"/,'safe external tab behavior');
assert.match(component,/href=\{WHATSAPP_CONTACT_URL\}/,'click direct to link, no delayed popup');
assert.match(brand,/href=\{WHATSAPP_CONTACT_URL\}/,'same direct link in footer');
assert.ok(brand.includes("href={'tel:'+WHATSAPP_CONTACT_E164}"),'footer calls internationally dialable, centralized support number');
assert.ok(brand.includes('>{WHATSAPP_CONTACT_LOCAL}</a>'),'footer displays the exact user-approved number');
assert.ok(!brand.includes('01027661546'),'obsolete support phone removed from publicly rendered footer');
assert.match(exampleEnv,/^VODAFONE_CASH_NUMBER=01027661546$/m,'payment wallet deliberately unchanged until explicitly verified');
assert.ok(app.includes('<WhatsAppContact pathname={pathname}/>'),'app mounts floating contact with route guard');
assert.match(app,/showWhatsApp=\{showWhatsAppContact\(pathname\)\}/,'footer is restricted too');
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/,'motion accessibility');
assert.match(css,/env\(safe-area-inset-bottom\)/,'phone safe-area spacing');
assert.match(css,/focus-visible/,'keyboard support');
assert.doesNotMatch(component,/fetch\(|localStorage|sessionStorage|document\.cookie|navigator\.mediaDevices/,'not a collection or surveillance feature');
assert.doesNotMatch(css,/@import|url\(https?:/,'does not load any third-party resources');
console.log('PASS WhatsApp international number, safe URL, student privacy, route exclusion and accessible CTA');
