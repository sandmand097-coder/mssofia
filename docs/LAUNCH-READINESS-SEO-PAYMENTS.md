# MISS SOFIA — Launch, SEO & Paid-Enrollment Go/No-Go (11 October 2026)

**Scope:** Targeted public SEO/marketing and refund-policy readiness. This is **not** a certificate of production security, legal compliance, or successful customer payments.

## Verified read-only facts

- Public website: https://mssofia.pages.dev/ (available, full-mode health at time of audit).
- Public API at audit: `/api/auth/registration-status` reported Google guardian registration enabled and email-password registration disabled. A full guardian signup, classroom attendance and transactional payment were NOT tested.
- Live course catalog: **one** published primary-level course, `دورة العلوم`, course ID `443b2d26-faba-464a-984b-8a823fddd146`, public price EGP 100, 60-minute normal duration. `next_date` was null. Do not invent upcoming lessons, certified outcomes, instructor credentials or additional courses.
- Linked Supabase project: `jtluslevdmcpxxkngomj` (mrsofia). Read-only project metadata confirms private `mrsofia-payment-proofs` bucket, WebP, 2 MB. The previous deployment probe was hard-coded to an unrelated project; this change corrects it and preserves exact-hostname allowlisting.
- Existing Google ownership verification file is preserved. Google Search Console property was **not accessible** to the currently connected GSC Wizard account; attempted registration returned `not_found`. Therefore sitemap submission, URL inspection, click/impression verification and ranking claims cannot be made yet.
- Two larger staging PRs #11 and #13 remain separate; this focused patch copies only isolated, tested public SEO patterns from #11, not the classroom/network/notification modifications.

## What this change delivers

1. Public cancellations/compensation/refund rules on `/terms`, with requests directed to the same official contact as the site footer. Refund amounts for unprovided scheduled lessons use the announced minutes as the pro-rata basis. Owner must approve operational terms (timeframes, cash handling, delivery accountability) before new payments.
2. A production-only opt-in `SCHOOL_REFUND_POLICY_APPROVED=true` is required before displaying a new payment wallet or accepting a new paid receipt/manual booking. Default is **false**, including when the variable is absent. Existing account logins, paid entitlements and review of already-submitted receipts are preserved; do not revoke or delete prior records.
3. Accurate promotion and course-description fallback for the one actual published course, a correction for internal school-admin instructor labeling, clear next-date disclosure, and links to the refund policy. No extra courses or schedules are invented.
4. Static HTTP-served HTML titles, descriptions, OG/Twitter/social image, self-canonical and JSON-LD for home, catalogue, published science course, privacy and terms. Generated files in `dist/` include `courses/<id>.html`. Protected account/classroom URLs are not pre-generated. Sitemap includes the one publicly known course.
5. Production and PR CI runs SEO static-build checks before publishing to Cloudflare Pages.

## Required actions BEFORE enabling paid enrollments

- [ ] **Owner/legal:** Approve the actual policy wording and service-delivery/refund timeframes (especially 3 business days for review, 14 for refund, 7 days for makeup, pro-rata by announced lesson duration). Amend if needed. Do not imply that an automated legal review was performed.
- [ ] **Course administration:** Publish the confirmed upcoming course timetable and number/duration of paid lessons, instructor public display name, and detailed real curriculum. Do not accept a monthly payment while course schedule/content are unspecified.
- [ ] **Billing:** Confirm that `VODAFONE_CASH_NUMBER` in Render is the official collection wallet, separate from WhatsApp unless intentionally the same; test a **consented and reversible** low-value live transfer only after explicit authorization. No transfer was made by this change.
- [ ] **Render owner:** Inspect the actual production Render environment and logs in the correct confirmed workspace. This audit did not access Render because the connector requires a workspace confirmed by the account owner. Check `DATABASE_URL`, `SUPABASE_URL`, bucket storage auth and permissions, cookie origin, Google OAuth and LiveKit webhook setup, then test `/api/admin/dependencies` through a real director account.
- [ ] **Data protection:** Confirm private storage bucket access restrictions, RLS, least-privilege service keys, backups and a tested restore; verify parental consent wording and school data-retention/deletion procedures before processing children's data.
- [ ] **Guardian flow:** Test real Google guardian consent, registration, booking, receipt upload, admin manual verification, approved access, 30-day expiry, renewal, invalid/duplicate receipts, failed payment, and a negative permission/CSRF test using **isolated test accounts** only.
- [ ] **Service delivery:** Test a real instructor and student on separate networks with LiveKit, classroom attendance webhooks, reconnects, mobile usability and a cancelled lesson rescheduling/refund scenario.
- [ ] **Sign-off + deploy:** ONLY after the above checks pass, set `SCHOOL_REFUND_POLICY_APPROVED=true` in the **private Render environment** and restart the backend. Keep it false otherwise. Never commit credentials to Git or put them in frontend `VITE_*` vars.
- [ ] **Google SEO:** Sign into the Google account that owns the site's Search Console property (or add and verify the URL-prefix property `https://mssofia.pages.dev/`), connect that account to GSC Wizard, then submit `https://mssofia.pages.dev/sitemap.xml` and inspect `/`, `/courses`, and the one public course detail URL. Verification of a domain/property is an owner operation; it cannot be inferred from an HTML verification file alone.
- [ ] **Course SEO maintenance:** Update `src/public-seo.js` and `public/sitemap.xml` whenever the real public course catalog changes, or implement a verified server-side catalog-driven sitemap. Do not mint 3 fake courses to satisfy Google's Course carousel eligibility. No search ranking or rich result is guaranteed.

## Automated verification

```sh
npm ci --no-fund --no-audit
npm run check
npm test
npm run build
npm run test:seo:build
```

The tests above run without real payments, child accounts or paid LiveKit usage. Passing them **does not** replace the E2E production acceptance steps.
