// An intentionally separate production phase: administrators may prepare courses
// and teach, but public account creation and student/payment traffic remain closed.
// Mounted after Google Identity routes and before all application API routes.
export function attachAdminOnlyGuard(app, {auth, role, enabled}) {
 if (!enabled) return;
 app.use('/api', (req,res,next) => {
  const pathname=req.path;
  if (req.method==='GET' && pathname==='/health') return next();
  if (req.method==='GET' && pathname==='/auth/registration-status')
   return res.status(200).json({registrationAvailable:false,emailMode:'disabled'});
  if (req.method==='POST' && pathname==='/auth/logout') return next();
  if (req.method==='POST' && (/^\/admin\/payments\/[^/]+\/review$/.test(pathname)||/^\/bookings\/[^/]+\/payment$/.test(pathname)))
   return res.status(503).json({error:'مراجعة التحويلات محجوبة حتى يبدأ التسجيل والدفع العام بعد الاعتماد'});
  if (pathname.startsWith('/auth/') && pathname!=='/auth/me')
   return res.status(503).json({error:'دخول المديرة عبر Google فقط. تسجيل الطلاب غير متاح بعد'});
  // Even valid older student/teacher JWTs cannot access the API in this phase.
  return auth(req,res,() => role('admin')(req,res,next));
 });
 // Email bearer links and payment decisions are unavailable while in admin-only mode.
 app.use('/payment-review', (req,res) => res.status(503).json({error:'المدفوعات غير متاحة قبل الإطلاق العام'}));
}
