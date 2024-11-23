import { cliSchema } from './global.js'

export const buildOptsSchema = cliSchema
  .pick({})

export type BuildOpts = Zod.infer<typeof buildOptsSchema>
