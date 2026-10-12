-- Additive, nullable contact fields for manual parent/guardian enrollment only.
-- No existing payment records, bookings, RLS policies or student statuses change.
-- Apply to Supabase before deploying code that reads these fields.
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS guardian_phone text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS contact_requested_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS contact_kind text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS contact_status text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS contact_review_note text;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_contact_kind_valid
  CHECK (contact_kind IS NULL OR contact_kind IN ('initial','renewal')) NOT VALID;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_contact_status_valid
  CHECK (contact_status IS NULL OR contact_status IN ('pending','approved','rejected')) NOT VALID;
-- Both new constraints permit legacy NULL data. Validate when a maintenance
-- window and project backup/restore plan have been confirmed.
