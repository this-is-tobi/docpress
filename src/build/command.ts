import { resolve } from 'node:path'
import { build as vitepressBuild } from 'vitepress'
import { createCommand } from 'commander'

const cmdName = 'build'

export const cmd = createCommand(cmdName)
  .description('Build vitepress website.')
  .action(async (_opts) => {
    await main()
  })

export async function main() {
  await vitepressBuild(resolve(process.cwd(), 'vitepress'))
}
