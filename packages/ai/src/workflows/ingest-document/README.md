# Document ingestion

The workflow renders the synthetic PDF into PNG pages and WebP thumbnails, then
waits on `document:<UUID>:review`. A redaction decision (`redaction.update` with
`accepted` or `rejected`) increments a durable refresh counter. `markReviewed`
and `discard` finish with `reviewed` and `discarded`, respectively.

Status reads return the Workflow lifecycle state (`pending`, `running`,
`completed`, `failed`, `cancelled`); completed runs include the document status
and refresh count. Review returns 409 while the hook is unavailable. Delivery
acknowledgment does not mean the action has finished processing.

Steps call ordinary stage functions. Workflow history contains IDs, action
metadata and counts; document content stays in the artifact directory.

Render and refresh steps log aggregate metadata through `@repo/logger`. A final
completion step records the terminal document status and returns the workflow
result. Logging stays outside the replayed workflow body.
