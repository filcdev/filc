ALTER TABLE "role" ALTER COLUMN "can" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "roles" SET DEFAULT '{user}'::text[];--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "roles" SET NOT NULL;