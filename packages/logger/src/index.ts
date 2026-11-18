import { Logger } from 'tslog'

/** Shared metadata-only logger; named children inherit formatting and masking. */
export const logger = new Logger({
  name: 'ade',
  type:
    process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'
      ? 'json'
      : 'pretty',
  minLevel: 'INFO',
  // Sub-logger names identify the source; bundled eve paths are unreadable and cost a stack capture.
  stack: { capture: 'off' },
  mask: {
    keys: [
      'authorization',
      'password',
      'secret',
      'token',
      'apiKey',
      'text',
      'content',
      'name',
      'firstName',
      'lastName',
      'mrn',
      'dob',
      'dateOfBirth',
      'address',
      'phone',
      'email',
    ],
    caseInsensitive: true,
  },
})
