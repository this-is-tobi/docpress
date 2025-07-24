import type { z } from 'zod'
import { cliSchema } from './global.js'

/**
 * Schema for build command options
 * Currently empty as build doesn't require specific options
 */
export const buildOptsSchema = cliSchema
  .pick({})

export type BuildOpts = z.infer<typeof buildOptsSchema>
