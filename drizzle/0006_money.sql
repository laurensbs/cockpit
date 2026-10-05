CREATE TABLE "money_item" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"project_id" text,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"amount" double precision,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"period" text NOT NULL,
	"next_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"source" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "money_item" ADD CONSTRAINT "money_item_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "money_item_owner_key_idx" ON "money_item" USING btree ("owner_id","key");