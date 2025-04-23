CREATE TABLE "timetable"."lesson_period" (
	"id" text PRIMARY KEY NOT NULL,
	"lessonId" text NOT NULL,
	"periodId" text NOT NULL,
	"isStart" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "timetable"."lesson" DROP CONSTRAINT "lesson_period_period_id_fk";
--> statement-breakpoint
DROP INDEX "timetable"."lesson_weekType_day_period_subject_teacher_cohort_index";--> statement-breakpoint
ALTER TABLE "timetable"."lesson_period" ADD CONSTRAINT "lesson_period_lessonId_lesson_id_fk" FOREIGN KEY ("lessonId") REFERENCES "timetable"."lesson"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable"."lesson_period" ADD CONSTRAINT "lesson_period_periodId_period_id_fk" FOREIGN KEY ("periodId") REFERENCES "timetable"."period"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_period_lessonId_periodId_index" ON "timetable"."lesson_period" USING btree ("lessonId","periodId");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_weekType_day_subject_teacher_cohort_index" ON "timetable"."lesson" USING btree ("weekType","day","subject","teacher","cohort");--> statement-breakpoint
ALTER TABLE "timetable"."lesson" DROP COLUMN "period";