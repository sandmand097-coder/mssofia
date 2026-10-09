# Mrs Sofia — staged administrator-only launch

This deployable mode lets a preapproved school director prepare courses and conduct LiveKit lessons. It **does not** enable public registration, email/password login, receipts, payments, or student access.

## Status and invariants

- GitHub repository: `sandmand097-coder/mssofia` (only).
- Static frontend: `https://mssofia.pages.dev` (Cloudflare Pages).
- Existing backend: `https://mssofia.onrender.com` (Render Free).
- Database: existing Supabase PostgreSQL project (no reseeding, drops, or migrations as part of this stage).
- Google OAuth web client already has both Cloudflare Pages and Render in **Authorized JavaScript origins**; the app uses the Google Identity Services JavaScript callback (no redirect URI required).
- `PUBLIC_LAUNCH_MODE=preview` continues to fail closed and serve the public promotional page without waking Render.
- Do **not** point production to the local SQLite file; use the existing PostgreSQL schema.
- Never expose database passwords, Google client secrets, Supabase service-role keys, or LiveKit API secrets to the browser, source control, or chat logs.

## Production prerequisites (must be verified before switching modes)

1. Create/activate a dedicated least-privileged `mssofia_backend` PostgreSQL login on the existing Supabase project. Use its own randomly generated secret; obtain the **exact Session Pooler** hostname/port from Supabase Connect and verify TLS and `SELECT 1`. Do not use a guessed host or privileged `postgres` account as a substitute.
2. Store `DATABASE_URL` and `JWT_SECRET` **only** in Render environment. `JWT_SECRET` must be at least 48 characters. Keep PostgreSQL TLS verification on. Confirm backend startup and a restricted query on the existing schema.
3. Configure Render environment (merge; never replace other variables):
   - `APP_ORIGIN=https://mssofia.pages.dev`
   - `GOOGLE_OAUTH_CLIENT_ID=<the existing Mrs Sofia web-client ID>`
   - `GOOGLE_ADMIN_EMAIL=<email of existing active admin database row>`
   - `GOOGLE_ADMIN_LOGIN_ENABLED=true`
   - `REGISTRATION_ENABLED=false`
   - `SCHOOL_PRIVACY_APPROVED=false`
   - `PUBLIC_LAUNCH_MODE=admin`
4. The director must sign in using the existing approved Google account. The backend validates the Google-signed ID token, exact audience, issuer, verified email, existing active admin row, and immutable Google subject. It cannot create or promote an admin account. First successful login binds the Google subject.
5. Confirm the backend `GET /api/health` returns `mode: admin` and `GET /api/auth/google/config` returns `enabled: true`; the registration-status endpoint must return `registrationAvailable:false`. Test administrative auth, course creation, and LiveKit token generation using authorized school accounts.
6. **Only after these checks succeed**, configure Cloudflare Pages project environment:
   - `API_ORIGIN=https://mssofia.onrender.com`
   - `FULL_BACKEND_READY=true`
   - `PUBLIC_LAUNCH_MODE=admin`
   Cloudflare's fixed-origin proxy preserves first-party HttpOnly cookies. Public health and marketing remain edge-local; private requests can wake Render Free.

## Rollback

If any production check fails, restore `PUBLIC_LAUNCH_MODE=preview` on Cloudflare Pages and Render; reset `FULL_BACKEND_READY=false` on Pages. This disables all protected access without deleting school data.

## Public launch remains separate

**Do not** set `PUBLIC_LAUNCH_MODE=full` or `REGISTRATION_ENABLED=true` until a verified production email sender, guardian consent, approved privacy and refund policies, restricted receipt storage, verified Vodafone Cash reconciliation, two-device LiveKit test, and end-to-end negative-permission tests have passed. The first-month 100 EGP offer is promotional until those tests complete.

## Local verification

```sh
npm ci
npm run check
npm test
npm run build
node tests/admin-only-browser.mjs
```

These commands test local behavior. They do not prove the external identity, database, email, or LiveKit services are configured in production.
