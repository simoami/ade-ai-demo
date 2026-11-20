CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TYPE "public"."document_class" AS ENUM('clinical', 'consent', 'other');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('rendering', 'reading', 'redacting', 'extracting', 'needsReview', 'reviewed', 'discarded', 'unsupported', 'failed');--> statement-breakpoint
CREATE TYPE "public"."observation_kind" AS ENUM('lab', 'vital', 'symptom', 'adverse-event');--> statement-breakpoint
CREATE TYPE "public"."observation_review_status" AS ENUM('confirmed', 'corrected', 'rejected', 'flagged', 'unchecked');--> statement-breakpoint
CREATE TYPE "public"."redaction_state" AS ENUM('applied', 'needsReview', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."review_action" AS ENUM('redaction.update', 'observation.resolve', 'patient.link', 'discard', 'markReviewed');--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text,
	"document_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_sessions_one_context" CHECK (num_nonnulls("chat_sessions"."patient_id", "chat_sessions"."document_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "clinical_entities" (
	"id" text PRIMARY KEY NOT NULL,
	"note_chunk_id" text NOT NULL,
	"text" text NOT NULL,
	"category" text NOT NULL,
	"type" text NOT NULL,
	"assertions" jsonb NOT NULL,
	"codes" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text,
	"status" "document_status" DEFAULT 'rendering' NOT NULL,
	"file_name" text NOT NULL,
	"original_pathname" text NOT NULL,
	"document_class" "document_class",
	"identity_mismatch" boolean DEFAULT false NOT NULL,
	"page_dimensions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"run_id" text,
	"consent_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "note_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"text" text NOT NULL,
	"source" jsonb NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"removed_by_redaction_ids" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"kind" "observation_kind" NOT NULL,
	"name" text NOT NULL,
	"value" text NOT NULL,
	"value_numeric" numeric,
	"unit" text,
	"effective_date" date,
	"date_source" text,
	"source_format" text NOT NULL,
	"source" jsonb NOT NULL,
	"review_status" "observation_review_status" DEFAULT 'unchecked' NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"removed_by_redaction_ids" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" text PRIMARY KEY NOT NULL,
	"mrn_hash" text,
	"first_name_hash" text,
	"last_name_hash" text,
	"birth_date_hash" text,
	"initials" text NOT NULL,
	"sex" text NOT NULL,
	"birth_year" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redactions" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"page" integer NOT NULL,
	"block_id" text,
	"box" jsonb NOT NULL,
	"points" jsonb NOT NULL,
	"category" text NOT NULL,
	"state" "redaction_state" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_events" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"action" "review_action" NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_entities" ADD CONSTRAINT "clinical_entities_note_chunk_id_note_chunks_id_fk" FOREIGN KEY ("note_chunk_id") REFERENCES "public"."note_chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_chunks" ADD CONSTRAINT "note_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redactions" ADD CONSTRAINT "redactions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_patient_id_idx" ON "documents" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "note_chunks_document_id_idx" ON "note_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "note_chunks_embedding_cosine_idx" ON "note_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "observations_document_id_idx" ON "observations" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "redactions_document_id_idx" ON "redactions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "review_events_document_id_idx" ON "review_events" USING btree ("document_id");