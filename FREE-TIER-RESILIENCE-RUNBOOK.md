# Miss Sofia — Free-first availability runbook

**Trial:** 12 October–12 December 2026. No paid hosting, unapproved API services, money movement, or additional LiveKit usage are introduced by this release.

## Reality of free compute

Render Free can sleep after inactivity and needs time to wake. Cloudflare Pages being online does **not** mean the Node origin, Supabase connectivity, or LiveKit token issuance is immediately ready. There is no technically honest zero-downtime guarantee on this architecture. A free-plan process can also be restarted/evicted or encounter provider outages. Do not use high-frequency keep-alive traffic to misrepresent availability or rely on undocumented free-plan guarantees.

## Recovery envelope

1. **Public home, guide, catalogue and marketing pages** paint without waiting for private bootstrap; Cloudflare distributes static frontend assets.
2. **Edge public catalogue only:** `GET /api/courses` with no query and no Authorization is fetched without account cookies, strictly checked for published status, and sanitized to an explicit public field allowlist. Cloudflare Cache API stores a 3-minute fresh copy and up to 6-hour last-known-good copy. A stale copy is returned immediately, visibly labelled, while one POP-local background refresh (45-second guard) checks Render. Cache API storage is **best effort per POP**, not a replicated database and not a guarantee for first-time visitors.
3. **Course details in a sleep event:** published course summary may be rendered from the public list while the private origin cannot answer. Booking, seat counts, precise lesson schedule, and member entitlements are never guessed or activated using that summary. The detail page attempts safe GET recovery automatically; the button for booking stays disabled until the authoritative detail endpoint responds and authorization is known.
4. **Identity:** `/api/health` checks readiness before `/api/auth/me`. A verified HTTP 401 is anonymous; a 429/503/timeout/invalid payload is a temporary outage, never a forced logout. Private pages stay closed until both checks pass. Visible online tabs retry with bounded jitter; successful probes resume safely.
5. **No unsafe request replay:** Never automatically retry POST/PATCH/DELETE enrolment, payment review, school moderation, or live classroom token issuance because these can have side effects. The course data path uses only GET.
6. **GitHub Actions monitoring:** an hourly read-only workflow checks both https://mssofia.onrender.com/api/health and https://mssofia.pages.dev/api/health, giving three probe rounds and 20-second spacing. The schedule is best-effort, not precise. A persistent outage raises a single GitHub issue for review; it does **not** auto-redeploy or touch user data.
7. **Recovery must not claim successful attendance or payment:** after origin recovery, the server remains the authoritative source of bookings, sessions and access rights.

## Privacy / correctness controls

- No cached `/auth`, `/student`, `/admin`, `/lesson`, `/bookings`, or `/payments` endpoint, even if the requested method is GET.
- No database migrations, storage resets, LiveKit API key changes or session cookie changes in this release.
- Whitelist published public fields only. Reject malformed, oversized or non-public course catalogue data and responses setting cookies.
- Browser responses from the edge catalogue always have `Cache-Control: no-store, private` so user browsers do not accidentally retain unreviewed responses.
- Public stale values (price, seat count, schedule) are **not authoritative** and must be marked as unverified.

## Operational acceptance criteria

- PASS: Node24 unit/integration and Chromium browser regression gates.
- PASS: locked student/dashboard/moderation/payment protections and anonymous GET policy.
- PASS: mock first upstream 503, cached public course reads and later recovery without browser reload.
- PASS: Cloudflare Pages production deployment and read-only smoke checks on main.
- Measure real user health response time and failure percentage over 7 days; 503 incidents count even when eventual recovery succeeds.
- During actual classes, teacher opens and verifies the studio ahead of time; the free origin may still fail unexpectedly.
- Before **12 December 2026**, evaluate actual outage count, wake time p95, parent complaints, and whether an always-on backend is required. No paid switch happens without explicit approval.

## Release and rollback

Develop in isolated branch/PR. Require green CI. Merge only after code/security review; Cloudflare frontend is deployed by the existing main workflow if its deployment secret is configured. Render has autoDeploy off; it need not be redeployed here because this is an edge/client-only change. Verify production after Cloudflare deploy. To roll back, revert the merge commit and redeploy the previously known-good Pages build; never erase Supabase records.

The edge cache is a resilience convenience, **not** an alternate authorization service or an SLA.
