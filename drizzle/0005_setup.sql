CREATE TABLE "setup_item" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"project_id" text NOT NULL,
	"key" text NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "setup_item" ADD CONSTRAINT "setup_item_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "setup_item_project_key_source_idx" ON "setup_item" USING btree ("project_id","key","source");