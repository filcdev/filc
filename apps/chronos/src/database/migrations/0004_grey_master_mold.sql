CREATE TABLE "card_device" (
	"card_id" uuid NOT NULL,
	"device_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "card_device_card_id_device_id_pk" PRIMARY KEY("card_id","device_id")
);
--> statement-breakpoint
CREATE TABLE "device" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"last_seen_at" timestamp,
	"ttl_seconds" integer DEFAULT 30 NOT NULL,
	"status" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_device" ADD CONSTRAINT "card_device_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_device" ADD CONSTRAINT "card_device_device_id_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device"("id") ON DELETE cascade ON UPDATE no action;