import { z } from 'zod'
import { loadConfigFile, prettifyEnum, splitByComma } from '../utils/functions.js'
import { log } from '../utils/logger.js'

/**
 * List of supported Git providers
 */
const providers = ['github'] as const

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
    .describe('Branch used to collect Git provider data.')
    .default('main'),
  gitProvider: z.enum(providers)
    .describe(`Git provider used to retrieve data. Values should be ${prettifyEnum(providers)}.`)
    .default('github'),
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
    .describe('Whether or not to create the dedicated fork page that aggregate external contributions.')
    .default(false),
  vitepressConfig: z.any()
    .describe('Path to the vitepress configuration file.'),
  websiteTitle: z.string()
    .describe('Website title.'),
  websiteTagline: z.string()
    .describe('Website tagline.'),
})

export type Config = z.infer<typeof configSchema>

/**
 * Base CLI schema for parsing command line arguments
 * All fields are optional in this schema
 */
export const baseCliSchema = configSchema.partial().extend({
  config: z.string()
    .describe('Path to the docpress configuration file.')
    .optional(),
  token: z.string()
    .describe('Git provider token used to collect data.')
    .optional(),
  usernames: z.string()
    .describe(configSchema.shape.usernames.description || '')
    .optional(),
  reposFilter: z.string()
    .describe(configSchema.shape.reposFilter.description || '')
    .optional(),
  extraHeaderPages: z.string()
    .describe(configSchema.shape.extraHeaderPages.description || '')
    .optional(),
  extraPublicContent: z.string()
    .describe(configSchema.shape.extraPublicContent.description || '')
    .optional(),
  extraTheme: z.string()
    .describe(configSchema.shape.extraTheme.description || '')
    .optional(),
  vitepressConfig: z.string()
    .describe(configSchema.shape.vitepressConfig.description || '')
    .optional(),
})

export type RawCli = z.infer<typeof baseCliSchema>

/**
 * CLI schema with transformations applied to handle string-to-array conversions
 */
export const cliSchema = configSchema
  .partial()
  .extend({
    config: z.string()
      .describe('Path to the docpress configuration file.')
      .optional(),
    token: z.string()
      .describe('Git provider token used to collect data.')
      .optional(),
    usernames: z.string()
      .describe(configSchema.shape.usernames.description || '')
      .transform(splitByComma)
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

export type Cli = z.infer<typeof cliSchema>

// Helper functions to reduce complexity
/**
 * Prepares configuration data by converting string values to arrays when needed
 *
 * @param configData - Raw configuration data to process
 * @returns Processed configuration data with proper array types
 */
function prepareConfigData(configData: any) {
  if (!configData) return {}

  // Convert arrays that might be strings
  if (configData.usernames && typeof configData.usernames === 'string') {
    configData.usernames = [configData.usernames]
  }
  if (configData.reposFilter && typeof configData.reposFilter === 'string') {
    configData.reposFilter = [configData.reposFilter]
  }
  if (configData.extraHeaderPages && typeof configData.extraHeaderPages === 'string') {
    configData.extraHeaderPages = [configData.extraHeaderPages]
  }
  if (configData.extraPublicContent && typeof configData.extraPublicContent === 'string') {
    configData.extraPublicContent = [configData.extraPublicContent]
  }
  if (configData.extraTheme && typeof configData.extraTheme === 'string') {
    configData.extraTheme = [configData.extraTheme]
  }

  return configData
}

/**
 * Validates the final merged configuration to ensure required fields are present
 *
 * @param mergedConfig - The merged configuration to validate
 * @returns The validated configuration if it passes validation
 * @throws Error if required fields are missing
 */
function validateFinalConfig(mergedConfig: any) {
  // Ensure usernames exists
  if (!mergedConfig.usernames?.length) {
    throw new Error('The usernames field is required')
  }

  return mergedConfig
}

/**
 * Schema for global options that combines CLI arguments and configuration files
 * Applies transformations to merge different config sources and validate the result
 */
export const globalOptsSchema = cliSchema
  .partial()
  .transform((data) => {
    try {
      const { config, vitepressConfig, token, ...rest } = data

      // Load configuration from file
      const configData = loadConfigFile(config)
      const preparedConfigData = prepareConfigData(configData)

      // Create a manually initialized defaultConfig with explicit values
      const defaultConfig = {
        branch: 'main',
        gitProvider: 'github',
        forks: false,
      }

      // Load VitePress config if available
      const loadedVPConfig = loadConfigFile(vitepressConfig) || {}

      // Merge configurations with proper precedence
      const vpConfig = {
        ...loadedVPConfig,
        ...(preparedConfigData.vitepressConfig || {}),
      }

      const mergedConfig = {
        ...defaultConfig,
        ...preparedConfigData,
        ...rest,
        ...(Object.keys(vpConfig).length ? { vitepressConfig: vpConfig } : {}),
      }

      return validateFinalConfig({ ...mergedConfig, token })
    } catch (error) {
      // Handle errors gracefully
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
