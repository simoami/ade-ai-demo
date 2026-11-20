# Document ingestion

The channel accepts `{ fileName, pathnames }`, inserts a Postgres document and
stores its workflow run ID. Originals are private Blob paths under `uploads/`.
The render step uses an isolated temporary directory, uploads deterministic
`render/<page>.png` artifacts and records dimensions with status `reading`.
The OCR step uses Reducto r-1 and writes AES-256-GCM encrypted `ocr.json.enc`,
then leaves the document at `redacting` pending the redaction stage.

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
Only later redaction processing can create servable `pages/<page>.webp` images.
