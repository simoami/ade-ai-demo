# Stage evaluations

`pnpm eval` runs stage suites; `pnpm eval:ocr` or `pnpm eval ocr` selects OCR.
The runner loads `packages/ai/.env.local` without printing credentials. OpenAI
calls require `OPENAI_API_KEY`. Braintrust `Eval()` runs with `noSendLogs` when
`BRAINTRUST_API_KEY` is absent; setting it uploads synthetic experiments.

Datasets load only `fixtures/synthetic/*/expected.json`, both PDF variants.
Private documents are gitignored and never accepted as dataset arguments.
The held-out fixtures are clinical-06, consent-02 and invoice-01; do not tune
prompts on them. The 20-page clinical fixture is included in the full suite.

Scorers are plain functions tested by `pnpm test`. CER and WER normalize
whitespace, retaining case and punctuation. Block metrics use monotonic
text-edit alignment; missing and extra blocks contribute zero. Local reports
contain only identifiers, metrics, token counts and timings, never OCR text.

Stage suites use the Braintrust SDK directly. There are no agent evals yet;
when added, run them through `eve eval` with `braintrustReporter`, separately
from these stage suites (which are not eve `defineEval` cases).

Runtime or schema failures fail the suite, as does a page-mean CER or WER
above the fixed per-variant ceilings in `scorers/ocr.ts`. Compare candidates
against a baseline experiment in Braintrust; the completion log prints the
experiment URL. `EVAL_FIXTURE`, `EVAL_VARIANT` and `EVAL_DPI` (144 or 216)
support focused runs; ceilings then apply to the selected pages only.
See [threshold rationale](../../../docs/evals.md) before changing a ceiling.
