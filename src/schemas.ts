import { z } from 'zod'

export const options = z.object({
  config: z.string()
    .describe('DocHunt configuration file path.')
    .optional(),
})

export type Options = Zod.infer<typeof options>
