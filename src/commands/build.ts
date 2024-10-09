import { resolve } from 'node:path'
import { build as vitepressBuild } from 'vitepress'
import { createCommand } from 'commander'

const cmdName = 'build'

export const buildCmd = createCommand(cmdName)
  .description('Build vitepress website.')
  .action(async (_opts) => {
    await build()
  })

export async function build() {
  await vitepressBuild(resolve(process.cwd(), 'vitepress'))
}
