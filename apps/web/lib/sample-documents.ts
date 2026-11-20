/** Synthetic scanned PDFs available for exercising the upload pipeline. */
export const sampleDocuments = [
  {
    id: 'clinical-01',
    name: 'Clinical note',
    description: 'A two-page clinical note with vitals and lab results.',
    pages: 2,
    downloadName: 'sample-clinical-note.pdf',
  },
  {
    id: 'intake-01',
    name: 'Intake form',
    description: 'An intake form with a patient photo.',
    pages: 1,
    downloadName: 'sample-intake-form.pdf',
  },
  {
    id: 'radiology-01',
    name: 'Radiology report',
    description: 'A radiology report with an X-ray.',
    pages: 1,
    downloadName: 'sample-radiology-report.pdf',
  },
  {
    id: 'consent-01',
    name: 'Consent form',
    description: 'A signed consent form for treatment.',
    pages: 1,
    downloadName: 'sample-consent-form.pdf',
  },
] as const
