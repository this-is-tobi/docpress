/* eslint-disable dot-notation */
import type { Command, Option } from 'commander'
import { fromError } from 'zod-validation-error'
import type { GlobalOpts } from '../schemas/global.js'
import { configSchema, globalOptsSchema } from '../schemas/global.js'
import type { BuildOpts } from '../schemas/build.js'
import { buildOptsSchema } from '../schemas/build.js'
import type { FetchOpts } from '../schemas/fetch.js'
import { fetchOptsSchema } from '../schemas/fetch.js'
import type { PrepareOpts } from '../schemas/prepare.js'
import { prepareOptsSchema } from '../schemas/prepare.js'
import { loadConfigFile } from './functions.js'
import { log } from './logger.js'

/**
 * Type definition for command names
 */
type Cmd = 'fetch' | 'build' | 'prepare' | 'global'

/**
 * Interface mapping command names to their option types
 */
interface Options {
  build: BuildOpts
  fetch: FetchOpts
  prepare: PrepareOpts
  global: GlobalOpts
}

/**
 * Mapping of command names to their schema validators
 */
export const options = {
  build: buildOptsSchema,
  fetch: fetchOptsSchema,
  prepare: prepareOptsSchema,
  global: globalOptsSchema,
}

/**
 * Handles loading and parsing of the configuration file
 *
 * @param configPath - Path to the configuration file
 * @param token - Optional GitHub token
 * @returns Parsed configuration data or null if loading/parsing failed
 */
function handleConfigFile(configPath: string, token?: string) {
  const configData = loadConfigFile(configPath)
  if (!configData) return null

  // No need for a try/catch here since we're handling errors at a higher level
  const parsedConfig = configSchema.partial().safeParse(configData)
  if (parsedConfig.success) {
    return {
      ...parsedConfig.data,
      config: configPath,
      token: token || undefined,
    }
  }

  return null
}

/**
 * Parses and validates command options based on the command type
 *
 * @param cmd - The command name ('fetch', 'build', 'prepare', or 'global')
 * @param opts - Raw options from the command line
 * @returns Validated and processed options for the specified command
 */
export function parseOptions<T extends Cmd>(cmd: T, opts: Record<string, unknown>): Options[T] {
  log(`Initializing Docpress...`, 'info', 'blue')
  log(`\n\n-> Checking for required environment settings and configurations.`, 'info')
  log(`   Debug info - opts: ${JSON.stringify(opts)}`, 'debug')
  log(`   Debug info - options[cmd]: ${cmd}`, 'debug')

  try {
    // Special handling for config file
    if (cmd === 'global' && typeof opts['config'] === 'string') {
      const configResult = handleConfigFile(
        opts['config'],
        typeof opts['token'] === 'string' ? opts['token'] : undefined,
      )
      if (configResult) {
        // Force type assertion since we know the structure will match
        return configResult as unknown as Options[T]
      }
    }

    const res = options[cmd].safeParse(opts)
    if (!res.success) {
      try {
        const errorMessage = fromError(res.error).toString()
        log(`   An error occurred while checking configuration.\n     ${errorMessage}`, 'error')
      } catch {
        // Fallback for incompatibility between zod-validation-error and Zod v4
        log(`   An error occurred while checking configuration.\n     ${JSON.stringify(res.error, null, 2)}`, 'error')
      }
      process.exit(1)
    }
    log('   Setup complete! Ready to process your documentation.', 'info')
    return res.data as Options[T]
  } catch (error) {
    log(`   An error occurred while processing options.`, 'error')
    if (error instanceof Error) {
      log(`     ${error.message}`, 'error')
    } else {
      log(`     ${JSON.stringify(error, null, 2)}`, 'error')
    }
    process.exit(1)
  }
}

/**
 * Adds option definitions to a Command instance
 *
 * @param cmd - The Commander Command instance
 * @param opts - Array of option definitions to add
 * @returns The Command instance with options added
 */
export function addOptions(cmd: Command, opts: Option[]) {
  for (const opt of opts) {
    cmd.addOption(opt)
  }
  return cmd
}
