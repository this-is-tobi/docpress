// import type { GlobalOpts } from './global.js'
import { applyGlobalOptsTransform, cliSchema } from './global.js'

export const fetchOptsSchema = cliSchema
  .pick({
    branch: true,
    config: true,
    gitProvider: true,
    reposFilter: true,
    token: true,
    username: true,
  })
  .transform(applyGlobalOptsTransform)

export type FetchOpts = Zod.infer<typeof fetchOptsSchema>
