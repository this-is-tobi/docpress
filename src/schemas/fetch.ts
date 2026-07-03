import type { GlobalOpts } from './global.js'

/**
 * Type for fetch options
 */
export type FetchOpts = GlobalOpts

/**
 * Type for fetch options with username instead of usernames array
 */
export type FetchOptsUser = Omit<FetchOpts, 'usernames'> & { username: FetchOpts['usernames'][number] }
