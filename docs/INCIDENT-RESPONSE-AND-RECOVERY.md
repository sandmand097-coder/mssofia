# Miss Sofia — Incident Response, Safety & Business Continuity Runbook
**Internal operations document — 12 October 2026**
**Owner approval required before changing production secrets, money flows, child accounts or publishing external incident statements.**

## Purpose and evidence levels
The aim is to prevent incidents, identify them quickly, preserve children's data, and restore the learning experience safely. No system can guarantee prevention of *every* risk.

- **Verified by read-only investigation:** Supabase project \`mrsofia\` is ACTIVE_HEALTHY at the check time; its 11 public tables show RLS enabled; the \`mrsofia-payment-proofs\` bucket is private, WebP-only, 2 MiB. Supabase security advisor returned no active lints. These checks do **not** prove every row-level policy is correct, the backup can be restored, or credentials cannot leak.
- **Risk observed:** On 11 October the public API returned transient 503 responses on health, registration and courses; all recovered on a subsequent check. A sleeping Render instance or edge timeout is a *possible* explanation, **not a diagnosed root cause** without platform metrics and logs.
- **Performance findings:** The Supabase advisor reports **9 unindexed foreign keys**, plus unused-index informational notices. Do not drop or create production indexes without a backup, query-plan review, and low-traffic migration window.
- **Outstanding release acceptance:** true parent registration, real small-value financial reconciliation (only after explicit owner approval), two-device LiveKit streaming, attendance webhook, payment errors, backups and restore have NOT been verified end to end.
- **Known configuration drift:** emergency admin-only preflight previously referenced a different Supabase project and EU-West pooler; the code now expects the active EU-Central project and fail-closes unknown database addresses. The actual Render \`DATABASE_URL\` and Google/admin identity **still require confirmation by the authorized workspace owner**. Do not enter or print database URLs, passwords, tokens or student identifiers into a GitHub ticket.

## Severity and first response
| Priority | Detection examples | Immediate operator action | Target (goal, not SLA) |
|---|---|---|---|
| **P0** Security/child safety | Unexpected anonymous access to student/admin API, receipt leakage, credential compromise, unauthorized access to a lesson, child safeguarding report | Restrict public registration and private API access, protect evidence and escalate to owner/data-protection contact. Preserve original logs; rotate affected credentials **with coordination**, revoke sessions when relevant; assess notification duties under applicable law | Start triage immediately, ideally within 15 min |
| **P1** Service disruption | API 503 continues after retry, paid pupils cannot enter scheduled live lesson, Google login repeatedly fails, database unavailable, approved receipt cannot be verified | Declare incident; stop new payment instructions and postpone/rearrange affected lesson; notify guardians via authorized school channel; contact hosting provider; do not bypass session/role checks | Start triage within 30 min |
| **P2** Degradation | Slow course list, occasional recovering 503, delayed media or voice, SEO indexing stalled | Record symptoms/timestamps, watch recurrence and impact, switch viewing quality to audio-only if needed, plan correction | Triage same business day |

The table is a proposed operating target, not an externally promised service-level agreement.

## Pre-class and after-deploy checklist (read-only)
1. From GitHub → **Actions** → **Miss Sofia production readiness (read-only)** → **Run workflow**, execute the GET-only probe **before real sessions**. Also runs automatically after a successful Cloudflare Pages deployment. Read failure annotations and \`SUMMARY\`.
2. The probe visits homepage, parent guide and terms, then health/Google/registration/catalogue and verifies unauthenticated access to \`/api/auth/me\`, \`/api/admin/dependencies\`, and \`/api/payments/config\` is rejected with HTTP 401. It never logs in, starts a room, submits payment, or copies actual data.
3. 503/502/504/429/408 and network errors may be tried at most 5 times **for GETs only**, with bounded delays (6, 12, 20, 20 seconds) to accommodate temporary Render cold starts. **RECOVERED_AFTER_RETRY** is a warning to investigate cold-start frequency, not proof of a lasting outage; **FAIL**, **PRIVATE_API_ACCESS_EXPOSED**, and **UPSTREAM_HEALTH_FAILED** require triage. Do not retry a POST payment, enrollment approval or moderation decision automatically.
4. Confirm class and instructor timetable with administration, Google guardian sign-in availability, LiveKit console quota, and actual registered occupancy. Course capacity in the current API is **30**, not a tested 50-seat paid broadcast guarantee.
5. At class start, use an authorized teacher plus an isolated adult-operated test student on separate devices/networks to verify sound, stage screen-share, moderation, enrollment and attendance event. **Do not create fake paid submissions or touch real minors' records for testing.**
6. Confirm incidents are resolved by re-running the probe and checking the legitimate class flow. No "all clear" until both the signal and its underlying behavior recover.

### What checks do and do not assert
- Probe exit 0: these public GET endpoints and three anonymous-access gates passed **at the checked time**. Passing does **not** prove there is no bug, the database has backups, LiveKit scale capacity, or transactions settle correctly.
- Probe exit 1: at least one public site/API/access guard failed; the GitHub workflow is red and should be investigated by the person who receives GitHub Actions notifications.
- GitHub Actions workflow_dispatch is on demand. **Continuous 24/7 alerting is not configured by this PR**. Notifications, a trusted on-call contact, external status monitoring, frequency and provider/billing impact must be approved before enabling a scheduled paid monitor.
- Cloudflare Pages may finish publishing before the post-deploy probe begins. If the probe later fails, a **red job does not mean the deploy was automatically rolled back**; investigate or roll back deliberately.
- Avoid heavy, artificial load checks on production during classes.

## Outage / recovery decision tree
### 1. Public site loads but registration, courses or lesson requests return 503
- Check the current GitHub probe run (URL and sanitized status codes only). Retry once after 60–120 seconds, watch recurrence and compare the Cloudflare dashboard response with the Render service's **verified workspace** events and logs.
- Distinguish Cloudflare edge transient timeout from Render failed health checks, instance suspension, application crash, exhausted database connections or Supabase outage. Do not infer a root cause from a single 503.
- If sustained during a paid lesson: contact guardians using the official support process, preserve progress, and announce a makeup date **only after the teacher confirms availability**. The site may continue displaying public content while protected student operations are blocked.
- Never turn off CORS/session/CSRF or force a payment approved simply to bypass an incident.

### 2. Suspected breach, impersonated teacher or child data exposure
- The owner/security lead must immediately stop new account/payment intake while preserving accessible public help. Preferred emergency Cloudflare fail-closed posture: confirm the correct project, then set \`PUBLIC_LAUNCH_MODE=preview\` or disable \`FULL_BACKEND_READY\` at Cloudflare and verify \`/api/health\` reports preview and private endpoints reject requests. This intentionally stops signed-in services; coordinate any active classes first when safe.
- Use verified provider consoles to revoke affected tokens/sessions and rotate the relevant secrets (Google/LiveKit/Supabase/JWT) in a controlled order, checking dependent applications and webhook signatures afterward. **Never write secrets in the repository, screenshots, error tickets or public chat.**
- Keep event timestamps, request IDs, providers' event history and a minimal audit trail; restrict access to authorized adults. Avoid copying students' PII into diagnostics. Escalate mandatory disclosure decisions to a qualified professional.

### 3. Database or receipt storage unavailable
- Keep financial approval and receipt intake closed; the application must fail closed. Existing payment data must not be "fixed" by creating duplicate submissions.
- Validate Postgres connectivity, private bucket permissions, and IAM policies through the owner-authorized consoles. Security scan returned no current lints; that is not a substitute for an authenticated privacy test.
- Restore only from a documented backup into a **separate, access-controlled test project** first, verifying user/course/bookings/review/attendance referential integrity and a sample receipt hash. Confirm exact recovery point before any production restore.
- **Never overwrite production or delete user data as the first incident response.** Coordinate recovery with a maintenance window and owner sign-off.

### 4. Classroom sound / media / provider quota issue
- Student opens Dashboard → Schedule → Watch broadcast → Enter lesson → Waiting lobby. The teacher opens studio and starts broadcasting. The waiting screen does not use student LiveKit minutes until stream start; the platform code protects early joins and enforces permission-based mic/camera.
- On slow internet, switch student mode from auto to low bandwidth/audio-only; do not ask a child to disable browser protections or install unknown software. Teacher checks audio device and screen-share grant.
- On LiveKit quota/provider outage: do not promise an immediate substitute link accessible without login. Postpone/rearrange the lesson through the authorized guardian communication channel, document reason and makeup/refund disposition.
- Test a two-device rehearsal with consent; don't use 50 real children to benchmark production. LiveKit account quotas and class concurrency must be confirmed separately.

### 5. Payment mistaken approval / duplicate proof / disputed refund
- Stop **new approvals**, not already enrolled students' class access, until the owner verifies bank/wallet transaction history.
- Use an authorized director to reconcile transfer reference, amount, time and sender with school records; log outcome minimally. Do not rely on the receipt screenshot alone or send PII via WhatsApp.
- Never backfill a paid status without verifying cash receipt. Compensate/refund based on the published school terms and applicable law. Keep sensitive payment proofs in private storage only.

## Backup and disaster recovery — owner action required
Backup design **not verified or activated by this change**:
1. Confirm Supabase plan backup/point-in-time restore availability from the actual project dashboard. If unavailable, set up **encrypted off-project** backups with limited credentials. Protect data-in-transit and at-rest; keep backup keys outside GitHub. Define daily backup cadence and retention only after assessing volume/legal requirements.
2. Include PostgreSQL schema **and data**, private receipt objects/metadata, and evidence of schema migration version; back up the two stores consistently where feasible. Never dump production data into a CI log, public repository or personal email.
3. Conduct and document a **quarterly restore drill** into a non-public isolated environment with masked test data. Verify login permissions, FK integrity, booking states, reports, receipt linkage, and LiveKit settings (test credentials only). Report timestamp, operator, result and deletion of temporary copies.
4. Proposed business goals **only**: target RPO <=24h and recovery for key account/lesson functions within 4h. **Not guaranteed** until automated backup and a timed restore drill prove feasibility.
5. Maintain a separate emergency communication plan for guardians and a teacher-managed makeup schedule. Never reuse Google OAuth/LiveKit prod secrets in a public staging environment.

## Before allowing full paid production operation
- [ ] School owner confirms which **Render workspace and service** runs production; inspect its **events**, DB connection errors, app version and effective private feature switches without disclosing secret values.
- [ ] Approve real school refund/service terms and activation (currently new paid intake should remain fail-closed until \`SCHOOL_REFUND_POLICY_APPROVED=true\` is intentionally set in the correct private environment).
- [ ] Confirm correct Vodafone Cash wallet number via owner, and test authorized isolated transaction and rejected/duplicate-proof cases (no auto-approval).
- [ ] Verify a real guardian Google account + parent consent flow, teacher, and adult-operated test student through a real entire class. Test blocked expired enrollment and teacher termination.
- [ ] Confirm reliable Postgres and **tested restore**, storage private direct access denial and role-level permission tests. Protect any child's data.
- [ ] Verify the next scheduled class and teacher/content/course capacity; public course currently has no next scheduled lesson and is configured for 30 seats.
- [ ] Review the 9 foreign keys lacking indexes using real query plans *after* recovery is proven. Do not automatically remove "unused" indexes from a newly launched project.
- [ ] Configure outside-hours alerting / on-call ownership if 24/7 support is required; GitHub manual and post-deploy probes alone cannot supply an uptime SLA.
- [ ] Recheck Google Search Console property/verified ownership once connected; SEO is lower priority than safe accounts and live classes.

## Change control & safe rollback
- Release backend and website changes through PRs, with \`npm ci\`, \`npm run check\`, \`npm test\`, \`npm run build\`, \`npm run test:seo:build\`, then the post-deploy GET-only probe. Record the commit SHA.
- If a deploy introduces a severe regression, review the failing run and choose rollback of the affected Git commit/Cloudflare deployment **through the owner**; do not automatically overwrite database records or rotate keys without incident triage.
- Re-run readiness probes, privileged-access negatives, and a teacher/student test after rollback. Record when/how safe operation resumed.

**Scope note:** This document describes operational safeguards and verification steps; it does not enact backups, credential rotation, changes to real balances, proactive messages to guardians or incident notifications. These require approved owner/provider access and careful validation.
