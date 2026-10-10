# Miss Sofia — controlled Supabase project migration

## Ownership and integrity

- Original source project: `jtluslevdmcpxxkngomj` in `yassinkandil's Org`. **Preserved, no deletes or modifications.**
- New owner-accessible project: `wnkewiulyobbjftckfqb` in `sandmand097-coder's Org`, West EU (Ireland).
- New target was verified to have **zero public base tables** before applying the schema.
- Copied 11 public school tables, 82 columns, 45 constraints (18 FKs), 28 indexes, and 11 RLS policies.
- Copied the sole existing administrator account, preserving account ID, email, status and bcrypt password hash.
- Source held zero courses, lessons, bookings, student accounts, payment submissions, or verification tokens.
- Recreated the private `mrsofia-payment-proofs` bucket. Source bucket contained zero objects.
- Target verified: 11 tables, 11 policies, 1 private bucket and 1 active administrator.
- The new restricted PostgreSQL role `mssofia_backend` has no BYPASSRLS and is authenticated separately from the `postgres` owner role.

## Connection security

- Exact Session Pooler, copied from the new project's Supabase Connect UI:
  - `aws-0-eu-west-1.pooler.supabase.com:5432`
  - username: `mssofia_backend.wnkewiulyobbjftckfqb`
- Official root certificate download from the project's Database Settings:
  - `https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`
  - SHA-256: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`
- Database and JWT credentials are generated using a cryptographic RNG and must exist only in Render secrets. They MUST NOT be committed, shown on a public website or included in logs.
- Both preflight and active PostgreSQL adapter use the Supabase CA certificate and strict certificate verification. Disabling TLS verification in production is prohibited.

## Staged release strategy

1. Backend deploys with `PUBLIC_LAUNCH_MODE=admin`, `REGISTRATION_ENABLED=false`, `SCHOOL_PRIVACY_APPROVED=false` and restricted database credentials.
2. Verify Render's own `/api/health` reports `mode=admin` and Google admin config reports `enabled=true`; independently verify student account creation and payments remain blocked.
3. Only then switch Cloudflare Pages settings `API_ORIGIN=https://mssofia.onrender.com`, `FULL_BACKEND_READY=true` and `PUBLIC_LAUNCH_MODE=admin`.
4. Check the browser/mobile login screen, first-party HttpOnly cookie and admin panel.
5. Never enable student registration, email payments or full mode before verified production email sender, guardian consent, legal policies, payment proof storage/security and full two-party LiveKit test.

## Rollback

Switch Cloudflare `PUBLIC_LAUNCH_MODE=preview` and `FULL_BACKEND_READY=false` immediately if admin auth or database service malfunctions. Source database remains available unchanged for comparison and recovery. Do not delete the old project automatically.
