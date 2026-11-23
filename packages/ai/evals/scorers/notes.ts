type NoteLocation = { fixtureId: string; section: string | null; page: number }

/** Recall for one expected section and page among the selected note matches. */
export function scoreNoteRecall(
  expected: NoteLocation,
  matches: NoteLocation[]
): number {
  return Number(
    matches.some(
      (match) =>
        match.fixtureId === expected.fixtureId &&
        match.section === expected.section &&
        match.page === expected.page
    )
  )
}
