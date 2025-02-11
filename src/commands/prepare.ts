import { dirname } from 'node:path'
import { createCommand, createOption } from 'commander'
import { configSchema } from '../schemas/global.js'
import { addOptions, parseOptions } from '../utils/commands.js'
import { prepareDoc } from '../lib/prepare.js'
import type { PrepareOpts } from '../schemas/prepare.js'
import { log } from '../utils/logger.js'
import { createDir } from '../utils/functions.js'
import { VITEPRESS_CONFIG } from '../utils/const.js'
import { globalOpts } from './global.js'

const cmdName = 'prepare'

export const prepareOpts = [
  createOption('-c, --extra-public-content <string>', configSchema.shape.extraPublicContent._def.description),
  createOption('-f, --forks', configSchema.shape.forks._def.description),
  createOption('-p, --extra-header-pages <string>', configSchema.shape.extraHeaderPages._def.description),
  createOption('-t, --extra-theme <string>', configSchema.shape.extraTheme._def.description),
  createOption('-v, --vitepress-config <string>', configSchema.shape.vitepressConfig._def.description),
  createOption('--website-title <string>', configSchema.shape.websiteTitle._def.description),
  createOption('--website-tagline <string>', configSchema.shape.websiteTagline._def.description),
]

export const prepareCmd = addOptions(createCommand(cmdName), [...prepareOpts, ...globalOpts])
  .description('Transform doc to the target vitepress format.')
  .action(async (opts) => {
    const parsedOpts = parseOptions(cmdName, opts)
    await main(parsedOpts)
  })

export async function main(opts: PrepareOpts) {
  const { extraHeaderPages, extraPublicContent, extraTheme, vitepressConfig, forks, token, usernames, websiteTitle, websiteTagline } = opts
  log(`\n-> Start transform files to prepare Vitepress build.`, 'info')

  createDir(dirname(VITEPRESS_CONFIG), { clean: true })
  for (const username of usernames) {
    await prepareDoc({ extraHeaderPages, extraPublicContent, extraTheme, vitepressConfig, forks, token, username, websiteTitle, websiteTagline })
  }
}
