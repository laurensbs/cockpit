CREATE TABLE "publish_job" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"project_id" text,
	"content_item_id" text NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"publish_at" timestamp NOT NULL,
	"next_try_at" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"remote_id" text,
	"permalink" text,
	"error" text,
	"published_at" timestamp,
	"stats" jsonb,
	"stats_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "publish_job" ADD CONSTRAINT "publish_job_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_job" ADD CONSTRAINT "publish_job_content_item_id_content_item_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "publish_owner_status_idx" ON "publish_job" USING btree ("owner_id","status","publish_at");--> statement-breakpoint
CREATE INDEX "publish_item_idx" ON "publish_job" USING btree ("content_item_id");