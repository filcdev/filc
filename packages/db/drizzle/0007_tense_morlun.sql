CREATE TABLE "timetable"."substitution" (
	"id" text PRIMARY KEY NOT NULL,
	"lesson" text NOT NULL,
	"teacher" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable"."timetable" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"validFrom" timestamp NOT NULL,
	"validTo" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable"."timetable_day" (
	"id" text PRIMARY KEY NOT NULL,
	"day" "day" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "timetable"."substitution" ADD CONSTRAINT "substitution_lesson_lesson_id_fk" FOREIGN KEY ("lesson") REFERENCES "timetable"."lesson"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable"."substitution" ADD CONSTRAINT "substitution_teacher_teacher_id_fk" FOREIGN KEY ("teacher") REFERENCES "timetable"."teacher"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "timetable_name_index" ON "timetable"."timetable" USING btree ("name");