import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AccessToken, WebhookReceiver } from 'livekit-server-sdk';
import { getRoomService, participantPermission, videoGrant, MAX_ACTIVE_SPEAKERS } from './classroom.js';
import { randomBytes, createHash } from 'node:crypto';
import { sendAccountEmail, canRegister, mailMode } from './email.js';
import {attachGoogleAdminAuth,googleAdminConfig,googleStudentConfig} from './google-admin-auth.js';
import {schoolReadiness} from './release-readiness.js';
import {createDiagnosticReader} from './deployment-diagnostics.js';
import {attachAdminOnlyGuard} from './admin-only.js';
import {attachPaymentRoutes} from './payment-routes.js';
import {createLiveAdmission} from './live-admission.js';
import {attachClassroomQuestions,classroomQuestionsEnabled} from './classroom-questions.js';
import {evaluateMonthlyAccess,accessView,countCurrentMembers,renewalEndSelect} from './monthly-access.js';
import { get, all, run, uid, now, publicUser, checkConnection, withTransaction, isCloudDatabase } from './db-adapter.js';
const app = express(),
  PORT = Number(process.env.PORT || 4010);
const secret = process.env.JWT_SECRET;
const adminOnly = process.env.PUBLIC_LAUNCH_MODE==='admin';
if (!secret || secret.length < 48) throw Error('Set strong JWT_SECRET in .env');
const localVideo = String(process.env.LIVEKIT_URL || '').match(/^ws:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/i) !== null;
if (process.env.NODE_ENV === 'production') {
  if(!process.env.DATABASE_URL)throw Error('Production requires persistent PostgreSQL DATABASE_URL. Refusing ephemeral SQLite.');
  if (localVideo || process.env.LIVEKIT_API_KEY === 'devkey' || process.env.LIVEKIT_API_SECRET === 'secret') throw Error('Refusing to start publicly with local-development LiveKit settings.');
  if (process.env.LIVEKIT_URL && !process.env.LIVEKIT_URL.startsWith('wss://')) throw Error('Production LiveKit URL must use wss://');
  if (!process.env.APP_ORIGIN?.startsWith('https://')) throw Error('Production requires secure APP_ORIGIN.');
  if (adminOnly && (!googleAdminConfig().enabled || process.env.REGISTRATION_ENABLED==='true')) throw Error('Admin-only production requires configured Google login and disabled public registration.');
}
// Render places one trusted reverse-proxy hop in front of Express.\n// Never use boolean true: that would trust client-supplied X-Forwarded-For.\napp.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);\napp.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false
}));
const roomService = getRoomService();
const admission=createLiveAdmission({studentLimit:Number(process.env.LIVE_JOIN_STUDENT_INFLIGHT||14),totalLimit:Number(process.env.LIVE_JOIN_TOTAL_INFLIGHT||20)});
const webhookReceiver = process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET ? new WebhookReceiver(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET) : null;
// LiveKit sends a signed raw body. Never mark a student present when merely requesting a token.
app.post('/api/webhooks/livekit', express.raw({
  type: 'application/webhook+json',
  limit: '128kb'
}), async (req, res) => {
  if (!webhookReceiver) return res.status(503).json({
    error: 'LiveKit غير مفعل'
  });
  try {
    if (!Buffer.isBuffer(req.body)) return res.status(415).json({
      error: 'نوع المحتوى غير مدعوم'
    });
    const event = await webhookReceiver.receive(req.body.toString('utf8'), req.get('Authorization'));
    if (event.event === 'participant_joined' && event.room?.name && event.participant?.identity) {
      const l = await get('SELECT l.id,l.course_id,c.teacher_id FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.room_key=?', event.room.name);
      const user = await get('SELECT id,role,status FROM users WHERE id=?', event.participant.identity);
      const permitted = l && user && user.status === 'active' && (user.role === 'admin' || user.role === 'teacher' && l.teacher_id === user.id || user.role === 'student' && (await studentCanStream(l.course_id,user.id)));
      if (permitted) await run('INSERT OR IGNORE INTO attendance(id,lesson_id,user_id,joined_at) VALUES(?,?,?,?)', uid(), l.id, user.id, now());
    }
    return res.json({
      ok: true
    });
  } catch {
    return res.status(401).json({
      error: 'توقيع حدث البث غير صالح'
    });
  }
});
app.use(express.json({
  limit: '100kb'
}));
app.use(cookieParser());
const allowedOrigins = new Set([process.env.APP_ORIGIN, 'http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:' + PORT].filter(Boolean));
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && !allowedOrigins.has(req.headers.origin)) return res.status(403).json({
    error: 'مصدر الطلب غير مسموح'
  });
  next();
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'طلبات تسجيل دخول كثيرة. حاول بعد قليل'
  }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
attachGoogleAdminAuth(app,{get,run,uid,now,publicUser,secret,limiter:authLimiter});
const send = (res, status, data) => res.status(status).json(data);
const asyncRoute = f => (req, res, next) => Promise.resolve(f(req, res, next)).catch(next);
const auth = async (req, res, next) => {
  try {
    const token = req.cookies.session;
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256']
    });
    const user = await get('SELECT * FROM users WHERE id=?', decoded.sub);
    if (!user || user.status !== 'active' || Number(decoded.version || 0) !== Number(user.session_version || 0)) return send(res, 401, {
      error: 'جلسة غير صالحة'
    });
    req.user = user;
    next();
  } catch {
    return send(res, 401, {
      error: 'يجب تسجيل الدخول أولاً'
    });
  }
};
const role = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : send(res, 403, {
  error: 'ليس لديك صلاحية'
});
attachAdminOnlyGuard(app,{auth,role,enabled:adminOnly});
attachPaymentRoutes(app,{auth,role,get,all,run,uid,now});
app.get('/api/admin/setup-status',auth,role('admin'),(req,res)=>res.json(schoolReadiness()));
const readSchoolDiagnostics=createDiagnosticReader({
 env:process.env,roomService,
 checkDatabase:async()=>{
  if(!process.env.DATABASE_URL||!(await checkConnection()))return false;
  const row=await get("SELECT id FROM users WHERE role='admin' AND status='active' AND lower(email)=lower(?) LIMIT 1",process.env.GOOGLE_ADMIN_EMAIL||'');
  return Boolean(row?.id);
 }
});
const diagnosticLimiter=rateLimit({windowMs:60000,limit:12,standardHeaders:'draft-8',legacyHeaders:false});
app.get('/api/admin/live/admission',auth,role('admin'),(req,res)=>res.set('Cache-Control','no-store, private').json({admission:admission.snapshot(),providerLimitVerified:false}));
app.get('/api/admin/dependencies',auth,role('admin'),diagnosticLimiter,asyncRoute(async(req,res)=>{
 res.set('Cache-Control','no-store, private').json(await readSchoolDiagnostics());
}));
const valid = (v, max = 120) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;
const owns = (course, user) => user.role === 'admin' || user.role === 'teacher' && course.teacher_id === user.id;
const intRange = (v, min, max) => (typeof v === 'number' || typeof v === 'string' && v.trim() !== '') && Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max;
const parseCourse = input => {
  if (!input || !valid(input.title, 160) || !valid(input.description, 2000) || !valid(input.subject, 120) || !valid(input.level, 120) || !intRange(input.price, 0, 10000000) || !intRange(input.capacity, 1, 500) || !intRange(input.duration_minutes, 15, 240)) return null;
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    subject: input.subject.trim(),
    level: input.level.trim(),
    price: Number(input.price),
    capacity: Number(input.capacity),
    duration_minutes: Number(input.duration_minutes)
  };
};

