# Document ingestion

The channel accepts `{ fileName, pathnames }`, inserts a Postgres document and
stores its workflow run ID. Originals are private Blob paths under `uploads/`.
The render step uses an isolated temporary directory, uploads deterministic
`render/<page>.png` artifacts and records dimensions with status `reading`.
The OCR step uses Reducto r-1 and writes AES-256-GCM encrypted `ocr.json.enc`,
then sets `redacting`. A single durable redaction step loads OCR, detects identifier
spans, reviews figures, places redactions and burns every candidate. It checkpoints
encrypted burned PNGs and a manifest under `redaction/` before replacing redaction
rows atomically, publishing page pairs and setting `needsReview`. UUID v5 row IDs
use the document UUID and page/index. A retry reuses the checkpoint after render
deletion; publication can increment the page version again. Keeping detection and
geometry inside the step prevents content entering workflow history; the checkpoint
avoids repeating model calls once preparation succeeds.

The workflow waits on `document:<UUID>:review`. `redaction.update` increments
a durable refresh counter; `markReviewed` and `discard` write `reviewed` and
`discarded`. Artifact deletion is not implemented. Processing errors record
`failed`; durable step errors exclude provider messages and document content.

Status reads return the Workflow lifecycle state (`pending`, `running`,
`completed`, `failed`, `cancelled`); completed runs include the terminal status
and refresh count. Review returns 404 for unknown documents and 409 when the
hook is unavailable. Acknowledgment means delivery, not completed processing.

Workflow input contains upload references and the file name. Step outputs and
logs contain IDs, counts, durations and statuses; OCR stays inside steps.
Publication creates servable `pages/<page>-v<version>.webp` pairs.
