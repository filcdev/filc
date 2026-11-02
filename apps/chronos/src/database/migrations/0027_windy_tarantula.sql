ALTER TABLE "moved_lesson" ADD COLUMN "manual_cohort_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "moved_lesson" ADD COLUMN "manual_subject_id" text;--> statement-breakpoint
ALTER TABLE "moved_lesson" ADD COLUMN "manual_teacher_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "moved_lesson" ADD CONSTRAINT "moved_lesson_manual_subject_id_subject_id_fk" FOREIGN KEY ("manual_subject_id") REFERENCES "public"."subject"("id") ON DELETE set null ON UPDATE no action;