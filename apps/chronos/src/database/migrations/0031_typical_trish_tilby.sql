CREATE TABLE "site_theme_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"theme" text NOT NULL,
	"start_month" integer NOT NULL,
	"start_day" integer NOT NULL,
	"end_month" integer NOT NULL,
	"end_day" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "site_theme_schedule" ADD CONSTRAINT "site_theme_schedule_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;