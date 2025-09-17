CREATE TABLE "lesson_cohort_mtm" (
	"lesson_id" text NOT NULL,
	"cohort_id" text NOT NULL,
	CONSTRAINT "lesson_cohort_mtm_lesson_id_cohort_id_pk" PRIMARY KEY("lesson_id","cohort_id")
);
--> statement-breakpoint
ALTER TABLE "lesson_cohort_mtm" ADD CONSTRAINT "lesson_cohort_mtm_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_cohort_mtm" ADD CONSTRAINT "lesson_cohort_mtm_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohort"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson" DROP COLUMN "cohort_ids";