# Stage evaluations

## OCR baseline

Measured 2026-11-18 with `gpt-6.1-sol`, `ocr-v1`, `synthetic-v2`, at 144 DPI.
Git SHA: `b205692f30ba8860fef453baf026c69856549355` with uncommitted task changes.
Braintrust experiment (private to the organization):
[ocr-ocr-v1-144-1795037248695](https://www.braintrust.dev/app/Simo/p/ade-document-stages/experiments/ocr-ocr-v1-144-1795037248695).

| Subset                | Pages | CER    | WER    | Block-kind accuracy | Box IoU |
| --------------------- | ----- | ------ | ------ | ------------------- | ------- |
| clean / development   | 37    | 0.000% | 0.000% | 100.00%             | 0.714   |
| clean / held-out      | 5     | 0.000% | 0.000% | 100.00%             | 0.712   |
| scanned / development | 37    | 0.020% | 0.132% | 100.00%             | 0.718   |
| scanned / held-out    | 5     | 0.025% | 0.172% | 100.00%             | 0.702   |
| all / all             | 84    | 0.010% | 0.068% | 100.00%             | 0.715   |

All 22 document/variant cases passed, covering 84 pages. These are page-weighted
means; Braintrust averages pages within each document before averaging cases.
The worst page was the fax (scan severity about 1): CER 0.16%, WER 1.08%.
Mean model latency: 8.647 s/page; wall time: 219.527 s.
Input: 224,280 tokens, including 5,334 cached tokens; output: 65,373 tokens.
Estimated cost: **$1.0922**. This is a token-based estimate, not an invoice.

Cost uses standard short-context rates of $2/M input, $0.10/M cached input and
$10/M output, checked on 2026-11-18 against
[OpenAI pricing](https://developers.openai.com/api/docs/pricing).

## OCR candidate: `gpt-6-luna`

Measured 2026-11-18 with `gpt-6-luna` (`models.fast`), `ocr-v1`, `synthetic-v2`,
at 144 DPI. Git SHA: `e620c0230ba76c4ab46cc483114d22a1c13009fe` with
uncommitted task changes. Braintrust experiment (private to the organization):
[ocr-gpt-6-luna-ocr-v1-144-1795040634365](https://www.braintrust.dev/app/Simo/p/ade-document-stages/experiments/ocr-gpt-6-luna-ocr-v1-144-1795040634365).

| Subset                | Pages | CER     | WER     | Block-kind accuracy | Box IoU | Latency/page | Cost/page |
| --------------------- | ----- | ------- | ------- | ------------------- | ------- | ------------ | --------- |
| clean / development   | 37    | 3.324%  | 4.089%  | 95.49%              | 0.647   | 9.265 s      | $0.00082  |
| clean / held-out      | 5     | 11.052% | 12.414% | 92.00%              | 0.601   | 8.297 s      | $0.00073  |
| scanned / development | 37    | 2.344%  | 3.560%  | 97.53%              | 0.601   | 11.638 s     | $0.00097  |
| scanned / held-out    | 5     | 7.769%  | 9.637%  | 91.56%              | 0.554   | 9.844 s      | $0.00083  |
| all / all             | 84    | 3.617%  | 4.682%  | 95.95%              | 0.618   | 10.287 s     | $0.00088  |

All 22 cases ran without runtime or schema failures, but the suite failed the
clean ceilings: clean page-mean CER 4.24% (ceiling 1%) and WER 5.08% (ceiling
3%). Scanned CER 2.99% and WER 4.28% are within their ceilings. Errors are
concentrated: nine pages score 26-28% CER, while most pages stay near zero.
Input was 224,280 tokens (5,334 cached), the same as the baseline; output was
104,514 tokens. Estimated cost: **$0.0742** ($0.00088/page against $0.0130/page
for `gpt-6.1-sol`). Wall time: 264.746 s.

Decision: OCR keeps `models.pipeline` (`gpt-6.1-sol`), because `gpt-6-luna`
fails the clean CER and WER gates despite costing about 15x less per page.

## Metrics and thresholds

| Stage | Metric                    | Gate or score | Threshold                | Why                                                                                     |
| ----- | ------------------------- | ------------- | ------------------------ | --------------------------------------------------------------------------------------- |
| OCR   | Runtime / schema validity | Gate          | All cases succeed        | Invalid output cannot be consumed safely.                                               |
| OCR   | CER, clean                | Gate          | Page mean <= 1%          | Digital text should transcribe almost exactly; 1% is about one wrong value per page.    |
| OCR   | CER, scanned              | Gate          | Page mean <= 3%          | Typical scanned-document OCR tolerance; above it, identifiers and values become unsafe. |
| OCR   | WER, clean                | Gate          | Page mean <= 3%          | One character error spoils a whole word, so WER runs about 3x CER.                      |
| OCR   | WER, scanned              | Gate          | Page mean <= 9%          | The same 3x ratio applied to the scanned CER ceiling.                                   |
| OCR   | Block-kind accuracy       | Score         | Target >= 95%, not gated | Kinds for stamps and captions are partly judgment calls; a miss does not lose text.     |
| OCR   | Box IoU                   | Score         | None                     | Model boxes are approximate; tight boxes will come from Tesseract later.                |
| OCR   | PII word-box coverage     | Score         | None                     | Share of each ground-truth PII box covered by the provider's matched word boxes.        |
| OCR   | PII word-box precision    | Score         | None                     | 1 minus over-coverage: share of matched word-box area inside the PII box.               |
| OCR   | Cost per page             | Metric        | None                     | Token-based estimate from the dated price table in `packages/ai/evals/prices.ts`.       |

Ceilings are fixed tolerances, not observed envelopes, so normal run-to-run
variation does not fail the suite. They apply to the page mean of each variant
in the selected run (`ocrCeilings` in `packages/ai/evals/scorers/ocr.ts`); a
focused run applies them to its selected pages only. Compare a candidate with
the baseline experiment in Braintrust rather than against a checked-in file.

CER and WER normalize whitespace while preserving punctuation and case. Block
metrics use monotonic text-edit alignment, independent of generated IDs; extra
or missing blocks score zero. CER and WER compare the page text joined in
reading order, so a swapped block order costs as much as misread text.
PII word-box metrics apply only to providers that return words; the LLM
providers return none, so they log null and are excluded from the aggregate.
Each ground-truth PII span (`box` for clean, `scannedBox` for scanned) is
matched to the shortest reading-order word runs whose whitespace-normalized
text contains the span text; when the text repeats, the run covering most of
the span box wins. Coverage is the area of the span box inside the union of the
run's word boxes divided by the span box area; over-coverage is the share of the
union outside the span box. Unmatched spans score zero coverage and are left
out of the over-coverage mean.
Braintrust displays 1-CER and 1-WER clamped to 0..1; local reports retain the
unbounded error rates. Continuation-link accuracy is not scored. Each page is
read independently, so `continues` is currently null in model output; ground
truth retains links for later document-level stages.

## Experiment log

| #   | Experiment                                   | Pages | CER       | WER       | Box IoU  | Wall time | Estimated cost |
| --- | -------------------------------------------- | ----- | --------- | --------- | -------- | --------- | -------------- |
| -   | Clinical-01 pilot, both variants, 144 DPI    | 4     | 0.000000% | 0.000000% | 0.727451 | 8.913 s   | $0.0488        |
| 1   | Full baseline, `synthetic-v1`, 144 DPI       | 84    | 0.001540% | 0.010443% | 0.720600 | 174.390 s | $0.9279        |
| -   | Scanned clinical-01, `synthetic-v1`, 216 DPI | 2     | 0.000000% | 0.000000% | 0.713168 | 7.599 s   | $0.0334        |
| -   | Fax-01 pilot, `synthetic-v2`, 144 DPI        | 2     | 6.07%     | 4.84%     | 0.579    | 13.938 s  | $0.0257        |
| 2   | Full baseline, `synthetic-v2`, 144 DPI       | 84    | 0.010%    | 0.068%    | 0.715    | 219.527 s | $1.0922        |
| 3   | `gpt-6-luna`, `synthetic-v2`, 144 DPI        | 84    | 3.617%    | 4.682%    | 0.618    | 264.746 s | $0.0742        |

Experiment 1 was replaced because its monospaced, single-column, near-pristine
pages saturated every metric, so no prompt change could register. It ran
locally without Braintrust upload.

The fax-01 pilot exposed a ground-truth convention error, not a model error:
left and right header runs on one printed row were joined into one line, while
the model read the left block before the right. Split headers and footers are
now separate blocks. Experiment 2 is uploaded to Braintrust. No prompt
iterations were made: scores were near zero error, leaving no prompt problem
to fix.

## Scope and reproduction

Generate fixtures with `node packages/ai/scripts/generate-synthetic.ts`.
`pnpm eval` runs all stage suites; `pnpm eval:ocr` or `pnpm eval ocr` selects OCR.
`EVAL_OCR_PROVIDER` selects the provider arm (`gpt-6.1-sol` by default, or
`gpt-6-luna`). For a focused run:

```sh
EVAL_FIXTURE=clinical-01 EVAL_VARIANT=scanned EVAL_DPI=216 pnpm eval:ocr
```

There are six short clinical fixtures (2, 3, 1, 4, 5 and 2 pages), two consent
fixtures (1 and 2 pages), a fax cover and invoice (1 page each), and the
20-page clinical benchmark. Every fixture has clean and image-only scanned PDFs
and schema-validated ground truth. Clinical-06, consent-02 and invoice-01 are
held out from tuning. Private files are excluded by the fixed synthetic loader.

`synthetic-v2` pages mix Helvetica, Times and Courier at 7 to 14 pt. Clinical
pages use one of three seeded layouts: a single column with a ruled table and
a review stamp, two columns with an unruled lab table, or a dense unruled
ten-row panel at 7.5 pt. Result columns are right-aligned. Headers and footers
vary per fixture. Scans apply seeded per-page severity: 1 to 3 degree skew,
reduced contrast, gray noise and salt-and-pepper speckle, fax-style banding,
vertical streaks, blur, downsampling to 75-115 DPI and JPEG quality 30-70.
Fax-01 and clinical-03 are the worst pages. Ground-truth boxes follow the skew.

Even so, OCR error stays near zero, so the scanned set still does not
discriminate between prompts. This small templated corpus has limited
layout, identity and scan diversity. Its transcription error does not predict
performance on real records. Local JSON reports in `packages/ai/evals/results/`
contain only IDs, scores, counts and timings and are gitignored. OCR remains
outside the workflow.
