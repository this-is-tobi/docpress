import { z } from 'zod'
import { loadConfigFile, prettifyEnum, redactToken, splitByComma } from '../utils/functions.js'
import { log } from '../utils/logger.js'

/**
 * List of supported Git providers
 */
const providers = ['github', 'gitlab'] as const

/**
 * Allowed characters for a Git branch/ref name (must not start with "-")
 */
const safeRefRegex = /^\w[\w./-]*$/
const safeRefMessage = 'Branch name must start with a letter, digit or underscore and only contain letters, digits, ".", "-", "_" or "/".'

/**
 * Schema for the DocPress configuration file
 * Defines the structure and validation rules for the configuration
 */
export const configSchema = z.object({
  // Global
  usernames: z.string()
    .array()
    .describe('List of comma separated Git provider usernames used to collect data.'),
  // Fetch
  branch: z.string()
    .regex(safeRefRegex, safeRefMessage)
    .default('main')
    .describe('Branch used to collect Git provider data.'),
  gitProvider: z.enum(providers)
    .default('github')
    .describe(`Git provider used to retrieve data. Values should be ${prettifyEnum(providers)}.`),
  reposFilter: z.string()
    .array()
    .describe('List of comma separated repositories to retrieve from Git provider. Default to all user\'s public repositories.'),
  // Prepare
  extraHeaderPages: z.string()
    .array()
    .describe('List of comma separated additional files or directories to process Vitepress header pages.'),
  extraPublicContent: z.string()
    .array()
    .describe('List of comma separated additional files or directories to process Vitepress public folder.'),
  extraTheme: z.string()
    .array()
    .describe('List of comma separated additional files or directories to use as Vitepress theme.'),
  forks: z.boolean()
    .default(false)
    .describe('Whether or not to create the dedicated fork page that aggregate external contributions.'),
  lastUpdated: z.boolean()
    .default(false)
    .describe('Whether or not to inject each page\'s last Git commit date as Vitepress "lastUpdated" frontmatter.'),
  vitepressConfig: z.any()
    .optional()
    .describe('Path to the vitepress configuration file.'),
  websiteTitle: z.string()
    .describe('Website title.'),
  websiteTagline: z.string()
    .describe('Website tagline.'),
})

export type Config = z.infer<typeof configSchema>

/**
 * CLI schema with transformations applied to handle string-to-array conversions
 * Fields with config defaults are redefined without them, so that values coming
 * from a config file are not overridden by schema defaults
 */
export const cliSchema = configSchema
  .partial()
  .extend({
    branch: z.string()
      .regex(safeRefRegex, safeRefMessage)
      .optional()
      .describe(configSchema.shape.branch.description || ''),
    gitProvider: z.enum(providers)
      .optional()
      .describe(configSchema.shape.gitProvider.description || ''),
    forks: z.boolean()
      .optional()
      .describe(configSchema.shape.forks.description || ''),
    lastUpdated: z.boolean()
      .optional()
      .describe(configSchema.shape.lastUpdated.description || ''),
    config: z.string()
      .optional()
      .describe('Path to the docpress configuration file.'),
    token: z.string()
      .optional()
      .describe('Git provider token used to collect data.'),
    usernames: z.string()
      .transform(splitByComma)
      .optional()
      .describe(configSchema.shape.usernames.description || ''),
    reposFilter: z.string()
      .transform(splitByComma)
      .optional()
      .describe(configSchema.shape.reposFilter.description || ''),
    extraHeaderPages: z.string()
      .transform(splitByComma)
      .optional()
      .describe(configSchema.shape.extraHeaderPages.description || ''),
    extraPublicContent: z.string()
      .transform(splitByComma)
      .optional()
      .describe(configSchema.shape.extraPublicContent.description || ''),
    extraTheme: z.string()
      .transform(splitByComma)
      .optional()
      .describe(configSchema.shape.extraTheme.description || ''),
    vitepressConfig: z.string()
      .optional()
      .describe(configSchema.shape.vitepressConfig.description || ''),
  })

