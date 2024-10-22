import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import { buildOptsSchema } from './build.js'
import type { FetchOpts } from './fetch.js'
import { fetchOptsSchema } from './fetch.js'
import type { PrepareOpts } from './prepare.js'
import { prepareOptsSchema } from './prepare.js'

export const globalOptsSchema = z.object({
  config: z.string()
    .describe('Path to the docpress configuration file.')
    .transform(path => JSON.parse(readFileSync(resolve(process.cwd(), path)).toString()) as FetchOpts & PrepareOpts)
    .optional(),
})

export type GlobalOpts = Zod.infer<typeof globalOptsSchema>

export const configSchema = fetchOptsSchema
  .merge(prepareOptsSchema)
  .merge(buildOptsSchema)

export type Config = Zod.infer<typeof configSchema>
