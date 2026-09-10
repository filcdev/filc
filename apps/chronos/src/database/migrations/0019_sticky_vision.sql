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
CREATE TABLE "navigator_corridor" (
	"barrier_free" boolean DEFAULT false NOT NULL,
	"building_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_outdoor" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"storey" smallint NOT NULL,
	"width" real NOT NULL,
	"x1" smallint NOT NULL,
	"x2" smallint NOT NULL,
	"y1" smallint NOT NULL,
	"y2" smallint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "navigator_lift" (
	"building_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"max_storey" smallint NOT NULL,
	"min_storey" smallint NOT NULL,
	"name" text NOT NULL,
	"x" smallint NOT NULL,
	"y" smallint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "navigator_lift_storey_check" CHECK (min_storey <= max_storey)
);
--> statement-breakpoint
CREATE TABLE "navigator_stair" (
	"building_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"max_storey" smallint NOT NULL,
	"min_storey" smallint NOT NULL,
	"name" text NOT NULL,
	"rotation" smallint NOT NULL,
	"x" smallint NOT NULL,
	"y" smallint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "navigator_stair_storey_check" CHECK (min_storey <= max_storey)
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
ALTER TABLE "navigator_classroom" ADD CONSTRAINT "navigator_classroom_building_id_navigator_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."navigator_building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigator_classroom" ADD CONSTRAINT "navigator_classroom_type_id_navigator_classroom_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."navigator_classroom_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigator_corridor" ADD CONSTRAINT "navigator_corridor_building_id_navigator_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."navigator_building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigator_lift" ADD CONSTRAINT "navigator_lift_building_id_navigator_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."navigator_building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigator_stair" ADD CONSTRAINT "navigator_stair_building_id_navigator_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."navigator_building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "navigator_classroom_name_building_id_uidx" ON "navigator_classroom" USING btree ("name","building_id");--> statement-breakpoint
CREATE INDEX "navigator_classroom_building_id_idx" ON "navigator_classroom" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX "navigator_classroom_type_id_idx" ON "navigator_classroom" USING btree ("type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "navigator_corridor_name_building_id_uidx" ON "navigator_corridor" USING btree ("name","building_id");--> statement-breakpoint
CREATE UNIQUE INDEX "navigator_lift_name_building_id_uidx" ON "navigator_lift" USING btree ("name","building_id");--> statement-breakpoint
CREATE UNIQUE INDEX "navigator_stair_name_building_id_uidx" ON "navigator_stair" USING btree ("name","building_id");