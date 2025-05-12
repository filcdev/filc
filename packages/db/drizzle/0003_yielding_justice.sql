ALTER TABLE "filc"."session" ADD COLUMN "impersonatedBy" text;--> statement-breakpoint
ALTER TABLE "filc"."user" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "filc"."user" ADD COLUMN "banned" boolean;--> statement-breakpoint
ALTER TABLE "filc"."user" ADD COLUMN "banReason" text;--> statement-breakpoint
ALTER TABLE "filc"."user" ADD COLUMN "banExpires" timestamp;