export type Cli = z.infer<typeof cliSchema>

/**
 * Prepares configuration data by converting string values to arrays when needed
 *
 * @param configData - Raw configuration data to process
 * @returns Processed configuration data with proper array types
 */
function prepareConfigData(configData: any) {
  if (!configData) return {}

  const result = { ...configData }
  const arrayKeys = ['usernames', 'reposFilter', 'extraHeaderPages', 'extraPublicContent', 'extraTheme'] as const
  for (const key of arrayKeys) {
    if (typeof result[key] === 'string') {
      result[key] = [result[key]]
    }
  }

  return result
}

/**
 * Validates configuration file data against the config schema
 *
 * @param configData - Prepared configuration data to validate
 * @returns The validated configuration data
 * @throws Error if the configuration data is invalid
 */
function validateConfigData(configData: any) {
  const result = configSchema.partial().safeParse(configData)
  if (!result.success) {
    throw new Error(z.prettifyError(result.error))
  }
  return result.data
}

/**
 * Validates the final merged configuration to ensure required fields are present
 *
 * @param mergedConfig - The merged configuration to validate
 * @returns The validated configuration if it passes validation
 * @throws Error if required fields are missing
 */
function validateFinalConfig(mergedConfig: any) {
  if (!mergedConfig.usernames?.length) {
    throw new Error('The usernames field is required')
  }

  return mergedConfig
}

/**
 * Resolves the API token, with precedence: explicit token > DOCPRESS_TOKEN >
 * provider-specific env var (GITHUB_TOKEN / GITLAB_TOKEN)
 *
 * @param token - Token explicitly provided via CLI flag or config file
 * @param gitProvider - Git provider used to pick the provider-specific env var
 * @returns The resolved token, or undefined when none is available
 */
function resolveToken(token: string | undefined, gitProvider: string | undefined): string | undefined {
  if (token) {
    return token
  }
  /* eslint-disable dot-notation */
  const providerToken = gitProvider === 'gitlab' ? process.env['GITLAB_TOKEN'] : process.env['GITHUB_TOKEN']
  return process.env['DOCPRESS_TOKEN'] ?? providerToken
  /* eslint-enable dot-notation */
}

/**
 * Schema for global options that combines CLI arguments and configuration files
 * Merges config sources with precedence: CLI options > config file > defaults
 */
export const globalOptsSchema = cliSchema
  .partial()
  .transform((data) => {
    try {
      const { config, vitepressConfig, token, ...rest } = data

      log(`Debug: Schema transform input: ${JSON.stringify(redactToken(data))}`, 'debug')

      // Load and validate configuration from file
      const configData = validateConfigData(prepareConfigData(loadConfigFile(config)))

      // Create final config
      const mergedConfig = {
        branch: 'main',
        gitProvider: 'github',
        forks: false,
        lastUpdated: false,
        ...configData,
        ...rest,
        ...(vitepressConfig
          ? {
              vitepressConfig: {
                ...(configData.vitepressConfig || {}),
                ...(loadConfigFile(vitepressConfig) || {}),
              },
            }
          : {}),
      }

      log(`Debug: Final merged config: ${JSON.stringify(mergedConfig)}`, 'debug')

      return validateFinalConfig({ ...mergedConfig, token: resolveToken(token, mergedConfig.gitProvider) })
    } catch (error) {
      log(`   An error occurred while checking configuration.`, 'error')
      if (error instanceof Error) {
        log(`     ${error.message}`, 'error')
      } else {
        log(`     ${JSON.stringify(error, null, 2)}`, 'error')
      }
      process.exit(1)
    }
  })

export type GlobalOpts = Required<Pick<z.infer<typeof globalOptsSchema>, 'branch' | 'gitProvider'>>
  & Omit<z.infer<typeof globalOptsSchema>, 'branch' | 'gitProvider'>
