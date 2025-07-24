import { cliSchema } from './global.js'
import type { GlobalOpts } from './global.js'

export const prepareOptsSchema = cliSchema
  .pick({
    extraHeaderPages: true,
    extraPublicContent: true,
    extraTheme: true,
    config: true,
    gitProvider: true,
    reposFilter: true,
    token: true,
    usernames: true,
    vitepressConfig: true,
  })

export type PrepareOpts = GlobalOpts
