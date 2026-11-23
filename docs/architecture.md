# Architecture

A clinician uploads a scanned or digital record. The system reads it, redacts direct identifiers, links it to a patient, extracts observations, indexes the clinical notes and hands the result to a person for review. A page-aware assistant answers questions about the records with page citations. Terms are defined in [`CONTEXT.md`](../CONTEXT.md); decisions with real trade-offs are in [`docs/adr`](adr).

## Principles

1. **Evals drive model work.** Each model-backed stage has a synthetic dataset and scorers, and prompt or model changes are compared against a baseline. See [Evaluation](#evaluation).
2. **Fail closed on privacy.** Published pages burn every applied or accepted redaction, and uncertain candidates stay outlined until a reviewer decides. Unredacted renders are visible only while a document is being evaluated and redacted.
3. **Everything cites its source.** Observations, redactions and note chunks keep their page and box, so reviewers can check each one on the page.
4. **Deterministic pipeline, models for narrow judgments.** A durable workflow orders the steps. Models classify, read demographics, find identifiers and extract observations through structured output; the chat assistant can only read through typed tools.
5. **Replay-safe writes.** Rows use deterministic IDs and are replaced as a set, so a retried step never duplicates data.

## Services

| Service                      | Use                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| OpenAI (AI SDK)              | Picture pass, classification, demographics, PII detection, extraction, chat, embeddings |
| Reducto parse (`r-1`)        | OCR blocks and word boxes, chosen by the OCR evaluation                             |
| Tesseract (WASM, in-process) | Character boxes inside identifier regions, for exact redaction geometry             |
| Vercel Workflow (via eve)    | Durable pipeline run and review loop                                                |
| Vercel Blob (private)        | Originals, renders, encrypted artifacts and published pages                         |
| Neon Postgres + pgvector     | Application data and note embeddings                                                |
| Braintrust                   | Eval datasets, experiments and scores                                               |
| Vercel Deployment Protection | Access control for every deployment; the app has no auth code                       |

Models are called directly, without AI Gateway, from one registry in `packages/ai/src/models.ts`.

## System diagram

One Vercel deployment runs two services from root `vercel.ts`: the Next.js `web` service and the `eve` service that owns the durable workflow. `web` reaches `eve` only through a private service binding.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="diagrams/system-dark.svg">
  <img alt="Browser reaches Next.js through Vercel Authentication; Next.js calls the eve workflow service over a private binding with Vercel OIDC; the workflow renders, reads, redacts, classifies and extracts, then waits for human review; it writes to Vercel Blob and Neon Postgres and calls Reducto and OpenAI; the browser uploads to and reads pages from Blob directly." src="diagrams/system-light.svg">
</picture>

Consent documents skip extraction and other documents end as unsupported after redaction. Signed Blob URLs are issued per request on the server and never cached.

## Web rendering and cache boundaries

Next.js prerenders the workspace shell and streams live data into skeletons. Records that can still change (processing or in review) are always read live, because eve writes asynchronously. Reviewed and discarded records are cached with `use cache` and tagged, and every write path expires the tags it affects. Signed Blob URLs are created per request outside any cache.

## Pipeline

Each document gets one eve workflow run. The browser calls Next.js `/api/documents`, which validates the request and calls eve over a private Vercel service binding (`PIPELINE_SERVICE_ORIGIN`, 15-second timeout). The eve channel `/pipeline/documents` has no public route. It authenticates with HTTP Basic locally and Vercel OIDC on deployments, then starts, reads or resumes runs. Unknown errors return 503.

The workflow (`src/workflows/ingest-document`) runs durable steps that call plain stage functions under `src/stages`. Steps keep document content out of workflow history: they pass IDs and counts, encrypt OCR and identifier spans with `DOCUMENT_ENCRYPTION_KEY` (AES-256-GCM), and log metadata only. Row writes use UUID v5 IDs derived from the document and source, so retries replace rows instead of duplicating them.

```
upload ─► render ─► OCR ─┬─► classify ─────┐
                         ├─► demographics ─┼─► redact ─► observations ─► note index ─► review
                         └─► PII detection ┘
```

1. **Upload.** The browser uploads up to 10 PDF, PNG or JPEG files (20 MB each) straight to private Blob, three at a time. Each file becomes its own document and run. Uploading from a patient page fixes the patient.
2. **Render.** pdfium (WASM) renders PDF pages; Sharp applies EXIF orientation to images. The viewer shows these unredacted renders only while the status is `reading` or `redacting`.
3. **OCR.** Reducto returns typed blocks with boxes, reading order, cross-page `continues` links and word boxes. The result is stored encrypted ([ADR 0003](adr/0003-ocr-output-as-blob-artifacts.md)); providers are compared in [evals](evals.md).
4. **Classify, demographics and PII detection** run in parallel.
   - Classification sets the class: clinical, consent (with a summary) or other.
   - Demographics hashes identifiers inside the step and links the patient. An MRN, or last name, first name and date of birth, is a strong match; a partial match links with an identity mismatch; no match proposes a new patient.
   - PII detection finds identifier spans down to part of a token, so in `01/15/1985` only `01/15` is redacted ([ADR 0002](adr/0002-redact-direct-identifiers-keep-clinical-dates.md)). A picture pass classifies each figure (patient photo, other face, signature, logo, medical image) and finds identifiers printed inside it.
5. **Redact.** Tesseract reads each identifier region and returns character boxes; a redaction covers those characters with at most one pixel of padding. Reducto boxes are axis-aligned, so the angle comes from Tesseract baselines or the page skew. Low-confidence, unclear-picture and fallback-geometry candidates stay `needsReview` and are outlined, not burned. Burned pages are checkpointed encrypted before publication so retries survive render cleanup.
6. **Observations.** Clinical documents move to `extracting`. Extraction reads identifier-masked OCR and records labs, vitals, symptoms, adverse events, medical history and medications. Names stay as printed; vitals carry LOINC codes, and blood pressure is one panel with systolic and diastolic components ([ADR 0005](adr/0005-vitals-as-printed-with-loinc-codes.md)). Repeats within a document are merged, preferring tables over lists over narrative, and confidence below 0.7 is flagged. Each observation's box covers its row or its label and value, drawn as a rotated polygon on skewed pages.
7. **Note index.** Clinical and consent notes are masked, chunked by section and embedded with `text-embedding-3-small` into `note_chunks` ([ADR 0004](adr/0004-section-aware-note-chunking.md)). Chunks covered by a non-identifier redaction are hidden from search.
8. **Review.** The run registers its review hook, sets `needsReview` (consent documents skip extraction; other documents end as `unsupported`) and applies each action with `applyReviewAction`. Marking the document reviewed or discarding it ends the run and deletes originals and transient artifacts, keeping only the published redacted pages.

Published pages are versioned WebP pairs (`pages/<page>-v<version>.webp` and a thumbnail). Publishing writes every pair, bumps `documents.page_version`, then deletes older pages and renders, one publication at a time per document. The server signs 15-minute, single-file URLs so the browser loads pages straight from private Blob; OCR is never served.

## Review

After processing, the run waits on one review hook. The UI resumes it with typed actions (`redaction.update`, `observation.update`, `patient.link`, `patient.create`, `discard`, `markReviewed`), and each action is recorded as a review event.

- **Redaction decisions** republish every page from encrypted review sources, burning only applied and accepted redactions.
- **Mark as reviewed** requires no flagged or unchecked observations, no redactions needing review and no identity mismatch. It locks the document and deletes review-only artifacts.
- **Discard** ends review for a duplicate or wrong document and deletes its artifacts and derived data.

Statuses: `rendering` → `reading` → `redacting` → (`extracting` →) `needsReview` → `reviewed` or `discarded`. Unsupported documents end as `unsupported`, and failures as `failed`.

## Privacy

- All document content is PHI. Logs carry IDs, counts, durations and statuses only, and the logger masks sensitive keys as a backstop.
- Originals, OCR, identifier spans and review sources are encrypted with AES-256-GCM and deleted when review ends. Published redacted pages and derived data remain.
- Patients are stored as HMAC-SHA256 hashes (`PATIENT_HASH_KEY`) of MRN, names and date of birth, plus initials, sex and birth year. Ages over 89 store no birth year ([ADR 0002](adr/0002-redact-direct-identifiers-keep-clinical-dates.md)).
- Model prompts for extraction and note search use identifier-masked text.
- Only synthetic fixtures go to Braintrust. Private test documents stay in a gitignored folder.
- Reducto keeps API results for 24 hours on the standard tier; real PHI needs its tier with a BAA and zero data retention.
- Review events live in Postgres ([ADR 0001](adr/0001-review-events-in-postgres.md)).

## Data

Postgres holds `patients`, `documents`, `redactions`, `observations`, `note_chunks` (`vector(1536)` with an HNSW cosine index) and `review_events`. OCR blocks are Blob artifacts, not rows ([ADR 0003](adr/0003-ocr-output-as-blob-artifacts.md)).

Observations share common columns (kind, name, value, numeric value, unit, date, source region, review state) and keep kind-specific fields in a `details` JSON column, such as reference ranges, adverse-event seriousness, LOINC codes and blood pressure components. Observations from different documents are never merged; patient history is assembled at read time.

## Chat

A drawer on every workspace page streams answers from a Next.js route built on the AI SDK. The page sets the scope (all documents, all patients, one document or one patient), and the model reads data only through typed tools: `queryObservations`, `observationTrend`, `reviewStatus`, `listDocuments` and `searchNotes` (pgvector). Trends are computed in code, results render as observation cards and charts, and every clinical claim links to its source page. Conversations are not stored.

## Evaluation

Model-backed stages are built against evaluations, and [`docs/evals.md`](evals.md) holds the metrics, thresholds and current scores.

- **Synthetic fixtures.** A generator produces clinical, consent and other documents in clean and scanned variants, each with `expected.json` ground truth.
- **Suites per stage.** OCR, classification, demographics, PII detection, extraction and note retrieval. Run them with `pnpm eval`.
- **Gates and scores.** Privacy and correctness metrics, such as identifier recall and OCR error rates, are gates that fail the suite; the rest are tracked scores.
- **Experiments.** Results upload to Braintrust with the prompt version, model and dataset version, so a change is compared against its baseline.
