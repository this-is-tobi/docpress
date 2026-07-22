import type { Command, Option } from 'commander'
import { z } from 'zod'
import type { GlobalOpts } from '../schemas/global.js'
import { globalOptsSchema } from '../schemas/global.js'
import type { FetchOpts } from '../schemas/fetch.js'
import type { PrepareOpts } from '../schemas/prepare.js'
import { redactToken } from './functions.js'
import { log } from './logger.js'

/**
 * Type definition for command names
 */
type Cmd = 'fetch' | 'prepare' | 'global'

/**
 * Interface mapping command names to their option types
 */
interface Options {
  fetch: FetchOpts
  prepare: PrepareOpts
  global: GlobalOpts
}

/**
 * Validates raw command options against the global schema
 * The merging with precedence CLI options > config file > defaults is performed by
 * `globalOptsSchema` (see src/schemas/global.ts); this function only runs that schema
 *
 * @param cmd - The command name ('fetch', 'prepare' or 'global')
 * @param opts - Raw options from the command line
 * @returns Validated and processed options for the specified command
 */
export function parseOptions<T extends Cmd>(cmd: T, opts: Record<string, unknown>): Options[T] {
  log(`Initializing Docpress...`, 'info', 'blue')
  log(`\n\n-> Checking for required environment settings and configurations.`, 'info')
  log(`   Debug info - cmd: ${cmd}`, 'debug')

  const res = globalOptsSchema.safeParse(opts)
  if (!res.success) {
    log(`   An error occurred while checking configuration.\n     ${z.prettifyError(res.error)}`, 'error')
    process.exit(1)
  }
  // Logged after validation (not the raw input) so this reflects the fully merged
  // CLI/config/defaults result, and so a `--log-level debug` passed in this same
  // invocation - only resolved inside the schema above - is already in effect.
  log(`   Debug info - resolved options: ${JSON.stringify(redactToken(res.data))}`, 'debug')
  log('   Setup complete! Ready to process your documentation.', 'info')
  return res.data as Options[T]
}

/**
 * Extracts options that were explicitly provided by the user, skipping Commander defaults
 * This lets config file values take precedence over CLI defaults
 *
 * @param cmd - The Commander Command instance
 * @param opts - Raw options from the command line
 * @returns Options object containing only user-provided values
 */
export function explicitOptions(cmd: Command, opts: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(opts).filter(([key]) => cmd.getOptionValueSource(key) !== 'default'),
  )
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
