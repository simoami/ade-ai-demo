ALTER TYPE "public"."review_action" ADD VALUE 'observation.update' BEFORE 'patient.link';--> statement-breakpoint
ALTER TYPE "public"."review_action" ADD VALUE 'patient.create' BEFORE 'discard';--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "proposed_patient" jsonb;