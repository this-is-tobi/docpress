import { resolve } from 'node:path'
import type { program as Program } from 'commander'
import { build as vitepressBuild } from 'vitepress'
import { generateExtraPages } from './functions.js'
import { options, type Options } from './schemas.js'
import { parseOptions } from '~/utils/config.js'

const cmd = 'build'

export function getCommand(program: typeof Program) {
  return program.command(cmd)
    .option(
      '-c, --extra-public-content <string>',
      options.shape.extraPublicContent._def.description,
    )
    .option(
      '-p, --extra-header-pages <string>',
      options.shape.extraHeaderPages._def.description,
    )
    .action(async (opts) => {
      const options = parseOptions(cmd, opts)
      await build(options)
    })
}

export async function build(opts: Options) {
  const { extraHeaderPages } = opts

  generateExtraPages(extraHeaderPages || [])
  // addPublicContent(extraHeaderPages || [])
  await vitepressBuild(resolve(process.cwd(), 'vitepress'))
}
