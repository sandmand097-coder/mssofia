# Mrs Sofia — GitHub and Render release workflow

## Confirmed GitHub repository

- Owner: `sandmand097-coder`
- Repository: `mssofia`
- URL: https://github.com/sandmand097-coder/mssofia
- Repository visibility: Public at the time of verification. Keep secrets and pupil data outside Git.
- School branding: **Mrs Sofia — مدرسة العلوم**.
- The repository owner is the new GitHub account, not any older GitHub account.
- This project must not modify unrelated Render or GitHub services.

## Production prerequisites

The source is committed in local Git, and can be uploaded using the authorised GitHub connector. A public repository must not contain passwords, database connection strings, API keys, cookie secrets, personal student details, backup files, or `.env`.

The Render service must be independent on a Free plan and use persistent Supabase PostgreSQL. Its production startup deliberately refuses to use SQLite.

Required server-only secrets:

- `NODE_ENV=production`
- `DATABASE_URL`: verified Supabase PostgreSQL Pooler URI with a least-privileged database role
- `JWT_SECRET`: 48+ character random server-only signing key
- `APP_ORIGIN`: actual Render HTTPS service URL
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`: real cloud broadcast credentials (local `devkey/secret` must not be used)
- `MAIL_FROM` and `RESEND_API_KEY` or verified SMTP credentials before outbound student emails
- `REGISTRATION_ENABLED=false` until email delivery, privacy and child-account safeguards are proven

## Safe deployment order

1. Push cleaned code to `sandmand097-coder/mssofia`, main.
2. Confirm visibility and that there are no credentials or real user records in repository history.
3. Confirm persistent Supabase database connectivity over TLS, schema and driver behaviour.
4. Create **new** Render Free Web Service named `mssofia`, Frankfurt, pointing ONLY to the new repository; do not alter other services.
5. Build: `npm ci && npm run check && npm run build`; Start: `npm start`.
6. Configure server-only environment, start the app and check `/api/health`, login page, and database.
7. Provision LiveKit Cloud and verified mail. Test remote audio/video and delivery to a real inbox.
8. Invite the director/admin with a one-time email-only password setup, then test course creation, pupil enrolment approval and attendance.
9. After valid parent consent and privacy policy, enable public registration.

The local administrator is for development only and must never be used as the cloud admin.

## Verified local checks

`npm run check`, `npm test` (86 integration + 32 room moderation tests), `npm run build`, `node qa-registration-admin.mjs`, and `node qa-livekit-local-e2e.mjs` have passed previously. `npm audit` was brought to zero known advisories before publishing.

No untested claims should be made about hundreds of simultaneous students or remote LiveKit connectivity.
