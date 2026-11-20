import { createUploadHandler } from './handler.ts'

/** Issues constrained client tokens and handles authenticated Blob completion callbacks. */
export const POST = createUploadHandler()
