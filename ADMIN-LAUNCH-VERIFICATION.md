# Mrs Sofia - Administrator Launch Verification
Status: ADMIN-ONLY LIVE (2026-10-10). Public student enrollment and payments remain CLOSED.

## Production endpoints
- Cloudflare Pages: https://mssofia.pages.dev
- Administrator entry: https://mssofia.pages.dev/login
- Render API: https://mssofia.onrender.com
- Owner-managed Supabase: wnkewiulyobbjftckfqb (sandmand097-coder's Org; EU West 1)
- Prior Supabase project: jtluslevdmcpxxkngomj (preserved, not used by Render)
- GitHub: https://github.com/sandmand097-coder/mssofia

## Confirmed in production
- Render /api/health returns HTTP 200 with mode=admin and registrationAvailable=false.
- Render /api/auth/google/config has enabled=true with the preapproved Google client ID.
- Cloudflare Pages /api/health returns HTTP 200 with mode=admin.
- Cloudflare Pages /api/auth/google/config returns enabled=true.
- Unauthorized dashboard/profile/payment API requests return HTTP 401.
- Password login and public registration requests return HTTP 503.
- Nonauthenticated course listing returns an empty public array.
- Chrome/Edge headless browser checked home, privacy, terms, and courses at 390px and 1366px; no horizontal overflow or browser runtime errors.
- Google Sign-In iframe rendered on the admin login screen on both viewport sizes.
- /admin redirects unauthenticated visitors to /login.
- Render LiveKit Cloud API connection was confirmed by read-only room listing at startup.
- Backend readiness checks require a validated PostgreSQL TLS connection, restricted database login, and an active preapproved admin account.
- Public student registration and payment operations are intentionally locked during this phase.

## Repeatable test commands (Windows PC)
- npm run check
- npm test
- npm run build
- node qa-cloudflare-admin.mjs

## First interactive acceptance test
The preapproved director must click the Google button on https://mssofia.pages.dev/login
and authorize their actual Google identity. This cannot be completed by mocked-token tests.
After login, verify the dashboard loads real data, create a genuine science course, schedule
a lesson, and test live audio/video from two devices with appropriate consent.
Do not inject fake sessions or bypass Google's identity flow.

## Release restrictions
**Not a full public-school launch.** Before enabling full mode and real student enrollment:
- Verify school owner approval of privacy terms and parent/guardian consent handling.
- Configure and verify a school-controlled outgoing email sender for account verification.
- Confirm payment number, private receipt storage, reviewer authorization and real transfer confirmation.
- Perform genuine Google administrator login and two-device LiveKit media acceptance tests.
- Re-run role-based access and rate limiting/security checks on the deployed public environment.

## Rollback (if authentication breaks)
1. Keep the Render application in admin-only mode; do not remove its secrets.
2. In the Cloudflare Pages project mssofia, set PUBLIC_LAUNCH_MODE=preview and
   FULL_BACKEND_READY=false (as encrypted Pages environment variables).
3. Redeploy a known-good site build with Wrangler Pages deploy.
4. Verify https://mssofia.pages.dev/api/health returns mode=preview; registration remains closed.
No database reset, schema drop, key disclosure or data migration is part of rollback.

## Security handling
Never commit DATABASE_URL, JWT_SECRET, LiveKit secrets or Supabase privileged API keys.
Never paste secret values into logs or public chat. The original Supabase project and source
data have not been deleted. Refer to database/CUTOVER-REPORT.md for schema transfer details.
