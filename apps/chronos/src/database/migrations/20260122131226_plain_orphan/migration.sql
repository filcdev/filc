CREATE TABLE "audit_log" (
	"button_pressed" boolean NOT NULL,
	"card_data" text,
	"card_id" uuid,
	"device_id" uuid NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"result" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "card" (
	"card_uid" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"frozen" boolean DEFAULT false NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "card_card_uid_unique" UNIQUE("card_uid")
);
--> statement-breakpoint
CREATE TABLE "card_device" (
	"card_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	CONSTRAINT "card_device_card_id_device_id_pk" PRIMARY KEY("card_id","device_id")
);
--> statement-breakpoint
CREATE TABLE "device" (
	"api_token" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"last_reset_reason" text,
	"location" text,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "device_api_token_unique" UNIQUE("api_token")
);
--> statement-breakpoint
CREATE TABLE "device_health" (
	"device_id" uuid NOT NULL,
	"device_meta" jsonb NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role" (
	"can" text[] DEFAULT ARRAY[]::text[],
	"description" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "role_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"access_token" text,
	"access_token_expires_at" timestamp,
	"account_id" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_token" text,
	"password" text,
	"provider_id" text NOT NULL,
	"refresh_token" text,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"created_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_address" text,
	"token" text NOT NULL,
	"updated_at" timestamp NOT NULL,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"cohort_id" text,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image" text,
	"name" text NOT NULL,
	"nickname" text,
	"roles" text[] DEFAULT '{"user"}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"expires_at" timestamp NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "building" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classroom" (
	"building_id" text NOT NULL,
	"capacity" integer,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cohort" (
	"classroom_ids" text[],
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short" text NOT NULL,
	"teacher_id" text,
	"timetable_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group" (
	"cohort_id" text NOT NULL,
	"entire_class" boolean NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"student_count" integer NOT NULL,
	"teacher_id" text,
	"timetable_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_definition" (
	"days" text[],
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson" (
	"classroom_ids" text[],
	"day_definition_id" text NOT NULL,
	"group_ids" text[],
	"id" text PRIMARY KEY NOT NULL,
	"period_id" text NOT NULL,
	"periods_per_week" integer NOT NULL,
	"subject_id" text NOT NULL,
	"teacher_ids" text[],
	"term_definition_id" text,
	"timetable_id" text NOT NULL,
	"weeks_definition_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_cohort_mtm" (
	"cohort_id" text NOT NULL,
	"lesson_id" text NOT NULL,
	CONSTRAINT "lesson_cohort_mtm_lesson_id_cohort_id_pk" PRIMARY KEY("lesson_id","cohort_id")
);
--> statement-breakpoint
CREATE TABLE "moved_lesson" (
	"date" date NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"room" text,
	"starting_day" text,
	"starting_period" text
);
--> statement-breakpoint
CREATE TABLE "moved_lesson_lesson_mtm" (
	"lesson_id" text NOT NULL,
	"moved_lesson_id" text NOT NULL,
	CONSTRAINT "moved_lesson_lesson_mtm_lesson_id_moved_lesson_id_pk" PRIMARY KEY("lesson_id","moved_lesson_id")
);
--> statement-breakpoint
CREATE TABLE "period" (
	"end_time" time NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"period" integer NOT NULL,
	"start_time" time NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subject" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "substitution" (
	"date" date NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"substituter" text
);
--> statement-breakpoint
CREATE TABLE "substitution_lesson_mtm" (
	"lesson_id" text NOT NULL,
	"substitution_id" text NOT NULL,
	CONSTRAINT "substitution_lesson_mtm_lesson_id_substitution_id_pk" PRIMARY KEY("lesson_id","substitution_id")
);
--> statement-breakpoint
CREATE TABLE "teacher" (
	"first_name" text NOT NULL,
	"gender" bit(1),
	"id" text PRIMARY KEY NOT NULL,
	"last_name" text NOT NULL,
	"short" text NOT NULL,
	"user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "term_definition" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short" text NOT NULL,
	"terms" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"valid_from" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "week_definition" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short" text NOT NULL,
	"weeks" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_device_id_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_device" ADD CONSTRAINT "card_device_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_device" ADD CONSTRAINT "card_device_device_id_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_health" ADD CONSTRAINT "device_health_device_id_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohort"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom" ADD CONSTRAINT "classroom_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort" ADD CONSTRAINT "cohort_teacher_id_teacher_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teacher"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort" ADD CONSTRAINT "cohort_timetable_id_timetable_id_fk" FOREIGN KEY ("timetable_id") REFERENCES "public"."timetable"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group" ADD CONSTRAINT "group_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohort"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group" ADD CONSTRAINT "group_teacher_id_teacher_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teacher"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group" ADD CONSTRAINT "group_timetable_id_timetable_id_fk" FOREIGN KEY ("timetable_id") REFERENCES "public"."timetable"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_day_definition_id_day_definition_id_fk" FOREIGN KEY ("day_definition_id") REFERENCES "public"."day_definition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_period_id_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."period"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_term_definition_id_term_definition_id_fk" FOREIGN KEY ("term_definition_id") REFERENCES "public"."term_definition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_timetable_id_timetable_id_fk" FOREIGN KEY ("timetable_id") REFERENCES "public"."timetable"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_weeks_definition_id_week_definition_id_fk" FOREIGN KEY ("weeks_definition_id") REFERENCES "public"."week_definition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_cohort_mtm" ADD CONSTRAINT "lesson_cohort_mtm_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohort"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_cohort_mtm" ADD CONSTRAINT "lesson_cohort_mtm_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moved_lesson" ADD CONSTRAINT "moved_lesson_room_classroom_id_fk" FOREIGN KEY ("room") REFERENCES "public"."classroom"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moved_lesson" ADD CONSTRAINT "moved_lesson_starting_day_day_definition_id_fk" FOREIGN KEY ("starting_day") REFERENCES "public"."day_definition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moved_lesson" ADD CONSTRAINT "moved_lesson_starting_period_period_id_fk" FOREIGN KEY ("starting_period") REFERENCES "public"."period"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moved_lesson_lesson_mtm" ADD CONSTRAINT "moved_lesson_lesson_mtm_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moved_lesson_lesson_mtm" ADD CONSTRAINT "moved_lesson_lesson_mtm_moved_lesson_id_moved_lesson_id_fk" FOREIGN KEY ("moved_lesson_id") REFERENCES "public"."moved_lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substitution" ADD CONSTRAINT "substitution_substituter_teacher_id_fk" FOREIGN KEY ("substituter") REFERENCES "public"."teacher"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substitution_lesson_mtm" ADD CONSTRAINT "substitution_lesson_mtm_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substitution_lesson_mtm" ADD CONSTRAINT "substitution_lesson_mtm_substitution_id_substitution_id_fk" FOREIGN KEY ("substitution_id") REFERENCES "public"."substitution"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher" ADD CONSTRAINT "teacher_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_device_card_id_idx" ON "card_device" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "card_device_device_id_idx" ON "card_device" USING btree ("device_id");