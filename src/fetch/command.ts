import { existsSync, rmSync } from 'node:fs'
import { createCommand, createOption } from 'commander'
import { VITEPRESS_PATH } from '../utils/const.js'
import { addOptions, parseOptions } from '../utils/commands.js'
import { type Options, optionsSchema } from './schemas.js'
import { initProvider } from './git.js'
import { main as fetchDoc } from './functions.js'

const cmdName = 'fetch'

export const opts = [
  createOption('-b, --branch <string>', optionsSchema.shape.branch._def.description)
    .default(optionsSchema.shape.branch._def.defaultValue()),

  createOption('-g, --git-provider <string>', optionsSchema.shape.gitProvider._def.description)
    .default(optionsSchema.shape.gitProvider._def.defaultValue()),

  createOption('-r, --repositories <string>', optionsSchema.shape.repositories._def.description),

  createOption('-T, --token <string>', optionsSchema.shape.token._def.description),

  createOption('-u, --username <string>', optionsSchema.shape.username._def.description),
]

export const cmd = addOptions(createCommand(cmdName), opts)
  .description('Fetch docs with the given username and git provider.')
  .action(async (opts) => {
    await main(opts)
  })

export async function main(opts: Options) {
  const options = parseOptions(cmdName, opts) as Options
  const { username, repositories: reposFilter, token, branch } = options

  initProvider(token)
  if (existsSync(VITEPRESS_PATH)) {
    rmSync(VITEPRESS_PATH, { recursive: true })
  }

  await fetchDoc(username, branch, reposFilter || [])
}
