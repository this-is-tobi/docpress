import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'
import type { UserConfig } from 'vitepress'
import { loadConfigFile, prettifyEnum, splitByComma } from '../utils/functions.js'
import { log } from '../utils/logger.js'

const providers = ['github'] as const

export const configSchema = z.object({
  // Global
  username: z.string()
    .describe('Git provider username used to collect data.'),
  // Fetch
  branch: z.string()
    .describe('Branch used to collect Git provider data.')
    .default('main'),
  gitProvider: z.enum(providers)
    .describe(`Git provider used to retrieve data. Values should be ${prettifyEnum(providers)}.`)
    .default('github'),
  reposFilter: z.array(z.string())
    .describe('List of comma separated repositories to retrieve from Git provider. Default to all user\'s public repositories.'),
  // Prepare
  extraHeaderPages: z.array(z.string())
    .describe('List of comma separated additional files or directories to process Vitepress header pages.'),
  extraPublicContent: z.array(z.string())
    .describe('List of comma separated additional files or directories to process Vitepress public folder.'),
  extraTheme: z.array(z.string())
    .describe('List of comma separated additional files or directories to use as Vitepress theme.'),
  forks: z.boolean()
    .describe('Whether or not to create the dedicated fork page that aggregate external contributions.')
    .default(false),
  vitepressConfig: z.any()
    .describe('Path to the vitepress configuration file.'),
})

export type Config = Zod.infer<typeof configSchema>

export function applyGlobalOptsTransform(data: Cli) {
  const { config, vitepressConfig, token, ...rest } = data

  try {
    const loadedDPConfig = configSchema.partial().parse(loadConfigFile(config)) as Config
    const loadedVPConfig = loadConfigFile(vitepressConfig) as UserConfig
    const defaultConfig = configSchema.partial().required({ branch: true, gitProvider: true }).parse({})
    const vpConfig = {
      ...loadedVPConfig,
      ...loadedDPConfig.vitepressConfig,
    }
    const mergedConfig = {
      ...loadedDPConfig,
      ...defaultConfig,
      ...rest,
      ...(Object.keys(vpConfig).length && { vitepressConfig: vpConfig }),
    }
    const parsedConfig = configSchema.partial().required({ username: true }).parse(mergedConfig)

    return { ...parsedConfig, token }
  } catch (error) {
    log(`   An error occurred while checking configuration.\n     ${fromZodError(error).toString()}`, 'error')
    process.exit(1)
  }
}

export const cliSchema = configSchema
  .partial()
  .extend({
    config: z.string()
      .describe('Path to the docpress configuration file.')
      .optional(),
    token: z.string()
      .describe('Git provider token used to collect data.')
      .optional(),
    reposFilter: z.string()
      .describe(configSchema.shape.reposFilter.description || '')
      .transform(splitByComma)
      .optional(),
    extraHeaderPages: z.string()
      .describe(configSchema.shape.extraHeaderPages.description || '')
      .transform(splitByComma)
      .optional(),
    extraPublicContent: z.string()
      .describe(configSchema.shape.extraPublicContent.description || '')
      .transform(splitByComma)
      .optional(),
    extraTheme: z.string()
      .describe(configSchema.shape.extraTheme.description || '')
      .transform(splitByComma)
      .optional(),
    vitepressConfig: z.string()
      .describe(configSchema.shape.vitepressConfig.description || '')
      .optional(),
  })

export type Cli = Zod.infer<typeof cliSchema>

export const globalOptsSchema = cliSchema
  .partial()
  .transform(applyGlobalOptsTransform)

export type GlobalOpts = Required<Pick<Zod.infer<typeof globalOptsSchema>, 'branch' | 'gitProvider'>>
  & Omit<Zod.infer<typeof globalOptsSchema>, 'branch' | 'gitProvider'>
