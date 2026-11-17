# Clinical record ingestion

Turns uploaded clinical documents into redacted, reviewable, patient-linked clinical data.

## Documents

**Document**:
One uploaded file (PDF or image) and everything derived from it.
_Avoid_: File, upload, record

**Document class**:
The kind of document: clinical, consent, or other. Only clinical documents yield observations.
_Avoid_: Type, category

**Discard**:
Ending a document's review without accepting it, for example a duplicate upload or the wrong patient. A discarded document contributes no data.
_Avoid_: Delete, reject

**Review**:
The period after processing in which a person resolves flagged redactions, observations and the patient link before marking the document as reviewed or discarding it.
_Avoid_: Approval, QA

**Reviewed**:
The final state of a document after a person marks it as reviewed. A reviewed document is read-only.
_Avoid_: Approved, signed, completed

**Redaction**:
A region of a page whose content is hidden from every derived artifact, either detected automatically or drawn by a reviewer. A redaction is applied, needs review, accepted, or rejected.
_Avoid_: PII finding, detection, mask

## Patients

**Patient**:
The person a document is about, identified only by keyed hashes of identifiers plus initials, sex, and birth year.

**Patient link**:
The association between a document and a patient. It is proposed automatically on a strong identifier match and can be changed until the document is reviewed.
_Avoid_: Assignment, mapping

**Identity mismatch**:
A document whose identifiers only partly match its linked patient. It must be resolved before the document can be reviewed.

## Clinical data

**Observation**:
One clinical fact stated in a document (a lab result, vital sign, symptom, or adverse event), with its value, date, and source region.
_Avoid_: Finding, fact, data point

**Removed observation**:
An observation hidden because a redaction covers it. It returns if that redaction is rejected.

**Duplicate observation**:
The same observation stated more than once in one document for the same date. Observations in different documents are never duplicates of each other.
