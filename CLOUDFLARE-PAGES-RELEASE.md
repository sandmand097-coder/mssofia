# Mrs Sofia — Cloudflare Pages: fast public site and protected Node backend

## Why this architecture

The Render Free instance can sleep when unused. The Cloudflare Pages static React/Vite frontend is served from CDN without waking Render. The existing Render application remains the backend for authenticated lessons, administrative actions and payment receipt reviews. LiveKit Cloud stays the WebRTC/SFU media provider.

Public school website (after deployment): `https://<assigned-project>.pages.dev`.
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

### Cloudflare Pages Git integration — preferred for ongoing professional maintenance

1. Open https://dash.cloudflare.com > Workers & Pages > Create > Pages > Connect to Git.
2. Choose GitHub account `sandmand097-coder`, authorizing access **only to** `sandmand097-coder/mssofia`.
3. Project name `mssofia` (use `mrs-sofia-school` only if the first name is unavailable).
4. Production branch `main`, root `/`, build command `npm ci && npm run build`, output directory `dist`.
5. Set Cloudflare Pages build environment `NODE_VERSION=24` and keep `PUBLIC_LAUNCH_MODE=preview`. No database password, LiveKit secret, or other backend keys are needed in Pages for preview.
6. Deploy and verify `https://<assigned-name>.pages.dev`, `/privacy`, `/terms`, `/courses`, `/api/health`, `/api/auth/me` and mobile view.
7. After successful launch, share the **Cloudflare Pages URL** rather than Render's URL. Future GitHub pushes deploy automatically after the Cloudflare build passes.

Git-connected Pages projects support manual Wrangler deployments too; direct-upload projects cannot later be converted to Git integration. Therefore do not create a Direct Upload project before choosing the long-term Git-based workflow.

### Testing

- `npm run check` validates Node server and Pages API Function syntax.
- `npm test` includes 21 checks for the preview API and full-mode proxy, including cookie handling, CSRF Origin forwarding, upload payloads, no-cache headers, open-proxy prevention and upstream failures.
- `npm run build` builds the static site into `dist/` and includes `public/_headers`.
- `npx wrangler pages dev dist` tests real Cloudflare Pages routing and SPA fallback locally. Use a separate port from the Vite dev server.
- For deployment, test first mobile/desktop renders, instant edge `/api/health`, API lockout, private login, and that a cold Render backend does not affect the public landing page.

### Known limits of free services

Cloudflare Pages static assets are globally cached without per-request Functions charges; Pages Functions consume Workers Free requests (up to 100,000 daily across Workers/Pages Functions on the free plan, subject to current terms). Render Free backend still sleeps after inactivity: requests requiring it can be slow when first used. LiveKit Cloud Build also has usage limits, and large simultaneous classes will require scaling/payment eventually.

There is **no zero-cost guarantee of zero downtime, infinite bandwidth or hundreds of simultaneous pupils**. The architecture prioritizes a stable, fast, secure landing page with a measured path to full production.
