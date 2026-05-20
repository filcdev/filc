CREATE TABLE "cohort_timetable_mtm" (
	"cohort_id" text NOT NULL,
	"timetable_id" text NOT NULL,
	CONSTRAINT "cohort_timetable_mtm_cohort_id_timetable_id_pk" PRIMARY KEY("cohort_id","timetable_id")
);
--> statement-breakpoint
INSERT INTO "cohort_timetable_mtm" ("cohort_id", "timetable_id")
  SELECT "id", "timetable_id" FROM "cohort" WHERE "timetable_id" IS NOT NULL
  ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "user_cohort_id_cohort_id_fk";
--> statement-breakpoint
ALTER TABLE "cohort" DROP CONSTRAINT "cohort_timetable_id_timetable_id_fk";
--> statement-breakpoint
ALTER TABLE "group" DROP CONSTRAINT "group_cohort_id_cohort_id_fk";
--> statement-breakpoint
ALTER TABLE "cohort" ALTER COLUMN "timetable_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "group" ALTER COLUMN "cohort_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ALTER COLUMN "notification_preferences" SET DEFAULT '{"announcement":true,"blogPost":false,"channelsEnabled":true,"doorlockCardUsed":false,"movedLesson":true,"substitution":true,"systemMessage":true}'::jsonb;--> statement-breakpoint
ALTER TABLE "cohort_timetable_mtm" ADD CONSTRAINT "cohort_timetable_mtm_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohort"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_timetable_mtm" ADD CONSTRAINT "cohort_timetable_mtm_timetable_id_timetable_id_fk" FOREIGN KEY ("timetable_id") REFERENCES "public"."timetable"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohort"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort" ADD CONSTRAINT "cohort_timetable_id_timetable_id_fk" FOREIGN KEY ("timetable_id") REFERENCES "public"."timetable"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group" ADD CONSTRAINT "group_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohort"("id") ON DELETE set null ON UPDATE no action;