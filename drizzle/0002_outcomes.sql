CREATE TABLE "connector" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"project_id" text NOT NULL,
	"kind" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp,
	"last_ok_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_event" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"project_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"status" text NOT NULL,
	"day" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_point" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"project_id" text NOT NULL,
	"key" text NOT NULL,
	"day" date NOT NULL,
	"value" double precision NOT NULL,
	"source" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "deal_value" integer;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "deal_period" text;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "next_step" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "next_step_on" date;--> statement-breakpoint
ALTER TABLE "metric" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "growth_model" jsonb;--> statement-breakpoint
ALTER TABLE "connector" ADD CONSTRAINT "connector_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_event" ADD CONSTRAINT "contact_event_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_event" ADD CONSTRAINT "contact_event_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_point" ADD CONSTRAINT "metric_point_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "connector_project_kind_idx" ON "connector" USING btree ("project_id","kind");--> statement-breakpoint
CREATE INDEX "connector_owner_idx" ON "connector" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "contact_event_project_idx" ON "contact_event" USING btree ("project_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "metric_point_unique_idx" ON "metric_point" USING btree ("project_id","key","day","source");--> statement-breakpoint
CREATE INDEX "metric_point_owner_idx" ON "metric_point" USING btree ("owner_id","project_id","key","day");