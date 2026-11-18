# Stage evaluations

## OCR baseline

Measured 2026-11-18 with `gpt-6.1-sol`, `ocr-v1`, `synthetic-v1`, at 144 DPI.
Git SHA: `a75f269ee7ed0e1d73885ba3ad500615be87a6d4` with uncommitted task changes.
Braintrust ran locally (`noSendLogs`); no Braintrust key was configured.

| Subset                | Pages | CER       | WER       | Block-kind accuracy | Box IoU  |
| --------------------- | ----- | --------- | --------- | ------------------- | -------- |
| clean / development   | 37    | 0.003496% | 0.023708% | 100.00%             | 0.724620 |
| clean / held-out      | 5     | 0.000000% | 0.000000% | 100.00%             | 0.714070 |
| scanned / development | 37    | 0.000000% | 0.000000% | 100.00%             | 0.720963 |
| scanned / held-out    | 5     | 0.000000% | 0.000000% | 100.00%             | 0.694698 |
| all / all             | 84    | 0.001540% | 0.010443% | 100.00%             | 0.720600 |

All 22 document/variant cases passed, covering 84 pages. These are page-weighted
means; Braintrust averages pages within each document before averaging cases.
Mean model latency: 6.906 s/page; wall time: 174.390 s.
Input: 224,280 tokens, including 10,668 cached tokens; output: 49,964 tokens.
Estimated baseline cost: **$0.9279**. This is a token-based estimate, not an invoice.

Cost uses standard short-context rates of $2/M input, $0.10/M cached input and
$10/M output, checked on 2026-11-18 against
[OpenAI pricing](https://developers.openai.com/api/docs/pricing).

## Metrics and thresholds

| Stage | Metric                    | Gate vs score               | Threshold               | Why                                           |
| ----- | ------------------------- | --------------------------- | ----------------------- | --------------------------------------------- |
| OCR   | CER                       | Score with regression guard | <= 0.00129366106080207  | Largest page CER observed in the baseline     |
| OCR   | WER                       | Score with regression guard | <= 0.008771929824561403 | Largest page WER observed in the baseline     |
| OCR   | Block-kind accuracy       | Score with regression guard | >= 1                    | Lowest page accuracy observed in the baseline |
| OCR   | Box IoU                   | Score with regression guard | >= 0.6686833755797957   | Lowest page IoU observed in the baseline      |
| OCR   | Runtime / schema validity | Gate                        | All cases succeed       | Invalid output cannot be consumed safely      |

The checked-in `packages/ai/evals/ocr-baseline.json` contains the unrounded
observed per-page envelope. Scores outside it fail `pnpm eval`; these are
empirical regression thresholds, not clinical acceptance targets or calibrated
confidence bounds. One run does not establish model variance. Aggregate means
above remain the baseline for experiment comparisons.

CER and WER normalize whitespace while preserving punctuation and case. Block
metrics use monotonic text-edit alignment, independent of generated IDs; extra
or missing blocks score zero. Braintrust displays 1-CER and 1-WER clamped to
0..1; local reports retain the unbounded error rates. Continuation-link accuracy
is not scored. Each page is read independently, so `continues` is currently null
in model output; ground truth retains links for later document-level stages.

## Experiment log

| Experiment                                | Pages | CER       | WER       | Box IoU  | Wall time | Estimated cost |
| ----------------------------------------- | ----- | --------- | --------- | -------- | --------- | -------------- |
| Clinical-01 pilot, both variants, 144 DPI | 4     | 0.000000% | 0.000000% | 0.727451 | 8.913 s   | $0.0488        |
| Full baseline, 144 DPI                    | 84    | 0.001540% | 0.010443% | 0.720600 | 174.390 s | $0.9279        |
| Scanned clinical-01, 216 DPI              | 2     | 0.000000% | 0.000000% | 0.713168 | 7.599 s   | $0.0334        |

No prompt iterations were made. On the same two scanned clinical-01 pages,
144 DPI produced CER/WER 0 and IoU 0.727417; 216 DPI produced CER/WER 0 and
IoU 0.713168. Keep 144 DPI: the higher resolution showed no text benefit and
used 11,100 input tokens versus 5,340. This two-page comparison does not establish
equivalence on harder scans.

## Scope and reproduction

Generate fixtures with `node packages/ai/scripts/generate-synthetic.ts`.
`pnpm eval` runs all stage suites; `pnpm eval:ocr` or `pnpm eval ocr` selects OCR.
For the resolution comparison:

```sh
EVAL_FIXTURE=clinical-01 EVAL_VARIANT=scanned EVAL_DPI=216 pnpm eval:ocr
```

There are six short clinical fixtures (2, 3, 1, 4, 5 and 2 pages), two consent
fixtures (1 and 2 pages), a fax cover and invoice (1 page each), and the
20-page clinical benchmark. Every fixture has clean and image-only scanned PDFs
and schema-validated ground truth. Clinical-06, consent-02 and invoice-01 are
held out from tuning. Private files are excluded by the fixed synthetic loader.

This small templated corpus has limited layout, identity and scan diversity.
Its near-zero transcription error does not predict performance on real records.
Braintrust upload is configured but unverified without a key. Local JSON reports
in `packages/ai/evals/results/` contain only IDs, scores, counts and timings and
are gitignored. OCR remains outside the workflow.
