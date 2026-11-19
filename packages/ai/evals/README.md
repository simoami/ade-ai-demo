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
the stage default model). PII word-box coverage and precision apply only to
providers that return words; others log a null score, which Braintrust
excludes from averages. Page cost is the vendor-reported cost when a provider
returns one, otherwise a token estimate from the dated price table in
`prices.ts`. `reducto-r-1` and `reducto-r-1-mini` call Reducto parse and require
`REDUCTO_API_KEY`. `datalab-balanced` and `datalab-accurate` call the Datalab convert
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
