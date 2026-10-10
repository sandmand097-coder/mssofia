-- Mrs Sofia: schema copy from read-only PostgreSQL catalog inspection, 2026-10-10
-- Target: sandmand097-coder's existing Supabase project wnkewiulyobbjftckfqb.
-- Non-destructive: source database is untouched; refuse if target already contains school tables.
BEGIN;
SET LOCAL statement_timeout = '120s';
DO $check$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_tables WHERE schemaname='public' AND tablename IN ('users','courses','lessons','bookings')) THEN
   RAISE EXCEPTION 'Migration stopped: target contains school tables; no objects were changed';
 END IF;
END $check$;
DO $role$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='mssofia_backend') THEN
  CREATE ROLE mssofia_backend NOLOGIN;
 END IF;
END $role$;
CREATE TABLE public."attendance" (
  "id" uuid NOT NULL,
  "lesson_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."auth_tokens" (
  "id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "purpose" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."bookings" (
  "id" uuid NOT NULL,
  "course_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_at" timestamp with time zone
);
CREATE TABLE public."courses" (
  "id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "subject" text NOT NULL,
  "level" text NOT NULL,
  "price" integer DEFAULT 0 NOT NULL,
  "duration_minutes" integer DEFAULT 60 NOT NULL,
  "capacity" integer DEFAULT 30 NOT NULL,
  "teacher_id" uuid NOT NULL,
  "status" text DEFAULT 'published'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."lesson_bans" (
  "lesson_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "banned_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."lesson_hands" (
  "lesson_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "raised_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."lesson_speakers" (
  "lesson_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "mode" text NOT NULL,
  "approved_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."lessons" (
  "id" uuid NOT NULL,
  "course_id" uuid NOT NULL,
  "title" text NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "duration_minutes" integer DEFAULT 60 NOT NULL,
  "status" text DEFAULT 'scheduled'::text NOT NULL,
  "room_key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "meet_url" text
);
CREATE TABLE public."payment_review_links" (
  "id" uuid NOT NULL,
  "payment_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "recipient_email" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."payment_submissions" (
  "id" uuid NOT NULL,
  "booking_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "course_id" uuid NOT NULL,
  "amount_egp" integer NOT NULL,
  "transfer_reference" character varying(80) NOT NULL,
  "sender_last4" character(4),
  "proof_key" text NOT NULL,
  "status" character varying(16) DEFAULT 'pending'::character varying NOT NULL,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_at" timestamp with time zone,
  "reviewed_by" uuid,
  "review_note" text,
  "confirmed_on_phone" boolean DEFAULT false NOT NULL,
  "sender_phone" text
);
CREATE TABLE public."users" (
  "id" uuid NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "role" text NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "specialty" text DEFAULT ''::text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "email_verified_at" timestamp with time zone,
  "session_version" integer DEFAULT 0 NOT NULL,
  "guardian_email" text,
  "guardian_consent_at" timestamp with time zone,
  "google_sub" text
);
ALTER TABLE public."attendance" ADD CONSTRAINT "attendance_lesson_id_user_id_key" UNIQUE (lesson_id, user_id);
ALTER TABLE public."attendance" ADD CONSTRAINT "attendance_pkey" PRIMARY KEY (id);
ALTER TABLE public."auth_tokens" ADD CONSTRAINT "auth_tokens_pkey" PRIMARY KEY (id);
ALTER TABLE public."auth_tokens" ADD CONSTRAINT "auth_tokens_purpose_check" CHECK (purpose = ANY (ARRAY['verify_email'::text, 'reset_password'::text]));
ALTER TABLE public."auth_tokens" ADD CONSTRAINT "auth_tokens_token_hash_key" UNIQUE (token_hash);
ALTER TABLE public."bookings" ADD CONSTRAINT "bookings_course_id_student_id_key" UNIQUE (course_id, student_id);
ALTER TABLE public."bookings" ADD CONSTRAINT "bookings_pkey" PRIMARY KEY (id);
ALTER TABLE public."bookings" ADD CONSTRAINT "bookings_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]));
ALTER TABLE public."courses" ADD CONSTRAINT "courses_pkey" PRIMARY KEY (id);
ALTER TABLE public."lesson_bans" ADD CONSTRAINT "lesson_bans_pkey" PRIMARY KEY (lesson_id, student_id);
ALTER TABLE public."lesson_hands" ADD CONSTRAINT "lesson_hands_pkey" PRIMARY KEY (lesson_id, student_id);
ALTER TABLE public."lesson_speakers" ADD CONSTRAINT "lesson_speakers_mode_check" CHECK (mode = ANY (ARRAY['microphone'::text, 'camera'::text]));
ALTER TABLE public."lesson_speakers" ADD CONSTRAINT "lesson_speakers_pkey" PRIMARY KEY (lesson_id, student_id);
ALTER TABLE public."lessons" ADD CONSTRAINT "lessons_pkey" PRIMARY KEY (id);
ALTER TABLE public."lessons" ADD CONSTRAINT "lessons_room_key_key" UNIQUE (room_key);
ALTER TABLE public."payment_review_links" ADD CONSTRAINT "payment_review_links_pkey" PRIMARY KEY (id);
ALTER TABLE public."payment_review_links" ADD CONSTRAINT "payment_review_links_token_hash_key" UNIQUE (token_hash);
ALTER TABLE public."payment_submissions" ADD CONSTRAINT "payment_submissions_amount_egp_check" CHECK (amount_egp >= 0 AND amount_egp <= 100000);
ALTER TABLE public."payment_submissions" ADD CONSTRAINT "payment_submissions_booking_id_key" UNIQUE (booking_id);
ALTER TABLE public."payment_submissions" ADD CONSTRAINT "payment_submissions_pkey" PRIMARY KEY (id);
ALTER TABLE public."payment_submissions" ADD CONSTRAINT "payment_submissions_proof_key_key" UNIQUE (proof_key);
ALTER TABLE public."payment_submissions" ADD CONSTRAINT "payment_submissions_status_check" CHECK (status::text = ANY (ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying]::text[]));
ALTER TABLE public."payment_submissions" ADD CONSTRAINT "sender_phone_format" CHECK (sender_phone IS NULL OR sender_phone ~ '^01[0125][0-9]{8}$'::text) NOT VALID;
ALTER TABLE public."users" ADD CONSTRAINT "users_email_key" UNIQUE (email);
ALTER TABLE public."users" ADD CONSTRAINT "users_pkey" PRIMARY KEY (id);
ALTER TABLE public."users" ADD CONSTRAINT "users_role_check" CHECK (role = ANY (ARRAY['student'::text, 'teacher'::text, 'admin'::text]));
ALTER TABLE public."users" ADD CONSTRAINT "users_status_check" CHECK (status = ANY (ARRAY['active'::text, 'pending'::text, 'blocked'::text]));
ALTER TABLE public."attendance" ADD CONSTRAINT "attendance_lesson_id_fkey" FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE;
ALTER TABLE public."attendance" ADD CONSTRAINT "attendance_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public."auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."bookings" ADD CONSTRAINT "bookings_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE public."bookings" ADD CONSTRAINT "bookings_student_id_fkey" FOREIGN KEY (student_id) REFERENCES users(id);
ALTER TABLE public."courses" ADD CONSTRAINT "courses_teacher_id_fkey" FOREIGN KEY (teacher_id) REFERENCES users(id);
ALTER TABLE public."lesson_bans" ADD CONSTRAINT "lesson_bans_lesson_id_fkey" FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE;
ALTER TABLE public."lesson_bans" ADD CONSTRAINT "lesson_bans_student_id_fkey" FOREIGN KEY (student_id) REFERENCES users(id);
ALTER TABLE public."lesson_hands" ADD CONSTRAINT "lesson_hands_lesson_id_fkey" FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE;
ALTER TABLE public."lesson_hands" ADD CONSTRAINT "lesson_hands_student_id_fkey" FOREIGN KEY (student_id) REFERENCES users(id);
ALTER TABLE public."lesson_speakers" ADD CONSTRAINT "lesson_speakers_lesson_id_fkey" FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE;
ALTER TABLE public."lesson_speakers" ADD CONSTRAINT "lesson_speakers_student_id_fkey" FOREIGN KEY (student_id) REFERENCES users(id);
ALTER TABLE public."lessons" ADD CONSTRAINT "lessons_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE public."payment_review_links" ADD CONSTRAINT "payment_review_links_payment_id_fkey" FOREIGN KEY (payment_id) REFERENCES payment_submissions(id) ON DELETE CASCADE;
ALTER TABLE public."payment_submissions" ADD CONSTRAINT "payment_submissions_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
ALTER TABLE public."payment_submissions" ADD CONSTRAINT "payment_submissions_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE public."payment_submissions" ADD CONSTRAINT "payment_submissions_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES users(id);
ALTER TABLE public."payment_submissions" ADD CONSTRAINT "payment_submissions_student_id_fkey" FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expiry ON public.auth_tokens USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_purpose ON public.auth_tokens USING btree (user_id, purpose);
CREATE INDEX IF NOT EXISTS idx_bookings_course ON public.bookings USING btree (course_id, status);
CREATE INDEX IF NOT EXISTS idx_lesson_hands_time ON public.lesson_hands USING btree (lesson_id, raised_at);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON public.lessons USING btree (course_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_payment_review_links_payment ON public.payment_review_links USING btree (payment_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS payment_submissions_reference_unique ON public.payment_submissions USING btree (lower((transfer_reference)::text));
CREATE INDEX IF NOT EXISTS payment_submissions_status_time ON public.payment_submissions USING btree (status, submitted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON public.users USING btree (google_sub) WHERE (google_sub IS NOT NULL);
ALTER TABLE public."attendance" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."attendance" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."attendance" TO mssofia_backend;
CREATE POLICY app_backend_only ON public."attendance" FOR ALL TO mssofia_backend USING (true) WITH CHECK (true);
ALTER TABLE public."auth_tokens" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."auth_tokens" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."auth_tokens" TO mssofia_backend;
CREATE POLICY app_backend_only ON public."auth_tokens" FOR ALL TO mssofia_backend USING (true) WITH CHECK (true);
ALTER TABLE public."bookings" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."bookings" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."bookings" TO mssofia_backend;
CREATE POLICY app_backend_only ON public."bookings" FOR ALL TO mssofia_backend USING (true) WITH CHECK (true);
ALTER TABLE public."courses" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."courses" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."courses" TO mssofia_backend;
CREATE POLICY app_backend_only ON public."courses" FOR ALL TO mssofia_backend USING (true) WITH CHECK (true);
ALTER TABLE public."lesson_bans" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."lesson_bans" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."lesson_bans" TO mssofia_backend;
CREATE POLICY app_backend_only ON public."lesson_bans" FOR ALL TO mssofia_backend USING (true) WITH CHECK (true);
ALTER TABLE public."lesson_hands" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."lesson_hands" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."lesson_hands" TO mssofia_backend;
CREATE POLICY app_backend_only ON public."lesson_hands" FOR ALL TO mssofia_backend USING (true) WITH CHECK (true);
ALTER TABLE public."lesson_speakers" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."lesson_speakers" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."lesson_speakers" TO mssofia_backend;
CREATE POLICY app_backend_only ON public."lesson_speakers" FOR ALL TO mssofia_backend USING (true) WITH CHECK (true);
ALTER TABLE public."lessons" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."lessons" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."lessons" TO mssofia_backend;
CREATE POLICY app_backend_only ON public."lessons" FOR ALL TO mssofia_backend USING (true) WITH CHECK (true);
ALTER TABLE public."payment_review_links" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."payment_review_links" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."payment_review_links" TO mssofia_backend;
CREATE POLICY app_backend_only ON public."payment_review_links" FOR ALL TO mssofia_backend USING (true) WITH CHECK (true);
ALTER TABLE public."payment_submissions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."payment_submissions" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."payment_submissions" TO mssofia_backend;
CREATE POLICY app_backend_only ON public."payment_submissions" FOR ALL TO mssofia_backend USING (true) WITH CHECK (true);
ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."users" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."users" TO mssofia_backend;
CREATE POLICY app_backend_only ON public."users" FOR ALL TO mssofia_backend USING (true) WITH CHECK (true);
GRANT USAGE ON SCHEMA public TO mssofia_backend;
INSERT INTO storage.buckets (id, name, public) VALUES ('mrsofia-payment-proofs','mrsofia-payment-proofs',false) ON CONFLICT (id) DO NOTHING;
COMMIT;
