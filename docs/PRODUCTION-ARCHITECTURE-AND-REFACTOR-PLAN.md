# Miss Sofia — Production Architecture & Controlled Refactoring Plan

## Status — 12 October 2026

This document describes the **existing** application and a safe migration plan. A green CI build and a successful Render deployment do not prove an absence of security vulnerabilities, that a real child's session works end-to-end, or that payment settlement and backups work.

### Current deployment map

```text
Guardian / Teacher / Admin browser
   |
   v
Cloudflare Pages (mssofia.pages.dev)
   |- Vite/React static application and public SEO HTML
   |- Pages Functions: /api/* on same-origin, fixed Render upstream
   |       [cookie forwarding / no-store / 19s bounded GET]
   v
Render Web Service "mssofia" (Frankfurt, single Free instance)
   |- server/start.js production mode selection
   |- server/index.js Express HTTP API, auth, school/business flows
   |- server/google-admin-auth.js guardian/director Google sign-in
   |- server/payment-routes.js & subscription-renewals.js
   |- server/classroom.js / live-admission.js / live-presence.js
   |- server/deployment-diagnostics.js private readiness checks
   v
Supabase Postgres (EU Central) + PRIVATE storage for receipts
LiveKit Cloud (live class media and webhooks)
```

**Deploy authority:** Cloudflare Pages deploys automatically from `main`. Render `mssofia` currently has **autoDeploy = no**, so syncing `main` needs a separate authorized deployment and separate API/role regression verification. Both runtimes must use compatible versions. Never assume a successful Cloudflare deploy updated Render.

## Current risk ledger (evidence-based)

| Risk | Evidence / impact | Owner action |
|---|---|---|
| Render sleeping after inactivity | Free single instance, recorded restarts and 503 edge responses; interrupted class admission | Confirm class schedule, warm-up policy and whether an always-on paid instance is needed |
| Version drift between site and API | Backend was 11 commits behind in previous audit; manually caught up on 12 Oct | Keep manual backend upgrade as an explicit release stage; compare commit SHA after every web deploy |
| Proxy / login limit attribution | Render had `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`; repaired bounded one-hop proxy setup and passed isolated rate-limit test | Monitor Render logs for recurrence after upgraded deployment; review trust boundary if networking topology changes |
| Payment receipt API check | Supabase receipt bucket is confirmed `public=false` by DB metadata; **Render boot diagnostic still shows `privateProofBucket=false`** | Keep new payments disabled; diagnose private Storage API identity, requested host and policy using authorized env access; never print tokens |
| Monetary transaction safety | Code requires refund-policy signoff + private storage before enabling receipt upload; production env's signoff is not independently known | Verify owner-approved policy; perform controlled authorized test without real minors' data |
| Child protection / class admission | Isolated LiveKit/auth tests pass; real two-device teacher/guardian journey unproven | Use consented isolated adult-operated test accounts, verify attendance/reconnect/moderation and no outsider token |
| Backups / restoration | No verified independent restore trial | Establish private encrypted off-project backups with tested isolated restoration; no production overwrites |
| Course readiness | Public science course had 30-seat capacity, 60-minute duration and no next date | Owner publishes real timetable/content and confirms business capacity |
| Contact / notifications | Mail provider `false` in Render startup diagnostics | Avoid promising email recovery until mail provider and actual delivery test work |
| Continuous alerts | GitHub post-deploy and manual public probes exist, not a 24/7 monitor | Assign an on-call guardian-facing contact and approve continuous uptime monitoring |

## Intended module boundaries (incremental, not a big-bang rewrite)

The 1000+ line `server/index.js` mixes Express creation, authentication, database, classes and subscriptions. Splitting it recklessly while production is serving children can break role checks and webhook ordering.

