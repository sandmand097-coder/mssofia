# Miss Sofia — secure monthly renewals and moderated classroom chat

## Current release model
- Every approved first payment grants one **30 × 24-hour period**, starting at the administrator-confirmed `payment_submissions.reviewed_at`.
- All scheduled live lessons for that course are accessible while the entitlement is active, subject to each lesson's join window.
- A new payment never activates itself. The director checks Vodafone Cash **on the real school phone** and approves it.
- A renewal made during the last 5 days extends from the previous expiry; a renewal after a lapse starts at approval time.
- Every renewal is **append-only** in `subscription_renewals`. The original booking, initial payment, and attendance are kept.
- The subscription expiry is enforced in `/api/lessons/:id/token` and all protected classroom endpoints, not just UI buttons.
- Children may submit text questions visible only to the presenter; answers are visible only to the submitting child. The presenter's LiveKit announcements remain classroom-wide.

## Rollout gates — leave OFF until verified
Two backend environment flags default to disabled:
```
MONTHLY_RENEWALS_ENABLED=true
CLASSROOM_QA_ENABLED=true
```
Do not set these flags before the correct production PostgreSQL project has the migration and RLS verified. The initial monthly entitlement and the LiveKit video are functional without them.

1. Confirm the **existing** Supabase project: `wnkewiulyobbjftckfqb`. Never migrate data to the historic unused project.
2. Back up the existing schema and application tables using the owner-approved backup workflow. Preserve original users, bookings, attendance, and payments.
3. Review and apply `supabase/migrations/20261010152637_secure_monthly_renewals.sql` via your authorized Supabase migration process. It adds two tables and indexes; it does not drop or overwrite existing data.
4. Verify that **both** new public-schema tables have RLS enabled, no direct `anon`/`authenticated` table privileges, and access only for `mssofia_backend` as used in the existing schema. Test an unprivileged client and the production backend role separately.
5. Create or verify bucket `mrsofia-payment-proofs` as **private**, with no public reads. Confirm the service-only credentials exist in **Render's secret environment**, never in Vite/browser or GitHub. Run `/api/admin/dependencies` as the director and require `receiptBucketPrivateVerified: true` before asking families to transfer money.
6. Check the school Vodafone Cash account details and legal/privacy notices with the school owner. Do not auto-approve screenshots.
7. Set both flags in Render only after gates 1–6 pass, restart the existing service, and verify:
   - A student with active first payment may see remaining days, lessons and renewals; an expired student is denied until manual approval.
   - A student cannot upload a second pending renewal or view another student's proof.
   - An administrator's repeated approval returns HTTP 409 and cannot add another month.
   - An approved second payment extends access without changing the first payment record.
   - Questions are visible only to the sender and director, and a student cannot answer.
8. Verify frontend deploy on Cloudflare Pages points at the matching backend commit and test on mobile/desktop Chrome/Edge.

## Safe tests (no production money)
```bash
npm ci
npm run check
npm test
npm run build
node qa-lesson-scheduling-browser.mjs
node qa-classroom-entry-browser.mjs
node qa-guardian-browser.mjs
```

The `tests/secure-monthly-renewal-http.mjs` suite uses disposable SQLite storage, synthetic webp receipts and fake identities. It does **not** perform actual transfers or publish WebRTC video. Production acceptance also requires a two-browser session using authorized test identities.

## Remaining operational safeguards
- LiveKit token expiration alone is not a substitute for full revocation of an already connected participant. If immediate revocation at subscription expiry is required, add server-side periodic removal of expired in-room participants and revalidate disconnections on LiveKit Cloud.
- Current Google guardian login maps to one legacy student identity. Multiple children under a guardian need a **separate parent–child identity model** and explicit child-specific bookings and attendance. Do not duplicate a guardian's Google email across student rows.
- Email reminders require a configured and verified transactional mail service. The current UI warning begins five days before expiry; no email send is claimed.
- Supabase connector authorization and LiveKit real-media verification are external rollout dependencies, not green based merely on passing mocked tests.
