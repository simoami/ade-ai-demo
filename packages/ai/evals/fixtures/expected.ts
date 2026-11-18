import { z } from 'zod'

/** Normalized top-left rectangle in page coordinates. */
export const boxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
})

/** Reading-order OCR block; continuation IDs refer to an earlier page. */
export const blockSchema = z.object({
  id: z.string(),
  kind: z.enum([
    'heading',
    'paragraph',
    'list',
    'table',
    'header',
    'footer',
    'other',
  ]),
  text: z.string(),
  box: boxSchema,
  continues: z.string().nullable(),
})

/** Synthetic truth shared by OCR, classification, identifier and extraction evals. */
export const expectedSchema = z.object({
  id: z.string(),
  datasetVersion: z.string(),
  seed: z.number().int(),
  split: z.enum(['development', 'held-out']),
  documentClass: z.enum(['clinical', 'consent', 'other']),
  pages: z.array(
    z.object({
      page: z.number().int().nonnegative(),
      rotation: z.number(),
      blocks: z.array(blockSchema),
      scannedBlocks: z.array(blockSchema),
      pii: z.array(
        z.object({
          blockId: z.string(),
          start: z.number().int().nonnegative(),
          end: z.number().int().positive(),
          category: z.enum([
            'name',
            'id',
            'dob',
            'address',
            'phone',
            'email',
            'ssn',
            'facility',
            'provider',
          ]),
          box: boxSchema,
          scannedBox: boxSchema,
        })
      ),
    })
  ),
  observations: z.array(
    z.object({
      id: z.string(),
      blockId: z.string(),
      kind: z.enum(['lab', 'vital', 'symptom', 'adverse-event']),
      name: z.string(),
      value: z.string(),
      unit: z.string().nullable(),
      effectiveDate: z.string(),
      sourceFormat: z.enum(['table', 'list', 'narrative']),
      details: z.object({
        referenceRange: z.string().optional(),
        flag: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        seriousness: z.string().optional(),
      }),
      duplicateGroup: z.string(),
    })
  ),
})

export type Block = z.infer<typeof blockSchema>

export type Box = z.infer<typeof boxSchema>

export type Expected = z.infer<typeof expectedSchema>
