import { z } from 'zod'
import { prettifyEnum } from '../utils/functions.js'

const providers = ['github', 'gitlab'] as const

export const fetchOptsSchema = z.object({
  branch: z.string()
    .describe('Branch used to collect Git provider data.')
    .optional()
    .default('main'),
  gitProvider: z.enum(providers)
    .describe(`Git provider used to retrieve data. Values should be one of ${prettifyEnum(providers)}.`)
    .optional()
    .default('github'),
  reposFilter: z.string()
    .describe('List of comma separated repositories to retrieve from Git provider. Default to all user\'s public repositories.')
    .transform(repos => repos.split(','))
    .optional(),
  token: z.string()
    .describe('Git provider token used to collect data.')
    .optional(),
  username: z.string()
    .describe('Git provider username used to collect data.'),
})

export type FetchOpts = Zod.infer<typeof fetchOptsSchema>
