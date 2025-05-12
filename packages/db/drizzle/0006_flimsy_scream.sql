CREATE SCHEMA "timetable";
--> statement-breakpoint
CREATE TYPE "public"."day" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');--> statement-breakpoint
CREATE TYPE "public"."week_type" AS ENUM('a', 'b', 'all', 'none');--> statement-breakpoint
CREATE TABLE "timetable"."cohort" (
	"id" text PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"designation" char NOT NULL,
	"classMaster" text NOT NULL,
	"secondaryClassMaster" text NOT NULL,
	"headquarters" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable"."group" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"cohort" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable"."lesson" (
	"id" text PRIMARY KEY NOT NULL,
	"weekType" "week_type" NOT NULL,
	"day" "day" NOT NULL,
	"period" text NOT NULL,
	"subject" text NOT NULL,
	"teacher" text NOT NULL,
	"cohort" text NOT NULL,
	"room" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable"."period" (
	"id" text PRIMARY KEY NOT NULL,
	"startTime" timestamp NOT NULL,
	"endTime" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable"."room" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"shortName" text NOT NULL,
	"capacity" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable"."subject" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"shortName" text NOT NULL,
	"icon" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable"."teacher" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"shortName" text NOT NULL,
	"email" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "filc"."account" CASCADE;--> statement-breakpoint
DROP TABLE "filc"."invitation" CASCADE;--> statement-breakpoint
DROP TABLE "filc"."member" CASCADE;--> statement-breakpoint
DROP TABLE "filc"."organization" CASCADE;--> statement-breakpoint
DROP TABLE "filc"."session" CASCADE;--> statement-breakpoint
DROP TABLE "filc"."team" CASCADE;--> statement-breakpoint
DROP TABLE "filc"."user" CASCADE;--> statement-breakpoint
DROP TABLE "filc"."verification" CASCADE;--> statement-breakpoint
ALTER TABLE "timetable"."cohort" ADD CONSTRAINT "cohort_classMaster_teacher_id_fk" FOREIGN KEY ("classMaster") REFERENCES "timetable"."teacher"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable"."cohort" ADD CONSTRAINT "cohort_secondaryClassMaster_teacher_id_fk" FOREIGN KEY ("secondaryClassMaster") REFERENCES "timetable"."teacher"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable"."cohort" ADD CONSTRAINT "cohort_headquarters_room_id_fk" FOREIGN KEY ("headquarters") REFERENCES "timetable"."room"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable"."group" ADD CONSTRAINT "group_cohort_cohort_id_fk" FOREIGN KEY ("cohort") REFERENCES "timetable"."cohort"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable"."lesson" ADD CONSTRAINT "lesson_period_period_id_fk" FOREIGN KEY ("period") REFERENCES "timetable"."period"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable"."lesson" ADD CONSTRAINT "lesson_subject_subject_id_fk" FOREIGN KEY ("subject") REFERENCES "timetable"."subject"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable"."lesson" ADD CONSTRAINT "lesson_teacher_teacher_id_fk" FOREIGN KEY ("teacher") REFERENCES "timetable"."teacher"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable"."lesson" ADD CONSTRAINT "lesson_cohort_cohort_id_fk" FOREIGN KEY ("cohort") REFERENCES "timetable"."cohort"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable"."lesson" ADD CONSTRAINT "lesson_room_room_id_fk" FOREIGN KEY ("room") REFERENCES "timetable"."room"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "cohort_year_designation_index" ON "timetable"."cohort" USING btree ("year","designation");--> statement-breakpoint
CREATE UNIQUE INDEX "group_name_index" ON "timetable"."group" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_weekType_day_period_subject_teacher_cohort_index" ON "timetable"."lesson" USING btree ("weekType","day","period","subject","teacher","cohort");--> statement-breakpoint
CREATE UNIQUE INDEX "period_startTime_endTime_index" ON "timetable"."period" USING btree ("startTime","endTime");--> statement-breakpoint
CREATE UNIQUE INDEX "room_name_index" ON "timetable"."room" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "room_shortName_index" ON "timetable"."room" USING btree ("shortName");--> statement-breakpoint
CREATE UNIQUE INDEX "subject_name_index" ON "timetable"."subject" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_name_index" ON "timetable"."teacher" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_email_index" ON "timetable"."teacher" USING btree ("email");--> statement-breakpoint
DROP SCHEMA "filc";
