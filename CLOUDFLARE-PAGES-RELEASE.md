# Miss Sofia — Cloudflare Pages: fast public site and protected Node backend

## Why this architecture

The Render Free instance can sleep when unused. The Cloudflare Pages static React/Vite frontend is served from CDN without waking Render. The existing Render application remains the backend for authenticated lessons, administrative actions and payment receipt reviews. LiveKit Cloud stays the WebRTC/SFU media provider.

Public school website (live): `https://mssofia.pages.dev`.
Existing backend: `https://mssofia.onrender.com`.

**The Render URL is no longer the preferred public link** after Cloudflare deployment: visitors to the old onrender.com link can still see Render's wake-up screen. Changing the domain attached to the new Cloudflare Pages frontend prevents that on the NEW public address, not on the old Render hostname.

### Zero Render requests in introductory preview mode

`functions/api/[[path]].js` implements a Cloudflare Pages Function scoped to `/api/*`. When the school is in preview mode, the Function returns `/api/health`, `/api/auth/me`, `/api/auth/registration-status`, `/api/auth/google/config` and `/api/courses` locally at the edge. Payments, registrations, admin, student accounts and LiveKit tokens remain unavailable. No API request to Render is made, and no credentials or database are required.

In the **future** when the full backend has passed production security checks, a same-origin edge proxy can forward `/api/*` to the fixed Render server. This supports same-origin HttpOnly session cookies, private receipts, JSON uploads and the Google login token exchange. Origin headers are preserved for Render's CSRF checks, while X-Forwarded-* supplied by the browser are stripped. Authenticated and error responses are never cached.

The full mode requires ALL THREE Cloudflare Function environment settings:

```text
PUBLIC_LAUNCH_MODE=full
FULL_BACKEND_READY=true
API_ORIGIN=https://mssofia.onrender.com
```

Any missing/wrong value leaves the edge in safe preview. Do **not** set these until the production database, guardian registration, verified mail, manual receipt flow and full LiveKit webhook integration have been verified. Never point `API_ORIGIN` at a user-supplied host.

Also set Render's `APP_ORIGIN` to the actual Cloudflare frontend domain before enabling any enrollment or Google sign-in. Add that frontend domain to Google Cloud OAuth's **Authorized JavaScript origins**, and keep Render's own domain only for administrative fallback.

### Cloudflare Pages deployment — LIVE (Direct Upload)

The free public school website has been **deployed successfully** to https://mssofia.pages.dev using Wrangler 4.149.0. The Cloudflare project is `mssofia` under the authorised school's Cloudflare account; the backend remains on Render.

First release was published from the verified GitHub `main` tree with:

```powershell
npm run check
npm test
npm run build
npx --yes wrangler@4.149.0 pages deploy dist --project-name mssofia --branch main
```

Cloudflare's Direct Upload projects cannot later be converted to a Cloudflare-managed Git integration. **Instead, this repo now includes a dedicated GitHub Actions CI/CD workflow** at `.github/workflows/cloudflare-pages.yml`, which can automatically build, test and deploy subsequent pushes to `main` using a *restricted Cloudflare Pages API token*.

To activate automatic deployments, do this once (without pasting any token into a chat):
1. In Cloudflare > My Profile > API Tokens, create a custom token with **Account / Cloudflare Pages / Edit** access, restricted to the Cloudflare account hosting `mssofia`. No global API key and no billing permissions are needed.
2. In GitHub `sandmand097-coder/mssofia` > Settings > Secrets and variables > Actions > New repository secret, add **`CLOUDFLARE_API_TOKEN`** with that token's value.
3. The Cloudflare account ID (public identifier, not a secret) is already scoped into the workflow. The next push to `main` will run Node 24, check, test, build and deploy automatically. Until the secret is present, the workflow **skips publishing safely**; the live site remains unaffected. You can trigger the workflow manually from GitHub Actions after installing the secret.

Cloudflare Pages preview Functions answer public read requests without waking Render. Do **not** enable student registration, payment or full API forwarding until the actual production database, official email domain and children's privacy review pass. When turning on the real backend, change `APP_ORIGIN` to the Pages domain and add it to Google's authorised JavaScript origins first.

### Testing

- `npm run check` validates Node server and Pages API Function syntax.
- `npm test` includes 21 checks for the preview API and full-mode proxy, including cookie handling, CSRF Origin forwarding, upload payloads, no-cache headers, open-proxy prevention and upstream failures.
- `npm run build` builds the static site into `dist/` and includes `public/_headers`.
- `npx wrangler pages dev dist` tests real Cloudflare Pages routing and SPA fallback locally. Use a separate port from the Vite dev server.
- For deployment, test first mobile/desktop renders, instant edge `/api/health`, API lockout, private login, and that a cold Render backend does not affect the public landing page.

### Known limits of free services

Cloudflare Pages static assets are globally cached without per-request Functions charges; Pages Functions consume Workers Free requests (up to 100,000 daily across Workers/Pages Functions on the free plan, subject to current terms). Render Free backend still sleeps after inactivity: requests requiring it can be slow when first used. LiveKit Cloud Build also has usage limits, and large simultaneous classes will require scaling/payment eventually.

There is **no zero-cost guarantee of zero downtime, infinite bandwidth or hundreds of simultaneous pupils**. The architecture prioritizes a stable, fast, secure landing page with a measured path to full production.
