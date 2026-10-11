// Show read-only pages immediately if Render is waking up. Keep all private
// student/teacher/admin and lesson routes gated until session+health are known.
const PUBLIC_BOOTSTRAP_ROUTES = new Set(['/', '/courses', '/privacy', '/terms']);
export function isPublicBootstrapRoute(pathname){
 if(typeof pathname!=='string')return false;
 const normalized=pathname.replace(/\/+$/,'')||'/';
 return PUBLIC_BOOTSTRAP_ROUTES.has(normalized);
}
