import { dirname } from 'node:path'
import { createCommand, createOption } from 'commander'
import { configSchema } from '../schemas/global.js'
import { addOptions, parseOptions } from '../utils/commands.js'
import { prepareDoc } from '../lib/prepare.js'
import type { PrepareOpts } from '../schemas/prepare.js'
import { log } from '../utils/logger.js'
import { createDir } from '../utils/functions.js'
import { VITEPRESS_CONFIG } from '../utils/const.js'
import { globalOpts } from './global.js'

/**
 * Command name for the prepare operation
 */
const cmdName = 'prepare'

/**
 * Command line options specific to the prepare command
 */
export const prepareOpts = [
  createOption('-c, --extra-public-content <string>', configSchema.shape.extraPublicContent.description),
  createOption('-f, --forks', configSchema.shape.forks.description),
  createOption('-p, --extra-header-pages <string>', configSchema.shape.extraHeaderPages.description),
  createOption('-t, --extra-theme <string>', configSchema.shape.extraTheme.description),
  createOption('-v, --vitepress-config <string>', configSchema.shape.vitepressConfig.description),
  createOption('--website-title <string>', configSchema.shape.websiteTitle.description),
  createOption('--website-tagline <string>', configSchema.shape.websiteTagline.description),
]

/**
 * The prepare command definition for Commander
 */
export const prepareCmd = addOptions(createCommand(cmdName), [...prepareOpts, ...globalOpts])
  .description('Transform doc to the target vitepress format.')
  .action(async (opts) => {
    const parsedOpts = parseOptions(cmdName, opts)
    await main(parsedOpts)
  })

/**
 * Main function to execute the prepare command
 *
 * @param opts - Validated prepare options
 */
export async function main(opts: PrepareOpts) {
  const { extraHeaderPages, extraPublicContent, extraTheme, vitepressConfig, forks, token, usernames, websiteTitle, websiteTagline } = opts
  log(`\n-> Start transform files to prepare Vitepress build.`, 'info')

  createDir(dirname(VITEPRESS_CONFIG), { clean: true })
  for (const username of usernames) {
    await prepareDoc({ extraHeaderPages, extraPublicContent, extraTheme, vitepressConfig, forks, token, username, websiteTitle, websiteTagline })
  }
}
