// A single, explicit contact destination for the school's visitor experience.
// Egypt local 01027661546 -> international +201027661546 -> wa.me/201027661546.
// Never put student identity, session IDs, payment details or lesson tokens in
// pre-filled WhatsApp text or URLs.
export const WHATSAPP_CONTACT_LOCAL='01027661546';
export const WHATSAPP_CONTACT_E164='+201027661546';
export const WHATSAPP_CONTACT_MESSAGE='مرحبًا مس صوفيا، أريد الاستفسار عن كورسات العلوم ومواعيد الحصص.';
export const WHATSAPP_CONTACT_URL='https://wa.me/'+WHATSAPP_CONTACT_E164.slice(1)
 + '?text='+encodeURIComponent(WHATSAPP_CONTACT_MESSAGE);

const PUBLIC_CONTACT_PAGES=new Set([
 '/', '/courses', '/guide', '/contact', '/privacy', '/terms', '/login', '/register',
 '/forgot-password', '/reset-password', '/verify-email'
]);
/** Marketing and sign-up only. Never float over a live lesson or dashboard. */
export function showWhatsAppContact(pathname){
 if(typeof pathname!=='string')return false;
 const path=pathname.replace(/\/+$/,'')||'/';
 return PUBLIC_CONTACT_PAGES.has(path)||/^\/courses\/[^/]+$/.test(path);
}
