import { z } from 'zod'
import { blockSchema, boxSchema } from '#stages/ocr/ocr-result'

/** Identifier text and box; it lies in a text block span or is burned into a figure's pixels. */
const piiSpan = z.object({
  text: z.string(),
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
        z.union([
          piiSpan.extend({
            blockId: z.string(),
            start: z.number().int().nonnegative(),
            end: z.number().int().positive(),
          }),
          piiSpan.extend({ figure: z.number().int().nonnegative() }),
        ])
      ),
      figures: z.array(
        z.object({
          kind: z.enum([
            'patientPhoto',
            'face',
            'signature',
            'logo',
            'icon',
            'medicalImage',
            'clinicalPhoto',
          ]),
          box: boxSchema,
          scannedBox: boxSchema,
          redaction: z.enum(['redact', 'keep', 'review']),
        })
      ),
    })
  ),
  observations: z.array(
    z.object({
      id: z.string(),
      blockId: z.string(),
      kind: z.enum([
        'lab',
        'vital',
        'symptom',
        'adverse-event',
        'medical-history',
        'medication',
      ]),
      name: z.string(),
      value: z.string(),
      unit: z.string().nullable(),
      effectiveDate: z.string(),
      sourceFormat: z.enum(['table', 'list', 'narrative']),
      details: z.object({
        code: z.string().optional(),
        components: z
          .array(
            z.object({
              code: z.string(),
              name: z.string(),
              value: z.number(),
              unit: z.string(),
            })
          )
          .optional(),
        referenceRange: z.string().optional(),
        flag: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        seriousness: z.string().optional(),
        rangeLow: z.number().nullable().optional(),
        rangeHigh: z.number().nullable().optional(),
        flagNormalized: z
          .enum(['low', 'normal', 'high', 'abnormal'])
          .nullable()
          .optional(),
        serious: z.boolean().nullable().optional(),
        outcome: z
          .enum([
            'recovered',
            'recovering',
            'not-recovered',
            'fatal',
            'unknown',
          ])
          .nullable()
          .optional(),
        ongoing: z.boolean().nullable().optional(),
        route: z.string().nullable().optional(),
        frequency: z.string().nullable().optional(),
      }),
      duplicateGroup: z.string(),
    })
  ),
})

export type Expected = z.infer<typeof expectedSchema>

export type ExpectedPage = Expected['pages'][number]

export type ExpectedFigure = ExpectedPage['figures'][number]
