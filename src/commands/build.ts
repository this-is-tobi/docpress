import { build as vitepressBuild } from 'vitepress'
import { createCommand } from 'commander'
import { addOptions } from '../utils/commands.js'
import { DOCPRESS_DIR } from '../utils/const.js'
import { log } from '../utils/logger.js'
import { globalOpts } from './global.js'

/**
 * Suppress specific Vue warnings during the build process
 *
 * @param callback - Function to execute while warnings are suppressed
 * @returns The result of the callback function
 */
async function suppressVueWarnings<T>(callback: () => Promise<T>): Promise<T> {
  // Store the original console.warn
  const originalWarn = console.warn

  // Override console.warn to suppress specific Vue warnings
  console.warn = function (...args) {
    if (
      args.length > 0
      && typeof args[0] === 'string'
      && (args[0].includes('[Vue warn]: Invalid watch source:')
        || args[0].includes('{ open: false }'))
    ) {
      // Skip this warning
      return
    }
    // Pass other warnings to the original console.warn
    originalWarn.apply(console, args)
  }

  try {
    // Execute the callback with warnings suppressed
    return await callback()
  } finally {
    // Restore the original console.warn
    console.warn = originalWarn
  }
}

/**
 * Command name for the build operation
 */
const cmdName = 'build'

/**
 * Command line options specific to the build command (none currently)
 */
export const buildOpts = []

/**
 * The build command definition for Commander
 */
export const buildCmd = addOptions(createCommand(cmdName), globalOpts)
  .description('Build vitepress website.')
  .action(async (_opts) => {
    await main()
  })

/**
 * Main function to execute the build command
 * Builds the VitePress static site
 */
export async function main() {
  log(`\n-> Start building Vitepress website.\n\n`, 'info')

  try {
    // Build VitePress with Vue warnings suppressed
    await suppressVueWarnings(async () => {
      await vitepressBuild(DOCPRESS_DIR)
    })

    log(`\n\nDocpress build succedeed.`, 'success')
  } catch (error) {
    log(`\n\nDocpress build failed : ${error}`, 'error')
  }
}
