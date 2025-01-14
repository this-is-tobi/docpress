import { createCommand, createOption } from 'commander'
import { createDir } from '../utils/functions.js'
import { DOCPRESS_DIR } from '../utils/const.js'
import { log } from '../utils/logger.js'
import { addOptions, parseOptions } from '../utils/commands.js'
import type { FetchOpts } from '../schemas/fetch.js'
import { fetchDoc } from '../lib/fetch.js'
import { configSchema } from '../schemas/global.js'
import { globalOpts } from './global.js'

const cmdName = 'fetch'

export const fetchOpts = [
  createOption('-b, --branch <string>', configSchema.shape.branch._def.description)
    .default(configSchema.shape.branch._def.defaultValue()),
  createOption('-g, --git-provider <string>', configSchema.shape.gitProvider._def.description)
    .default(configSchema.shape.gitProvider._def.defaultValue()),
  createOption('-r, --repos-filter <string>', configSchema.shape.reposFilter._def.description),
]

export const fetchCmd = addOptions(createCommand(cmdName), [...fetchOpts, ...globalOpts])
  .description('Fetch docs with the given username(s) and git provider.')
  .action(async (opts) => {
    const parsedOpts = parseOptions(cmdName, opts)
    await main(parsedOpts)
  })

export async function main(opts: FetchOpts) {
  const { usernames, reposFilter, token, branch, gitProvider } = opts
  log(`\n-> Start fetching documentation files. This may take a moment, especially for larger repositories.`, 'info')

  createDir(DOCPRESS_DIR, { clean: true })
  for (const username of usernames) {
    const finalRF = usernames.length > 1
      ? reposFilter?.filter(rf => rf.startsWith(username)).map(rf => rf.replace(`${username}/`, ''))
      : reposFilter
    await fetchDoc({ username, branch, reposFilter: finalRF, gitProvider, token })
  }
}
