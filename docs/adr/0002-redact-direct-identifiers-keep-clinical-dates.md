# Redact direct identifiers, keep clinical dates

Redaction removes direct identifiers (names, medical record and other ID numbers, full date of birth, address, phone, email, SSN, and facility or provider names) but keeps encounter and observation dates, because date-aware observation history is the core of the product. The output is therefore not de-identified under HIPAA Safe Harbor (45 CFR 164.514(b)(2)), which requires removing every date element except the year. From date of birth only the birth year is kept, and following Safe Harbor, ages over 89 collapse into a single "90 or older" category with no birth year stored, because very old patients are few enough to be identifiable.

Pictures are judged by what they identify, not by whether they show a face. A patient photo, a face placed with the patient's name or date of birth, is redacted. Other faces (clinician portraits, staff badges) are kept, and a face whose owner is unclear becomes a redaction that needs review. Logos, medical images and clinical photos without a face are kept, but any identifier printed inside them, such as a name or MRN burned into an X-ray, is redacted like page text. Every signature is redacted, whoever signed, because it renders a name; the fact and date of signing are kept.

## Considered options

- Full Safe Harbor with date shifting: rejected; it adds a per-patient offset subsystem and makes source documents disagree with the extracted data.
- Redact every face: rejected; clinician portraits are not patient identifiers, and judging ownership by proximity to the patient's name and date of birth keeps them while sending unclear cases to review.
