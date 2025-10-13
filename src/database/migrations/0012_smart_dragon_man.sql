CREATE TABLE "moved_lesson_lesson_mtm" (
	"lesson_id" text NOT NULL,
	"moved_lesson_id" text NOT NULL,
	CONSTRAINT "moved_lesson_lesson_mtm_lesson_id_moved_lesson_id_pk" PRIMARY KEY("lesson_id","moved_lesson_id")
);
--> statement-breakpoint
ALTER TABLE "moved_lesson_lesson_mtm" ADD CONSTRAINT "moved_lesson_lesson_mtm_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moved_lesson_lesson_mtm" ADD CONSTRAINT "moved_lesson_lesson_mtm_moved_lesson_id_moved_lesson_id_fk" FOREIGN KEY ("moved_lesson_id") REFERENCES "public"."moved_lesson"("id") ON DELETE cascade ON UPDATE no action;