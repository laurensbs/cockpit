CREATE TABLE "brief" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"project_id" text,
	"kind" text NOT NULL,
	"content" jsonb NOT NULL,
	"run_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'own' NOT NULL,
	"country" text,
	"registration" text DEFAULT '' NOT NULL,
	"website" text,
	"color" text DEFAULT '#8b7bff' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"project_id" text NOT NULL,
	"organization" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text,
	"website" text,
	"note" text DEFAULT '' NOT NULL,
	"basis" text DEFAULT 'business' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"last_contact_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_item" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"project_id" text,
	"kind" text NOT NULL,
	"channel" text DEFAULT '' NOT NULL,
	"language" text DEFAULT 'nl' NOT NULL,
	"title" text NOT NULL,
	"body" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"planned_for" date,
	"done_at" timestamp,
	"rating" integer DEFAULT 0 NOT NULL,
	"contact_id" text,
	"run_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"project_id" text NOT NULL,
	"month" date NOT NULL,
	"key" text NOT NULL,
	"value" double precision NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"company_id" text,
	"name" text NOT NULL,
	"stage" text DEFAULT 'build' NOT NULL,
	"one_liner" text DEFAULT '' NOT NULL,
	"what" text DEFAULT '' NOT NULL,
	"audience" text DEFAULT '' NOT NULL,
	"goal" text DEFAULT '' NOT NULL,
	"markets" text[] DEFAULT '{}'::text[] NOT NULL,
	"languages" text[] DEFAULT '{nl}'::text[] NOT NULL,
	"tone" text DEFAULT '' NOT NULL,
	"north_star" text DEFAULT '' NOT NULL,
	"red_lines" text DEFAULT '' NOT NULL,
	"site_url" text,
	"site_status" integer,
	"site_checked_at" timestamp,
	"local_path" text,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"monthly_budget" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quest" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"project_id" text,
	"title" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'custom' NOT NULL,
	"xp" integer DEFAULT 25 NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"source_key" text,
	"status" text DEFAULT 'open' NOT NULL,
	"recurrence" text DEFAULT 'none' NOT NULL,
	"due_on" date,
	"done_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repo" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"project_id" text,
	"full_name" text NOT NULL,
	"is_private" boolean DEFAULT true NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"include_in_ai" boolean DEFAULT true NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"homepage" text,
	"topics" text[] DEFAULT '{}'::text[] NOT NULL,
	"language" text,
	"stack" text[] DEFAULT '{}'::text[] NOT NULL,
	"readme" text DEFAULT '' NOT NULL,
	"docs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"commit_days" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recent_commits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pushed_at" timestamp,
	"synced_at" timestamp,
	"sync_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setting" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_event" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"project_id" text,
	"kind" text NOT NULL,
	"ref_id" text NOT NULL,
	"xp" integer NOT NULL,
	"day" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brief" ADD CONSTRAINT "brief_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_item" ADD CONSTRAINT "content_item_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_item" ADD CONSTRAINT "content_item_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric" ADD CONSTRAINT "metric_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest" ADD CONSTRAINT "quest_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo" ADD CONSTRAINT "repo_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_event" ADD CONSTRAINT "xp_event_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brief_owner_kind_idx" ON "brief" USING btree ("owner_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "brief_project_idx" ON "brief" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "company_owner_idx" ON "company" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "contact_project_idx" ON "contact" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "content_owner_kind_idx" ON "content_item" USING btree ("owner_id","kind","status");--> statement-breakpoint
CREATE INDEX "content_project_idx" ON "content_item" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "content_planned_idx" ON "content_item" USING btree ("owner_id","planned_for");--> statement-breakpoint
CREATE UNIQUE INDEX "metric_project_month_key_idx" ON "metric" USING btree ("project_id","month","key");--> statement-breakpoint
CREATE INDEX "project_owner_idx" ON "project" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "project_company_idx" ON "project" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "quest_owner_status_idx" ON "quest" USING btree ("owner_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "quest_source_idx" ON "quest" USING btree ("owner_id","source_key");--> statement-breakpoint
CREATE UNIQUE INDEX "repo_owner_full_name_idx" ON "repo" USING btree ("owner_id","full_name");--> statement-breakpoint
CREATE INDEX "repo_project_idx" ON "repo" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "setting_owner_key_idx" ON "setting" USING btree ("owner_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "xp_event_ref_idx" ON "xp_event" USING btree ("owner_id","kind","ref_id");--> statement-breakpoint
CREATE INDEX "xp_event_owner_day_idx" ON "xp_event" USING btree ("owner_id","day");