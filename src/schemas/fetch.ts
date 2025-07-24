import { cliSchema } from './global.js'
import type { GlobalOpts } from './global.js'

export const fetchOptsSchema = cliSchema
  .pick({
    branch: true,
    config: true,
    gitProvider: true,
    reposFilter: true,
    token: true,
    usernames: true,
  })

export type FetchOpts = GlobalOpts

export type FetchOptsUser = Omit<FetchOpts, 'usernames'> & { username: FetchOpts['usernames'][number] }
