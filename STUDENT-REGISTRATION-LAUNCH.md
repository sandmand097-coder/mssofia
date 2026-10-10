# Miss Sofia — Google guardian registration launch

## Scope
Public registration may create **one student profile per verified guardian Google account**.
The director remains the preapproved, separate admin Google identity.
Password-email signup stays disabled until email delivery is verified.
Paid enrollment, wallet transfers and receipt uploads remain unavailable
until the private storage service and payment policies have been verified.

The public guardian contact is the school's existing published telephone number:
01027661546. Do not publish the director's private admin Google email.
The school privacy notice explains the guardian-controlled identity, child data,
access/deletion requests, LiveKit controls, and international service providers.

## Production configuration

Render web service: mssofia onrender.com
- PUBLIC_LAUNCH_MODE=full
- GOOGLE_ADMIN_LOGIN_ENABLED=true (existing)
- GOOGLE_STUDENT_LOGIN_ENABLED=true
- REGISTRATION_ENABLED=true
- SCHOOL_PRIVACY_APPROVED=true (school operator must approve published policy)
- SCHOOL_SUPPORT_PHONE=01027661546
- APP_ORIGIN=https://mssofia.pages.dev
- Existing verified PostgreSQL/JWT/Google and LiveKit credentials remain unchanged.

Cloudflare Pages project: mssofia
- PUBLIC_LAUNCH_MODE=full
- FULL_BACKEND_READY=true
- API_ORIGIN=https://mssofia.onrender.com
- Redeploy the built dist assets after the server shows full mode.

## Safety checks
- GET /api/health responds with mode full and registrationAvailable true.
- GET /api/auth/google/config advertises studentEnabled and
  studentRegistrationAvailable true.
- GET /api/auth/registration-status advertises googleRegistrationAvailable true,
  emailRegistrationAvailable false.
- Parent enters child name and manually checks guardian consent. Google Identity
  verifies issuer, audience, email, immutable subject, and parent ownership.
- The admin email cannot be registered as a student. No student gains admin role.
- Students' course bookings are pending until the director approves them.
  Paid bookings cannot be approved without verified payment_submissions status.
- POST /api/auth/register is blocked while outbound verification email is absent.
- POST /api/lessons/:id/token is denied for students without approved bookings.
- Financial uploads stay off until a separate server check confirms private
  receipt storage and actual wallet details. Never tell parents to transfer
  money before the verified payment configuration appears on the student page.
- Rate limits, HttpOnly secure SameSite cookies, strict origin validation, and
  RLS for user tables are expected to remain in place.
- LiveKit never grants student publish rights before teacher moderation.
- Verify browser QA on 390px and 1366px screens.

### Repeatable QA
- npm run check
- npm test
- npm run build
- npm run test:guardian:browser
- npm run test:operations:browser
- npm run test:classroom:browser
- node qa-cloudflare-student-registration.mjs (production, read-only)

## Rollback
To restore administrator-only access without losing database accounts:
1. Render: set PUBLIC_LAUNCH_MODE=admin, REGISTRATION_ENABLED=false,
   SCHOOL_PRIVACY_APPROVED=false and GOOGLE_STUDENT_LOGIN_ENABLED=false in
   the same environment update; wait for Render LIVE.
2. Cloudflare Pages: set PUBLIC_LAUNCH_MODE=admin and redeploy the current dist.
3. Confirm GET /api/health mode admin and student registration blocked.
Do not delete tables or invalidate the director account as part of rollback.

## Outstanding
- Conduct a supervised genuine Google-parent account sign-up (do not use a
  spoofed identity or disclose tokens) and validate the registered record.
- Verify the school's legal/privacy notice and retention/contact obligations.
- Verify private receipt storage and payment policy before taking payments.
- Confirm a real two-device LiveKit class before admitting paying students.
