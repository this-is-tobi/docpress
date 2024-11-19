import { createCommand, createOption } from 'commander'
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
  .description('Fetch docs with the given username and git provider.')
  .action(async (opts) => {
    const parsedOpts = parseOptions(cmdName, opts)
    await main(parsedOpts)
  })

export async function main(opts: FetchOpts) {
  const { username, reposFilter, token, branch, gitProvider } = opts
  log(`\n-> Start fetching documentation files. This may take a moment, especially for larger repositories.`, 'info')

  await fetchDoc({ username, branch, reposFilter, gitProvider, token })
}
