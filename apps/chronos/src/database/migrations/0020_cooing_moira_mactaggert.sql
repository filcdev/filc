ALTER TABLE "announcement" ADD COLUMN "highlighted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "announcement" ADD COLUMN "image_byte_size" integer;--> statement-breakpoint
ALTER TABLE "announcement" ADD COLUMN "image_content_type" text;--> statement-breakpoint
ALTER TABLE "announcement" ADD COLUMN "image_key" text;--> statement-breakpoint
ALTER TABLE "announcement" ADD COLUMN "image_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_image_complete" CHECK (("announcement"."image_key" IS NULL) = ("announcement"."image_content_type" IS NULL)
        AND ("announcement"."image_key" IS NULL) = ("announcement"."image_byte_size" IS NULL)
        AND ("announcement"."image_key" IS NULL) = ("announcement"."image_updated_at" IS NULL));