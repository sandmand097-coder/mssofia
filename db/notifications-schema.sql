-- PREPARATION ONLY: do not apply to production until privacy, verified guardian
-- WhatsApp opt-in and the official utility templates are approved.
-- SQL is compatible with Supabase PostgreSQL. Apply with a privileged role
-- during an approved maintenance window; never publish to the Data API.
CREATE TABLE IF NOT EXISTS public.notification_contacts (
 student_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
 phone_e164 TEXT NOT NULL CHECK (phone_e164 ~ '^\\+[1-9][0-9]{7,14}$'),
 whatsapp_opt_in_at TIMESTAMPTZ NOT NULL,
 whatsapp_verified_at TIMESTAMPTZ NOT NULL,
 consent_source TEXT NOT NULL CHECK (char_length(consent_source) BETWEEN 3 AND 100),
 revoked_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS public.notification_outbox (
 id TEXT PRIMARY KEY,
 event_key TEXT NOT NULL UNIQUE,
 type TEXT NOT NULL CHECK (type IN ('booking_approved','lesson_reminder')),
 student_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 booking_id TEXT NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
 lesson_id TEXT REFERENCES public.lessons(id) ON DELETE CASCADE,
 scheduled_at TIMESTAMPTZ NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','skipped','dead')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 12),
 next_attempt_at TIMESTAMPTZ NOT NULL,
 locked_until TIMESTAMPTZ,
 sent_at TIMESTAMPTZ,
 provider_message_id TEXT,
 last_error TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending
 ON public.notification_outbox(status,next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_student
 ON public.notification_outbox(student_id);
CREATE INDEX IF NOT EXISTS idx_notification_contacts_active
 ON public.notification_contacts(student_id)
 WHERE revoked_at IS NULL;
ALTER TABLE public.notification_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
-- No anon or authenticated policies; only the trusted backend DB role accesses
-- these tables. Explicitly GRANT to the existing restricted backend role after
-- inspection. Do not expose phone numbers via Supabase REST or frontend JS.
REVOKE ALL ON public.notification_contacts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.notification_outbox FROM PUBLIC, anon, authenticated;
