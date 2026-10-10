-- Created by Supabase CLI: supabase migration new secure_monthly_renewals
-- ADDITIVE ONLY: leaves all existing users, bookings, lessons and payments intact.
-- Apply to project wnkewiulyobbjftckfqb, then audit RLS before enabling flags.
BEGIN;

CREATE TABLE IF NOT EXISTS public.subscription_renewals (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  amount_egp integer NOT NULL CHECK (amount_egp>0 AND amount_egp<=100000),
  transfer_reference text NOT NULL UNIQUE,
  sender_phone text NOT NULL CHECK (sender_phone ~ '^01[0125][0-9]{8}$'),
  proof_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.users(id),
  review_note text,
  confirmed_on_phone boolean NOT NULL DEFAULT false,
  period_start timestamptz,
  period_end timestamptz,
  CONSTRAINT renewal_approved_needs_phone_confirmation CHECK (
   status<>'approved' OR (confirmed_on_phone AND reviewed_at IS NOT NULL
    AND reviewed_by IS NOT NULL AND period_start IS NOT NULL
    AND period_end IS NOT NULL AND period_end>period_start)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_renewal_one_pending
 ON public.subscription_renewals (booking_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS idx_renewals_booking_period
 ON public.subscription_renewals (booking_id,status,period_end);
CREATE INDEX IF NOT EXISTS idx_renewals_review_queue
 ON public.subscription_renewals (status,submitted_at);

CREATE TABLE IF NOT EXISTS public.lesson_questions (
 id uuid PRIMARY KEY,
 lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 300),
 answer text CHECK (answer IS NULL OR char_length(answer) BETWEEN 1 AND 500),
 created_at timestamptz NOT NULL DEFAULT now(),
 answered_at timestamptz,
 answered_by uuid REFERENCES public.users(id),
 CONSTRAINT answer_needs_review CHECK (
  (answer IS NULL AND answered_at IS NULL AND answered_by IS NULL)
  OR (answer IS NOT NULL AND answered_at IS NOT NULL AND answered_by IS NOT NULL)
 )
);
CREATE INDEX IF NOT EXISTS idx_lesson_questions_lesson_time
 ON public.lesson_questions (lesson_id,created_at);
CREATE INDEX IF NOT EXISTS idx_lesson_questions_student
 ON public.lesson_questions (student_id,lesson_id);

-- Both tables are private backend APIs. No direct browser/PostgREST access.
ALTER TABLE public.subscription_renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.subscription_renewals,public.lesson_questions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.subscription_renewals,public.lesson_questions TO mssofia_backend;

DO $policies$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_policies
  WHERE schemaname='public' AND tablename='subscription_renewals' AND policyname='app_backend_only'
 ) THEN
  CREATE POLICY app_backend_only ON public.subscription_renewals
   FOR ALL TO mssofia_backend USING (true) WITH CHECK (true);
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_policies
  WHERE schemaname='public' AND tablename='lesson_questions' AND policyname='app_backend_only'
 ) THEN
  CREATE POLICY app_backend_only ON public.lesson_questions
   FOR ALL TO mssofia_backend USING (true) WITH CHECK (true);
 END IF;
END
$policies$;

COMMIT;
