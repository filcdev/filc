CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "timetable";
--> statement-breakpoint
CREATE TYPE "public"."day" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');--> statement-breakpoint
CREATE TYPE "public"."week_type" AS ENUM('a', 'b', 'all', 'none');--> statement-breakpoint
CREATE TABLE "auth"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"idToken" text,
	"password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"inviterId" text NOT NULL,
	"organizationId" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"teamId" text,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."member" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"organizationId" text NOT NULL,
	"role" text NOT NULL,
	"teamId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"token" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"impersonatedBy" text,
	"activeOrganizationId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."team" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organizationId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean,
	"image" text,
	"role" text,
	"banned" boolean,
	"banReason" text,
	"banExpires" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable"."cohort" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"designation" char NOT NULL,
	"classMasterId" uuid NOT NULL,
	"secondaryClassMasterId" uuid NOT NULL,
	"headquartersRoomId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable"."group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"cohortId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable"."lesson" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weekType" "week_type" NOT NULL,
	"day" "day" NOT NULL,
	"subjectId" uuid NOT NULL,
	"teacherId" uuid NOT NULL,
	"cohortId" uuid NOT NULL,
	"roomId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable"."lesson_period" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lessonId" uuid NOT NULL,
	"periodId" uuid NOT NULL,
	"isStart" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable"."period" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"startTime" timestamp NOT NULL,
	"endTime" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable"."room" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"shortName" text NOT NULL,
	"capacity" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable"."subject" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"shortName" text NOT NULL,
	"icon" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable"."substitution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lessonId" uuid NOT NULL,
	"teacherId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable"."teacher" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"shortName" text NOT NULL,
	"email" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable"."timetable" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"validFrom" timestamp NOT NULL,
	"validTo" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetable"."timetable_day" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" "day" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_inviterId_user_id_fk" FOREIGN KEY ("inviterId") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES "auth"."team"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_teamId_team_id_fk" FOREIGN KEY ("teamId") REFERENCES "auth"."team"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "auth"."team" ADD CONSTRAINT "team_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable"."cohort" ADD CONSTRAINT "cohort_classMasterId_teacher_id_fk" FOREIGN KEY ("classMasterId") REFERENCES "timetable"."teacher"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable"."cohort" ADD CONSTRAINT "cohort_secondaryClassMasterId_teacher_id_fk" FOREIGN KEY ("secondaryClassMasterId") REFERENCES "timetable"."teacher"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable"."cohort" ADD CONSTRAINT "cohort_headquartersRoomId_room_id_fk" FOREIGN KEY ("headquartersRoomId") REFERENCES "timetable"."room"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable"."group" ADD CONSTRAINT "group_cohortId_cohort_id_fk" FOREIGN KEY ("cohortId") REFERENCES "timetable"."cohort"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable"."lesson" ADD CONSTRAINT "lesson_subjectId_subject_id_fk" FOREIGN KEY ("subjectId") REFERENCES "timetable"."subject"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable"."lesson" ADD CONSTRAINT "lesson_teacherId_teacher_id_fk" FOREIGN KEY ("teacherId") REFERENCES "timetable"."teacher"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable"."lesson" ADD CONSTRAINT "lesson_cohortId_cohort_id_fk" FOREIGN KEY ("cohortId") REFERENCES "timetable"."cohort"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable"."lesson" ADD CONSTRAINT "lesson_roomId_room_id_fk" FOREIGN KEY ("roomId") REFERENCES "timetable"."room"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable"."lesson_period" ADD CONSTRAINT "lesson_period_lessonId_lesson_id_fk" FOREIGN KEY ("lessonId") REFERENCES "timetable"."lesson"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable"."lesson_period" ADD CONSTRAINT "lesson_period_periodId_period_id_fk" FOREIGN KEY ("periodId") REFERENCES "timetable"."period"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable"."substitution" ADD CONSTRAINT "substitution_lessonId_lesson_id_fk" FOREIGN KEY ("lessonId") REFERENCES "timetable"."lesson"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "timetable"."substitution" ADD CONSTRAINT "substitution_teacherId_teacher_id_fk" FOREIGN KEY ("teacherId") REFERENCES "timetable"."teacher"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "account_userId_index" ON "auth"."account" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_email_index" ON "auth"."invitation" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_organizationId_index" ON "auth"."invitation" USING btree ("organizationId");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_index" ON "auth"."organization" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_index" ON "auth"."session" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "session_userId_index" ON "auth"."session" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "team_name_index" ON "auth"."team" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_index" ON "auth"."user" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_identifier_index" ON "auth"."verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "cohort_year_designation_index" ON "timetable"."cohort" USING btree ("year","designation");--> statement-breakpoint
CREATE UNIQUE INDEX "group_name_index" ON "timetable"."group" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_weekType_day_subjectId_teacherId_cohortId_index" ON "timetable"."lesson" USING btree ("weekType","day","subjectId","teacherId","cohortId");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_period_lessonId_periodId_index" ON "timetable"."lesson_period" USING btree ("lessonId","periodId");--> statement-breakpoint
CREATE UNIQUE INDEX "period_startTime_endTime_index" ON "timetable"."period" USING btree ("startTime","endTime");--> statement-breakpoint
CREATE UNIQUE INDEX "room_name_index" ON "timetable"."room" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "room_shortName_index" ON "timetable"."room" USING btree ("shortName");--> statement-breakpoint
CREATE UNIQUE INDEX "subject_name_index" ON "timetable"."subject" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_name_index" ON "timetable"."teacher" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_email_index" ON "timetable"."teacher" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "timetable_name_index" ON "timetable"."timetable" USING btree ("name");