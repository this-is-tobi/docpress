import { z } from 'zod'

export const buildOptsSchema = z.object({})

export type BuildOpts = Zod.infer<typeof buildOptsSchema>
