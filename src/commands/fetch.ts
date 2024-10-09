import { existsSync, rmSync } from 'node:fs'
import { createCommand, createOption } from 'commander'
import { DOCPRESS_DIR } from '../utils/const.js'
import { addOptions, parseOptions } from '../utils/commands.js'
import type { FetchOpts } from '../schemas/fetch.js'
import { fetchOptsSchema } from '../schemas/fetch.js'
import { initProvider } from '../lib/git.js'
import { main as fetchDoc } from '../lib/fetch.js'

const cmdName = 'fetch'

export const fetchOpts = [
  createOption(
    '-b, --branch <string>',
    fetchOptsSchema.shape.branch._def.description,
  )
    .default(
      fetchOptsSchema.shape.branch._def.defaultValue(),
    ),
  createOption(
    '-g, --git-provider <string>',
    fetchOptsSchema.shape.gitProvider._def.description,
  )
    .default(
      fetchOptsSchema.shape.gitProvider._def.defaultValue(),
    ),
  createOption(
    '-r, --repositories <string>',
    fetchOptsSchema.shape.repositories._def.description,

  ),
  createOption(
    '-T, --token <string>',
    fetchOptsSchema.shape.token._def.description,

  ),
  createOption(
    '-u, --username <string>',
    fetchOptsSchema.shape.username._def.description,

  ),
]

export const fetchCmd = addOptions(createCommand(cmdName), fetchOpts)
  .description('Fetch docs with the given username and git provider.')
  .action(async (opts) => {
    await fetch(opts)
  })

export async function fetch(opts: FetchOpts) {
  const options = parseOptions(cmdName, opts) as FetchOpts
  const { username, repositories: reposFilter, token, branch } = options

  initProvider(token)
  if (existsSync(DOCPRESS_DIR)) {
    rmSync(DOCPRESS_DIR, { recursive: true })
  }

  await fetchDoc(username, branch, reposFilter || [])
}
