# Miss Sofia — custom domains, resilient LiveKit and guardian WhatsApp

**Status:** Prepared in a separate development branch. NOT merged, deployed,
migrated, or connected to real WhatsApp recipients. PR #11 and its ongoing
120-minute load test are on another branch.

## 1. Domain and session cutover (zero downtime)

The project is **Vite/React + Express**, not Next.js. Keep one Express backend;
do NOT insert Next.js or duplicate authentication systems.

| Location | Current | After DNS/TLS cutover |
|---|---|---|
| Frontend | https://mssofia.pages.dev | https://mssofia.com |
| Public API used by browser | Same-origin `/api/*` Cloudflare Pages Function | Same-origin `https://mssofia.com/api/*` Pages Function |
| Render backend target | https://mssofia.onrender.com | https://api.mssofia.com (verified Render custom hostname) |

The **recommended** frontend still calls `/api`, because the Cloudflare Pages
proxy forwards credentials safely. You **do not need direct browser
cross-origin requests** to `api.mssofia.com` simply because it exists.
The private API and the public frontend should use HTTPS.

Cloudflare Pages `API_ORIGIN` is restricted to two exact upstream addresses
(`mssofia.onrender.com` or `api.mssofia.com`); it cannot become an open proxy.
Existing `FULL_BACKEND_READY` and `PUBLIC_LAUNCH_MODE` release gates remain.
The Express API responds to credentialed CORS only from `mssofia.pages.dev`,
`mssofia.com`, or `www.mssofia.com`. In development, localhost is allowed.
Rejected browser origins cannot read responses; unsafe methods remain rejected.

For cookies, login and Google login now share the same **HttpOnly**, 7-day,
`Secure` (production), `SameSite=Lax` configuration. Logout clears with
identical scope. **The safest default is a host-only cookie.**
Set `COOKIE_DOMAIN=mssofia.com` only AFTER the custom-domain setup is active.
The backend enables a parent-domain cookie only when the request is addressed
to the trusted custom hostname **and** comes from the custom frontend.
Requests from `pages.dev` keep a host-only cookie, since browsers reject
`Domain=mssofia.com` cookies returned from that domain.

`SameSite=Lax` is appropriate for `mssofia.com` → `api.mssofia.com` (same
**site**, different origin). A direct `pages.dev` → `api.mssofia.com`
cross-site credentialed fetch generally needs `SameSite=None; Secure` and
may still be blocked by third-party cookie restrictions. **We deliberately
avoid that fragile mode** using the Pages same-origin proxy.

The application currently issues a 7-day session JWT; it does **not** have
a refresh-token issuance/rotation flow. Do not invent refresh-token cookies
without an audited refresh-token database and revocation mechanism.

### Rollout

1. Set up and verify `mssofia.com` as a Cloudflare Pages Custom Domain
   (with redirect from `www` if appropriate); confirm HTTPS and DNS.
2. Verify `api.mssofia.com` in Render Custom Domains, valid TLS certificate
   and correct origin routing before changing Cloudflare `API_ORIGIN`.
3. Update Render `APP_ORIGIN=https://mssofia.com` only after cutover. Leave
   `COOKIE_DOMAIN` unset for the initial smoke test. Turn it on only if
   sharing login cookies across the custom subdomains is truly necessary.
4. Keep `PUBLIC_LAUNCH_MODE` and `FULL_BACKEND_READY` fail-closed through
   this staged rollout; test preflight, login, logout, page refresh, Google
   login, subscriptions and students who return from old URLs.
5. Update canonical metadata, OpenGraph, sitemap and robots to the preferred
   domain together, verify both Search Console properties, and set redirects
   from old public URLs. Do not prematurely change canonical URLs to a
   nonoperational hostname.
6. Preserve the existing production database and current deployment until
   verified. Have a rollback to the previous `API_ORIGIN` and cookie mode.

## 2. Classroom network resilience

The student-selectable **audio-only** mode now calls
`RemoteTrackPublication.setSubscribed(false)` for camera video from all
remote participants; unlike `setEnabled(false)`, this unsubscribes from
network media. Teacher **screen shares remain subscribed** and teacher
microphone audio is unaffected. Switching back restores webcam
subscriptions; on a weak connection use `setVideoQuality(LOW)`.
If the student had activated their own camera with teacher permission,
audio-only selection turns off that **student's** camera, never activates it.

Poor/Lost network quality presents a direct audio-only button. The reconnection
banner offers a manual retry, while the existing LiveKit connection logic and
bounded, authorized classroom token retry remain in charge. Server-side
payment, student entitlement, microphone grants, bans and room-ended checks
are unchanged. Phone backgrounding is platform-dependent.

## 3. Guardian WhatsApp notifications — DISABLED until reviewed

We use official **WhatsApp Cloud API approved utility templates**, not an
unofficial WhatsApp Web automation library. Outbound template sends may have
provider fees; Meta verifies business/account/phone number permissions.

Two approved Arabic UTILITY templates must be registered with exactly four
body placeholders in this precise order:

| Config | Template type | `{{1}}` | `{{2}}` | `{{3}}` | `{{4}}` |
|---|---|---|---|---|---|
| `WHATSAPP_BOOKING_TEMPLATE` | Booking confirmed | Student name | Course title | `https://.../dashboard` | Confirmation phrase |
| `WHATSAPP_REMINDER_TEMPLATE` | 15-min lesson reminder | Student name | Lesson title | Cairo lesson time | `https://.../lesson/{id}` |

