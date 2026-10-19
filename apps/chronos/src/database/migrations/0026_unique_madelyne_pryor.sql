CREATE TABLE "activity_log" (
	"action" text NOT NULL,
	"actor_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"id" serial PRIMARY KEY NOT NULL,
	"ip_address" text,
	"metadata" jsonb,
	"user_agent" text
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_log_actor_id_idx" ON "activity_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "activity_log_created_at_idx" ON "activity_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_log_entity_type_idx" ON "activity_log" USING btree ("entity_type");