import { cliSchema } from './global.js'
import type { GlobalOpts } from './global.js'

/**
 * Schema for fetch command options
 * Includes options related to Git repository fetching
 */
export const fetchOptsSchema = cliSchema
  .pick({
    branch: true,
    config: true,
    gitProvider: true,
    reposFilter: true,
    token: true,
    usernames: true,
  })

/**
 * Type for fetch options
 */
export type FetchOpts = GlobalOpts

/**
 * Type for fetch options with username instead of usernames array
 */
export type FetchOptsUser = Omit<FetchOpts, 'usernames'> & { username: FetchOpts['usernames'][number] }
