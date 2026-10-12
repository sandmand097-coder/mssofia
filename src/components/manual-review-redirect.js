// Email action links lead to an authenticated ADMIN page, never to a raw
// GET state-changing endpoint. Disallow external URLs and privilege mixing.
export function validAdminReviewPath(value){
 return typeof value==='string' && /^\/admin\?tab=manual(?:&booking=[a-f0-9-]{36})?$/i.test(value);
}
export function safeAdminRedirect(search,user){
 if(user?.role!=='admin')return null;
 const next=new URLSearchParams(search).get('next');
 return validAdminReviewPath(next)?next:null;
}
