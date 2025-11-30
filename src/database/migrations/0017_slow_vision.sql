ALTER TABLE "audit_log" ADD COLUMN "card_data" text;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "name" text NOT NULL;