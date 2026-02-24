ALTER TABLE "card" DROP CONSTRAINT "card_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "card" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;