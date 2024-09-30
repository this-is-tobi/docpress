import { existsSync, rmSync } from 'node:fs'
import type { program as Program } from 'commander'
import { options, type Options } from './schemas.js'
import { initProvider } from './git.js'
import { main as fetchDoc } from './functions.js'
import { VITEPRESS_PATH } from '~/utils/const.js'
import { parseOptions } from '~/utils/config.js'

const cmd = 'fetch'

export function getCommand(program: typeof Program) {
  return program.command(cmd)
    .option(
      '-b, --branch <string>',
      options.shape.branch._def.description,
      options.shape.branch._def.defaultValue(),
    )
    .option(
      '-g, --git-provider <string>',
      options.shape.gitProvider._def.description,
      options.shape.gitProvider._def.defaultValue(),
    )
    .option(
      '-r, --repositories <string>',
      options.shape.repositories._def.description,
    )
    .option(
      '-t, --token <string>',
      options.shape.token._def.description,
    )
    .option(
      '-u, --username <string>',
      options.shape.username._def.description,
    )
    .action(async (opts) => {
      const options = parseOptions(cmd, opts)
      await fetch(options)
    })
}

export async function fetch(opts: Options) {
  const { username, repositories: reposFilter, token, branch } = opts

  initProvider(token)
  if (existsSync(VITEPRESS_PATH)) {
    rmSync(VITEPRESS_PATH, { recursive: true })
  }

  await fetchDoc(username, branch, reposFilter || [])
}
