CREATE TABLE "substitution_lesson_mtm" (
	"lesson_id" text NOT NULL,
	"substitution_id" text NOT NULL,
	CONSTRAINT "substitution_lesson_mtm_lesson_id_substitution_id_pk" PRIMARY KEY("lesson_id","substitution_id")
);
--> statement-breakpoint
ALTER TABLE "substitution_lesson_mtm" ADD CONSTRAINT "substitution_lesson_mtm_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substitution_lesson_mtm" ADD CONSTRAINT "substitution_lesson_mtm_substitution_id_substitution_id_fk" FOREIGN KEY ("substitution_id") REFERENCES "public"."substitution"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substitution" DROP COLUMN "period_ids";