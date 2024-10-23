import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { defineConfig } from 'vitepress'
import { z } from 'zod'

export const prepareOptsSchema = z.object({
  extraHeaderPages: z.string()
    .describe('List of comma separated additional files or directories to process Vitepress header pages.')
    .transform(paths => paths.split(','))
    .optional(),
  extraPublicContent: z.string()
    .describe('List of comma separated additional files or directories to process Vitepress public folder.')
    .transform(paths => paths.split(','))
    .optional(),
  extraTheme: z.string()
    .describe('List of comma separated additional files or directories to use as Vitepress theme.')
    .transform(paths => paths.split(','))
    .optional(),
  vitepressConfig: z.string()
    .describe('Path to the vitepress configuration file.')
    .transform(path => JSON.parse(readFileSync(resolve(process.cwd(), path)).toString()) as ReturnType<typeof defineConfig>)
    .optional(),
})

export type PrepareOpts = Zod.infer<typeof prepareOptsSchema>
