# OCR output is stored as Blob artifacts, not database rows

OCR blocks are written as one JSON file per document in private Blob storage, not as rows in a `blocks` table. Nothing queries across blocks: observations, redactions and note chunks copy the page, block ID and box they cite, and blocks that continue across pages are linked inside the file. The file holds unredacted text, so it is encrypted and deleted when review ends; what remains are the published redacted pages and the rows derived from them.
