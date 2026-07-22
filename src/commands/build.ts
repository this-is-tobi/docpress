import { build as vitepressBuild } from 'vitepress'
import type { UserConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { createCommand } from 'commander'
import { addOptions } from '../utils/commands.js'
import { DOCPRESS_DIR } from '../utils/const.js'
import { log } from '../utils/logger.js'
import { formatDuration, formatError } from '../utils/functions.js'
import { globalOpts } from './global.js'

/**
 * Suppress specific Vue warnings during the build process
 *
 * @param callback - Function to execute while warnings are suppressed
 * @returns The result of the callback function
 */
export async function suppressVueWarnings<T>(callback: () => Promise<T>): Promise<T> {
  // Store the original console.warn
  const originalWarn = console.warn

  // Override console.warn to suppress two specific, noisy Vue/Vitepress warnings
  // and forward everything else, untouched, to the real console.warn.
  //
  // These must NOT be routed through log(): log() writes via console.warn, which
  // is this very override, so forwarding a non-suppressed warning through it would
  // recurse until the stack overflows and aborts the whole Vitepress build. Vite's
  // "chunks are larger than 500 kB" warning is exactly such a case, which is why
  // the build failed with "[vite:reporter] Maximum call stack size exceeded".
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
    // Pass other warnings straight to the original console.warn
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
  const start = Date.now()

  try {
    // Build VitePress with Vue warnings suppressed
    await suppressVueWarnings(async () => {
      await vitepressBuild(DOCPRESS_DIR, {
        onAfterConfigResolve(siteConfig) {
          withMermaid(siteConfig as unknown as UserConfig)
        },
      })
    })
  } catch (error) {
    // Re-thrown (not logged/exited here) so cli.ts's single top-level catch
    // is the only place that reports a failure and sets the exit code.
    throw new Error(`Docpress build failed: ${formatError(error)}`)
  }

  log(`\n\nDocpress build succeeded in ${formatDuration(Date.now() - start)}.`, 'success')
}
