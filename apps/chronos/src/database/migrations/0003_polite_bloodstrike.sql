CREATE TABLE "announcement" (
	"author_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"valid_from" timestamp NOT NULL,
	"valid_until" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcement_cohort_mtm" (
	"announcement_id" uuid NOT NULL,
	"cohort_id" text NOT NULL,
	CONSTRAINT "announcement_cohort_mtm_announcement_id_cohort_id_pk" PRIMARY KEY("announcement_id","cohort_id")
);
--> statement-breakpoint
CREATE TABLE "blog_post" (
	"author_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"published_at" timestamp,
	"slug" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_post_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "system_message" (
	"author_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"valid_from" timestamp NOT NULL,
	"valid_until" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_message_cohort_mtm" (
	"cohort_id" text NOT NULL,
	"system_message_id" uuid NOT NULL,
	CONSTRAINT "system_message_cohort_mtm_system_message_id_cohort_id_pk" PRIMARY KEY("system_message_id","cohort_id")
);
--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_cohort_mtm" ADD CONSTRAINT "announcement_cohort_mtm_announcement_id_announcement_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_cohort_mtm" ADD CONSTRAINT "announcement_cohort_mtm_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohort"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post" ADD CONSTRAINT "blog_post_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_message" ADD CONSTRAINT "system_message_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_message_cohort_mtm" ADD CONSTRAINT "system_message_cohort_mtm_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohort"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_message_cohort_mtm" ADD CONSTRAINT "system_message_cohort_mtm_system_message_id_system_message_id_fk" FOREIGN KEY ("system_message_id") REFERENCES "public"."system_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcement_cohort_mtm_announcement_id_idx" ON "announcement_cohort_mtm" USING btree ("announcement_id");--> statement-breakpoint
CREATE INDEX "announcement_cohort_mtm_cohort_id_idx" ON "announcement_cohort_mtm" USING btree ("cohort_id");--> statement-breakpoint
CREATE INDEX "system_message_cohort_mtm_system_message_id_idx" ON "system_message_cohort_mtm" USING btree ("system_message_id");--> statement-breakpoint
CREATE INDEX "system_message_cohort_mtm_cohort_id_idx" ON "system_message_cohort_mtm" USING btree ("cohort_id");