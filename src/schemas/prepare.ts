import { cliSchema } from './global.js'
import type { GlobalOpts } from './global.js'

/**
 * Schema for prepare command options
 * Includes options related to documentation preparation and customization
 */
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

/**
 * Type for prepare options
 */
export type PrepareOpts = GlobalOpts
