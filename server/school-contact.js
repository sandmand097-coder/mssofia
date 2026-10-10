// Public school contact is required before collecting guardian-managed child
// accounts. An already public support telephone can be used if school email
// delivery is not yet configured; no private account email is published.
export function schoolContactConfigured(env=process.env){
 const email=String(env.SCHOOL_CONTACT_EMAIL||'').trim();
 const phone=String(env.SCHOOL_SUPPORT_PHONE||'').trim();
 return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||/^01[0125]\d{8}$/.test(phone);
}

export function guardianRegistrationReleaseReady(env=process.env){
 return env.REGISTRATION_ENABLED==='true'
  &&env.SCHOOL_PRIVACY_APPROVED==='true'
  &&schoolContactConfigured(env);
}
