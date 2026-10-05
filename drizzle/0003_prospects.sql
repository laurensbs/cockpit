ALTER TABLE "contact" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "observation" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "fit" integer;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "channel" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "email_source" text;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "city" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "pitch" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "prospect_per_day" integer DEFAULT 0 NOT NULL;