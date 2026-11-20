import type { ReviewDocument } from '#lib/sample-records'

// Generated from the invoice-01 synthetic fixture's ground truth.
export const sampleData: Pick<
  ReviewDocument,
  'pageImages' | 'redactions' | 'observations' | 'patientMatches'
> = {
  pageImages: ['/samples/invoice-01/1.webp'],
  redactions: [
    {
      id: 'r1',
      page: 1,
      category: 'Facility',
      box: { x: 0.0338, y: 0.0459, width: 0.1602, height: 0.0191 },
      points: [
        [0.0338, 0.0517],
        [0.1932, 0.0459],
        [0.194, 0.0593],
        [0.0346, 0.0651],
      ],
      state: 'applied',
    },
    {
      id: 'r2',
      page: 1,
      category: 'Name',
      box: { x: 0.0884, y: 0.0599, width: 0.1055, height: 0.0172 },
      points: [
        [0.0884, 0.0637],
        [0.1931, 0.0599],
        [0.1939, 0.0733],
        [0.0892, 0.0771],
      ],
      state: 'applied',
    },
    {
      id: 'r3',
      page: 1,
      category: 'Date of birth',
      box: { x: 0.267, y: 0.0558, width: 0.0403, height: 0.0148 },
      points: [
        [0.267, 0.0572],
        [0.3064, 0.0558],
        [0.3072, 0.0692],
        [0.2678, 0.0706],
      ],
      state: 'applied',
    },
    {
      id: 'r4',
      page: 1,
      category: 'Record number',
      box: { x: 0.8309, y: 0.034, width: 0.0809, height: 0.0163 },
      points: [
        [0.8309, 0.0369],
        [0.911, 0.034],
        [0.9118, 0.0474],
        [0.8317, 0.0503],
      ],
      state: 'applied',
    },
    {
      id: 'r5',
      page: 1,
      category: 'Name',
      box: { x: 0.088, y: 0.1456, width: 0.1158, height: 0.0199 },
      points: [
        [0.088, 0.1498],
        [0.2028, 0.1456],
        [0.2038, 0.1614],
        [0.089, 0.1655],
      ],
      state: 'applied',
    },
    {
      id: 'r6',
      page: 1,
      category: 'Address',
      box: { x: 0.0408, y: 0.1572, width: 0.2992, height: 0.0265 },
      points: [
        [0.0408, 0.1679],
        [0.339, 0.1572],
        [0.34, 0.1729],
        [0.0418, 0.1837],
      ],
      state: 'applied',
    },
    {
      id: 'r7',
      page: 1,
      category: 'Name',
      box: { x: 0.0889, y: 0.9607, width: 0.0834, height: 0.014 },
      points: [
        [0.0889, 0.9637],
        [0.1717, 0.9607],
        [0.1723, 0.9717],
        [0.0895, 0.9747],
      ],
      state: 'applied',
    },
    {
      id: 'r8',
      page: 1,
      category: 'Record number',
      box: { x: 0.2022, y: 0.9572, width: 0.0668, height: 0.0134 },
      points: [
        [0.2022, 0.9596],
        [0.2683, 0.9572],
        [0.269, 0.9682],
        [0.2028, 0.9706],
      ],
      state: 'applied',
    },
  ],
  observations: [],
  patientMatches: {
    'PT-1042': {
      firstName: 'mismatch',
      lastName: 'mismatch',
      birthDate: 'match',
      mrn: 'mismatch',
      sex: 'absent',
    },
    'PT-2210': {
      firstName: 'match',
      lastName: 'match',
      birthDate: 'match',
      mrn: 'mismatch',
      sex: 'absent',
    },
    'PT-3317': {
      firstName: 'mismatch',
      lastName: 'mismatch',
      birthDate: 'match',
      mrn: 'mismatch',
      sex: 'absent',
    },
  },
}
