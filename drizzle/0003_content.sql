CREATE TABLE "media_asset" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"project_id" text,
	"content_item_id" text,
	"origin" text NOT NULL,
	"role" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"file" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"duration_ms" integer,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "brand" jsonb;--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_content_item_id_content_item_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_owner_project_idx" ON "media_asset" USING btree ("owner_id","project_id");--> statement-breakpoint
CREATE INDEX "media_item_idx" ON "media_asset" USING btree ("content_item_id");