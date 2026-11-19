# Stage evaluations

## OCR scorecard

Measured 2026-11-19 on `synthetic-v2` at 144 DPI with prompt `ocr-v1` for the
LLM arms. Git SHA `1c8975190bc584915f0737442e5ccbadd9de5fc2` plus the
uncommitted scorer and Datalab changes. Every arm passed all 22 cases and the
CER and WER ceilings.

| Arm                | CER    | WER    | Block kind | Box IoU | Reading order | PII word-box coverage / precision | Latency/page | Cost/page | Experiment                                                                                                                      |
| ------------------ | ------ | ------ | ---------- | ------- | ------------- | --------------------------------- | ------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `gpt-6.1-sol`      | 0.028% | 0.126% | 99.85%     | 0.713   | 1.000         | no words                          | 8.82 s       | $0.01315  | [sol](https://www.braintrust.dev/app/Simo/p/ade-document-stages/experiments/ocr-gpt-6.1-sol-ocr-v1-144-1795055423654)           |
| `gpt-6-luna`       | 0.571% | 1.142% | 98.37%     | 0.653   | 0.986         | no words                          | 10.41 s      | $0.00090  | [luna](https://www.braintrust.dev/app/Simo/p/ade-document-stages/experiments/ocr-gpt-6-luna-ocr-v1-144-1795055650760)           |
| `datalab-balanced` | 0.060% | 0.563% | 91.94%     | 0.748   | 0.996         | 0.822 / 0.964                     | 8.35 s       | $0.00386  | [balanced](https://www.braintrust.dev/app/Simo/p/ade-document-stages/experiments/ocr-datalab-balanced-ocr-v1-144-1795055423654) |
| `datalab-accurate` | 0.055% | 0.515% | 92.12%     | 0.749   | 0.996         | 0.822 / 0.964                     | 8.68 s       | $0.00771  | [accurate](https://www.braintrust.dev/app/Simo/p/ade-document-stages/experiments/ocr-datalab-accurate-ocr-v1-144-1795055623276) |

| Arm                | Clean CER / WER | Scanned CER / WER | Held-out CER / WER |
| ------------------ | --------------- | ----------------- | ------------------ |
| `gpt-6.1-sol`      | 0.017% / 0.031% | 0.040% / 0.222%   | 0.012% / 0.086%    |
| `gpt-6-luna`       | 0.674% / 1.436% | 0.469% / 0.847%   | 0.037% / 0.259%    |
| `datalab-balanced` | 0.008% / 0.056% | 0.112% / 1.070%   | 0.012% / 0.086%    |
| `datalab-accurate` | 0.008% / 0.056% | 0.102% / 0.974%   | 0.012% / 0.086%    |

Means are page-weighted over 84 pages; Braintrust averages pages within each
document before averaging cases. LLM cost is a token estimate at the rates in
`packages/ai/evals/prices.ts`; Datalab cost is the `final_cost_cents` the API
reports, with word boxes included.

Findings:

- All four arms transcribe the synthetic set within the ceilings, so text
  accuracy no longer separates them; cost, geometry and word boxes do.
- Datalab returns typed layout blocks, word boxes and per-word confidence in
  one call, at 29% of `gpt-6.1-sol`'s cost in balanced mode. Its block boxes
  are tighter (IoU 0.748 against 0.713).
- Datalab's lower block-kind accuracy is a labelling difference: it types
  review stamps as paragraphs, where ground truth uses `other`.
- Accurate mode costs twice as much as balanced mode for no measurable gain
  on this set.
- PII word-box coverage of 0.82 reflects the ground-truth box convention:
  span boxes cover the full 1.25 em line height and inter-word spaces, while
  word boxes hug the glyphs.

`gpt-6.1-sol` remains the default provider (`defaultOcrModel`).

## Metrics and thresholds

| Stage | Metric                    | Gate or score | Threshold                | Why                                                                                     |
| ----- | ------------------------- | ------------- | ------------------------ | --------------------------------------------------------------------------------------- |
| OCR   | Runtime / schema validity | Gate          | All cases succeed        | Invalid output cannot be consumed safely.                                               |
| OCR   | CER, clean                | Gate          | Page mean <= 1%          | Digital text should transcribe almost exactly; 1% is about one wrong value per page.    |
| OCR   | CER, scanned              | Gate          | Page mean <= 3%          | Typical scanned-document OCR tolerance; above it, identifiers and values become unsafe. |
| OCR   | WER, clean                | Gate          | Page mean <= 3%          | One character error spoils a whole word, so WER runs about 3x CER.                      |
| OCR   | WER, scanned              | Gate          | Page mean <= 9%          | The same 3x ratio applied to the scanned CER ceiling.                                   |
| OCR   | Block-kind accuracy       | Score         | Target >= 95%, not gated | Kinds for stamps and captions are partly judgment calls; a miss does not lose text.     |
| OCR   | Box IoU                   | Score         | None                     | Block geometry quality; LLM boxes are approximate, layout-model boxes are tighter.      |
| OCR   | Reading order             | Score         | None                     | Share of matched block pairs in ground-truth order; multi-column order is ambiguous.    |
| OCR   | PII word-box coverage     | Score         | None                     | Share of each ground-truth PII box covered by the provider's matched word boxes.        |
| OCR   | PII word-box precision    | Score         | None                     | 1 minus over-coverage: share of matched word-box area inside the PII box.               |
| OCR   | Cost per page             | Metric        | None                     | Token estimate from `packages/ai/evals/prices.ts`, or the cost a vendor API reports.    |

Ceilings are fixed tolerances, not observed envelopes, so normal run-to-run
variation does not fail the suite. They apply to the page mean of each variant
in the selected run (`ocrCeilings` in `packages/ai/evals/scorers/ocr.ts`); a
focused run applies them to its selected pages only. Compare a candidate with
the baseline experiment in Braintrust rather than against a checked-in file.

CER and WER normalize whitespace while preserving punctuation and case. Each
output block is first anchored to the expected block it overlaps most and the
output is reordered to match, so CER and WER measure transcription, not block
order. Reading order is scored separately as the share of anchored block pairs
that keep the expected order. Block metrics then use monotonic text-edit
alignment, independent of generated IDs; extra or missing blocks score zero.
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
| -   | Datalab balanced and accurate, first runs    | 84    | -         | -         | -        | -         | -              |
| 4   | `gpt-6.1-sol`, order-independent scorer      | 84    | 0.028%    | 0.126%    | 0.713    | 226.8 s   | $1.1050        |
| 5   | `gpt-6-luna`, order-independent scorer       | 84    | 0.571%    | 1.142%    | 0.653    | 261.5 s   | $0.0759        |
| 6   | `datalab-balanced` with word boxes           | 84    | 0.060%    | 0.563%    | 0.748    | 199.3 s   | $0.3240        |
| 7   | `datalab-accurate` with word boxes           | 84    | 0.055%    | 0.515%    | 0.749    | 231.7 s   | $0.6480        |

Experiment 1 was replaced because its monospaced, single-column, near-pristine
pages saturated every metric, so no prompt change could register. It ran
locally without Braintrust upload.

The fax-01 pilot exposed a ground-truth convention error, not a model error:
left and right header runs on one printed row were joined into one line, while
the model read the left block before the right. Split headers and footers are
now separate blocks. Experiment 2 is uploaded to Braintrust. No prompt
iterations were made: scores were near zero error, leaving no prompt problem
to fix.

Experiments 2 and 3 scored page text joined in reading order. Under that
scorer `gpt-6-luna` failed the clean ceilings (CER 4.24%, WER 5.08%), and
Datalab accurate mode scored 27% CER on two-column and dense pages. Inspecting
those pages showed correct text in a different block order: the right-column
lab table read before the left-column narrative. Experiments 4 to 7 use the
order-independent scorer, under which `gpt-6-luna` passes. Experiments 2 and 3
are public in Braintrust:
[2](https://www.braintrust.dev/app/Simo/p/ade-document-stages/experiments/ocr-ocr-v1-144-1795037248695) and
[3](https://www.braintrust.dev/app/Simo/p/ade-document-stages/experiments/ocr-gpt-6-luna-ocr-v1-144-1795040634365).

The first Datalab runs failed 14 of 22 cases on HTTP 429 rate limits, which
count status polls. The adapter now waits out `Retry-After` within its
per-page timeout.

## Scope and reproduction

Generate fixtures with `node packages/ai/scripts/generate-synthetic.ts`.
`pnpm eval` runs all stage suites; `pnpm eval:ocr` or `pnpm eval ocr` selects OCR.
`EVAL_OCR_PROVIDER` selects the provider arm: `gpt-6.1-sol` (default),
`gpt-6-luna`, `datalab-balanced` or `datalab-accurate`. Datalab arms require
`DATALAB_API_KEY` and send only synthetic fixtures. For a focused run:

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
