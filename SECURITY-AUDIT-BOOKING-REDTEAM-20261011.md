# Miss Sofia — Payment / Booking Consistency & Adversarial Security Audit

**Date:** 2026-10-11  
**Scope:** administrator bookings, first-month Vodafone Cash approvals, manually verified payments, monthly renewal callbacks, authenticated API decisions and student access gating.  
**Safety:** adversarial state corruption only in a disposable local SQLite test database; frontend attacks used mocked network responses. No live financial transfers, course deletions, real student data mutations, production stress load or credentials extraction.

## Root cause and correction
The admin page fetched `/api/my/overview` and `/api/admin/dashboard` on mount, while `AdminPayments` refreshed only its own payment-list component after a successful decision. Returning to the bookings tab therefore displayed cached `pending` booking information and an outdated pending-count badge. On the server, legitimate payment review paths already change both payment and booking statuses in a transaction; a stale UI can look exactly like an inconsistent DB state.

**Fix:** successful first-month and renewal approvals notify the parent portal to reload the authoritative booking and dashboard results; entering the bookings or overview tab also triggers a refresh.

**Legacy recovery:** where a verified payment is `approved` + `confirmed_on_phone`, but its booking is still `pending`, the director receives a clearly labeled **complete booking activation** control. Its server transaction checks payment verification, course capacity, admin role, and current booking state before promoting the booking. This does **not** create any new payment, extend the payment period or overwrite an existing payment decision. If an already paid booking is `rejected`, the UI raises a conflict warning for manual investigation rather than trying an automatic recovery.

## Security findings and mitigations
| Priority | Pre-fix weakness | Treatment |
| --- | --- | --- |
| High | Stale bookings could invite a director to reject or repeat approval after a successful wallet decision | Synchronize parent state and hide destructive actions for approved/pending wallet transfers |
| High | Generic `PATCH /api/bookings/:id` allowed status reversal of already approved bookings, potentially disabling a paying student's access | Reject all changes to previously decided bookings, regardless of stale client requests |
| High | General booking approval checked `payment.status` but not `confirmed_on_phone` | Require director role and both approved status and explicit confirmed receipt for paid booking reconciliation |
| Medium | Booking moderation ran standalone reads + updates without a transaction | Lock booking and course rows on PostgreSQL and perform checked update inside one transaction |
| Medium | Already-verified legacy `payment=approved, booking=pending` was not explicitly identifiable in the director portal | Expose cross-status information, safe recovery button and errors without fabricating a second wallet record |
| Medium | Booking count not updated when money was accepted from a child payment component | Parent refresh after accepted/rejected transfers and when revisiting booking/overview tabs |

## Adversarial test coverage
- Existing complete Node test suite, Vite build, browser UI regression suite.
- **60 isolated wallet-payment checks** including cross-site origin (403), forged role and JSON status, SQL-injection-shaped booking identifiers, wrong payment amount, invalid phone, absent wallet confirmation, repeat receipt, one-time email token replay, unauthorized receipt reading and failed self-approval.
- Deliberately corrupted a temporary booking status from `approved` to `pending` while leaving payment approved; the student's entitlement remained disabled until director reconciliation, after which it was reactivated with the original payment record and expiry.
- Corrupted the temporary wallet confirmation flag and verified activation remained blocked.
- **Eight simultaneous repair requests:** exactly one successful approval (HTTP 200) and seven harmless conflicts (HTTP 409); no extra payment entries.
- Browser API mocks reproduce the original stale-screen symptom and verify refresh, pending count, reconciliation controls and no action to reject a previously approved payment.
- Production-side checks are read-only and limited to availability and protected endpoints. Real payment and production-DB modifications are excluded.
- `npm audit --omit=dev --audit-level=high` produced 0 known reported high/critical dependency advisories for the production dependency lockfile at test time. This is not proof that no vulnerability exists.

## Infrastructure visibility constraint
The Supabase project accessible through the connected Supabase integration returned **one user, zero bookings, zero payments and zero courses** in read-only counts at the time of investigation. The live screenshot contains a booking and payment; therefore the queried project cannot be treated as verified evidence of that live booking. The deployed Render database configuration was **not** inspected or altered, and the actual production record was not changed through this review. Confirm the real database project with an authorized infrastructure owner if a booking remains inconsistent after UI refresh.

## Operational acceptance
1. Sign in as a director and open **Bookings** after approving an authentic received transfer. Status should be `مقبول`, pending badge reduced, and student's live-access entitlement valid.
2. If a payment is confirmed but booking remains pending, use **استكمال تفعيل الحجز المدفوع** once; this operation does not create a new payment. If the course is full or the payment confirmation is missing, it refuses safely.
3. Do not manually approve the same wallet transfer twice. A payment image, phone number or test transaction ID alone does **not** prove that money arrived.
4. For a rejected booking with an approved payment, escalate the inconsistency and reconcile against the real wallet record and DB audit trail; do not invoke blind SQL fixes.
5. Retest with two isolated staging accounts and a test course before reopening a paid cohort.

**Status:** Controlled adversarial and browser regression tests pass on the release branch; live paid-transfer verification must be performed by the director herself.
