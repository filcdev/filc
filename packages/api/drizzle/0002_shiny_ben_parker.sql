CREATE UNIQUE INDEX "account_userId_index" ON "filc"."account" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_index" ON "filc"."session" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "session_userId_index" ON "filc"."session" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_index" ON "filc"."user" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_identifier_index" ON "filc"."verification" USING btree ("identifier");