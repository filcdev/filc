DROP INDEX "account_issuer_accountId_uidx";--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "roles" SET DEFAULT '{"user"}';--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "issuer";