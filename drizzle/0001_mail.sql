CREATE TABLE "email_job" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"project_id" text,
	"contact_id" text,
	"content_item_id" text,
	"sequence_id" text NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"to_address" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"send_after" timestamp,
	"sent_at" timestamp,
	"message_id" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_job" ADD CONSTRAINT "email_job_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_job" ADD CONSTRAINT "email_job_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_job" ADD CONSTRAINT "email_job_content_item_id_content_item_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_job_owner_status_idx" ON "email_job" USING btree ("owner_id","status","send_after");--> statement-breakpoint
CREATE INDEX "email_job_sequence_idx" ON "email_job" USING btree ("sequence_id");