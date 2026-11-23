# Stage evaluations

`pnpm eval` runs stage suites; `pnpm eval:ocr` or `pnpm eval ocr` selects OCR.
The runner loads `packages/ai/.env.local` without printing credentials. OpenAI
calls require `OPENAI_API_KEY`. Braintrust `Eval()` runs with `noSendLogs` when
`BRAINTRUST_API_KEY` is absent; setting it uploads synthetic experiments.

Datasets load only `fixtures/synthetic/*/expected.json`, both PDF variants.
Private documents are gitignored and never accepted as dataset arguments.
The held-out fixtures are clinical-06, consent-02, invoice-01 and skin-01; do
not tune prompts on them. The 20-page clinical fixture is included in the full suite.

Scorers are plain functions tested by `pnpm test`. CER and WER normalize
whitespace, retaining case and punctuation, and ignore block order: output
blocks are reordered to the expected blocks they overlap most, and reading
order is scored separately. Block metrics use monotonic text-edit alignment;
missing and extra blocks contribute zero. Figure blocks are left out of text
metrics and scored in `scorers/figures.ts`: an output figure matches a
ground-truth figure one-to-one at box IoU 0.5 or more, and burned-in recall is
the share of identifiers printed inside images found anywhere in the page
output text. Local reports
contain only identifiers, metrics, token counts, costs and timings, never OCR
text.

OCR providers implement `OcrProvider` from `src/stages/ocr/ocr-result.ts`.
`EVAL_OCR_PROVIDER` selects an arm from the record in `ocr.eval.ts` (default:
`defaultOcrProvider`, Reducto `r-1`). PII word-box coverage and precision apply only to
providers that return words; others log a null score, which Braintrust
excludes from averages. Page cost is the vendor-reported cost when a provider
returns one, otherwise a token estimate from the dated price table in
`prices.ts`. `reducto-r-1` and `reducto-r-1-mini` call Reducto parse and require
`REDUCTO_API_KEY`; `reducto-r-1` returns word boxes from word citations. `datalab-balanced` and `datalab-accurate` call the Datalab convert
API and require `DATALAB_API_KEY`.

Stage suites use the Braintrust SDK directly. There are no agent evals yet;
when added, run them through `eve eval` with `braintrustReporter`, separately
from these stage suites (which are not eve `defineEval` cases).

Runtime or schema failures fail the suite, as does a page-mean CER or WER
above the fixed per-variant ceilings in `scorers/ocr.ts`. Compare candidates
against a baseline experiment in Braintrust; the completion log prints the
experiment URL. `EVAL_FIXTURE`, `EVAL_VARIANT` and `EVAL_DPI` (144 or 216)
support focused runs; ceilings then apply to the selected pages only.
See [threshold rationale](../../../docs/evals.md) before changing a ceiling.

## Identifier detection and picture decisions

`pnpm eval pii` runs `pii-v1` with Sol on ten clean development pages from
`synthetic-v3`, using ground-truth text and figure blocks to isolate detection
from OCR. The selected fixtures cover names, DOB, IDs, address, phone, provider and
facility names, patient and non-patient faces, an unclear face, signatures,
a logo and an X-ray. The corpus has no email or SSN ground truth; those
categories have no measured recall.
Full-DOB fixture spans are projected to month/day for ADR 0002; birth years
and clinical dates count as false positives if predicted. Figures use their
separate ground-truth boxes as OCR figure blocks. Picture decisions are scored
by page/block identity; identifiers inside pictures are validated but their
box accuracy is not scored. Text recall/precision count unique characters per
category, so duplicate spans earn no credit. Hard error ceilings are 1% missed
identifier characters, 5% false-positive characters, and zero wrong picture
decisions. Runtime/schema failures also fail the suite. Current results live
in `docs/evals.md`; the local metadata/metrics-only report is
`evals/results/pii-latest.json`. No held-out pages are used.

## Classification and demographics

`pnpm eval classify` runs `classify-v1` with Luna on all 16 fixtures,
held-out included, over ground-truth text blocks. Scorers in
`scorers/classify.ts` report accuracy, per-class precision, recall and F1, and
flag consent summaries that repeat any ground-truth identifier text. Any
misclassification or leaking summary fails the suite.

`pnpm eval demographics` runs `demographics-v1` with Sol on the 15 clinical
and consent fixtures. Truth is the fixture's most frequent patient name, DOB
and MRN spans. Scorers in `scorers/demographics.ts` compare keyed hashes under
a per-run random key, then run `matchPatient` against two patients derived
from clinical-01 and clinical-03 (with an altered birth date). Ceilings are
90% accuracy per identifier field and zero wrong strong links. Both suites
fail on runtime or schema errors; results and reasons are in `docs/evals.md`.
Local reports hold metrics and fixture IDs only, never summaries or values.

## Observation extraction

`pnpm eval extract` runs `extract-v2` with Sol on clinical-01, clinical-02,
clinical-03 and clinical-followup (seven development pages). Input is ground-truth text blocks with
whole ground-truth identifier spans masked, so extraction is isolated from OCR
and identifier detection. Scorers in `scorers/extract.ts` compare
deduplicated output with ground truth deduplicated per `duplicateGroup`
(table over list over narrative): recall and precision on normalized name,
value and effective date, kind and detail field accuracy, unit accuracy among
matches, and dedupe accuracy
(exactly one survivor per group, in the preferred format). Error ceilings are
5% missed or extra observations, 5% wrong fields, 2% wrong units and 5% wrong groups; results
and reasons are in `docs/evals.md`.

## Note retrieval

`BRAINTRUST_API_KEY= pnpm eval notes` runs ten questions over the six searchable
seeded synthetic fixtures (clinical-20, clinical-followup, intake-01, referral-01,
radiology-01 and consent-01). It uses ground-truth OCR with identifiers masked,
the real section chunker and embedding model, in-memory cosine distance and
`selectNoteMatches` (up to four results at the chat similarity threshold).
Recall@4 requires the expected fixture, section and page; it is report-only,
with no pass threshold. Existing fixtures mostly have broad document headings,
so path nesting and sentence splitting are covered by unit tests instead.
The local `evals/results/notes-latest.json` report contains metadata and metrics
only; runtime failures appear as failed question IDs or a failed run.
