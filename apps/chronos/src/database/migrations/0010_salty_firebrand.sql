ALTER TABLE "announcement" ALTER COLUMN "title" DROP NOT NULL;

ALTER TABLE "user_preferences" ADD COLUMN "timetable_class_colors" jsonb NOT NULL DEFAULT '{}'::jsonb;