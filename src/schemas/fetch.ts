// import type { GlobalOpts } from './global.js'
import { applyGlobalOptsTransform, cliSchema } from './global.js'

export const fetchOptsSchema = cliSchema
  .pick({
    branch: true,
    config: true,
    gitProvider: true,
    reposFilter: true,
    token: true,
    usernames: true,
  })
  .transform(applyGlobalOptsTransform)

export type FetchOpts = Zod.infer<typeof fetchOptsSchema>

export type FetchOptsUser = Omit<FetchOpts, 'usernames'> & { username: FetchOpts['usernames'][number] }
