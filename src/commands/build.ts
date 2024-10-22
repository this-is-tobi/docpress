import { build as vitepressBuild } from 'vitepress'
import { createCommand } from 'commander'
import { addOptions } from '../utils/commands.js'
import { DOCPRESS_DIR } from '../utils/const.js'
import { globalOpts } from './global.js'

const cmdName = 'build'

export const buildOpts = []

export const buildCmd = addOptions(createCommand(cmdName), globalOpts)
  .description('Build vitepress website.')
  .action(async (_opts) => {
    await main()
  })

export async function main() {
  await vitepressBuild(DOCPRESS_DIR)
}
