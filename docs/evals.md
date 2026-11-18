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

Ceilings are fixed tolerances, not observed envelopes, so normal run-to-run
variation does not fail the suite. They apply to the page mean of each variant
in the selected run (`ocrCeilings` in `packages/ai/evals/scorers/ocr.ts`); a
focused run applies them to its selected pages only. Compare a candidate with
the baseline experiment in Braintrust rather than against a checked-in file.

CER and WER normalize whitespace while preserving punctuation and case. Block
metrics use monotonic text-edit alignment, independent of generated IDs; extra
or missing blocks score zero. CER and WER compare the page text joined in
reading order, so a swapped block order costs as much as misread text.
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
For a focused run:

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
