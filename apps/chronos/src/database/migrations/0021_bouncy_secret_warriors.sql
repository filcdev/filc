CREATE TABLE "announcement_kiosk_mtm" (
	"announcement_id" uuid NOT NULL,
	"kiosk_id" uuid NOT NULL,
	CONSTRAINT "announcement_kiosk_mtm_announcement_id_kiosk_id_pk" PRIMARY KEY("announcement_id","kiosk_id")
);
--> statement-breakpoint
ALTER TABLE "announcement_kiosk_mtm" ADD CONSTRAINT "announcement_kiosk_mtm_announcement_id_announcement_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_kiosk_mtm" ADD CONSTRAINT "announcement_kiosk_mtm_kiosk_id_kiosk_id_fk" FOREIGN KEY ("kiosk_id") REFERENCES "public"."kiosk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcement_kiosk_mtm_announcement_id_idx" ON "announcement_kiosk_mtm" USING btree ("announcement_id");--> statement-breakpoint
CREATE INDEX "announcement_kiosk_mtm_kiosk_id_idx" ON "announcement_kiosk_mtm" USING btree ("kiosk_id");