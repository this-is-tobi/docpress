import { build as vitepressBuild } from 'vitepress'
import { createCommand } from 'commander'
import { DOCPRESS_DIR } from '../utils/const.js'

const cmdName = 'build'

export const buildCmd = createCommand(cmdName)
  .description('Build vitepress website.')
  .action(async (_opts) => {
    await build()
  })

export async function build() {
  await vitepressBuild(DOCPRESS_DIR)
}
