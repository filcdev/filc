CREATE TABLE "navigator_building" (
	"description" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"x" smallint NOT NULL,
	"y" smallint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "navigator_building_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "navigator_classroom" (
	"building_id" uuid NOT NULL,
	"capacity" smallint NOT NULL,
	"description" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"rotation" smallint NOT NULL,
	"size_x" smallint NOT NULL,
	"size_y" smallint NOT NULL,
	"size_z" smallint NOT NULL,
	"storey" smallint NOT NULL,
	"type_id" uuid NOT NULL,
	"x" smallint NOT NULL,
	"y" smallint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "navigator_classroom_type" (
	"colorhex" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "navigator_classroom_type_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "navigator_translation" (
	"lang_key" varchar(10) NOT NULL,
	"text" text NOT NULL,
	"text_key" varchar(190) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "navigator_translation_lang_key_text_key_pk" PRIMARY KEY("lang_key","text_key")
);
--> statement-breakpoint
CREATE TABLE "navigator_utility" (
	"barrier_free" boolean,
	"building_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_outdoor" boolean,
	"kind" text NOT NULL,
	"max_storey" smallint,
	"min_storey" smallint,
	"name" text NOT NULL,
	"rotation" smallint,
	"storey" smallint,
	"width" real,
	"x" smallint,
	"x1" smallint,
	"x2" smallint,
	"y" smallint,
	"y1" smallint,
	"y2" smallint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "navigator_utility_storey_check" CHECK (min_storey IS NULL OR max_storey IS NULL OR min_storey <= max_storey)
);
--> statement-breakpoint
ALTER TABLE "navigator_classroom" ADD CONSTRAINT "navigator_classroom_building_id_navigator_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."navigator_building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigator_classroom" ADD CONSTRAINT "navigator_classroom_type_id_navigator_classroom_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."navigator_classroom_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigator_utility" ADD CONSTRAINT "navigator_utility_building_id_navigator_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."navigator_building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "navigator_classroom_name_building_id_uidx" ON "navigator_classroom" USING btree ("name","building_id");--> statement-breakpoint
CREATE INDEX "navigator_classroom_building_id_idx" ON "navigator_classroom" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX "navigator_classroom_type_id_idx" ON "navigator_classroom" USING btree ("type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "navigator_utility_name_building_id_kind_uidx" ON "navigator_utility" USING btree ("name","building_id","kind");--> statement-breakpoint
CREATE INDEX "navigator_utility_building_id_idx" ON "navigator_utility" USING btree ("building_id");