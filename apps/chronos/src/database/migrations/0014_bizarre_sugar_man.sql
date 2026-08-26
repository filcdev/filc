ALTER TABLE "user" DROP CONSTRAINT "user_cohort_id_cohort_id_fk";
--> statement-breakpoint
ALTER TABLE "system_message_cohort_mtm" DROP CONSTRAINT "system_message_cohort_mtm_system_message_id_system_message_id_f";
--> statement-breakpoint
DROP INDEX "notification_created_at_idx";--> statement-breakpoint
DROP INDEX "notification_user_id_created_at_idx";--> statement-breakpoint
DROP INDEX "api_key_user_id_idx";--> statement-breakpoint
DROP INDEX "bug_report_status_idx";--> statement-breakpoint
DROP INDEX "card_device_card_id_idx";--> statement-breakpoint
DROP INDEX "card_device_device_id_idx";--> statement-breakpoint
DROP INDEX "announcement_cohort_mtm_announcement_id_idx";--> statement-breakpoint
DROP INDEX "announcement_cohort_mtm_cohort_id_idx";--> statement-breakpoint
DROP INDEX "system_message_cohort_mtm_cohort_id_idx";--> statement-breakpoint
DROP INDEX "system_message_cohort_mtm_system_message_id_idx";--> statement-breakpoint
DROP INDEX "cohort_timetable_mtm_timetable_id_idx";--> statement-breakpoint
ALTER TABLE "role" ALTER COLUMN "can" SET DEFAULT ARRAY[]::text[];--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "updated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "email_verified" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "roles" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "updated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "updated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();--> statement-breakpoint
ALTER TABLE "user_preferences" ALTER COLUMN "notification_preferences" SET DEFAULT '{"announcement":true,"blogPost":false,"channelsEnabled":true,"doorlockCardUsed":false,"movedLesson":true,"substitution":true,"systemMessage":true}'::jsonb;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "issuer" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "system_message_cohort_mtm" ADD CONSTRAINT "system_message_cohort_mtm_system_message_id_system_message_id_fk" FOREIGN KEY ("system_message_id") REFERENCES "public"."system_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON "account" USING btree ("issuer","account_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_key_key_hash_idx" ON "api_key" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "notification_created_at_idx" ON "notification" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notification_user_id_created_at_idx" ON "notification" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "api_key_user_id_idx" ON "api_key" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bug_report_status_idx" ON "bug_report" USING btree ("status");--> statement-breakpoint
CREATE INDEX "card_device_card_id_idx" ON "card_device" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "card_device_device_id_idx" ON "card_device" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "announcement_cohort_mtm_announcement_id_idx" ON "announcement_cohort_mtm" USING btree ("announcement_id");--> statement-breakpoint
CREATE INDEX "announcement_cohort_mtm_cohort_id_idx" ON "announcement_cohort_mtm" USING btree ("cohort_id");--> statement-breakpoint
CREATE INDEX "system_message_cohort_mtm_cohort_id_idx" ON "system_message_cohort_mtm" USING btree ("cohort_id");--> statement-breakpoint
CREATE INDEX "system_message_cohort_mtm_system_message_id_idx" ON "system_message_cohort_mtm" USING btree ("system_message_id");--> statement-breakpoint
CREATE INDEX "cohort_timetable_mtm_timetable_id_idx" ON "cohort_timetable_mtm" USING btree ("timetable_id");--> statement-breakpoint
ALTER TABLE "card_device" DROP CONSTRAINT "card_device_card_id_device_id_pk";
--> statement-breakpoint
ALTER TABLE "card_device" ADD CONSTRAINT "card_device_card_id_device_id_pk" PRIMARY KEY("card_id","device_id");--> statement-breakpoint
ALTER TABLE "moved_lesson_lesson_mtm" DROP CONSTRAINT "moved_lesson_lesson_mtm_lesson_id_moved_lesson_id_pk";
--> statement-breakpoint
ALTER TABLE "moved_lesson_lesson_mtm" ADD CONSTRAINT "moved_lesson_lesson_mtm_lesson_id_moved_lesson_id_pk" PRIMARY KEY("lesson_id","moved_lesson_id");--> statement-breakpoint
ALTER TABLE "substitution_lesson_mtm" DROP CONSTRAINT "substitution_lesson_mtm_lesson_id_substitution_id_pk";
--> statement-breakpoint
ALTER TABLE "substitution_lesson_mtm" ADD CONSTRAINT "substitution_lesson_mtm_lesson_id_substitution_id_pk" PRIMARY KEY("lesson_id","substitution_id");--> statement-breakpoint
ALTER TABLE "announcement_cohort_mtm" DROP CONSTRAINT "announcement_cohort_mtm_announcement_id_cohort_id_pk";
--> statement-breakpoint
ALTER TABLE "announcement_cohort_mtm" ADD CONSTRAINT "announcement_cohort_mtm_announcement_id_cohort_id_pk" PRIMARY KEY("announcement_id","cohort_id");--> statement-breakpoint
ALTER TABLE "cohort_timetable_mtm" DROP CONSTRAINT "cohort_timetable_mtm_cohort_id_timetable_id_pk";
--> statement-breakpoint
ALTER TABLE "cohort_timetable_mtm" ADD CONSTRAINT "cohort_timetable_mtm_cohort_id_timetable_id_pk" PRIMARY KEY("cohort_id","timetable_id");