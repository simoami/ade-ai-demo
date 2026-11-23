# Stage evaluations

## OCR scorecard

Measured 2026-11-19 on `synthetic-v3` (96 pages: 16 fixtures, clean and
scanned) at 144 DPI. LLM and Datalab rows ran at `b09d61f` plus the
`synthetic-v3` changes; Reducto rows at `71d14e9`, with word citations for `r-1`.
Every arm passed all 32 cases and the CER and WER ceilings.

| Arm                      | CER    | WER    | Block kind | Box IoU | Reading order | PII word boxes coverage / precision | Latency/page | Cost/page | Experiment                                                                                                                      |
| ------------------------ | ------ | ------ | ---------- | ------- | ------------- | ----------------------------------- | ------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `gpt-6.1-sol`, `ocr-v3`  | 0.012% | 0.082% | 99.74%     | 0.711   | 1.000         | no words                            | 9.30 s       | $0.01320  | [sol](https://www.braintrust.dev/app/Simo/p/ade-document-stages/experiments/ocr-gpt-6.1-sol-ocr-v3-144-1795068667095)           |
| `datalab-balanced`       | 0.284% | 0.853% | 92.03%     | 0.741   | 0.997         | 0.823 / 0.964                       | 8.49 s       | $0.00600  | [datalab](https://www.braintrust.dev/app/Simo/p/ade-document-stages/experiments/ocr-datalab-balanced-ocr-v2-144-1795068297742)  |
| `reducto-r-1`, citations | 0.186% | 0.216% | 77.30%     | 0.502   | 0.999         | 0.687 / 0.968                       | 2.24 s       | $0.01000  | [r-1](https://www.braintrust.dev/app/Simo/p/ade-document-stages/experiments/ocr-reducto-r-1-ocr-v3-144-1795117014042)           |
| `reducto-r-1-mini`       | 0.198% | 0.303% | 77.29%     | 0.490   | 0.999         | no words                            | 1.40 s       | $0.00100  | [r-1-mini](https://www.braintrust.dev/app/Simo/p/ade-document-stages/experiments/ocr-reducto-r-1-mini-ocr-v3-144-1795116546074) |

| Arm                      | Clean CER / WER | Scanned CER / WER | Held-out CER / WER |
| ------------------------ | --------------- | ----------------- | ------------------ |
| `gpt-6.1-sol`, `ocr-v3`  | 0.000% / 0.000% | 0.024% / 0.164%   | 0.031% / 0.216%    |
| `datalab-balanced`       | 0.243% / 0.436% | 0.326% / 1.270%   | 0.144% / 0.510%    |
| `reducto-r-1`, citations | 0.179% / 0.169% | 0.193% / 0.262%   | 0.010% / 0.072%    |
| `reducto-r-1-mini`       | 0.189% / 0.239% | 0.207% / 0.367%   | 0.010% / 0.072%    |

Figures found (output figure at box IoU 0.5 or more), summed over clean and
scanned pages:

| Figure kind     | Redaction    | `gpt-6.1-sol` | `datalab-balanced` | Reducto (both) |
| --------------- | ------------ | ------------- | ------------------ | -------------- |
| Patient photo   | redact       | 2/2           | 2/2                | 2/2            |
| Face            | keep, review | 4/4           | 4/4                | 4/4            |
| Signature       | redact       | 5/6           | 0/6                | 0/6            |
| Logo            | keep         | 2/2           | 2/2                | 2/2            |
| Icon            | keep         | 12/12         | 0/12               | 0/12           |
| Medical image   | keep         | 2/2           | 2/2                | 2/2            |
| Clinical photo  | keep         | 2/2           | 2/2                | 2/2            |
| **Recall**      |              | **29/30**     | **12/30**          | **12/30**      |
| **Precision**   |              | **29/30**     | **12/12**          | **12/12**      |
| Burned-in label |              | 6/6 strings   | 6/6 strings        | 6/6 strings    |

Findings:

- Both arms read the name, MRN and date of birth burned into the X-ray pixels.
  Datalab returns that text in the picture's `img-desc` paragraph without word
  boxes, so a burned-in identifier can be found but not located below the
  picture box.
- Datalab detects photos, logos and medical images, but transcribes signatures
  as plain text blocks and outline icons as emoji. Signature text is the
  signer's name, so text PII detection still sees it, but the signature region
  is not a figure. That extra text and the emoji explain its higher CER on
  `consent-03` (8.6%) and `intake-01` (1.6%).
- Reducto finds the same figures as Datalab: photos, faces, logos and
  medical images, but no signatures or icons. Signatures arrive inside
  key-value blocks as the signer's name. It returns block boxes only, no word
  boxes, and splits lists into one block per item, which lowers block-kind
  accuracy and box IoU against whole-list ground truth.
- With `return_citations`, `r-1` returns a box for every word, including
  table cells; `r-1-mini` does not support citations. Its word boxes are
  tighter than Datalab's (PII coverage 0.687 against 0.823, precision 0.968
  against 0.964), which the same 1.25 em ground-truth convention explains.
- Reducto is the fastest arm (1.3-1.4 s/page). `r-1-mini` matches `r-1` on
  this set at a tenth of the list price ($0.001/page).
- `gpt-6.1-sol` with `ocr-v3` finds every figure kind; its one miss is a
  scanned signature whose box overlaps the ground truth below IoU 0.5.
- Datalab's lower block-kind accuracy is the same labelling difference as on
  `synthetic-v2`: review stamps become paragraphs.
- PII word-box coverage of 0.82 reflects the ground-truth box convention:
  span boxes cover the full 1.25 em line height and inter-word spaces, while
  word boxes hug the glyphs.

Decision: OCR uses `reducto-r-1` with word citations (`defaultOcrProvider`).
It matches the LLM arms on text within the ceilings, returns layout blocks and
word boxes in one call, and is about four times faster at $0.01/page. Its
missed signatures and icons are covered by the picture pass, and Tesseract
supplies character boxes for redaction, so neither depends on the OCR vendor.
The provider is re-evaluated as fixtures and real-world failures are added.

## Identifier detection and picture decisions

`pii-v1`, `gpt-6.1-sol`, `synthetic-v3`: ten clean development pages, using
ground-truth OCR text and figure boxes. DOB truth is projected to month/day;
birth years and encounter dates are retained. The total counts characters
hidden at the correct page, block and offset regardless of category; category
rows also require the category. All eight cases completed without
runtime/schema failures. [Experiment](https://www.braintrust.dev/app/Simo/p/ade-document-stages/experiments/pii-pii-v1-1795193806105).

| Category or metric  | Character recall | Character precision | Picture accuracy |
| ------------------- | ---------------- | ------------------- | ---------------- |
| name                | 100.00%          | 97.33%              | —                |
| dob                 | 100.00%          | 100.00%             | —                |
| id                  | 100.00%          | 100.00%             | —                |
| address             | 100.00%          | 100.00%             | —                |
| phone               | 100.00%          | 100.00%             | —                |
| email               | unmeasured       | unmeasured          | —                |
| ssn                 | unmeasured       | unmeasured          | —                |
| facility            | 100.00%          | 93.42%              | —                |
| provider            | 90.84%           | 100.00%             | —                |
| **All identifiers** | **100.00%**      | **98.51%**          | —                |
| Picture decisions   | —                | —                   | **12/12 (100%)** |

`pnpm eval pii` passes its minimums: 99% recall, 95% precision and every
picture decision. Provider's lower category recall is a labeling difference:
the consent witness is labeled `provider` in ground truth and `name` by the
model, and is hidden either way. The fixtures contain no email or SSN.
Identifiers inside pictures are validated, but their localization accuracy is
not scored. Ground-truth figures bypass OCR picture omissions; these results do
not measure end-to-end redaction. The local report contains metrics and
fixture IDs only at `packages/ai/evals/results/pii-latest.json`.

## Document classification

`classify-v1`, `gpt-6-luna`, `synthetic-v3`: all 16 fixtures (12 development,
4 held-out), one call per document over ground-truth OCR text blocks.
Measured 2026-11-20 at `9de3cf2` plus the step 4 changes; all 16 cases
completed. [Experiment](https://www.braintrust.dev/app/Simo/p/ade-document-stages/experiments/classify-classify-v1-1795199257786).

| Class                                  | Documents | Recall           | Precision     | Ceiling |
| -------------------------------------- | --------- | ---------------- | ------------- | ------- |
| clinical                               | 11        | 100%             | 100%          | —       |
| consent                                | 3         | 100%             | 100%          | —       |
| other                                  | 2         | 100%             | 100%          | —       |
| **Accuracy**                           | **16**    | **16/16 (100%)** | macro F1 1.00 | 100%    |
| Consent summaries naming an identifier | 3         | 0                | —             | 0       |

The class decides whether observations are extracted, so every document must
be classified correctly; with 16 documents any error is a regression. Consent
summaries are stored after review ends, so a summary containing any
ground-truth identifier text (names, MRN, DOB, facility, provider, contact
details; case-insensitive) fails the suite. Confidence is 0.99 or more except
consent-03 (0.91), the guardian-countersigned form. The set is small and
templated, so it does not discriminate between prompts. The local report holds
classes, confidences and leak flags only, never summaries, at
`packages/ai/evals/results/classify-latest.json`.

## Demographics and patient matching

`demographics-v1`, `gpt-6.1-sol`, `synthetic-v3`: the 14 clinical and consent
fixtures (11 development, 3 held-out), one call per document over
ground-truth OCR text blocks. Measured 2026-11-20 at `9de3cf2` plus the step 4
changes; all 14 cases completed. [Experiment](https://www.braintrust.dev/app/Simo/p/ade-document-stages/experiments/demographics-demographics-v1-1795199269535).

| Field or metric         | Result       | Ceiling |
| ----------------------- | ------------ | ------- |
| Last name               | 14/14 (100%) | >= 90%  |
| First name              | 14/14 (100%) | >= 90%  |
| Date of birth           | 14/14 (100%) | >= 90%  |
| MRN                     | 14/14 (100%) | >= 90%  |
| Match strength and link | 14/14 (100%) | —       |
| Wrong automatic links   | 0            | 0       |

Truth is the most frequent ground-truth `name` span (first token given name,
last token family name), the single `dob` span and the single `id` span.
Fields are compared as keyed hashes under a per-run random key, so values are
normalized exactly as linking normalizes them. Matching runs the production
rule against two patients built from fixtures: Bex from clinical-01, and Cora
from clinical-03 with a different birth date. Expected links are 8 strong to
Bex (MRN, or name and DOB), 1 strong to Cora (MRN), 3 partial to Cora (name
only) and 2 partial to Bex (Aven's documents share the corpus-wide birth
date). The set has no `none` case; unit tests cover it. A strong link attaches
a document to a patient without review, so any wrong strong link fails the
suite; a missed field only weakens the link and allows one miss in ten.
Consent-03 also names a guardian, who is correctly ignored. Fixtures do not
state sex, so sex is not scored (every output was `Unknown`). The local
report holds field correctness, match outcomes and sex only at
`packages/ai/evals/results/demographics-latest.json`.

## Observation extraction

`extract-v2` extracts labs, vitals, symptoms, adverse events, medical history
and medications using `gpt-6.1-sol`. The development suite covers clinical-01,
clinical-02, clinical-03 and clinical-followup; clinical-20 remains outside the
model suite for cost. Extraction receives ground-truth identifier-masked OCR.

Ground truth uses canonical systolic and diastolic blood pressure observations.
The follow-up uses separate SBP/DBP readings on March 10, medications, ongoing
hypertension and a serious dehydration event with a recovered outcome. It links
to PT-1042 alongside clinical-20 for cross-document trends.

Recall and precision match normalized name/value and exact date one-to-one;
unit accuracy and preferred-format deduplication are scored separately. Field
accuracy checks kind and every expected detail, including lab bounds and flags,
AE seriousness/outcome/ongoing, medication route/frequency and history dates.
Ceilings are 95% recall, precision, field accuracy and deduplication accuracy,
and 98% unit accuracy. New prompt scores require a model-backed run; prior
prompt measurements do not validate this prompt.

Pure unit tests cover range parsing, printed flag precedence, both BP formats,
stable component IDs, seriousness and medication numeric doses. Note indexing
tests use a fake embedder to verify identifier masking, chunk limits, source
regions, stable IDs, embedding validation and replacement after success only.
No API keys are needed for these tests.

## Metrics and thresholds

| Stage | Metric                    | Gate or score | Threshold                | Why                                                                                      |
| ----- | ------------------------- | ------------- | ------------------------ | ---------------------------------------------------------------------------------------- |
| OCR   | Runtime / schema validity | Gate          | All cases succeed        | Invalid output cannot be consumed safely.                                                |
| OCR   | CER, clean                | Gate          | Page mean <= 1%          | Digital text should transcribe almost exactly; 1% is about one wrong value per page.     |
| OCR   | CER, scanned              | Gate          | Page mean <= 3%          | Typical scanned-document OCR tolerance; above it, identifiers and values become unsafe.  |
| OCR   | WER, clean                | Gate          | Page mean <= 3%          | One character error spoils a whole word, so WER runs about 3x CER.                       |
| OCR   | WER, scanned              | Gate          | Page mean <= 9%          | The same 3x ratio applied to the scanned CER ceiling.                                    |
| OCR   | Block-kind accuracy       | Score         | Target >= 95%, not gated | Kinds for stamps and captions are partly judgment calls; a miss does not lose text.      |
| OCR   | Box IoU                   | Score         | None                     | Block geometry quality; LLM boxes are approximate, layout-model boxes are tighter.       |
| OCR   | Reading order             | Score         | None                     | Share of matched block pairs in ground-truth order; multi-column order is ambiguous.     |
| OCR   | Figure recall             | Score         | None                     | Share of ground-truth pictures found at box IoU >= 0.5; unfound pictures go unredacted.  |
| OCR   | Figure precision          | Score         | None                     | Share of output figure blocks that match a picture; extras hide text from transcription. |
| OCR   | Burned-in recall          | Score         | None                     | Share of identifiers printed inside images found anywhere in the page output text.       |
| OCR   | PII word-box coverage     | Score         | None                     | Share of each ground-truth PII box covered by the provider's matched word boxes.         |
| OCR   | PII word-box precision    | Score         | None                     | 1 minus over-coverage: share of matched word-box area inside the PII box.                |
| OCR   | Cost per page             | Metric        | None                     | Token estimate from `packages/ai/evals/prices.ts`, or the cost a vendor API reports.     |

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
| 8   | `gpt-6.1-sol`, `ocr-v2`, `synthetic-v3`      | 96    | 0.590%    | 0.579%    | 0.693    | 321.1 s   | $1.2437        |
| 9   | `datalab-balanced`, `synthetic-v3`           | 96    | 0.284%    | 0.853%    | 0.741    | 252.0 s   | $0.5760        |
| 10  | `gpt-6.1-sol`, `ocr-v3`, `synthetic-v3`      | 96    | 0.012%    | 0.082%    | 0.711    | 287.5 s   | $1.2668        |
| -   | Reducto r-1 and r-1-mini, first runs         | 96    | 2.98%     | 19.5%     | 0.50     | 74 s      | $1.0560        |
| 11  | `reducto-r-1`, `synthetic-v3`                | 96    | 0.222%    | 0.264%    | 0.501    | 49 s      | $0.9600        |
| 12  | `reducto-r-1-mini`, `synthetic-v3`           | 96    | 0.198%    | 0.303%    | 0.490    | 50 s      | $0.0960        |
| 13  | `reducto-r-1` with word citations            | 96    | 0.186%    | 0.216%    | 0.502    | 76 s      | $0.9600        |

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

Experiments 4 to 7 compared four arms on `synthetic-v2`, where all four passed
the ceilings: `gpt-6.1-sol` (0.028% CER, $0.0132/page), `gpt-6-luna` (0.571%,
$0.0009/page), and Datalab balanced and accurate (0.060% and 0.055%, $0.0039
and $0.0077/page). Accurate mode cost twice as much for no measurable gain, so
it was not rerun on `synthetic-v3`. Experiments:
[4](https://www.braintrust.dev/app/Simo/p/ade-document-stages/experiments/ocr-gpt-6.1-sol-ocr-v1-144-1795055423654),
[5](https://www.braintrust.dev/app/Simo/p/ade-document-stages/experiments/ocr-gpt-6-luna-ocr-v1-144-1795055650760),
[6](https://www.braintrust.dev/app/Simo/p/ade-document-stages/experiments/ocr-datalab-balanced-ocr-v1-144-1795055423654) and
[7](https://www.braintrust.dev/app/Simo/p/ade-document-stages/experiments/ocr-datalab-accurate-ocr-v1-144-1795055623276).

`synthetic-v3` added pictures and signatures, and prompt `ocr-v2` added figure
blocks. In experiment 8, `gpt-6.1-sol` typed the boxed review stamp as a figure
on 15 pages, which removed its text from transcription (3.7-3.8% CER on those
pages) and gave 16 unmatched figures. Prompt `ocr-v3` states that text stamps
are `other` blocks; experiment 10 has no unmatched figures. The Datalab arm
ignores the prompt, so experiment 9 carries the `ocr-v2` label without effect.
Experiment 8: [sol ocr-v2](https://www.braintrust.dev/app/Simo/p/ade-document-stages/experiments/ocr-gpt-6.1-sol-ocr-v2-144-1795068297742).

The first Reducto runs failed the WER ceilings at about 19.5% with 3% CER:
Reducto returns tables as HTML, and stripping tags joined adjacent cells into
one word. The shared HTML-to-text step now separates cells with spaces and
rows with line breaks. Reducto cost is the list price per page, since the API
reports pages but not cost. Experiment 11 ran without word citations; it scored
0.222% CER and 0.264% WER at 1.30 s/page. Experiment 13 enables them.

## Scope and reproduction

Generate fixtures with `node packages/ai/scripts/generate-synthetic.ts`.
`pnpm eval` runs all stage suites; `pnpm eval:ocr` or `pnpm eval ocr` selects OCR.
`EVAL_OCR_PROVIDER` selects the provider arm: `reducto-r-1` (default),
`gpt-6.1-sol`, `gpt-6-luna`, `datalab-balanced`, `datalab-accurate` or
`reducto-r-1-mini`. Reducto arms require `REDUCTO_API_KEY`. Datalab arms require
`DATALAB_API_KEY` and send only synthetic fixtures. For a focused run:

```sh
EVAL_FIXTURE=clinical-01 EVAL_VARIANT=scanned EVAL_DPI=216 pnpm eval:ocr
```

There are seven short clinical fixtures (2, 3, 1, 4, 5, 2 and 1 pages),
two consent fixtures (1 and 2 pages), a fax cover and invoice (1 page each), the 20-page
clinical benchmark, and five picture fixtures: an intake form with a patient
photo and contact icons, a two-page referral with a logo, a captioned
clinician portrait, a two-column letter and an unlabeled face, a consent form
with patient, guardian and witness signatures, a radiology report whose X-ray
carries a burned-in name, MRN and date of birth, and a dermatology note with a
skin photo. Every fixture has clean and image-only scanned PDFs and
schema-validated ground truth. Clinical-06, consent-02, invoice-01 and skin-01
are held out from tuning. Private files are excluded by the fixed synthetic
loader.

Ground truth lists each picture with its kind, box and expected redaction
(`redact`, `keep` or `review`, per ADR 0002). Identifiers burned into image
pixels are PII spans that point at their figure instead of a text block.
Portraits, the X-ray and the skin photo were generated once with
`gpt-image-2.6-flare` and are listed with their prompts in
`fixtures/assets/manifest.json`; no image depicts a real person. Logos and
icons are vector paths, and signatures use the OFL-licensed Dancing Script
font.

`synthetic-v3` pages mix Helvetica, Times and Courier at 7 to 14 pt. Clinical
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

Local baseline (2026-11-23): recall@4 1.00 (10/10 questions; 31 chunks).
