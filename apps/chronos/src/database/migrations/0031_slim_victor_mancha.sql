CREATE TABLE "event" (
	"capacity" integer,
	"category" text NOT NULL,
	"checkin_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cohort_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"description" jsonb NOT NULL,
	"ends_at" timestamp NOT NULL,
	"guest_registration_enabled" boolean DEFAULT false NOT NULL,
	"helper_registration_enabled" boolean DEFAULT false NOT NULL,
	"helper_registration_separate_window" boolean DEFAULT false NOT NULL,
	"helper_registration_closes_at" timestamp,
	"helper_registration_opens_at" timestamp,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_byte_size" integer,
	"image_content_type" text,
	"image_key" text,
	"image_updated_at" timestamp,
	"helper_max_grade" integer,
	"helper_min_grade" integer,
	"max_grade" integer,
	"min_grade" integer,
	"registration_closes_at" timestamp,
	"registration_enabled" boolean DEFAULT true NOT NULL,
	"registration_opens_at" timestamp,
	"starts_at" timestamp NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_category_valid" CHECK ("event"."category" IN ('honfoglalo', 'open_day', 'career_day', 'digital_week', 'codeweek', 'fair', 'external')),
	CONSTRAINT "event_status_valid" CHECK ("event"."status" IN ('draft', 'published', 'archived')),
	CONSTRAINT "event_dates_ordered" CHECK ("event"."ends_at" >= "event"."starts_at"),
	CONSTRAINT "event_registration_window_ordered" CHECK (("event"."registration_opens_at" IS NULL OR "event"."registration_closes_at" IS NULL
        OR "event"."registration_closes_at" >= "event"."registration_opens_at")),
	CONSTRAINT "event_helper_registration_window_ordered" CHECK (("event"."helper_registration_opens_at" IS NULL
        OR "event"."helper_registration_closes_at" IS NULL
        OR "event"."helper_registration_closes_at" >= "event"."helper_registration_opens_at")),
	CONSTRAINT "event_grade_range" CHECK (("event"."min_grade" IS NULL OR "event"."max_grade" IS NULL
        OR "event"."min_grade" <= "event"."max_grade")),
	CONSTRAINT "event_helper_grades_valid" CHECK (("event"."helper_min_grade" IS NULL
          OR ("event"."helper_min_grade" >= 1 AND "event"."helper_min_grade" <= 13))
        AND ("event"."helper_max_grade" IS NULL
          OR ("event"."helper_max_grade" >= 1 AND "event"."helper_max_grade" <= 13))),
	CONSTRAINT "event_helper_grade_range" CHECK (("event"."helper_min_grade" IS NULL OR "event"."helper_max_grade" IS NULL
        OR "event"."helper_min_grade" <= "event"."helper_max_grade")),
	CONSTRAINT "event_image_complete" CHECK (("event"."image_key" IS NULL) = ("event"."image_content_type" IS NULL)
        AND ("event"."image_key" IS NULL) = ("event"."image_byte_size" IS NULL)
        AND ("event"."image_key" IS NULL) = ("event"."image_updated_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "event_checkin_grant" (
	"event_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_checkin_grant_user_event_unique" UNIQUE("user_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "event_field" (
	"audiences" text[] DEFAULT '{guest,student,helper}' NOT NULL,
	"event_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"options" text[],
	"position" integer DEFAULT 0 NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"type" text NOT NULL,
	CONSTRAINT "event_field_type_valid" CHECK ("event_field"."type" IN ('text', 'textarea', 'select', 'number', 'checkbox')),
	CONSTRAINT "event_field_audiences_valid" CHECK ("event_field"."audiences" <@ ARRAY['guest', 'student', 'helper']::text[]
        AND cardinality("event_field"."audiences") > 0
        AND cardinality("event_field"."audiences") = (
          (CASE WHEN 'guest' = ANY("event_field"."audiences") THEN 1 ELSE 0 END)
          + (CASE WHEN 'student' = ANY("event_field"."audiences") THEN 1 ELSE 0 END)
          + (CASE WHEN 'helper' = ANY("event_field"."audiences") THEN 1 ELSE 0 END)
        ))
);
--> statement-breakpoint
CREATE TABLE "event_registration" (
	"event_id" uuid NOT NULL,
	"guest_email" text,
	"guest_name" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" text DEFAULT 'participant' NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_registration_event_user_unique" UNIQUE("event_id","user_id"),
	CONSTRAINT "event_registration_role_valid" CHECK ("event_registration"."role" IN ('participant', 'helper', 'visitor')),
	CONSTRAINT "event_registration_status_valid" CHECK ("event_registration"."status" IN ('pending', 'confirmed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "event_registration_answer" (
	"field_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "event_registration_answer_unique" UNIQUE("registration_id","field_id")
);
--> statement-breakpoint
CREATE TABLE "event_ticket" (
	"checked_in_at" timestamp,
	"checked_in_by" uuid,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_ticket_registration_unique" UNIQUE("registration_id")
);
--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_checkin_grant" ADD CONSTRAINT "event_checkin_grant_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_checkin_grant" ADD CONSTRAINT "event_checkin_grant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_field" ADD CONSTRAINT "event_field_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registration" ADD CONSTRAINT "event_registration_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registration" ADD CONSTRAINT "event_registration_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registration_answer" ADD CONSTRAINT "event_registration_answer_field_id_event_field_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."event_field"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registration_answer" ADD CONSTRAINT "event_registration_answer_registration_id_event_registration_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."event_registration"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_ticket" ADD CONSTRAINT "event_ticket_checked_in_by_user_id_fk" FOREIGN KEY ("checked_in_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_ticket" ADD CONSTRAINT "event_ticket_registration_id_event_registration_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."event_registration"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_status_starts_at_idx" ON "event" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "event_registration_opens_at_idx" ON "event" USING btree ("registration_opens_at");--> statement-breakpoint
CREATE INDEX "event_checkin_grant_event_id_idx" ON "event_checkin_grant" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_field_event_id_idx" ON "event_field" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_registration_event_status_idx" ON "event_registration" USING btree ("event_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "event_registration_guest_unique" ON "event_registration" USING btree ("event_id",lower("guest_email")) WHERE "event_registration"."guest_email" is not null;