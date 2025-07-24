import { build as vitepressBuild } from 'vitepress'
import { createCommand } from 'commander'
import { addOptions } from '../utils/commands.js'
import { DOCPRESS_DIR } from '../utils/const.js'
import { log } from '../utils/logger.js'
import { globalOpts } from './global.js'

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
    await vitepressBuild(DOCPRESS_DIR)
    log(`\n\nDocpress build succedeed.`, 'success')
  } catch (error) {
    log(`\n\nDocpress build failed : ${error}`, 'error')
  }
}
