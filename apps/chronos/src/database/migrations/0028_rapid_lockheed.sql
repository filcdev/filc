ALTER TABLE "user_preferences" ADD COLUMN "color_scheme" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "site_theme_acknowledged" text;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "site_theme_enabled" boolean DEFAULT true NOT NULL;