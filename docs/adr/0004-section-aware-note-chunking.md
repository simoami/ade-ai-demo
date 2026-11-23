# Chunk clinical notes by section, with sentence splitting as the fallback

Note search embeds clinical notes as note chunks built from the document's own structure. Each note section (a heading and the blocks under it) becomes one chunk, and only a section too large for one chunk is split further, at block and then sentence boundaries. Clinical notes are written in conventional sections (chief complaint, history of present illness, assessment, plan), and clinicians ask questions in those terms. A chunk that follows a section answers the question on its own, and a chunk cut at an arbitrary length does not.

## Strategies considered

- **Fixed-size and recursive splitting** cut text by length, recursive splitting at paragraph or sentence boundaries. Neither knows about sections, so a heading ends up apart from its body and a rule apart from its exception ("unless eGFR is below 30"). A chunk read alone can then say the opposite of the note.
- **Sentence chunking** packs whole sentences up to a limit. It ignores sections too, and splitting on ". " breaks clinical abbreviations (`Dr.`, `mg.`, `b.i.d.`). We use it only as the fallback inside an oversized section, with abbreviation-safe splitting.
- **Semantic and LLM-based chunking** let embeddings or a model choose the boundaries. They need a model call per sentence or per document, and they can draw different boundaries each time the same note is re-indexed. Terse sections like vitals give similarity little to work with, and LLM rewriting loses the document's exact wording, which citations depend on.
- **Hierarchical (parent–child) chunking** matches small chunks and returns their parent. Note sections are already short, so child and parent would mostly be the same text.

Clinical headings already mark topic changes, and the OCR provides them, so structure-based chunking gets clean boundaries at no extra cost.

## How it is applied

- **Sections.** OCR heading blocks start a note section. A heading carries a level (the document title is level 1 and section headers are level 2; headings without a level default to 2), and each section records its section path, the headings from the title down, for example `CAR-T Screening Visit › Chief complaint`. A heading with no body emits no chunk; it remains in the path until a heading at the same or a higher level replaces it. Blocks before the first heading stay as separate chunks.
- **Headings stored apart from text.** A chunk stores its `section` path and its `text` body separately. The embedding input is built in code as `[section path]` followed by the body, so a query for "chief complaint" matches the heading even when the body never repeats it. The chat tool returns `section`, `text` and `page` as separate fields, so the model can tell heading from note text and cite the page, and the stored body never repeats the heading.
- **Pages.** A section continues across a page break, but every chunk is cut at the page, so each chunk cites one page and the second page's chunk keeps its section path.
- **Size and overlap.** Chunks target 2,000 characters, about 500 tokens. An indivisible sentence or table and its sentence overlap may exceed that target; text is never cut mid-word. Different sections never overlap; overlap stays within a section and page. An oversized section is split at block boundaries first and then at sentence boundaries, using splitting rules that keep clinical abbreviations intact. Each following piece starts with the previous piece's last sentence.
- **Tables.** A table block stays whole, including oversized tables. Row splitting with repeated headers is deferred because normalized OCR table text does not reliably distinguish header rows from data. Lab and vital values in tables are also extracted as observations, so note search mainly serves narrative text.

## Considered options

- **Headings only in chunk text, or only as metadata.** Text-only headings repeat in every piece of a split section and mix heading with note text. Metadata-only headings leave the heading out of the embedding, which is the failure that hid a chief complaint behind a heading-only match.
- **`@chonkiejs/core`.** Its `SentenceChunker` is well built: character-based sizing, sentence overlap and offsets into the source. But it covers only the in-section sentence split, its default delimiters split on clinical abbreviations, it is created asynchronously, and it is pre-1.0. The parts specific to us (sections, section paths, page cuts, table rows and source boxes) would remain our code either way. We would revisit it if we move to token-exact sizing.
- **Hybrid keyword and vector retrieval.** Adding Postgres full-text scoring would help exact terms such as drug names and abbreviations. It is deferred until the note retrieval evaluation shows exact-term misses.

## Consequences

Migration 0005 adds a nullable `note_chunks.section`. Reseeding re-indexes the synthetic samples on each database branch, and uploaded documents are re-indexed only when they are processed again. A `notes` evaluation suite asks ten questions against the six searchable synthetic samples and reports recall at four retrieved chunks, without a pass threshold. Tables and indivisible sentences can exceed the size target; these limits are listed in `docs/future-enhancements.md`.
