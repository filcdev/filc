CREATE TABLE "timetable" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"valid_from" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cohort" ADD COLUMN "timetable_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "group" ADD COLUMN "timetable_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson" ADD COLUMN "timetable_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "cohort" ADD CONSTRAINT "cohort_timetable_id_timetable_id_fk" FOREIGN KEY ("timetable_id") REFERENCES "public"."timetable"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group" ADD CONSTRAINT "group_timetable_id_timetable_id_fk" FOREIGN KEY ("timetable_id") REFERENCES "public"."timetable"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_timetable_id_timetable_id_fk" FOREIGN KEY ("timetable_id") REFERENCES "public"."timetable"("id") ON DELETE cascade ON UPDATE no action;