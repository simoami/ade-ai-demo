# Redact direct identifiers, keep clinical dates

Redaction removes direct identifiers (names, medical record and other ID numbers, full date of birth, address, phone, email, SSN, and facility or provider names) but keeps encounter and observation dates, because date-aware observation history is the core of the product. The output is therefore not de-identified under HIPAA Safe Harbor (45 CFR 164.514(b)(2)), which requires removing every date element except the year. From date of birth only the birth year is kept, and following Safe Harbor, ages over 89 collapse into a single "90 or older" category with no birth year stored, because very old patients are few enough to be identifiable.

## Considered options

- Full Safe Harbor with date shifting: rejected; it adds a per-patient offset subsystem and makes source documents disagree with the extracted data.
