# Vitals as printed with LOINC codes

## Context

Renaming printed labels such as BP, BMI or Body Mass Index makes observations harder to locate on the page. Separating one blood pressure reading into two observations doubles its cards.

## Decision

Keep observation names as printed, including case and abbreviations. The extraction model assigns vital LOINC codes from a short prompt list: BP 85354-9, BMI 39156-5, heart rate 8867-4, respiratory rate 9279-1, temperature 8310-5, oxygen saturation 59408-5, height 8302-2 and weight 29463-7. Unknown codes remain absent.

BP is one panel with its printed label and combined value, mmHg unit and no scalar numeric value. Components carry systolic code 8480-6 and diastolic code 8462-4. Complementary readings on the same date within one document combine while retaining the first printed label and citation; a lone reading remains a panel with one component. Keep printed flags without computing component flags.

Trends group by code when present, otherwise exact printed name, and always keep units separate. Their title uses the most recent printed label. BP shows both component series together; chat can request either component. Details use existing jsonb storage, so no migration is needed.

## Why

One printed reading becomes one observation, and the outline matches its label and value directly. Codes group equivalent vitals across documents without changing source labels. Components preserve per-value trends and queries. FHIR models blood pressure as a panel with LOINC component codes.

## Considered options

- Separate systolic and diastolic observations: rejected; doubled cards and outlines that could not match the printed field.
- Canonicalize names for grouping: rejected; codes supply identity while printed labels preserve the source wording.
