CREATE TABLE "site_theme" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"theme" text DEFAULT 'default' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "site_theme" ADD CONSTRAINT "site_theme_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;