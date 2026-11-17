# Review events live in Postgres

Every human review action (redaction decisions, observation corrections, patient link changes, discard, mark as reviewed) is appended to a `review_events` table in the application database. A production system handling PHI would send these to dedicated, append-only audit storage (for example OpenSearch or a WORM log store) with its own retention and access controls. This demo keeps them in Postgres to avoid a second datastore; the table is insert-only by convention, not by enforcement.
