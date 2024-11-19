// import type { GlobalOpts } from './global.js'
import { applyGlobalOptsTransform, cliSchema } from './global.js'

export const prepareOptsSchema = cliSchema
  .pick({
    extraHeaderPages: true,
    extraPublicContent: true,
    extraTheme: true,
    config: true,
    gitProvider: true,
    reposFilter: true,
    token: true,
    username: true,
    vitepressConfig: true,
  })
  .transform(applyGlobalOptsTransform)

export type PrepareOpts = Zod.infer<typeof prepareOptsSchema>
