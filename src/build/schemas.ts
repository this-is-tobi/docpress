import { z } from 'zod'

export const options = z.object({
  extraHeaderPages: z.string()
    .describe('List of comma separated additional files to process Vitepress header pages.')
    .transform(repos => repos.split(','))
    .optional(),
  extraPublicContent: z.string()
    .describe('List of comma separated additional files to process Vitepress public folder.')
    .transform(repos => repos.split(','))
    .optional(),
})

export type Options = Zod.infer<typeof options>
