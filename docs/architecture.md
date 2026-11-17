# Architecture

Clinical record ingestion: a clinician uploads a scanned or digital record, the system reads it, redacts direct identifiers, links it to a patient, extracts observations, indexes doctor notes, and hands the result to a person for review. Terms are defined in [`CONTEXT.md`](../CONTEXT.md); decisions with real trade-offs are in [`docs/adr`](adr).

## Principles

1. **Evals drive the work.** Every model-backed stage gets a dataset and scorers before its prompt is written. See [Evaluation](#evaluation).
2. **Fail closed on privacy.** Third parties other than the OCR model never see unconfirmed identifiers. Redactions are burned into pixels, not overlaid.
3. **Everything cites its source.** Observations, redactions and note chunks carry page, block ID and box, so the UI can outline them and reviewers can verify them.
4. **Deterministic pipeline, agents only where judgment helps.** The pipeline is a durable workflow. The two agents (observation review and chart Q&A) use narrow tools.
5. **Replay-safe writes.** Deterministic IDs and upserts, so a retried step never duplicates data.

## Packages

| Package            | Responsibility                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `apps/web`         | Next.js app: documents and patients views, document review, chat drawer, upload route                        |
| `packages/ai`      | Pipeline workflow, stage functions, prompts and model registry, eve agents, document artifacts, evals        |
| `packages/db`      | Drizzle schema and migrations for Neon Postgres with pgvector                                                |
| `packages/storage` | Provider-agnostic wrapper over Vercel Blob: put, get, head, list, delete, client upload tokens. No app logic |
| `packages/logger`  | One tslog instance: pretty locally, JSON on Vercel, sensitive keys masked                                    |
| `packages/ui`      | shadcn components on Base UI                                                                                 |

`packages/ai` owns everything document-specific about storage: the artifact path layout, AES-256-GCM encryption of review-only artifacts, and their deletion.

## Services

| Service                          | Use                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| OpenAI (direct, AI SDK provider) | OCR, classification, demographics, PII detection, extraction, agents, embeddings                         |
| AWS Comprehend Medical           | Clinical entity enrichment of redacted note text, behind an `Enricher` interface                         |
| Vercel Workflow (via eve)        | Durable pipeline run and review loop                                                                     |
| Vercel Blob (private)            | Originals, page renders, OCR artifacts                                                                   |
| Neon Postgres + pgvector         | Application data and note embeddings                                                                     |
| Braintrust                       | Datasets, experiments and scores for evals                                                               |
| Vercel Deployment Protection     | Access control: Vercel Authentication on all deployments plus a shareable link. The app has no auth code |

AI Gateway is deferred; models are called directly. Model IDs live in one registry in `packages/ai`: `gpt-6.1-sol` for OCR, PII, extraction and agents, `gpt-6-luna` for classification and consent summaries, `text-embedding-3-small` for notes.

## Pipeline

One workflow run per document, implemented as an eve workflow tool in `packages/ai` and started by the upload route.

```
upload ─► render pages ─► OCR ─┬─► classify ──────────┐
                               ├─► demographics ──────┼─► redact ─► observations ─► review agent ─┐
                               └─► PII detection ─────┘          └► note index ─► enrichment ─────┴─► in_review
```

1. **Upload.** The browser uploads directly to private Blob with a client token. Limits: PDF, PNG or JPEG, 20 pages, 20 MB. The route creates the document and starts the run. Uploading from a patient's page fixes the target patient.
2. **Render.** pdfium (WASM) renders pages; Sharp produces thumbnails. Runs in a normal step.
3. **OCR.** The vision model returns typed blocks (text, kind, reading order, box, optional `continues` link to a block on a previous page). Stored as encrypted `ocr.json` ([ADR 0003](adr/0003-ocr-output-as-blob-artifacts.md)).
4. **Classify.** Clinical, consent, or other. Consent gets a summary and no extraction; other is marked unsupported.
5. **Demographics.** A structured-output step (not an agent) reads identifiers, hashes them inside the step, and matches a patient: MRN, or last name, first name and date of birth, is a strong match and links automatically; a partial match links with an identity mismatch; no match proposes a new patient.
6. **PII detection.** The model returns identifier spans per block ([ADR 0002](adr/0002-redact-direct-identifiers-keep-clinical-dates.md) defines the scope). Tesseract runs on the block crop to find exact word boxes; if it cannot, the redaction falls back to the whole block and needs review.
7. **Redact.** High-confidence redactions are burned into page images and thumbnails and removed from `ocr.redacted.json`. Low-confidence candidates are masked in text only, so embeddings and enrichment never see them, while the reviewer can still read the page.
8. **Observations.** Structured extraction over tables, lists and narrative, then within-document deduplication that is date-aware and prefers table over list over narrative. The review agent checks each batch against the source with `viewSourceRegion` and `readBlocks`, and returns a verdict per observation:
   - `confirmed`: accepted.
   - `corrected`: applied automatically, badged, revertible.
   - `rejected`: hidden, restorable.
   - `flagged`: needs a person; blocks review completion.
   - `unchecked`: the agent failed; blocks review completion.
9. **Note index.** Doctor-note sections (joined across pages) are chunked, embedded from redacted text, and stored with their source regions.
10. **Enrichment.** Comprehend Medical extracts entities, assertions and codes from redacted chunk text.

## Review

After processing, the run waits on a single review hook in a loop. The UI resumes it with typed actions: `redaction.update`, `observation.resolve`, `patient.link`, `discard`, `markReviewed`. Each action writes a review event and runs one idempotent refresh step.

- **New or approved redaction.** Refresh burns it in, rewrites `ocr.redacted.json`, and tests overlap against observations and note chunks. Coverage is the intersection area divided by the item's area. An observation at 0.3 or more is removed; a note chunk at 0.5 or more is removed, and below that its text is scrubbed and re-embedded. Removal is soft and records the redaction, so its enrichment disappears with it and everything returns if the redaction is rejected.
- **Rejected candidate.** Its text is unmasked and refresh re-embeds the chunks whose redacted text changed.
- **Mark as reviewed** is enabled when nothing blocks it: no flagged or unchecked observations, no redactions needing review, no identity mismatch. It creates the patient if needed, locks the document, and deletes the review-only artifacts.
- **Discard** (duplicate upload, wrong patient) deletes the review-only artifacts and the document's derived data.

Statuses: `queued`, `processing`, `in_review`, `reviewed`, `discarded`, and `failed` with a retry.

## Privacy

- All document content is PHI. Logs and traces carry IDs, counts and durations only; the logger masks sensitive keys as a backstop.
- Review-only artifacts (original, `ocr.json`, demographics) are encrypted with AES-256-GCM and deleted when review ends. Only `ocr.redacted.json`, redacted renders and derived data remain.
- Patients are stored as HMAC keys (`PATIENT_KEY_SECRET`) of MRN, first name, last name and date of birth, plus initials, sex and birth year. Ages over 89 store no birth year.
- Only synthetic fixtures go to Braintrust. Private test documents live in a gitignored folder and are excluded from evals.
- Review events live in Postgres for this demo ([ADR 0001](adr/0001-review-events-in-postgres.md)).

## Data

Eight tables in `packages/db`: `patients`, `documents`, `redactions`, `observations`, `note_chunks` (`vector(1536)`, HNSW cosine index), `clinical_entities`, `review_events`, `chat_sessions`. Page dimensions are a jsonb column on `documents`; OCR blocks are Blob artifacts, not rows.

Observations have common columns (`kind`, `name`, `value`, `valueNumeric`, `unit`, `effectiveDate`, `dateSource`, `sourceFormat`, `source` regions, review status) and a `details` jsonb validated per kind, for example reference range for labs, or start date, end date and seriousness for adverse events. Trend queries use only the common columns. Observations from different documents are never merged; history is assembled at read time.

## Chat

A drawer on the documents and patient views. One eve session per context (a patient or a document, shown as a pill). Tools: `searchNotes` (pgvector), `queryObservations`, and `observationTrend`, which computes trends in code rather than asking the model.

## Evaluation

Evaluation is how stages are built, not a check added afterwards.

- **Fixtures first.** A generator produces about ten synthetic documents, with clean and scanned variants, and writes `expected.json` ground truth for each. A small held-out split is never tuned against.
- **Suites per stage.** OCR (character and word error rate), classification (F1), PII (span recall and precision, redaction pixel coverage), extraction (field match, evidence validity), review agent (decision accuracy), chat agent (tool use, groundedness).
- **Gates and scores.** PII recall and redaction coverage are hard gates that fail `pnpm eval`. Other metrics must not regress against the baseline. Acceptance criteria and their reasons are in `docs/evals.md`.
- **Experiments.** Each prompt or model change runs as a baseline-versus-candidate experiment in Braintrust, recorded with git SHA, prompt version, model and dataset version. eve agents report through eve's Braintrust reporter; stage functions use Braintrust's `Eval()`.
- **Judges.** LLM judges use an explicit OpenAI model and are calibrated against a small human-labelled set; their agreement rate is reported with their scores.
- **Refinement loop.** Failures found in traces, and reviewer verdicts on synthetic documents, are promoted into datasets with corrected expectations.
- **Visible history.** Free-tier retention is short, so `docs/evals.md` keeps the current scorecard and a changelog of experiments.

## Delivery

GitHub Actions runs check, typecheck, test and build on every pull request. Evals cost tokens, so they run on the `run-evals` label or manually and post the comparison as a comment. The app is developed locally and deployed to Vercel.

Build order: a spike (workflow hook resumed from a route, thumbnail timing), then the fixture generator and eval harness, then the stages in pipeline order.