const parseLesson = input => {
  if (!input || !valid(input.title, 160) || typeof input.starts_at !== 'string' || !Number.isFinite(Date.parse(input.starts_at)) || Date.parse(input.starts_at) < Date.now() - 60000 || !intRange(input.duration_minutes, 15, 240)) return null;
  return {
    title: input.title.trim(),
    starts_at: new Date(input.starts_at).toISOString(),
    duration_minutes: Number(input.duration_minutes)
  };
};
const courseQuery = `SELECT c.*,u.name AS teacher_name,u.specialty AS teacher_specialty,(SELECT COUNT(*) FROM bookings b WHERE b.course_id=c.id AND b.status='approved') AS enrolled,(SELECT MIN(starts_at) FROM lessons l WHERE l.course_id=c.id AND datetime(l.starts_at)>=datetime('now')) AS next_date FROM courses c JOIN users u ON u.id=c.teacher_id`;
const studentAccessRows=studentId=>all(`SELECT b.course_id,b.status AS booking_status,c.price AS course_price,p.status AS payment_status,p.reviewed_at AS payment_reviewed_at,p.confirmed_on_phone AS confirmed_on_phone,${renewalEndSelect('b')} FROM bookings b JOIN courses c ON c.id=b.course_id LEFT JOIN payment_submissions p ON p.booking_id=b.id WHERE b.student_id=?`,studentId);
const studentCanStream=async(courseId,studentId)=>{
 const row=await get(`SELECT b.status AS booking_status,c.price AS course_price,p.status AS payment_status,p.reviewed_at AS payment_reviewed_at,p.confirmed_on_phone AS confirmed_on_phone,${renewalEndSelect('b')} FROM bookings b JOIN courses c ON c.id=b.course_id LEFT JOIN payment_submissions p ON p.booking_id=b.id WHERE b.course_id=? AND b.student_id=?`,courseId,studentId);
 return evaluateMonthlyAccess(row).active;
};
app.get('/api/health', (req, res) => res.json({
  ok: true,
  mode:adminOnly?'admin':'full',
  registrationAvailable:adminOnly?false:canRegister()||googleStudentConfig().registrationEnabled,
  videoConfigured: !!(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET),
  videoMode: localVideo ? 'local-development' : process.env.LIVEKIT_URL ? 'remote' : 'disabled'
}));
const tokenHash = token => createHash('sha256').update(token).digest('hex');
const issueAccountToken = async (userId, purpose, minutes) => {
  const token = randomBytes(32).toString('hex');
  await run('DELETE FROM auth_tokens WHERE user_id=? AND purpose=?', userId, purpose);
  await run('INSERT INTO auth_tokens(id,user_id,token_hash,purpose,expires_at,created_at) VALUES(?,?,?,?,?,?)', uid(), userId, tokenHash(token), purpose, new Date(Date.now() + minutes * 60000).toISOString(), now());
  return token;
};
const deliverAccountLink = async (user, purpose, token) => {
  const path = purpose === 'verify_email' ? '/verify-email' : '/reset-password';
  const link = (process.env.APP_ORIGIN || 'http://127.0.0.1:5173') + path + '?token=' + encodeURIComponent(token);
  return sendAccountEmail({
    to: user.email,
    url: link,
    kind: purpose,
    subject: purpose === 'verify_email' ? 'تأكيد بريدك — Miss Sofia' : 'تغيير كلمة المرور — Miss Sofia',
    text: purpose === 'verify_email' ? 'اضغط على الرابط لتأكيد بريدك الإلكتروني وتفعيل حساب الطالب. صلاحية الرابط 30 دقيقة.' : 'اضغط على الرابط لتعيين كلمة مرور جديدة. صلاحية الرابط 20 دقيقة.'
  });
};
const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'محاولات كثيرة، حاول لاحقًا'
  }
});
app.get('/api/auth/registration-status', (req, res) => res.json({
  registrationAvailable: canRegister()||googleStudentConfig().registrationEnabled,
  emailRegistrationAvailable: canRegister(),
  googleRegistrationAvailable: googleStudentConfig().registrationEnabled,
  emailMode: mailMode()
}));
app.post('/api/auth/register', asyncRoute(async (req, res) => {
  if (!canRegister()) return send(res, 503, {
    error: 'تسجيل الطلاب متوقف مؤقتًا لحين تفعيل إرسال البريد الإلكتروني'
  });
  const {
    name,
    email,
    password,
    role: requested,
    guardian_email,
    guardian_consent
  } = req.body || {};
  if (requested && requested !== 'student') return send(res, 403, {
    error: 'إنشاء حسابات المدرسين والإدارة متاح للإدارة فقط'
  });
  if (!valid(name, 80) || !valid(email, 160) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 10 || password.length > 128) return send(res, 400, {
    error: 'أدخل الاسم وبريدًا صحيحًا وكلمة مرور من 10 أحرف على الأقل'
  });
  if (guardian_email && (!valid(guardian_email, 160) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardian_email))) return send(res, 400, {
    error: 'بريد ولي الأمر غير صحيح'
  });
  const address = email.trim().toLowerCase();
  if(process.env.NODE_ENV==='production'&&(guardian_consent!==true||String(guardian_email||'').trim().toLowerCase()!==address))return send(res,400,{error:'يجب أن يكون الحساب مُدارًا ببريد ولي الأمر نفسه، مع موافقته على التسجيل وسياسة الخصوصية'});
  if (await get('SELECT id FROM users WHERE email=?', address)) return send(res, 409, {
    error: 'البريد الإلكتروني مسجل بالفعل. سجل دخولك أو استخدم إعادة الإرسال'
  });
  const id = uid();
  await run('INSERT INTO users(id,name,email,password_hash,role,status,specialty,created_at,guardian_email,guardian_consent_at) VALUES(?,?,?,?,?,?,?,?,?,?)', id, name.trim(), address, await bcrypt.hash(password, 12), 'student', 'pending', '', now(), guardian_email?.toLowerCase().trim() || null,guardian_consent===true?now():null);
  const token = await issueAccountToken(id, 'verify_email', 30);
  try {
    await deliverAccountLink({
      email: address
    }, 'verify_email', token);
  } catch (error) {
    console.error('Mail delivery failed:', error.message);
    return send(res, 503, {
      error: 'تعذر إرسال رسالة التأكيد الآن. استخدم إعادة الإرسال بعد قليل'
    });
  }
  res.status(201).json({
    message: 'تم إنشاء حسابك، راجع بريدك الإلكتروني واضغط رابط التفعيل قبل تسجيل الدخول',
    pending: true
  });
}));
app.post('/api/auth/resend-verification', accountLimiter, asyncRoute(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const ok = {
    message: 'لو البريد مسجل ولم يتم تأكيده، ستصلك رسالة تفعيل جديدة'
  };
  if (!canRegister()) return send(res, 503, {
    error: 'خدمة البريد غير متاحة حاليًا'
  });
  if (!valid(email, 160)) return res.json(ok);
  const user = await get('SELECT id,email,status,email_verified_at,role FROM users WHERE email=?', email);
  if (user && user.role === 'student' && !user.email_verified_at && user.status === 'pending') {
    const token = await issueAccountToken(user.id, 'verify_email', 30);
    try {
      await deliverAccountLink(user, 'verify_email', token);
    } catch (error) {
      console.error('Resend failed:', error.message);
    }
  }
  res.json(ok);
}));
app.post('/api/auth/verify-email', accountLimiter, async (req, res) => {
  const token = req.body?.token;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return send(res, 400, {
    error: 'رابط التفعيل غير صالح'
  });
  const record = await get('SELECT * FROM auth_tokens WHERE token_hash=? AND purpose=? AND consumed_at IS NULL', tokenHash(token), 'verify_email');
  if (!record || Date.parse(record.expires_at) < Date.now()) return send(res, 400, {
    error: 'رابط التفعيل انتهت صلاحيته. اطلب رابطًا جديدًا'
  });
  const changed = await run('UPDATE auth_tokens SET consumed_at=? WHERE id=? AND consumed_at IS NULL', now(), record.id);
  if (!changed.changes) return send(res, 400, {
    error: 'تم استخدام رابط التفعيل بالفعل'
  });
  await run("UPDATE users SET email_verified_at=?,status=CASE WHEN role='student' THEN 'active' ELSE status END WHERE id=?", now(), record.user_id);
  res.json({
    ok: true,
    message: 'تم تأكيد البريد الإلكتروني. يمكنك الآن تسجيل الدخول'
  });
});
app.post('/api/auth/forgot-password', accountLimiter, asyncRoute(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const ok = {
    message: 'لو البريد مسجل ستصلك تعليمات تغيير كلمة المرور'
  };
  if (!valid(email, 160)) return res.json(ok);
  const user = await get("SELECT id,email FROM users WHERE email=? AND status='active'", email);
  if (user && canRegister()) {
    const token = await issueAccountToken(user.id, 'reset_password', 20);
    try {
      await deliverAccountLink(user, 'reset_password', token);
    } catch (error) {
      console.error('Password mail failed:', error.message);
    }
  }
  res.json(ok);
}));
app.post('/api/auth/reset-password', accountLimiter, asyncRoute(async (req, res) => {
  const {
    token,
    password
  } = req.body || {};
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || typeof password !== 'string' || password.length < 10 || password.length > 128) return send(res, 400, {
    error: 'الرابط أو كلمة المرور غير صالحين'
  });
  const record = await get('SELECT * FROM auth_tokens WHERE token_hash=? AND purpose=? AND consumed_at IS NULL', tokenHash(token), 'reset_password');
  if (!record || Date.parse(record.expires_at) < Date.now()) return send(res, 400, {
    error: 'الرابط انتهت صلاحيته. اطلب رابطًا جديدًا'
  });
  const changed = await run('UPDATE auth_tokens SET consumed_at=? WHERE id=? AND consumed_at IS NULL', now(), record.id);
  if (!changed.changes) return send(res, 400, {
    error: 'الرابط تم استخدامه'
  });
  await run('UPDATE users SET password_hash=?,email_verified_at=COALESCE(email_verified_at,?),session_version=session_version+1 WHERE id=?', await bcrypt.hash(password, 12), now(), record.user_id);
  await run('DELETE FROM auth_tokens WHERE user_id=? AND purpose=? AND consumed_at IS NULL', record.user_id, 'reset_password');
  res.json({
    ok: true,
    message: 'تم تغيير كلمة المرور. سجل دخولك من جديد'
  });
}));
app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const user = await get('SELECT * FROM users WHERE email=?', email);
  if (!user || typeof req.body?.password !== 'string' || !(await bcrypt.compare(req.body.password, user.password_hash))) return send(res, 401, {
    error: 'بيانات الدخول غير صحيحة'
  });
  if (user.status !== 'active') return send(res, 403, {
    error: user.status === 'pending' && user.role === 'student' ? 'راجع بريدك لتأكيد حسابك قبل تسجيل الدخول' : user.status === 'pending' ? 'حسابك ينتظر موافقة الإدارة' : 'الحساب غير مفعل'
  });
  const token = jwt.sign({
    sub: user.id,
    role: user.role,
    version: user.session_version || 0
  }, secret, {
    algorithm: 'HS256',
    expiresIn: '7d'
  });
  res.cookie('session', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 3600 * 1000,
    path: '/'
  });
  res.json({
    user: publicUser(user)
  });
}));
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('session', {
    path: '/',
    sameSite: 'strict'
  });
  res.json({
    ok: true
  });
});
app.get('/api/auth/me', auth, (req, res) => res.json({
  user: publicUser(req.user)
}));
app.patch('/api/my/profile', auth, async (req, res) => {
  const name = req.body?.name;
  if (!valid(name, 80)) return send(res, 400, {
    error: 'اكتب اسماً صحيحاً لا يتجاوز 80 حرفاً'
  });
  await run('UPDATE users SET name=? WHERE id=?', name.trim(), req.user.id);
  res.json({
    user: publicUser({
      ...req.user,
      name: name.trim()
    })
  });
});
app.get('/api/courses', async (req, res) => {
  const q = String(req.query.q || '').slice(0, 80),
    subject = String(req.query.subject || '').slice(0, 40);
  let sql = courseQuery + " WHERE c.status='published' AND u.status='active'",
    p = [];
  if (q) {
    sql += ' AND (c.title LIKE ? OR c.description LIKE ? OR u.name LIKE ?)';
    p.push(...Array(3).fill('%' + q + '%'));
  }
  if (subject) {
    sql += ' AND c.subject=?';
    p.push(subject);
  }
  const listing=await all(sql + ' ORDER BY c.created_at DESC', ...p);
  res.json({courses:await Promise.all(listing.map(async c=>({...c,enrolled:await countCurrentMembers(all,c.id)})))});
});
app.get('/api/courses/:id', async (req, res) => {
  const c = await get(courseQuery + ' WHERE c.id=?', req.params.id);
  if (!c) return send(res, 404, {
    error: 'الدورة غير موجودة'
  });
  res.json({
    course:{...c,enrolled:await countCurrentMembers(all,c.id)},
    lessons: await all('SELECT id,course_id,title,starts_at,duration_minutes,status FROM lessons WHERE course_id=? ORDER BY starts_at', c.id)
  });
});
app.get('/api/admin/subscriptions',auth,role('admin'),asyncRoute(async(req,res)=>{
 const rows=await all(`SELECT b.id,b.student_id,b.course_id,b.status AS booking_status,
  u.name AS student_name,u.email AS student_email,c.title AS course_title,c.price AS course_price,
  p.status AS payment_status,p.reviewed_at AS payment_reviewed_at,p.confirmed_on_phone,
  ${renewalEndSelect('b')}
  FROM bookings b JOIN users u ON u.id=b.student_id
  JOIN courses c ON c.id=b.course_id
  LEFT JOIN payment_submissions p ON p.booking_id=b.id
  WHERE b.status='approved' ORDER BY b.created_at DESC LIMIT 1000`);
 const memberships=rows.map(row=>({...row,...accessView(row)}));
 const counts={active:0,expiringSoon:0,expired:0,unpaid:0};
 for(const m of memberships){
  if(m.live_access_active){
   counts.active++;
   if(Number.isFinite(m.live_access_days_remaining)&&m.live_access_days_remaining<=5)counts.expiringSoon++;
  }else if(m.live_access_status==='expired')counts.expired++;
  else counts.unpaid++;
 }
 res.set('Cache-Control','no-store, private').json({memberships,counts});
}));
app.get('/api/student/dashboard', auth, role('student'), async (req, res) => {
  const id = req.user.id,
    asOf = now();
  const learningRows = await all(`SELECT c.id,c.title,c.subject,c.level,c.teacher_id,u.name AS teacher_name,
 (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id) AS total_lessons,
 (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id AND l.starts_at<?) AS started_lessons,
 (SELECT COUNT(*) FROM attendance a JOIN lessons l ON l.id=a.lesson_id WHERE l.course_id=c.id AND a.user_id=?) AS attended_lessons,
 (SELECT MIN(l.starts_at) FROM lessons l WHERE l.course_id=c.id AND l.starts_at>=?) AS next_lesson_at
 FROM bookings b JOIN courses c ON c.id=b.course_id JOIN users u ON u.id=c.teacher_id
 WHERE b.student_id=? AND b.status='approved' ORDER BY b.created_at DESC`, asOf, id, asOf, id);
  const allowedIds=new Set((await studentAccessRows(id)).filter(row=>evaluateMonthlyAccess(row).active).map(row=>row.course_id));
  const learning=learningRows.filter(row=>allowedIds.has(row.id));
  const attendance = (await all('SELECT lesson_id FROM attendance WHERE user_id=?', id)).map(row => row.lesson_id);
  res.json({
    learning,
    attendedLessonIds: attendance
  });
});
app.get('/api/my/overview', auth, async (req, res) => {
  const u = req.user;
  let courses,
    bookings = [];
  if (u.role === 'student') {
    bookings = await all(`SELECT b.*,(SELECT p.status FROM payment_submissions p WHERE p.booking_id=b.id) AS payment_status,(SELECT p.amount_egp FROM payment_submissions p WHERE p.booking_id=b.id) AS payment_amount,(SELECT p.review_note FROM payment_submissions p WHERE p.booking_id=b.id) AS payment_note,(SELECT p.reviewed_at FROM payment_submissions p WHERE p.booking_id=b.id) AS payment_reviewed_at,(SELECT p.confirmed_on_phone FROM payment_submissions p WHERE p.booking_id=b.id) AS confirmed_on_phone,${renewalEndSelect('b')},c.price,c.title AS course_title,c.subject,c.teacher_id,u.name AS teacher_name FROM bookings b JOIN courses c ON c.id=b.course_id JOIN users u ON u.id=c.teacher_id WHERE b.student_id=? ORDER BY b.created_at DESC`, u.id);
    const allowedIds=new Set(bookings.filter(b=>evaluateMonthlyAccess(b).active).map(b=>b.course_id));
    bookings=bookings.map(b=>({...b,...accessView(b)}));
    courses = (await all(courseQuery + ` WHERE c.id IN (SELECT course_id FROM bookings WHERE student_id=? AND status='approved')`, u.id)).filter(c=>allowedIds.has(c.id));
  } else if (u.role === 'teacher') {
    courses = await all(courseQuery + ' WHERE c.teacher_id=?', u.id);
    bookings = await all(`SELECT b.*,c.title AS course_title,u.name AS student_name,u.email AS student_email FROM bookings b JOIN courses c ON c.id=b.course_id JOIN users u ON u.id=b.student_id WHERE c.teacher_id=? ORDER BY b.created_at DESC`, u.id);
  } else {
    courses = await all(courseQuery);
    bookings = await all(`SELECT b.*,c.title AS course_title,c.price AS course_price,(SELECT p.status FROM payment_submissions p WHERE p.booking_id=b.id) AS payment_status,(SELECT p.confirmed_on_phone FROM payment_submissions p WHERE p.booking_id=b.id) AS confirmed_on_phone,u.name AS student_name FROM bookings b JOIN courses c ON c.id=b.course_id JOIN users u ON u.id=b.student_id ORDER BY b.created_at DESC`);
  }
  courses=await Promise.all(courses.map(async c=>({...c,enrolled:await countCurrentMembers(all,c.id)})));
  const lessons = await all(`SELECT l.id,l.title,l.course_id,l.starts_at,l.duration_minutes,l.status,l.meet_url,c.title AS course_title FROM lessons l JOIN courses c ON c.id=l.course_id WHERE ${u.role === 'student' ? "c.id IN (SELECT course_id FROM bookings WHERE student_id=? AND status='approved')" : u.role === 'teacher' ? 'c.teacher_id=?' : '1=1'} ORDER BY l.starts_at ASC LIMIT 120`, ...(u.role === 'admin' ? [] : [u.id]));
  const visibleLessons=u.role==='student'?(await studentAccessRows(u.id)).reduce((ids,row)=>{if(evaluateMonthlyAccess(row).active)ids.add(row.course_id);return ids},new Set()):null;
  const accessibleLessons=visibleLessons?lessons.filter(l=>visibleLessons.has(l.course_id)):lessons;
  res.json({
    courses,
    bookings,
    lessons:accessibleLessons,
    stats: {
      courses: courses.length,
      bookings: bookings.length,
      upcoming: accessibleLessons.filter(x => x.status !== 'ended' && Date.parse(x.starts_at) > Date.now()).length
    }
  });
});
app.post('/api/courses/:id/book', auth, role('student'), async (req, res) => {
  const c = await get('SELECT * FROM courses WHERE id=? AND status=?', req.params.id, 'published');
  if (!c) return send(res, 404, {
    error: 'الدورة غير متاحة'
  });
  if (await get('SELECT id FROM bookings WHERE student_id=? AND course_id=?', req.user.id, c.id)) return send(res, 409, {
    error: 'قدمت طلبًا للدورة بالفعل'
  });
  const count=await countCurrentMembers(all,c.id);
  if (count >= c.capacity) return send(res, 409, {
    error: 'لا توجد أماكن متاحة'
  });
  await run('INSERT INTO bookings(id,course_id,student_id,status,created_at) VALUES(?,?,?,?,?)', uid(), c.id, req.user.id, 'pending', now());
  res.status(201).json({
    message:Number(c.price)>0?'تم تسجيل طلبك. لا ترسل أي تحويل قبل ظهور وسيلة الدفع المعتمدة داخل حساب الطالب؛ يظل دخول الحصة معلقًا حتى تؤكد الإدارة الاشتراك.':'تم إرسال طلب الالتحاق بالدورة المجانية. انتظر موافقة الإدارة على الحجز.'
  });
});
app.post('/api/courses', auth, role('teacher', 'admin'), async (req, res) => {
  const values = parseCourse({
    ...req.body,
    price: req.body?.price ?? 0,
    capacity: req.body?.capacity ?? 30,
    duration_minutes: req.body?.duration_minutes ?? 60
  });
  if (!values) return send(res, 400, {
    error: 'بيانات الدورة غير صحيحة'
  });
  const id = uid(),
    teacherId = req.user.role === 'teacher' ? req.user.id : req.body?.teacher_id || req.user.id;
  if (!(await get("SELECT id FROM users WHERE id=? AND role IN ('teacher','admin') AND status='active'", teacherId))) return send(res, 400, {
    error: 'حدد مدرسًا نشطًا أو المُدرِّسة'
  });
  await run('INSERT INTO courses(id,title,description,subject,level,price,duration_minutes,capacity,teacher_id,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)', id, values.title, values.description, values.subject, values.level, values.price, values.duration_minutes, values.capacity, teacherId, 'published', now());
  res.status(201).json({
    id
  });
});
app.patch('/api/courses/:id', auth, role('teacher', 'admin'), async (req, res) => {
  const course = await get('SELECT * FROM courses WHERE id=?', req.params.id);
  if (!course) return send(res, 404, {
    error: 'الدورة غير موجودة'
  });
  if (!owns(course, req.user)) return send(res, 403, {
    error: 'ليس لديك صلاحية تعديل هذه الدورة'
  });
  if (req.user.role === 'teacher' && req.body?.teacher_id !== undefined && req.body.teacher_id !== course.teacher_id) return send(res, 403, {
    error: 'لا يمكنك نقل الدورة لمدرس آخر'
  });
  const values = parseCourse({
    ...course,
    ...req.body
  });
  if (!values) return send(res, 400, {
    error: 'بيانات الدورة غير صحيحة'
  });
  const enrolled=await countCurrentMembers(all,course.id);
  if (values.capacity < enrolled) return send(res, 409, {
    error: 'عدد المقاعد لا يمكن أن يقل عن الطلاب المقبولين'
  });
  if(Number(course.price)===0&&values.price>0&&Number(enrolled)>0)return send(res,409,{error:'لا يمكن تحويل دورة مجانية بها طلاب مقبولون إلى اشتراك مدفوع؛ أنشئي دورة مدفوعة جديدة للحفاظ على حقوق الطلاب'});
  const teacherId = req.user.role === 'admin' && req.body?.teacher_id !== undefined ? req.body.teacher_id : course.teacher_id;
  if (!(await get("SELECT id FROM users WHERE id=? AND role IN ('teacher','admin') AND status='active'", teacherId))) return send(res, 400, {
    error: 'حدد مدرسًا نشطًا أو المُدرِّسة'
  });
  await run('UPDATE courses SET title=?,description=?,subject=?,level=?,price=?,duration_minutes=?,capacity=?,teacher_id=? WHERE id=?', values.title, values.description, values.subject, values.level, values.price, values.duration_minutes, values.capacity, teacherId, course.id);
  res.json({
    ok: true,
    id: course.id
  });
});
app.post('/api/courses/:id/lessons', auth, role('teacher', 'admin'), async (req, res) => {
  const c = await get('SELECT * FROM courses WHERE id=?', req.params.id);
  if (!c) return send(res, 404, {
    error: 'الدورة غير موجودة'
  });
  if (!owns(c, req.user)) return send(res, 403, {
    error: 'ليس لديك صلاحية'
  });
  const {
    title,
    starts_at,
    duration_minutes = c.duration_minutes
  } = req.body || {};
  if (!valid(title, 160) || !Number.isFinite(Date.parse(starts_at)) || Date.parse(starts_at) < Date.now() - 60000 || +duration_minutes < 15 || +duration_minutes > 240) return send(res, 400, {
    error: 'حدد عنوانًا وموعدًا قادمًا ومدة صحيحة'
  });
  const id = uid();
  if(req.body?.meet_url)return send(res,400,{error:'الحصص المباشرة داخل الموقع عبر LiveKit؛ لا تضعي رابط Google Meet'});
  await run('INSERT INTO lessons(id,course_id,title,starts_at,duration_minutes,status,room_key,created_at,meet_url) VALUES(?,?,?,?,?,?,?,?,?)', id, c.id, title, new Date(starts_at).toISOString(), +duration_minutes, 'scheduled', uid(), now(),null);
  res.status(201).json({
    id
  });
});
app.patch('/api/lessons/:id', auth, role('teacher', 'admin'), async (req, res) => {
  const lesson = await get('SELECT l.*,c.teacher_id FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.id=?', req.params.id);
  if (!lesson) return send(res, 404, {
    error: 'الحصة غير موجودة'
  });
  if (!owns(lesson, req.user)) return send(res, 403, {
    error: 'ليس لديك صلاحية تعديل الحصة'
  });
  if (lesson.status !== 'scheduled' || Date.parse(lesson.starts_at) < Date.now()) return send(res, 409, {
    error: 'لا يمكن تعديل حصة بدأت أو انتهت'
  });
  const values = parseLesson({
    ...lesson,
    ...req.body
  });
  if (!values) return send(res, 400, {
    error: 'حدد عنوانًا وموعدًا قادمًا ومدة صحيحة'
  });
  if(req.body?.meet_url)return send(res,400,{error:'لا يلزم رابط Google Meet؛ البث متاح داخل موقع المُدرِّسة'});
  await run('UPDATE lessons SET title=?,starts_at=?,duration_minutes=?,meet_url=? WHERE id=?', values.title, values.starts_at, values.duration_minutes,null,lesson.id);
  res.json({
    ok: true,
    id: lesson.id
  });
});
// Director/instructor may extend or shorten a scheduled or in-progress
// lesson without changing student subscriptions. Ending immediately is the
// separate room moderation action that disconnects existing participants.
app.patch('/api/lessons/:id/duration', auth, role('teacher', 'admin'), async (req,res)=>{
 const lesson=await get('SELECT l.id,l.starts_at,l.duration_minutes,l.status,c.teacher_id FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.id=?',req.params.id);
 if(!lesson)return send(res,404,{error:'الحصة غير موجودة'});
 if(!owns(lesson,req.user))return send(res,403,{error:'تغيير المدة متاح لمقدمة الحصة فقط'});
 if(lesson.status!=='scheduled')return send(res,409,{error:'لا يمكن تعديل حصة انتهت'});
 const value=Number(req.body?.duration_minutes);
 if(!Number.isInteger(value)||value<15||value>240)return send(res,400,{error:'اختاري مدة صحيحة من 15 إلى 240 دقيقة'});
 const start=Date.parse(lesson.starts_at),clock=Date.now();
 const presentEnd=start+Number(lesson.duration_minutes)*60000+30*60000;
 if(!Number.isFinite(start)||clock>presentEnd)return send(res,409,{error:'انتهت نافذة تعديل هذه الحصة'});
 if(clock>=start && start+value*60000<clock+3*60000)
  return send(res,409,{error:'المدة المختارة يجب أن تترك ثلاث دقائق على الأقل من وقت الحصة'});
 await run("UPDATE lessons SET duration_minutes=? WHERE id=? AND status='scheduled'",value,lesson.id);
 res.set('Cache-Control','no-store').json({ok:true,duration_minutes:value,starts_at:lesson.starts_at,
  ends_at:new Date(start+value*60000).toISOString(),
  note:'تم تحديث موعد نهاية الحصة. لإنهاء اتصال الطلاب الحاليين فورًا استخدمي زر إنهاء الحصة للجميع.'});
});
// Paid bookings are settled exclusively by a verified payment decision.
// The generic booking action may RECONCILE an already confirmed payment but
// may never revoke an approved booking or approve an unconfirmed transfer.
// Each decision is atomic and locks the course row to serialize seat checks.
app.patch('/api/bookings/:id',auth,role('teacher','admin'),async(req,res)=>{
 const status=req.body?.status;
 if(!['approved','rejected'].includes(status))return send(res,400,{error:'الحالة غير صحيحة'});
 const outcome=await withTransaction(async tx=>{
  const lock=isCloudDatabase?' FOR UPDATE OF b,c':'';
  const booking=await tx.get('SELECT b.*,c.teacher_id,c.capacity,c.price FROM bookings b JOIN courses c ON c.id=b.course_id WHERE b.id=?'+lock,req.params.id);
  if(!booking)return{http:404,error:'الحجز غير موجود'};
  if(!owns(booking,req.user))return{http:403,error:'ليس لديك صلاحية لهذا الحجز'};
  if(booking.status!=='pending')return{http:409,error:'الحجز حُسم بالفعل؛ لا يمكن إعادة قبوله أو رفضه من القائمة'};
  if(Number(booking.price)>0){
   const payment=await tx.get('SELECT status,confirmed_on_phone FROM payment_submissions WHERE booking_id=?'+(isCloudDatabase?' FOR UPDATE':''),booking.id);
   if(status==='approved'){
    if(req.user.role!=='admin')return{http:403,error:'استكمال حجز مدفوع يتطلب صلاحية المديرة'};
    const verified=payment?.confirmed_on_phone===true||payment?.confirmed_on_phone===1;
    if(payment?.status!=='approved'||!verified)return{http:409,error:'الحجز المدفوع لا يتفعّل إلا إذا كان تحويله معتمدًا ومؤكد الوصول'};
   }else if(payment?.status==='approved'||payment?.status==='pending'){
    return{http:409,error:'لا يمكن رفض حجز له تحويل معتمد أو قيد الفحص؛ افتحي سجل المدفوعات أولًا'};
   }
  }
  if(status==='approved'){
   const occupied=await countCurrentMembers(tx.all,booking.course_id);
   if(Number(occupied)>=Number(booking.capacity))return{http:409,error:'اكتمل عدد المقاعد؛ لم يتغيّر الحجز'};
  }
  const updated=await tx.run("UPDATE bookings SET status=?,reviewed_at=? WHERE id=? AND status='pending'",status,now(),booking.id);
  if(!updated.changes)throw Error('Concurrent booking moderation conflict');
  return{http:200,ok:true,status};
 });
 return send(res,outcome.http,outcome.error?{error:outcome.error}:{ok:true,status:outcome.status});
});
app.get('/api/courses/:id/attendance', auth, role('teacher', 'admin'), async (req, res) => {
  const c = await get('SELECT id,title,teacher_id FROM courses WHERE id=?', req.params.id);
  if (!c) return send(res, 404, {
    error: 'الدورة غير موجودة'
  });
  if (!owns(c, req.user)) return send(res, 403, {
    error: 'لا يمكنك مشاهدة حضور هذه الدورة'
  });
  const attendance = await all(`SELECT a.lesson_id,a.user_id,a.joined_at,u.name AS student_name,u.email AS student_email,l.title AS lesson_title,l.starts_at
 FROM attendance a JOIN lessons l ON l.id=a.lesson_id JOIN users u ON u.id=a.user_id
 WHERE l.course_id=? ORDER BY l.starts_at DESC,a.joined_at`, c.id);
  const lessons = await all('SELECT id,title,starts_at FROM lessons WHERE course_id=? ORDER BY starts_at DESC', c.id);
  res.json({
    course: {
      id: c.id,
      title: c.title
    },
    lessons,
    attendance
  });
});
app.get('/api/admin/dashboard', auth, role('admin'), async (req, res) => {
  const count = async (sql, ...params) => (await get(sql, ...params)).n;
  const statistics = {
    students: await count("SELECT COUNT(*) AS n FROM users WHERE role='student' AND status='active'"),
    teachers: await count("SELECT COUNT(*) AS n FROM users WHERE role='teacher' AND status='active'"),
    pendingTeachers: await count("SELECT COUNT(*) AS n FROM users WHERE role='teacher' AND status='pending'"),
    courses: await count("SELECT COUNT(*) AS n FROM courses WHERE status='published'"),
    upcomingLessons: await count("SELECT COUNT(*) AS n FROM lessons WHERE status='scheduled' AND starts_at>=?", now()),
    pendingBookings: await count("SELECT COUNT(*) AS n FROM bookings WHERE status='pending'"),
    approvedBookings: await count("SELECT COUNT(*) AS n FROM bookings WHERE status='approved'")
  };
  const latestUsers = await all("SELECT id,name,email,role,status,created_at FROM users ORDER BY created_at DESC LIMIT 7");
  const upcomingLessons = await all(`SELECT l.id,l.title,l.starts_at,l.duration_minutes,c.id AS course_id,c.title AS course_title,u.name AS teacher_name
 FROM lessons l JOIN courses c ON c.id=l.course_id JOIN users u ON u.id=c.teacher_id
 WHERE l.status='scheduled' AND l.starts_at>=? ORDER BY l.starts_at ASC LIMIT 6`, now());
  const pendingBookings = await all(`SELECT b.id,b.created_at,c.title AS course_title,u.name AS student_name
 FROM bookings b JOIN courses c ON c.id=b.course_id JOIN users u ON u.id=b.student_id
 WHERE b.status='pending' ORDER BY b.created_at DESC LIMIT 6`);
  const dailyRegistrations = await all("SELECT substr(created_at,1,10) AS day,COUNT(*) AS total FROM users WHERE created_at>=? GROUP BY substr(created_at,1,10)", new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10));
  const registrationTrend = Array.from({
    length: 7
  }, (_, i) => {
    const day = new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10);
    return {
      day,
      total: dailyRegistrations.find(x => x.day === day)?.total || 0
    };
  });
  res.json({
    statistics,
    latestUsers,
    upcomingLessons,
    pendingBookings,
    registrationTrend
  });
});
app.get('/api/admin/users', auth, role('admin'), async (req, res) => res.json({
  users: await all('SELECT id,name,email,role,status,specialty,created_at FROM users ORDER BY created_at DESC')
}));
app.patch('/api/admin/users/:id', auth, role('admin'), async (req, res) => {
  const status = req.body?.status;
  if (!['active', 'blocked'].includes(status)) return send(res, 400, {
    error: 'الحالة غير صحيحة'
  });
  const user = await get('SELECT id,role,email_verified_at,status FROM users WHERE id=?', req.params.id);
  if (!user) return send(res, 404, {
    error: 'المستخدم غير موجود'
  });
  if (user.id === req.user.id || user.role === 'admin') return send(res, 403, {
    error: 'لا يمكن تعديل هذا الحساب الإداري'
  });
  if(status==='active'&&user.role==='student'&&!user.email_verified_at)return send(res,409,{error:'لا يمكن تفعيل الطالب قبل تأكيد بريده الإلكتروني'});
  await run('UPDATE users SET status=? WHERE id=?', status, user.id);
  res.json({
    ok: true
  });
});
// The LiveKit SFU handles video and audio. This API controls room access and consent-based participation.
const roomLesson = async id => await get('SELECT l.*,c.teacher_id,c.capacity,c.title AS course_title FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.id=?', id);
const isLessonHost = (l, u) => u.role === 'admin' || u.role === 'teacher' && l.teacher_id === u.id;
const canStudentAttend = async (l,u)=>u.role==='student'&&(await studentCanStream(l.course_id,u.id));
const isBanned = async (l, userId) => !!(await get('SELECT student_id FROM lesson_bans WHERE lesson_id=? AND student_id=?', l.id, userId));
const roomPermitted = async (l, user) => isLessonHost(l, user) || (await canStudentAttend(l, user)) && !(await isBanned(l, user.id));
const selectedStudent = async(l,id)=>{
 const student=await get("SELECT u.id,u.name FROM users u WHERE u.id=? AND u.role='student' AND u.status='active'",id);
 return student&&(await studentCanStream(l.course_id,id))?student:null;
};
attachClassroomQuestions(app,{auth,role,get,all,run,uid,now,roomLesson,roomPermitted,isLessonHost});
app.get('/api/lessons/:id/classroom', auth, async (req, res) => {
  const l = await roomLesson(req.params.id);
  if (!l) return send(res, 404, {
    error: 'الحصة غير موجودة'
  });
  if (!(await roomPermitted(l, req.user))) return send(res, 403, {
    error: 'ليس لديك صلاحية دخول هذا الفصل'
  });
  const host = isLessonHost(l, req.user);
  const raised = host ? false : !!(await get('SELECT student_id FROM lesson_hands WHERE lesson_id=? AND student_id=?', l.id, req.user.id));
  const mode = host ? 'host' : (await get('SELECT mode FROM lesson_speakers WHERE lesson_id=? AND student_id=?', l.id, req.user.id))?.mode || '';
  const raisedHands=host?await all("SELECT h.student_id,h.raised_at,u.name FROM lesson_hands h JOIN users u ON u.id=h.student_id JOIN bookings b ON b.student_id=u.id AND b.course_id=? AND b.status='approved' WHERE h.lesson_id=? AND u.status='active' ORDER BY h.raised_at LIMIT 100",l.course_id,l.id):[];
  const hands=host?(await Promise.all(raisedHands.map(async hand=>(await studentCanStream(l.course_id,hand.student_id))?hand:null))).filter(Boolean):[];
  const speakers = host ? await all('SELECT s.student_id,s.mode,s.approved_at,u.name FROM lesson_speakers s JOIN users u ON u.id=s.student_id WHERE s.lesson_id=? ORDER BY s.approved_at', l.id) : [];
  res.json({
    isHost: host,
    handRaised: raised,
    speakerMode: mode,
    hands,
    speakers,
    status: l.status,
    starts_at: l.starts_at,
    duration_minutes: l.duration_minutes,
    ends_at: new Date(Date.parse(l.starts_at)+Number(l.duration_minutes)*60000).toISOString(),
    qaEnabled: classroomQuestionsEnabled(),
    maxActiveSpeakers: MAX_ACTIVE_SPEAKERS
  });
});
const handLimiter = rateLimit({
  windowMs: 60000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: req => req.user.id,
  message: {
    error: 'محاولات كثيرة، انتظر دقيقة قبل رفع اليد مرة أخرى'
  }
});
app.post('/api/lessons/:id/hand', auth, role('student'), handLimiter, async (req, res) => {
  const l = await roomLesson(req.params.id);
  if (!l) return send(res, 404, {
    error: 'الحصة غير موجودة'
  });
  if (!(await roomPermitted(l, req.user))) return send(res, 403, {
    error: 'هذه الحصة ليست متاحة لك'
  });
  if (l.status !== 'scheduled') return send(res, 409, {
    error: 'الحصة انتهت'
  });
  if (typeof req.body?.raised !== 'boolean') return send(res, 400, {
    error: 'طلب رفع اليد غير صحيح'
  });
  if (req.body.raised) await run('INSERT OR IGNORE INTO lesson_hands(lesson_id,student_id,raised_at) VALUES(?,?,?)', l.id, req.user.id, now());else await run('DELETE FROM lesson_hands WHERE lesson_id=? AND student_id=?', l.id, req.user.id);
  res.json({
    ok: true,
    handRaised: req.body.raised
  });
});
app.post('/api/lessons/:id/moderate', auth, role('teacher', 'admin'), asyncRoute(async (req, res) => {
  const l = await roomLesson(req.params.id);
  if (!l) return send(res, 404, {
    error: 'الحصة غير موجودة'
  });
  if (!isLessonHost(l, req.user)) return send(res, 403, {
    error: 'إدارة الفصل متاحة للمعلمة المسؤولة فقط'
  });
  if (l.status !== 'scheduled') return send(res, 409, {
    error: 'الحصة انتهت بالفعل'
  });
  const action = req.body?.action,
    id = req.body?.student_id;
  if (!['allow_audio', 'allow_camera', 'revoke', 'mute_all', 'remove', 'clear_hand', 'end_room'].includes(action)) return send(res, 400, {
    error: 'أمر إدارة غير معروف'
  });
  if (action === 'clear_hand') {
    if (typeof id !== 'string' || !(await selectedStudent(l, id))) return send(res, 400, {
      error: 'الطالب غير موجود في الدورة'
    });
    await run('DELETE FROM lesson_hands WHERE lesson_id=? AND student_id=?', l.id, id);
    return res.json({
      ok: true
    });
  }
  if (!roomService) return send(res, 503, {
    error: 'يجب تفعيل LiveKit على الخادم قبل استخدام إدارة البث'
  });
  if (['allow_audio', 'allow_camera', 'revoke', 'remove'].includes(action)) {
    if (typeof id !== 'string' || !(await selectedStudent(l, id))) return send(res, 400, {
      error: 'الطالب غير موجود في الدورة'
    });
  }
  try {
    if (action === 'end_room') {
      try {
        await roomService.deleteRoom(l.room_key);
      } catch (e) {
        if (!/not found|404|does not exist/i.test(String(e.message))) throw e;
      }
      await run("UPDATE lessons SET status='ended' WHERE id=?", l.id);
      await run('DELETE FROM lesson_hands WHERE lesson_id=?', l.id);
      await run('DELETE FROM lesson_speakers WHERE lesson_id=?', l.id);
    } else if (action === 'mute_all') {
      const participants = await roomService.listParticipants(l.room_key);
      const studentRows = await all("SELECT id FROM users WHERE role='student' AND status='active'");
      const liveStudentIds = new Set(studentRows.map(x => x.id));
      const students = participants.filter(p => liveStudentIds.has(p.identity));
      for (let i = 0; i < students.length; i += 16) {
        await Promise.all(students.slice(i, i + 16).map(p => roomService.updateParticipant(l.room_key, p.identity, {
          permission: participantPermission('')
        })));
      }
      await run('DELETE FROM lesson_speakers WHERE lesson_id=?', l.id);
    } else if (action === 'remove') {
      await run('INSERT OR IGNORE INTO lesson_bans(lesson_id,student_id,banned_at) VALUES(?,?,?)', l.id, id, now());
      try {
        await roomService.removeParticipant(l.room_key, id, {
          revokeTokenTs: BigInt(Math.floor(Date.now() / 1000) + 1)
        });
      } catch (e) {
        await run('DELETE FROM lesson_bans WHERE lesson_id=? AND student_id=?', l.id, id);
        throw e;
      }
      await run('DELETE FROM lesson_hands WHERE lesson_id=? AND student_id=?', l.id, id);
      await run('DELETE FROM lesson_speakers WHERE lesson_id=? AND student_id=?', l.id, id);
    } else {
      if (await isBanned(l, id)) return send(res, 403, {
        error: 'الطالب مستبعد من هذه الحصة'
      });
      const mode = action === 'allow_camera' ? 'camera' : action === 'allow_audio' ? 'microphone' : '';
      const existing = !!(await get('SELECT student_id FROM lesson_speakers WHERE lesson_id=? AND student_id=?', l.id, id));
      if (mode && !existing && (await get('SELECT COUNT(*) AS n FROM lesson_speakers WHERE lesson_id=?', l.id)).n >= MAX_ACTIVE_SPEAKERS) return send(res, 409, {
        error: 'وصلت للحد الأقصى من الميكروفونات المفتوحة'
      });
      await roomService.updateParticipant(l.room_key, id, {
        permission: participantPermission(mode)
      });
      if (mode) await run('INSERT INTO lesson_speakers(lesson_id,student_id,mode,approved_at) VALUES(?,?,?,?) ON CONFLICT(lesson_id,student_id) DO UPDATE SET mode=excluded.mode,approved_at=excluded.approved_at', l.id, id, mode, now());else await run('DELETE FROM lesson_speakers WHERE lesson_id=? AND student_id=?', l.id, id);
      if (mode) await run('DELETE FROM lesson_hands WHERE lesson_id=? AND student_id=?', l.id, id);
    }
    return res.json({
      ok: true
    });
  } catch (err) {
    if (/not.found|404|no.such.participant/i.test(String(err?.message))) return send(res, 409, {
      error: 'الطالب ليس متصلاً بالفصل الآن'
    });
    console.error('LiveKit moderation failed:', err?.message);
    return send(res, 503, {
      error: 'تعذر الاتصال بخدمة الفصل المباشر، حاول مرة أخرى'
    });
  }
}));
app.get('/api/lessons/:id', auth, async (req, res) => {
  const l = await get('SELECT l.id,l.title,l.course_id,l.starts_at,l.duration_minutes,l.status,l.meet_url,c.title AS course_title,c.teacher_id FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.id=?', req.params.id);
  if (!l) return send(res, 404, {
    error: 'الحصة غير موجودة'
  });
  if (!(await roomPermitted(l, req.user))) return send(res, 403, {
    error: 'الحصة للطلاب المقبولين فقط'
  });
  const liveWindow=Date.now()>=Date.parse(l.starts_at)-15*60000&&Date.now()<=Date.parse(l.starts_at)+(l.duration_minutes+30)*60000;
  if(req.user.role==='student'&&!liveWindow)l.meet_url=null;
  res.json({
    lesson: l,
    videoConfigured: !!(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET),
    videoLocalOnly: localVideo
  });
});
const classroomJoinLimiter=rateLimit({
 windowMs:60000,
 limit:req=>req.user.role==='student'?30:80,
 keyGenerator:req=>req.user.id,
 standardHeaders:'draft-8',legacyHeaders:false,
 message:{code:'JOIN_RATE_LIMITED',error:'طلبات دخول كثيرة لهذا الحساب. انتظر قليلًا قبل إعادة المحاولة.'}
});
app.post('/api/lessons/:id/token',auth,classroomJoinLimiter,admission.middleware,asyncRoute(async(req,res)=>{
  const l = await get('SELECT l.*,c.teacher_id FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.id=?', req.params.id);
  if (!l) return send(res, 404, {
    error: 'الحصة غير موجودة'
  });
  const teacher = req.user.role === 'teacher' && req.user.id === l.teacher_id,
    admin = req.user.role === 'admin';
  if (!(await roomPermitted(l, req.user))) return send(res, 403, {
    error: 'غير مسموح بدخول البث'
  });
  if (l.status !== 'scheduled') return send(res, 409, {
    error: 'هذه الحصة انتهت'
  });
  const starts = Date.parse(l.starts_at),
    ends = starts + l.duration_minutes * 60000;
  const host = admin || teacher;
  // The host can enter early for device rehearsal; students are still blocked
  // until 15 minutes before the scheduled lesson. An ended room stays closed.
  if (!Number.isFinite(starts) || Date.now() > ends + 30 * 60000 || (!host && Date.now() < starts - 15 * 60000)) return send(res, 403, {
    error: host ? 'انتهى وقت الاستوديو لهذه الحصة' : 'دخول الطلاب متاح من 15 دقيقة قبل الدرس وحتى 30 دقيقة بعد انتهائه'
  });
  if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) return send(res, 503, {
    error: 'لم يتم إعداد مزود البث LiveKit بعد'
  });
  const speakerMode = admin || teacher ? 'host' : (await get('SELECT mode FROM lesson_speakers WHERE lesson_id=? AND student_id=?', l.id, req.user.id))?.mode || '';
  const grant = videoGrant(req.user.role, speakerMode);
  const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity: req.user.id,
    name: req.user.name,
    // The student's player selects the active director's video even when an
    // older course points to a different teacher_id. Only the server assigns
    // these roles; students cannot elevate themselves through client input.
    metadata: JSON.stringify({mrsSofiaRole: admin ? 'director' : teacher ? 'instructor' : 'viewer'}),
    ttl: '30m'
  });
  token.addGrant({
    roomJoin: true,
    room: l.room_key,
    ...grant
  });
  res.set('Cache-Control','no-store, private').json({
    token: await token.toJwt(),
    serverUrl: process.env.LIVEKIT_URL,
    teacherId: l.teacher_id,
    lessonId: l.id,
    role: req.user.role,
    isHost: admin || teacher,
    canPublish: grant.canPublish,
    speakerMode
  });
}));
app.use('/api', (req, res) => send(res, 404, {
  error: 'المسار المطلوب غير موجود'
}));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
app.use(express.static(path.join(root, 'dist')));
app.get('/{*splat}', (req, res) => res.sendFile(path.join(root, 'dist', 'index.html'), e => {
  if (e && !res.headersSent) send(res, 404, {
    error: 'Not found'
  });
}));
app.use((err, req, res, next) => {
  console.error(err);
  send(res, 500, {
    error: 'حدث خطأ داخلي. حاول مرة أخرى'
  });
});
const bindHost = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
await checkConnection();
app.listen(PORT, bindHost, () => {
 console.log('Miss Sofia server listening on ' + bindHost + ':' + PORT);
 if(process.env.NODE_ENV==='production'){
  // Logs contain boolean-only readiness; no secret, wallet number or user data.
  void readSchoolDiagnostics().then(result=>{
   console.log('Miss Sofia operations audit',JSON.stringify({
    db:result.databaseConnected,livekit:result.livekitApiVerified,
    privateProofBucket:result.receiptBucketPrivateVerified,
    proofStorageConfigured:result.privateReceiptStorageConfigured,
    studentSignup:result.guardianRegistrationAllowed,
    privacyApproved:result.privacyApproved,
    schoolContact:result.schoolContactConfigured,
    walletConfigured:result.walletConfigured,
    mailProviderConfigured:result.mailProviderConfigured
   }));
  }).catch(()=>console.warn('Miss Sofia operations audit unavailable'));
 }
});
