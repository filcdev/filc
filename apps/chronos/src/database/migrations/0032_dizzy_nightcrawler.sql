CREATE TABLE "event_room" (
	"capacity" integer NOT NULL,
	"event_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_room_capacity_positive" CHECK ("event_room"."capacity" > 0)
);
--> statement-breakpoint
ALTER TABLE "event_registration" ADD COLUMN "room_id" uuid;--> statement-breakpoint
ALTER TABLE "event_ticket" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_room" ADD CONSTRAINT "event_room_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_room_event_id_idx" ON "event_room" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "event_registration" ADD CONSTRAINT "event_registration_room_id_event_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."event_room"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_registration_room_id_idx" ON "event_registration" USING btree ("room_id");