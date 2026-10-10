# Miss Sofia — in-site livestream and monthly access

## Director starts a science lesson
1. Open https://mssofia.pages.dev/login and use the approved director Google identity.
2. In **الدورات** choose a course. The administrator is the presenter.
3. Click **إضافة حصة**. Enter the lesson title, pick a calendar date, then select
   **24-hour hour and minutes in Cairo time**. For example, 16:30 means 4:30 PM
   Egypt local time. The form uses the Africa/Cairo timezone, including DST.
4. **No Google Meet URL** is needed or accepted. Creating a lesson reserves
   an internal LiveKit room in Miss Sofia and redirects no student to Meet.
5. In **الحصص** open **استوديو البث الخاص بي** from 15 minutes before the
   scheduled start; inside click **ابدئي البث الآن** to enable mic/camera after
   browser permission. Screen sharing, hand raising and director-controlled
   speaker permissions are available inside the same classroom.
6. Students join inside their own **لوحة الطالب** using **مشاهدة البث**.

## Paid membership policy (first month)
- Paid access begins only when **payment_submissions.status=approved**,
  **confirmed_on_phone=true**, the booking is approved and a valid
  administrator-confirmed **reviewed_at** timestamp exists.
- Live access lasts **30 x 24 hours after payment approval**.
- This covers the course's in-site live lessons that fall inside the period,
  subject to each lesson's own joining window.
- The student cannot see protected lessons, obtain LiveKit tokens, raise a
  hand or be granted media permissions after the period expires.
- An unverified photo, sign-up, mere booking, and unapproved payment are never
  accepted as proof of a paid month.
- Approved free courses are accessible without a payment; the director must
  still approve their booking.
- The director can present all classes irrespective of monthly student status.
- The dashboard shows the remaining time or the date of membership expiry;
  expired paid courses and lesson links do not appear as currently accessible.
- Capacity counts only active approved members, not students who have expired.
- Converting a free course that already has approved students into a paid
  course is prohibited, avoiding retroactive fees.

## Financial release and renewals
Payment processing is currently **closed in production** until the verified
private receipt-storage access key has been configured and tested. Do not send
money to a phone number found in an unrelated page or screenshot. Only send a
transfer when the authenticated student's Payments page displays the verified
school wallet, receipt upload and published refund terms.

The existing payment_submissions schema stores one auditable first payment per
booking. **Automatic renewal and a second month's payment-history workflow
are NOT deployed.** Renewal requires an append-only billing history migration,
a corresponding secure payment API and real device testing. The software
does **not** claim to charge 170 EGP automatically or accept renewals today.
Guardians should contact the school before the next billing period; the
director must not extend access by editing past payment evidence.

## Tests
- Unit: tests/cairo-scheduling.mjs, tests/monthly-live-access.mjs
- Real isolated backend HTTP: tests/monthly-classroom-http.mjs
- External Meet redirect rejected: tests/integration.mjs
- Mobile/desktop UI: qa-lesson-scheduling-browser.mjs
- Media roles: tests/classroom-moderation.mjs and qa-classroom-entry-browser.mjs
- General: npm run check, npm test, npm run build

## Acceptance testing on production
An approved real administrator and an approved real student (separate devices)
must check mic, camera, screen sharing, audio playback, moderation, waiting
window and a complete scheduled lesson. Do not use false payment proofs, live
children's data or real fund transfers for automated QA.
