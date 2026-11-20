# Architecture

Clinical record ingestion: a clinician uploads a scanned or digital record, the system reads it, redacts direct identifiers, links it to a patient, extracts observations, indexes doctor notes, and hands the result to a person for review. Terms are defined in [`CONTEXT.md`](../CONTEXT.md); decisions with real trade-offs are in [`docs/adr`](adr).

## Principles

1. **Evals drive the work.** Every model-backed stage gets a dataset and scorers before its prompt is written. See [Evaluation](#evaluation).
2. **Fail closed on privacy.** Third parties other than the OCR model never see unconfirmed identifiers. Redactions are burned into pixels, not overlaid.
3. **Everything cites its source.** Observations, redactions and note chunks carry page, block ID and box, so the UI can outline them and reviewers can verify them.
4. **Deterministic pipeline, agents only where judgment helps.** The pipeline is a durable workflow. The two agents (observation review and chart Q&A) use narrow tools.
5. **Replay-safe writes.** Deterministic IDs and upserts, so a retried step never duplicates data.

## Packages

| Package            | Responsibility                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `apps/web`         | Next.js document API gateway; validates requests and calls the authenticated eve service                        |
| `packages/ai`      | eve service, ingestion workflow and steps, plain rendering stage, model instances, Blob artifacts and contracts |
| `packages/db`      | Drizzle schema and migrations for Neon Postgres with pgvector                                                   |
| `packages/storage` | Provider-agnostic wrapper over Vercel Blob: put, get, head, list, delete, client upload tokens. No app logic    |
| `packages/logger`  | Shared tslog root and named children: pretty locally, JSON on Vercel/production, sensitive keys masked          |
| `packages/ui`      | shadcn components on Base UI                                                                                    |

`packages/ai` owns everything document-specific about storage: the artifact path layout, AES-256-GCM encryption of review-only artifacts, and their deletion.

## Services

| Service                          | Use                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| OpenAI (direct, AI SDK provider) | Picture pass, classification, demographics, PII detection, extraction, agents, embeddings                |
| Reducto parse (`r-1`)            | OCR: page text, layout blocks and word boxes, chosen by the OCR evaluation and re-evaluated over time    |
| Tesseract (WASM, in-process)     | Character boxes inside regions that hold identifiers, for exact redaction geometry                       |
| AWS Comprehend Medical           | Clinical entity enrichment of redacted note text, behind an `Enricher` interface                         |
| Vercel Workflow (via eve)        | Durable pipeline run and review loop                                                                     |
| Vercel Blob (private)            | Originals, page renders, OCR artifacts                                                                   |
| Neon Postgres + pgvector         | Application data and note embeddings                                                                     |
| Braintrust                       | Datasets, experiments and scores for evals                                                               |
| Vercel Deployment Protection     | Access control: Vercel Authentication on all deployments plus a shareable link. The app has no auth code |

AI Gateway is deferred; models are called directly. Model IDs live in one registry in `packages/ai`: `gpt-6.1-sol` for OCR, PII, extraction and agents, `gpt-6-luna` for classification and consent summaries, `text-embedding-3-small` for notes.

## Pipeline

One workflow run per document is owned by eve. Browser document requests go to
Next.js `/api/documents` route handlers, which validate the shared contract and
call a fixed `PIPELINE_SERVICE_ORIGIN` URL base with a 15-second timeout.
On Vercel, root `vercel.ts` composes web and eve services and injects this URL
through a private service binding. The project Root Directory is the repository
root. Internal binding calls skip Deployment Protection; browser requests remain
protected. The document channel has no public route. The eve channel
at `/pipeline/documents` authenticates with HTTP Basic locally or Vercel OIDC
on deployments, validates requests, then calls `start`, `getRun` or `resumeHook`.
Unknown gateway errors return 503 with "Service unavailable". `withEve` handles
public protocol routes; document calls use the binding. Local Next.js retains
`eve/next` and an explicitly configured service origin.

`agent/tools/ingest-document.ts` registers the workflow from
`src/workflows/ingest-document/ingest-document.workflow.ts`. Its steps call
ordinary functions under `src/stages/render` and `src/stages/ocr`. The channel
creates a Postgres document and persists its run ID. The workflow reads private
Blob originals, renders PNG pages, records dimensions, and runs Reducto r-1 OCR.
It encrypts OCR JSON with AES-256-GCM (12-byte IV, 16-byte tag, ciphertext) using
`DOCUMENT_ENCRYPTION_KEY`, then leaves status at `redacting`. It waits on the
review hook, increments a refresh counter for redaction decisions, and writes
terminal status on `markReviewed` or `discard`. Per-document artifact cleanup
and real-upload redaction are not implemented. Only redacted `pages/<page>.webp` can be served;
this workflow produces internal `render/<page>.png` and `ocr.json.enc` only.
Milestone logs use `@repo/logger` and carry metadata only. Render, OCR, refresh and
terminal review logs run in durable steps, outside workflow replay; request
failures include only fixed paths, statuses and error types.
Only the contract is exported to Next.js. The clinical processing design is:

```
upload ─► render pages ─► OCR ─┬─► classify ──────────┐
                               ├─► demographics ──────┼─► redact ─► observations ─► review agent ─┐
                               └─► PII detection ─────┘          └► note index ─► enrichment ─────┴─► in_review
```

1. **Upload.** The browser uploads directly to private Blob with a client token. Limits: one PDF, or up to 30 PNG or JPEG images that become the pages of one document in the order selected; 30 pages, 20 MB. The route creates the document and starts the run. Uploading from a patient's page fixes the target patient.
2. **Render.** pdfium (WASM) renders PDF pages; an uploaded PNG or JPEG becomes one page after Sharp applies its EXIF orientation. Sharp produces thumbnails. Runs in a normal step.
3. **OCR.** An `OcrProvider` returns typed blocks (text, kind, reading order, box, optional `continues` link to a block on a previous page), figure blocks for pictures and signatures, and word boxes where the provider has them. Providers are compared in [`docs/evals.md`](evals.md). Stored as encrypted `ocr.json` ([ADR 0003](adr/0003-ocr-output-as-blob-artifacts.md)).
4. **Classify.** Clinical, consent, or other. Consent gets a summary and no extraction; other is marked unsupported.
5. **Demographics.** A structured-output step (not an agent) reads identifiers, hashes them inside the step, and matches a patient: MRN, or last name, first name and date of birth, is a strong match and links automatically; a partial match links with an identity mismatch; no match proposes a new patient.
6. **PII detection.** The model returns identifier spans per block, down to part of a token: in `01/15/1985` only `01/15` is an identifier, because the birth year is kept ([ADR 0002](adr/0002-redact-direct-identifiers-keep-clinical-dates.md) defines the scope). A picture pass gives the model the page image and the figure blocks: it classifies each picture (patient photo by its placement with the patient's name or date of birth, other face, signature, logo, medical image, clinical photo) and locates identifiers printed inside pictures. Tesseract always runs on the crop of every region holding an identifier and returns character boxes. A redaction is the union of the span's character boxes with at most one pixel of padding, clipped to its text line, so neighbouring characters and tightly spaced lines stay readable. If Tesseract cannot match the span's characters, the redaction falls back to the OCR word or block box and needs review.
7. **Redact.** High-confidence redactions are burned into page images and thumbnails and removed from `ocr.redacted.json`. Low-confidence candidates are masked in text only, so embeddings and enrichment never see them, while the reviewer can still read the page.
8. **Observations.** Structured extraction over tables, lists and narrative, then within-document deduplication that is date-aware and prefers table over list over narrative. The review agent checks each batch against the source with `viewSourceRegion` and `readBlocks`, and returns a verdict per observation:
   - `confirmed`: accepted.
   - `corrected`: applied automatically, badged, revertible.
   - `rejected`: hidden, restorable.
   - `flagged`: needs a person; blocks review completion.
   - `unchecked`: the agent failed; blocks review completion.
9. **Note index.** Doctor-note sections (joined across pages) are chunked, embedded from redacted text, and stored with their source regions.
10. **Enrichment.** Comprehend Medical extracts entities, assertions and codes from redacted chunk text.

## Demo administration

The workspace header opens an Admin dialog with four synthetic scanned PDF
samples. A browser-only welcome popup links to those downloads; opting out
stores `ade.welcome.dismissed=1` in localStorage.

`DELETE /api/documents` calls authenticated `DELETE /pipeline/documents` in eve.
The service attempts to cancel active runs, paginates private Blob deletion under
`documents/` and `uploads/`, then deletes review events, redactions, observations,
note chunks (cascading clinical entities), document chat sessions and documents
in one Neon HTTP batch transaction. Patients and their chat sessions remain.
Blob cleanup failures stop before database deletion; a retry can finish partial
cleanup. The returned count is the number of document rows deleted.

## Review

After processing, the run waits on a single review hook in a loop. The UI resumes it with typed actions: `redaction.update`, `observation.resolve`, `patient.link`, `discard`, `markReviewed`. Each action writes a review event and runs one idempotent refresh step.

- **New or approved redaction.** Refresh burns it in, rewrites `ocr.redacted.json`, and tests overlap against observations and note chunks. Coverage is the intersection area divided by the item's area. An observation at 0.3 or more is removed; a note chunk at 0.5 or more is removed, and below that its text is scrubbed and re-embedded. Removal is soft and records the redaction, so its enrichment disappears with it and everything returns if the redaction is rejected.
- **Rejected candidate.** Its text is unmasked and refresh re-embeds the chunks whose redacted text changed.
- **Mark as reviewed** is enabled when nothing blocks it: no flagged or unchecked observations, no redactions needing review, no identity mismatch. It creates the patient if needed, locks the document, and deletes the review-only artifacts.
- **Discard** (duplicate upload, wrong patient) deletes the review-only artifacts and the document's derived data.

Implemented ingestion statuses: `rendering` → `reading` → `redacting`; failures write `failed`, and terminal review writes `reviewed` or `discarded`.

## Privacy

- All document content is PHI. Logs and traces carry IDs, counts and durations only; the logger masks sensitive keys as a backstop.
- Review-only artifacts (original, `ocr.json`, demographics) are encrypted with AES-256-GCM and deleted when review ends. Only `ocr.redacted.json`, redacted renders and derived data remain.
- Patients are stored as HMAC keys (`PATIENT_KEY_SECRET`) of MRN, first name, last name and date of birth, plus initials, sex and birth year. Ages over 89 store no birth year.
- Only synthetic fixtures go to Braintrust. Private test documents live in a gitignored folder and are excluded from evals; they are used for local human verification only.
- Reducto keeps API results for 24 hours on the standard tier. Real PHI requires its Growth tier, which adds a BAA and zero data retention.
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

Document artifacts live in private Blob and document/run mappings in Postgres.
Rendering uses temporary scratch directories removed inside the step. Workflow
history lives in `packages/ai/.eve/.workflow-data`; its inputs include original
upload references and file names, while OCR content remains inside steps.
Deployment requires service OIDC and Deployment Protection.
`pnpm workflows` uses pinned CLI 5.1.0 with the same Workflow core/local-world
versions as eve; live inspector access requires verification. See
[`packages/ai/README.md`](../packages/ai/README.md) for exact local commands.
