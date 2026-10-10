# Miss Sofia — Student registration, manual payment and live classroom

## Currently deployed
The production website is https://mssofia.pages.dev and the protected backend is
https://mssofia.onrender.com. Administrator-only enrollment phase is operational.
The school-controlled Supabase project is wnkewiulyobbjftckfqb.

**Public student registration and receiving payments are intentionally OFF until
the school has approved the privacy/guardian policies and confirmed the required
external service settings.** There is no workaround that makes unverified children
accounts or real money transfers safe.

## How Miss Sofia creates a course and begins a class
1. Log in as the preapproved director via https://mssofia.pages.dev/login using Google.
2. Open **لوحة الإدارة** > **دليل التشغيل** to review the launch checklist and workflow.
3. Open **الدورات** > **دورة جديدة**. Enter the science subject, school stage,
   description, price (EGP), capacity, duration; assign the director account.
4. In **الدورات**, choose **إضافة حصة**; pick a future date/time and class duration.
5. Open **الحصص** > **فتح الفصل والبث** for the class.
6. Starting 15 minutes before the scheduled time, click **الانضمام إلى الحصة**,
   grant browser microphone/camera access, and use the classroom controls.
   Screen sharing is provided by the supported desktop browser. The director
   may grant a student microphone/camera access after the student's request.
   Students start in listen-only mode and can raise their hands.

## Student Google signup (guardian-managed)
1. After the school authorizes opening registration, guardian visits /register.
2. Guardian enters the student's display name and checks the consent declaration
   referencing the privacy notice and terms.
3. Guardian selects Google and signs in using their **own verified Google email**.
   The backend checks issuer, audience, email verification and immutable Google
   subject. It creates a student record only with explicit guardian consent.
4. An account created via Google receives a random, unguessable disabled-password
   hash; a valid Google identity is required for future sign-ins.
5. The guardian later visits /login and signs in with the same Google identity,
   then sees the **لوحة الطالب**.
6. Registration grants **no** automatic admission to any paid course. A separate,
   administrator-approved booking is mandatory.

Current data model associates one managed student with one guardian email. It is
not yet a multi-child household platform; creating separate child profiles under
one parent requires a deliberately planned database schema extension.

## Booking and Vodafone Cash flow
1. In /courses, the verified student's guardian selects a published science course
   and requests a booking. Booking status is **pending**.
2. In **لوحة الطالب** > **فودافون كاش**, read the school's verified wallet number
   (only after payment service activation). After an actual transfer, upload an
   image of the receipt and the sender's Egyptian phone number.
3. In **لوحة الإدارة** > **تحويلات فودافون كاش**, the director opens the image and
   compares it with the received payment **inside the actual wallet on her phone**.
4. Only after real confirmation, check **تأكدت بنفسي من وصول المبلغ** and click
   **تأكيد التحويل وقبول الطالب**. Approval is atomic: payment and course booking
   are marked approved together. If not received, enter the reason and reject.
5. On the student's next dashboard refresh the approved course and scheduled
   classes appear. They can enter the class during its configured join window.
6. Neither creating a student account nor uploading a screenshot is evidence
   that the course is paid. A screenshot never automatically approves a booking.

## Feature flags and release gates
- Render: PUBLIC_LAUNCH_MODE=full, GOOGLE_STUDENT_LOGIN_ENABLED=true,
  REGISTRATION_ENABLED=true, SCHOOL_PRIVACY_APPROVED=true,
  SCHOOL_CONTACT_EMAIL=<verified school contact address>.
- Cloudflare Pages: PUBLIC_LAUNCH_MODE=full, FULL_BACKEND_READY=true,
  API_ORIGIN=https://mssofia.onrender.com.
- Before public rollout: approve the final privacy, guardian consent, refund,
  support contact and child data-retention rules. Do not mark school approval
  merely to override a warning.
- For optional password-and-email signup: verify a school-controlled domain and
  sender in Resend/SMTP, configure RESEND_API_KEY or SMTP_HOST and MAIL_FROM,
  and verify outbound delivery and reset links.
- For real Vodafone Cash: configure a verified VODAFONE_CASH_NUMBER, the restricted
  private storage bucket and SUPABASE_SECRET_KEY on Render (use a new sb_secret_ API key, never share it in chat). Verify storage upload,
  review, private visibility and deletion; never expose service-role keys to Pages.
- For live classes: verify room creation, teacher/student streaming across two
  separate browsers/devices, moderator permissions, and webhook attendance.
- Re-run backend authorization, Edge proxy, regression, browser and payment tests.
  Do not enable public enrollment until external validations succeed.

## Repeatable checks
- npm run check
- npm test
- npm run build
- npm run test:guardian:browser
- npm run test:operations:browser
- node qa-cloudflare-admin.mjs (when production remains admin-only)
- GET /api/admin/setup-status with a real administrator session; this endpoint
  returns booleans only, never credentials.

## Emergency rollback
If a production release fails, change Cloudflare Pages to
PUBLIC_LAUNCH_MODE=preview and FULL_BACKEND_READY=false, redeploy the last
known-good build and verify /api/health reports preview. Do not delete either
Supabase database or overwrite student/payment records.