The link leads to protected pages; it is **NOT** a session token or an
unauthenticated classroom entrance. The recipient must still log in and pass
subscription, schedule and ban checks. Templates must be approved with
matching body placeholders and Arabic language `ar`. The frontend never
receives any WhatsApp token.

### Privacy and consent

`payment_submissions.sender_phone` is NOT considered guardian consent.
Only `notification_contacts` with a valid E.164 phone, explicit opt-in,
independent verification of control of the phone, consent source and no
revocation can receive messages. **No public route to self-assert a phone
number has been introduced.** Consent collection/verification must be
established with the school and privacy policy before enabling sends.
No production recipients are imported automatically. Underage students'
personal information must not be sent to unrelated wallet senders.

### Outbox and scheduling

- `db/notifications-schema.sql` is a **staged** Supabase/PostgreSQL DDL
  script. IT HAS NOT BEEN APPLIED to production. It enables RLS and revokes
  public `anon`/`authenticated` access. Only the restricted backend DB
  role should receive the necessary SQL rights after review.
- The local SQLite schema is created automatically for tests only.
- On a **new, confirmed** payment approval, the payment and booking updates
  enqueue an idempotent outbox row **inside the same transaction**.
  Failed/rejected receipts never enqueue an approval notification.
- The minute scheduler scans upcoming lessons with a verified guardian and
  a currently approved booking, then queues a deterministic
  `lesson-id + student-id` reminder around 15 minutes before start.
- Before **each actual send**, the worker checks phone verification/opt-in,
  account and subscription entitlement and lesson timing again.
- Jobs use locked DB claims, an expiring lease, bounded retries, idempotent
  database event keys and sanitized errors. Provider HTTP requests have a
  12-second timeout. The school API does not await the provider while
  approving a payment. Deliveries are **at-least-once**, not exactly-once:
  if Meta accepts a message but its response is lost, a retry could duplicate
  it. This risk must be discussed before activation.
- The route `POST /api/internal/notifications/tick` is scheduler-only and
  checks a 40+ character bearer secret using constant-time comparison.
- The isolated Worker in `notifications-cron/` runs every UTC minute **only
  after deployed** and calls that private route. Do not publish the secret
  to browser bundles or public logs.

**Operational warning:** Render's free/sleeping instance is not reliable for
15-minute-exact notifications. Use an always-on paid Render service or a
dedicated worker with direct Supabase access and a verified delivery SLA
before treating reminders as time-critical. Cloudflare Cron itself may
start promptly but does not fix a slow/cold origin.

### Environment variables

| Variable | Installed where | Requirement |
|---|---|---|
| `APP_ORIGIN` | Render | Current frontend origin; use `https://mssofia.com` after cutover |
| `COOKIE_DOMAIN` | Render | Optional; leave empty until custom domain verified |
| `API_ORIGIN` | Cloudflare Pages | Exact allowlisted Render upstream; do not set arbitrary URLs |
| `WHATSAPP_ENABLED` | Render | **false** until DDL, consent, approved templates and dry runs |
| `WHATSAPP_GRAPH_VERSION` | Render | Tested/versioned Graph API, e.g. `v25.0` |
| `WHATSAPP_PHONE_NUMBER_ID` | Render | Meta Cloud API phone number ID |
| `WHATSAPP_ACCESS_TOKEN` | Render secret | Valid scoped Meta token; never in repo |
| `WHATSAPP_BOOKING_TEMPLATE` | Render | Approved utility template name |
| `WHATSAPP_REMINDER_TEMPLATE` | Render | Approved utility template name |
| `WHATSAPP_TEMPLATE_LANGUAGE` | Render | `ar` |
| `SCHOOL_PUBLIC_URL` | Render | Verified public origin for dashboard/lesson links |
| `NOTIFICATION_CRON_SECRET` | Render + Worker secret | Same unpredictable 40+ char value |
| `NOTIFICATION_TICK_URL` | Worker variable | Exact HTTPS scheduler-only endpoint |

### Launch checklist

1. Run the integration tests and actual browser checks. Maintain the private
   opt-in database in a separate staging project.
2. Inspect `db/notifications-schema.sql` against live DB table names, role
   grants, migrations and backup policy. Apply only after approval.
3. Complete Meta WhatsApp business/number onboarding and template approvals,
   guardian consent, contact verification and opt-out operations.
4. Set secrets using Render's secret settings and `wrangler secret put`.
   Do not deploy the Worker with a missing secret or incorrect URL.
5. Test on a designated **verified test number** with consent. Observe
   provider status and handle 429, revoked consents and worker failures.
6. Enable `WHATSAPP_ENABLED=true` only after all above pass.
7. Monitor sent/pending/dead job counts with a restricted administrator or
   SQL dashboard; **never** expose phone numbers or IDs to pupils.

## Non-destructive tests

```bash
npm run check
npm test
npm run build
npm run test:notifications
```

The provider tests replace `fetch` with a stub and never contact Meta.
The outbox test creates a private temporary SQLite database, validates
verified guardian opt-in, payment approval/transactional enqueue,
deduplication, revocation, a 15-minute reminder and retry/backoff. Actual
provider delivery and the real 120-minute LiveKit soak remain separate
acceptance gates.
