-- Additive, nullable contact fields for manual parent/guardian enrollment only.
-- No existing payment records, bookings, RLS policies or student statuses change.
-- Apply to Supabase before deploying code that reads these fields.
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS guardian_phone text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS contact_requested_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS contact_kind text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS contact_status text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS contact_review_note text;
-- The application validates contact_kind/contact_status and only the school's
-- authenticated backend may update these fields. Keep migration repeatable.
