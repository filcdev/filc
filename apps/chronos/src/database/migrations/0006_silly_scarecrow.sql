ALTER TABLE "teacher" RENAME COLUMN "linked_user_id" TO "user_id";--> statement-breakpoint
ALTER TABLE "teacher" DROP CONSTRAINT "teacher_linked_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "cohort_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohort"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher" ADD CONSTRAINT "teacher_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;