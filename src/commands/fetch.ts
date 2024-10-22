import { createCommand, createOption } from 'commander'
import { addOptions, parseOptions } from '../utils/commands.js'
import { fetchOptsSchema } from '../schemas/fetch.js'
import { fetchDoc } from '../lib/fetch.js'
import type { Config } from '../schemas/global.js'
import { globalOpts } from './global.js'

const cmdName = 'fetch'

export const fetchOpts = [
  createOption('-b, --branch <string>', fetchOptsSchema.shape.branch._def.description)
    .default(fetchOptsSchema.shape.branch._def.defaultValue()),
  createOption('-g, --git-provider <string>', fetchOptsSchema.shape.gitProvider._def.description)
    .default(fetchOptsSchema.shape.gitProvider._def.defaultValue()),
  createOption('-r, --repos-filter <string>', fetchOptsSchema.shape.reposFilter._def.description),
  createOption('-T, --token <string>', fetchOptsSchema.shape.token._def.description),
  createOption('-u, --username <string>', fetchOptsSchema.shape.username._def.description),
]

export const fetchCmd = addOptions(createCommand(cmdName), [...fetchOpts, ...globalOpts])
  .description('Fetch docs with the given username and git provider.')
  .action(async (opts) => {
    await main(opts)
  })

export async function main(opts: Config) {
  const { username, reposFilter, token, branch, gitProvider } = parseOptions(cmdName, opts)

  await fetchDoc({ username, branch, reposFilter, gitProvider, token })
}
