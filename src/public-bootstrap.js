// Public, read-only routes must be usable even when the Render backend is waking up.
// A delayed session/bootstrap response must never unlock private student or staff pages.
const PUBLIC_BOOTSTRAP_ROUTES = new Set(['/', '/courses', '/privacy', '/terms']);

export function isPublicBootstrapRoute(pathname) {
 if (typeof pathname !== 'string') return false;
 const path = pathname.replace(/\/+$/, '') || '/';
 return PUBLIC_BOOTSTRAP_ROUTES.has(path);
}
