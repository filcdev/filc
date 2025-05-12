CREATE UNIQUE INDEX "invitation_email_index" ON "filc"."invitation" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_organizationId_index" ON "filc"."invitation" USING btree ("organizationId");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_index" ON "filc"."organization" USING btree ("slug");