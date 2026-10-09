CREATE TABLE "apikey" (
	"config_id" text DEFAULT 'default' NOT NULL,
	"created_at" timestamp NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"last_refill_at" timestamp,
	"last_request" timestamp,
	"metadata" text,
	"name" text,
	"permissions" text,
	"prefix" text,
	"rate_limit_enabled" boolean DEFAULT true NOT NULL,
	"rate_limit_max" integer,
	"rate_limit_time_window" integer,
	"refill_amount" integer,
	"refill_interval" integer,
	"reference_id" text NOT NULL,
	"remaining" integer,
	"request_count" integer DEFAULT 0 NOT NULL,
	"start" text,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
DROP TABLE "api_key" CASCADE;--> statement-breakpoint
CREATE INDEX "apikey_config_id_idx" ON "apikey" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX "apikey_key_idx" ON "apikey" USING btree ("key");--> statement-breakpoint
CREATE INDEX "apikey_reference_id_idx" ON "apikey" USING btree ("reference_id");