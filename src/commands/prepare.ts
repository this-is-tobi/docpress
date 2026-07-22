import { dirname } from 'node:path'
import { createCommand, createOption } from 'commander'
import { configSchema } from '../schemas/global.js'
import { addOptions, explicitOptions, parseOptions } from '../utils/commands.js'
import { prepareDoc } from '../lib/prepare.js'
import type { PrepareOpts } from '../schemas/prepare.js'
import { log } from '../utils/logger.js'
import { createDir, formatDuration, formatError } from '../utils/functions.js'
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
  .action(async (opts, cmd) => {
    const parsedOpts = parseOptions(cmdName, explicitOptions(cmd, opts))
    await main(parsedOpts)
  })

/**
 * Main function to execute the prepare command
 *
 * @param opts - Validated prepare options
 */
export async function main(opts: PrepareOpts) {
  const { extraHeaderPages, extraPublicContent, extraTheme, vitepressConfig, forks, gitProvider, lastUpdated, token, usernames, websiteTitle, websiteTagline } = opts
  log(`\n-> Start transform files to prepare Vitepress build.`, 'info')
  const start = Date.now()

  createDir(dirname(VITEPRESS_CONFIG), { clean: true })
  const failedUsers: string[] = []
  for (const username of usernames) {
    try {
      await prepareDoc({ extraHeaderPages, extraPublicContent, extraTheme, vitepressConfig, forks, gitProvider, lastUpdated, token, username, websiteTitle, websiteTagline })
    } catch (error) {
      failedUsers.push(username)
      log(`   Failed to prepare documentation for '${username}': ${formatError(error)}`, 'error')
    }
  }

  if (failedUsers.length === usernames.length) {
    throw new Error(`Failed to prepare documentation for all requested username(s): ${failedUsers.join(', ')}.`)
  }

  const succeeded = usernames.length - failedUsers.length
  log(`   Prepared documentation for ${succeeded}/${usernames.length} username(s) in ${formatDuration(Date.now() - start)}.`, failedUsers.length ? 'warn' : 'success')
}
