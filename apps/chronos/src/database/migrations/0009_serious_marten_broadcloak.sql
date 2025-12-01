ALTER TABLE "moved_lesson" ALTER COLUMN "starting_period" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "moved_lesson" ALTER COLUMN "starting_day" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "moved_lesson" ADD COLUMN "room" text;--> statement-breakpoint
ALTER TABLE "moved_lesson" ADD CONSTRAINT "moved_lesson_room_classroom_id_fk" FOREIGN KEY ("room") REFERENCES "public"."classroom"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moved_lesson" DROP COLUMN "lesson_ids";