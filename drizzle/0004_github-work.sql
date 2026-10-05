ALTER TABLE "repo" ADD COLUMN "recent_pulls" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "repo" ADD COLUMN "recent_changes" jsonb DEFAULT '[]'::jsonb NOT NULL;