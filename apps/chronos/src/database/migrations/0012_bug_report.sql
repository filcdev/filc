CREATE TABLE "bug_report" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "reporter_id" uuid,
 "reporter_email" text,
 "subject" text NOT NULL,
 "description" text NOT NULL,
 "page" text,
 "metadata" jsonb,
 "status" text DEFAULT 'open' NOT NULL,
 "created_at" timestamp DEFAULT now() NOT NULL,
 "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "bug_report_status_idx" ON "bug_report" USING btree ("status");

ALTER TABLE "bug_report" ADD CONSTRAINT "bug_report_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "user"("id") ON DELETE SET NULL;
