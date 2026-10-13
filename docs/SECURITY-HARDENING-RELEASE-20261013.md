# Miss Sofia — Security hardening release, 13 October 2026

## Status

Changes in this PR prepare a controlled release; **passing CI is not a production security certification**.
The target production database project `wnkewiulyobbjftckfqb` is not currently accessible to the connected Supabase account, so real schema, Storage and RLS state are unverified.

## Code changes

- Public course detail API returns only published courses belonging to active teachers; draft titles and lesson schedules are not public.
- Director login by legacy password is blocked in production. A tested Google director sign-in becomes mandatory before Render rollout; development fixtures are unchanged.
- Old payment email review URLs (including proof/POST) return HTTP 410 in production. The notification sends only a pointer to the signed-in admin dashboard. Only authenticated director API decisions can update payments.
- Content-Security-Policy is enabled on Pages static responses and on the direct Render backend. Verify the real Google, LiveKit, font and responsive flows before deploying.
- Course enrollment statistics use parameterized batched database reads; authorization and 30-day entitlement rules remain unchanged.
- Both admin-only PostgreSQL preflight and private receipt-bucket verification now reject the old Supabase project and pin to the verified cutover *identifier* and EU-West-1 pooler hostname. This does **not** independently verify the target project's actual state.
- Independent read-only `GET /api/ready` checks PostgreSQL connectivity. Existing `GET /api/health` remains only process liveness.

## Release gates not yet satisfied

1. Reconnect an authorized Supabase account to the new project and inspect RLS, least-privileged role, private bucket and independent encrypted backup restore.
2. Verify Google sign-in for the director on `https://mssofia.pages.dev` before deploying a backend that disallows the old password.
3. Perform adult-operated two-device LiveKit tests including a previously minted token after moderation, removal and room end. Provider token revocation and account/session behavior cannot be proven from unit tests.
4. Deploy a compatible, fully tested Render commit manually (autoDeploy currently off) and compare backend/frontend SHAs before allowing a Pages update.
5. Execute read-only production smoke for readiness, anonymous access denial, cookies, full registration flow and live media. Do not use real payments or minor accounts for testing.
6. Set up a verified email sender and demonstrate benign message delivery. Until then do not advertise email recovery.
7. Resolve any continuing Cloudflare cold-start 503s. An always-on Render instance requires separate spending approval.
8. Enforce GitHub branch protection and required checks in repository settings with an administrator; do not assume CI alone prevents unauthorized merges.

## Rollback

No production mutation is performed by this PR. Preserve the prior live Render deploy for deliberate rollback, and block Cloudflare activation if the origin remains on an incompatible SHA. Never downgrade database policy or expose an anonymous financial endpoint to make a failing test pass.

## Atomic cross-provider deployment gate

The Cloudflare GitHub workflow now requires an actually successful quality check on **the same main commit**, checks that main has not moved, then performs anonymous read-only `/api/release` and `/api/ready` probes against Render. Unless Render's `RENDER_GIT_COMMIT` equals the source SHA and its database replies ready, the website **will not deploy**. A missing Cloudflare token is treated as a failure rather than reported as green.

Render deploys are still a separate manual owner decision. After Render is verified, re-run the Cloudflare workflow on main; rerunning the quality workflow is also supported. Never merge a partly tested backend and trust the next frontend automation to repair it.
