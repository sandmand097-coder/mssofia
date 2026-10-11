import React,{useEffect,useState} from 'react';
import {ArrowUpLeft} from 'lucide-react';
import {showWhatsAppContact,WHATSAPP_CONTACT_URL} from './whatsapp-contact.js';

/** Local inline vector: recognizable chat/phone mark, no external icon fetch. */
export function WhatsAppMark({size=26}){
 return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width={size} height={size}
  fill="none" aria-hidden="true" focusable="false">
  <path d="M18.1 3.3C10.1 3.3 3.6 9.8 3.6 17.8c0 2.5.65 4.85 1.85 6.91L3.7 32.4l7.9-2.08a14.53 14.53 0 0 0 6.5 1.51c8.03 0 14.54-6.51 14.54-14.52C32.64 9.8 26.13 3.3 18.1 3.3Z"
   stroke="currentColor" strokeWidth="2.45" strokeLinejoin="round"/>
  <path d="M12.5 11.1c-.45 0-.95.12-1.25.63-.45.7-1.27 1.7-1.27 3.74 0 2.07 1.45 4.09 1.64 4.37.21.29 2.75 4.4 6.83 5.97 3.37 1.29 4.1 1.03 4.82.94.75-.1 2.39-.94 2.73-1.93.35-.96.35-1.8.24-1.99-.13-.19-.46-.3-.97-.56-.52-.25-3.05-1.5-3.52-1.67-.47-.16-.81-.24-1.15.26-.34.5-1.33 1.66-1.63 1.99-.31.34-.6.37-1.11.11a13.4 13.4 0 0 1-3.98-2.48 14.83 14.83 0 0 1-2.75-3.43c-.29-.5-.03-.76.22-1.01.24-.23.51-.59.77-.89.25-.29.34-.5.51-.83.17-.33.09-.63-.04-.89-.13-.25-1.11-2.78-1.54-3.79-.34-.8-.71-.83-1.19-.85h-1.03"
   transform="translate(2 0) scale(.93)" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
 </svg>;
}

/** One-tap direct link, intentionally hidden from dashboards and live lessons. */
export function WhatsAppContact({pathname}){
 const [footerVisible,setFooterVisible]=useState(false);
 useEffect(()=>{
  if(!showWhatsAppContact(pathname)||typeof IntersectionObserver==='undefined')return;
  const footer=document.querySelector('.sofia-footer');
  if(!footer)return;
  const observer=new IntersectionObserver(entries=>{
   setFooterVisible(Boolean(entries[0]?.isIntersecting));
  },{threshold:0.05});
  observer.observe(footer);
  return()=>observer.disconnect();
 },[pathname]);
 // The footer has the same direct contact action; hide the floating widget
 // while it's visible so there aren't two competing CTAs on screen.
 if(!showWhatsAppContact(pathname)||footerVisible)return null;
 return <aside className="sofia-wa-contact" aria-label="التواصل عبر واتساب">
  <a className="sofia-wa-contact-link"
   href={WHATSAPP_CONTACT_URL} target="_blank" rel="noopener noreferrer"
   aria-label="راسل مس صوفيا مباشرة على واتساب لأسئلة الكورسات — يفتح في نافذة جديدة">
   <span className="sofia-wa-contact-icon"><WhatsAppMark size={28}/></span>
   <span className="sofia-wa-contact-copy">
    <span className="sofia-wa-contact-kicker">WHATSAPP SUPPORT</span>
    <strong>عندك استفسار؟</strong>
    <span className="sofia-wa-contact-description">راسل مس صوفيا مباشرة</span>
   </span>
   <span className="sofia-wa-contact-arrow"><ArrowUpLeft size={18}/></span>
  </a>
 </aside>;
}
