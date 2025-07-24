import type { z } from 'zod'
import { cliSchema } from './global.js'

export const buildOptsSchema = cliSchema
  .pick({})

export type BuildOpts = z.infer<typeof buildOptsSchema>
