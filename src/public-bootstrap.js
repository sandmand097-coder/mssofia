// Show read-only pages immediately if Render is waking up. Keep all private
// student/teacher/admin and lesson routes gated until session+health are known.
const PUBLIC_BOOTSTRAP_ROUTES = new Set(['/', '/courses', '/guide', '/privacy', '/terms']);
export function isPublicBootstrapRoute(pathname){
 if(typeof pathname!=='string')return false;
 const normalized=pathname.replace(/\/+$/,'')||'/';
 // Course descriptions are a public read-only resource; all booking writes
 // remain server-authorized and cannot be submitted while bootstrap is down.
 return PUBLIC_BOOTSTRAP_ROUTES.has(normalized)||/^\/courses\/[A-Za-z0-9_-]{1,100}$/.test(normalized);
}
