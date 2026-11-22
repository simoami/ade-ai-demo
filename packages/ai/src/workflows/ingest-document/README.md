# Document ingestion

The channel accepts `{ fileName, pathnames }`, inserts a Postgres document and
stores its workflow run ID. Originals are private Blob paths under `uploads/`.
The render step uses an isolated temporary directory, uploads deterministic
`render/<page>.png` artifacts and records dimensions with status `reading`.
The OCR step uses Reducto r-1 and writes AES-256-GCM encrypted `ocr.json.enc`,
then sets `redacting`. Classification, patient matching and identifier detection
then run as parallel durable steps. Classification stores the class and consent
summary. Matching hashes identifiers inside its step with `PATIENT_HASH_KEY`,
links strong or partial matches (partial sets `identity_mismatch`) and stores a
non-identifying `proposed_patient`. Detection stores encrypted spans in
`identifiers.json.enc` and reuses them on retry.

The redaction step places redactions from those spans, reviews figures and burns
every candidate. It checkpoints encrypted burned PNGs, encrypted unredacted
review sources under `redaction/source/` and a manifest before replacing
redaction rows atomically and publishing page pairs. A retry reuses the
checkpoint after render deletion; publication can increment the page version
again. The class step then extracts clinical documents from identifier-masked
OCR (`extracting`, then `needsReview`), sends consent documents to `needsReview`
and others to `unsupported`. Observation rows use UUID v5 IDs from the document,
page, block, name and date, are `flagged` below 0.7 confidence and list
redactions covering at least 30% of their source box. Validation normalizes lab
bounds/flags, BP components, medication numeric doses and AE seriousness.
A durable indexing step follows clinical extraction and consent processing:
it embeds identifier-masked text blocks into `note_chunks` with source regions,
replacing rows atomically using document/page/index UUID v5 IDs.

The workflow waits on `document:<UUID>:review` and applies each action with
`applyReviewAction` (`review-actions.ts`). Refused actions leave the loop
waiting; `markReviewed` and `discard` end the run with the count of applied
actions. Processing errors record `failed`; durable step errors exclude
provider messages and document content.

Status reads return the Workflow lifecycle state (`pending`, `running`,
`completed`, `failed`, `cancelled`); completed runs include the terminal status
and applied action count (`refreshCount`). Review returns 404 for unknown documents and 409 when the
hook is unavailable. Acknowledgment means delivery, not completed processing.

Workflow input contains upload references and the file name. Step outputs and
logs contain IDs, counts, classes, match strengths, durations and statuses;
OCR, identifiers and their hashes stay inside steps.
Publication creates servable `pages/<page>-v<version>.webp` pairs.
