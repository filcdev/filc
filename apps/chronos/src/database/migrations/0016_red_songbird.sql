CREATE TABLE "audit_log" (
	"button_pressed" boolean NOT NULL,
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
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_device_id_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_device" ADD CONSTRAINT "card_device_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_device" ADD CONSTRAINT "card_device_device_id_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_health" ADD CONSTRAINT "device_health_device_id_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_device_card_id_idx" ON "card_device" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "card_device_device_id_idx" ON "card_device" USING btree ("device_id");