```text
src/
  app/             # Router, route-level loading/error boundaries
  features/
    auth/           # Guardian/teacher sign-in UI
    catalogue/      # Public courses and detail pages
    student/        # Schedule, memberships, course access
    classroom/      # LiveKit UI, attendance feedback, reconnect
    operations/     # Instructor/director dashboards (never imported by public data loaders)
  components/       # Truly shared presentation
  pages/            # Compatibility entrypoints during migration
  public-seo.js     # Search metadata and sitemap declarations

server/
  app/             # Express composition, middlewares, error handling
  routes/          # Thin controllers: HTTP shape, validation, auth
  services/        # Business invariants, payments and live admission
  data/            # Postgres adapters/transactions and schema access
  integrations/    # Supabase Storage, Google OAuth, LiveKit, mail
  security/        # CSRF/CORS, sessions, rate limiting, proxy trust
  index.js         # Kept as compatibility entry until migrations verified

tests/
  unit/            # Safe pure functions and legal business guards
  integration/     # Isolated DB/service tests
  security/        # Negative role, session, upload and rate-limit tests
  browser/         # Separate teacher + guardian UX
  release/         # Real GET-only readiness (no PII, no writes)
```

These are **proposed folders**: no mass rename or production code move has been performed. Each feature moves behind an unchanged public API, in separate small PRs, with old import paths preserved until consumer tests pass. Prefer extracting one pure, audited module at a time.

## Non-negotiable invariants during refactoring

1. **No payment capture without deliberate owner-approved refund policy, confirmed real wallet and positively verified private receipt access.** An uploaded receipt is not money. No silent payment approval.
2. **Only authorized adults** can change lessons, courses, payments or memberships; student-only LiveKit tokens require verified active access. No anonymous admin/billing APIs.
3. Never trust public-supplied `X-Forwarded-For` prefixes; use bounded proxy trust, and test rate-limiter identity under Cloudflare/Render.
4. Prevent publicly cached authenticated content, student records and receipt images; preserve same-origin HttpOnly sessions.
5. No retroactive changes to paid bookings, student enrollment or private storage objects in structural PRs.
6. No real payments, live broadcasting, deletion, large production load test, API-key rotation or migration without owner-approved plan.
7. Preserve Cloudflare static availability even if Render is asleep; fail private capabilities closed and report degraded status honestly.
8. Do not make secrets, parent/student records, contact identifiers or payment proofs part of CI logs or public telemetry.
9. PR quality gate **must** run `npm run check`, `npm test`, `npm run build`, browser QA, runtime audit and new negative regression checks.

## Production release checklist

- [ ] Freeze scope; compare `main` with running Render SHA and capture previous deploy ID for manual rollback.
- [ ] Complete isolated role, guardian registration, payment/no-payment and classroom tests.
- [ ] Check Supabase project status, row policies, storage privacy **and actual server-side storage verification** (not merely DB metadata).
- [ ] Deploy website and backend in planned order. Do not conflate Cloudflare deployment with Render deployment.
- [ ] Confirm Render state `live`, then inspect sanitized startup audit and error logs.
- [ ] Call public `/api/health`, courses and registration. Confirm anonymous endpoints `/api/auth/me`, `/api/admin/dependencies` and `/api/payments/config` reject access.
- [ ] Confirm *authenticated* guardian, director, and teacher flows in a privacy-preserving isolated rehearsal.
- [ ] Reconcile wallet status and official policy **before** inviting paid students.
- [ ] Observe uptime through the next scheduled lesson; restore previous Render release only as an explicit authorized incident decision.

## Definition of done for real launch

A student can register with guardian consent, reserve an actual scheduled lesson, obtain *verified* membership after authorized settlement, enter the room when allowed, receive the teacher's real media, ask for the mic only with teacher approval, and have a correct attendance record. A failed/missing payment never unlocks media. A real restore drill succeeds; on-call staff know how to suspend and resume operations.

**Current state:** technical readiness improved, but production launch sign-off is **not yet achieved**. Reference `docs/INCIDENT-RESPONSE-AND-RECOVERY.md` and `docs/LAUNCH-READINESS-SEO-PAYMENTS.md`.
