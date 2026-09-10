CREATE TABLE "user_group" (
	"group_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "user_group_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "group" ADD COLUMN "division_tag" text;--> statement-breakpoint
ALTER TABLE "user_group" ADD CONSTRAINT "user_group_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_group" ADD CONSTRAINT "user_group_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_group_user_id_idx" ON "user_group" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_group_group_id_idx" ON "user_group" USING btree ("group_id");