CREATE TABLE "moved_lesson" (
	"id" text PRIMARY KEY NOT NULL,
	"lesson_ids" jsonb NOT NULL,
	"starting_period" text NOT NULL,
	"starting_day" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "substitution" (
	"id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"period_ids" jsonb NOT NULL,
	"substituter" text
);
--> statement-breakpoint
ALTER TABLE "moved_lesson" ADD CONSTRAINT "moved_lesson_starting_period_period_id_fk" FOREIGN KEY ("starting_period") REFERENCES "public"."period"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moved_lesson" ADD CONSTRAINT "moved_lesson_starting_day_day_definition_id_fk" FOREIGN KEY ("starting_day") REFERENCES "public"."day_definition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substitution" ADD CONSTRAINT "substitution_substituter_teacher_id_fk" FOREIGN KEY ("substituter") REFERENCES "public"."teacher"("id") ON DELETE no action ON UPDATE no action;