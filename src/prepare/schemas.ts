import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { defineConfig } from 'vitepress'
import { z } from 'zod'

export const optionsSchema = z.object({
  extraHeaderPages: z.string()
    .describe('List of comma separated additional files or directories to process Vitepress header pages.')
    .transform(pages => pages.split(','))
    .optional(),
  extraPublicContent: z.string()
    .describe('List of comma separated additional files or directories to process Vitepress public folder.')
    .transform(pages => pages.split(','))
    .optional(),
  extraTheme: z.string()
    .describe('List of comma separated additional files or directories to process Vitepress public folder.')
    .transform(pages => pages.split(','))
    .optional(),
  vitepressConfig: z.string()
    .describe('Path to the vitepress configuration.')
    .transform(path => JSON.parse(readFileSync(resolve(process.cwd(), path)).toString()) as ReturnType<typeof defineConfig>)
    .optional(),
})

export type Options = Zod.infer<typeof optionsSchema>