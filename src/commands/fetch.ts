import { createCommand, createOption } from 'commander'
import { createDir } from '../utils/functions.js'
import { DOCPRESS_DIR } from '../utils/const.js'
import { log } from '../utils/logger.js'
import { addOptions, explicitOptions, parseOptions } from '../utils/commands.js'
import type { FetchOpts } from '../schemas/fetch.js'
import { fetchDoc } from '../lib/fetch.js'
import { configSchema } from '../schemas/global.js'
import { globalOpts } from './global.js'

/**
 * Command name for the fetch operation
 */
const cmdName = 'fetch'

/**
 * Command line options specific to the fetch command
 */
export const fetchOpts = [
  createOption('-b, --branch <string>', configSchema.shape.branch.description)
    .default(configSchema.shape.branch.def.defaultValue),
  createOption('-g, --git-provider <string>', configSchema.shape.gitProvider.description)
    .default(configSchema.shape.gitProvider.def.defaultValue),
  createOption('-l, --last-updated', configSchema.shape.lastUpdated.description),
  createOption('-r, --repos-filter <string>', configSchema.shape.reposFilter.description),
]

/**
 * The fetch command definition for Commander
 */
export const fetchCmd = addOptions(createCommand(cmdName), [...fetchOpts, ...globalOpts])
  .description('Fetch docs with the given username(s) and git provider.')
  .action(async (opts, cmd) => {
    const parsedOpts = parseOptions(cmdName, explicitOptions(cmd, opts))
    await main(parsedOpts)
  })

/**
 * Main function to execute the fetch command
 *
 * @param opts - Validated fetch options
 */
export async function main(opts: FetchOpts) {
  const { usernames, reposFilter, token, branch, gitProvider, lastUpdated } = opts
  log(`\n-> Start fetching documentation files. This may take a moment, especially for larger repositories.`, 'info')

  createDir(DOCPRESS_DIR, { clean: true })
  const failedUsers: string[] = []
  for (const username of usernames) {
    // With multiple users, filters are scoped as '<username>/<repo>' or '!<username>/<repo>'
    const finalRF = usernames.length > 1
      ? reposFilter?.filter((rf: string) => rf.replace(/^!/, '').startsWith(`${username}/`)).map((rf: string) => rf.replace(`${username}/`, ''))
      : reposFilter
    try {
      await fetchDoc({ username, branch, reposFilter: finalRF, gitProvider, token, lastUpdated })
    } catch (error) {
      failedUsers.push(username)
      log(`   Failed to fetch documentation for '${username}': ${error instanceof Error ? error.message : String(error)}`, 'error')
    }
  }

  if (failedUsers.length === usernames.length) {
    throw new Error(`Failed to fetch documentation for all requested username(s): ${failedUsers.join(', ')}.`)
  }
}
