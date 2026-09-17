CREATE TABLE "announcement_kiosk_mtm" (
	"announcement_id" uuid NOT NULL,
	"kiosk_id" uuid NOT NULL,
	CONSTRAINT "announcement_kiosk_mtm_announcement_id_kiosk_id_pk" PRIMARY KEY("announcement_id","kiosk_id")
);
--> statement-breakpoint
CREATE TABLE "kiosk" (
	"app_version" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"last_seen_at" timestamp,
	"last_seen_ip" text,
	"machine_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kiosk_machine_id_unique" UNIQUE("machine_id")
);
--> statement-breakpoint
CREATE TABLE "navigator_corridor" (
	"barrier_free" boolean NOT NULL,
	"building_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"is_outdoor" boolean NOT NULL,
	"name" text NOT NULL,
	"storey" integer NOT NULL,
	"width" double precision NOT NULL,
	"x1" double precision NOT NULL,
	"x2" double precision NOT NULL,
	"y1" double precision NOT NULL,
	"y2" double precision NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "navigator_lift" (
	"building_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"max_storey" integer NOT NULL,
	"min_storey" integer NOT NULL,
	"name" text NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "navigator_stair" (
	"building_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"max_storey" integer NOT NULL,
	"min_storey" integer NOT NULL,
	"name" text NOT NULL,
	"rotation" double precision NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "navigator_translation" (
	"lang_key" text NOT NULL,
	"text" text NOT NULL,
	"text_key" text NOT NULL,
	CONSTRAINT "navigator_translation_lang_key_text_key_pk" PRIMARY KEY("lang_key","text_key")
);
--> statement-breakpoint
CREATE TABLE "classroom_type" (
	"colorhex" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "classroom" ALTER COLUMN "short" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "building" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "building" ADD COLUMN "mapped" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "building" ADD COLUMN "x" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "building" ADD COLUMN "y" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "classroom" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "classroom" ADD COLUMN "mapped" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "classroom" ADD COLUMN "rotation" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "classroom" ADD COLUMN "size_x" double precision DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE "classroom" ADD COLUMN "size_y" double precision DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE "classroom" ADD COLUMN "size_z" double precision DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "classroom" ADD COLUMN "storey" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "classroom" ADD COLUMN "type_id" text;--> statement-breakpoint
ALTER TABLE "classroom" ADD COLUMN "x" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "classroom" ADD COLUMN "y" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "announcement" ADD COLUMN "highlighted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "announcement" ADD COLUMN "image_byte_size" integer;--> statement-breakpoint
ALTER TABLE "announcement" ADD COLUMN "image_content_type" text;--> statement-breakpoint
ALTER TABLE "announcement" ADD COLUMN "image_key" text;--> statement-breakpoint
ALTER TABLE "announcement" ADD COLUMN "image_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "announcement" ADD COLUMN "kiosk_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "announcement_kiosk_mtm" ADD CONSTRAINT "announcement_kiosk_mtm_announcement_id_announcement_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_kiosk_mtm" ADD CONSTRAINT "announcement_kiosk_mtm_kiosk_id_kiosk_id_fk" FOREIGN KEY ("kiosk_id") REFERENCES "public"."kiosk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigator_corridor" ADD CONSTRAINT "navigator_corridor_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigator_lift" ADD CONSTRAINT "navigator_lift_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigator_stair" ADD CONSTRAINT "navigator_stair_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcement_kiosk_mtm_announcement_id_idx" ON "announcement_kiosk_mtm" USING btree ("announcement_id");--> statement-breakpoint
CREATE INDEX "announcement_kiosk_mtm_kiosk_id_idx" ON "announcement_kiosk_mtm" USING btree ("kiosk_id");--> statement-breakpoint
CREATE INDEX "navigator_corridor_building_id_idx" ON "navigator_corridor" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX "navigator_lift_building_id_idx" ON "navigator_lift" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX "navigator_stair_building_id_idx" ON "navigator_stair" USING btree ("building_id");--> statement-breakpoint
ALTER TABLE "classroom" ADD CONSTRAINT "classroom_type_id_classroom_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."classroom_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "classroom_building_id_idx" ON "classroom" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX "classroom_type_id_idx" ON "classroom" USING btree ("type_id");--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_image_complete" CHECK (("announcement"."image_key" IS NULL) = ("announcement"."image_content_type" IS NULL)
        AND ("announcement"."image_key" IS NULL) = ("announcement"."image_byte_size" IS NULL)
        AND ("announcement"."image_key" IS NULL) = ("announcement"."image_updated_at" IS NULL));