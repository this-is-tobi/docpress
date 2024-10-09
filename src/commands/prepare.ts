import { resolve } from 'node:path'
import { createCommand, createOption } from 'commander'
import { DOCPRESS_DIR } from '../utils/const.js'
import { getUserInfos, getUserRepos } from '../utils/functions.js'
import { addOptions, parseOptions } from '../utils/commands.js'
import { getVitepressConfig } from '../lib/vitepress.js'
import { addContent, addExtraPages, generateVitepressFiles, transformDoc } from '../lib/prepare.js'
import { prepareOptsSchema } from '../schemas/prepare.js'
import type { EnhancedRepository } from '../lib/fetch.js'
import type { Page } from '../lib/prepare.js'
import type { PrepareOpts } from '../schemas/prepare.js'

const cmdName = 'prepare'

export const prepareOpts = [
  createOption(
    '-c, --extra-public-content <string>',
    prepareOptsSchema.shape.extraPublicContent._def.description,
  ),
  createOption(
    '-p, --extra-header-pages <string>',
    prepareOptsSchema.shape.extraHeaderPages._def.description,
  ),
  createOption(
    '-t, --extra-theme <string>',
    prepareOptsSchema.shape.extraTheme._def.description,
  ),
  createOption(
    '-v, --vitepress-config <string>',
    prepareOptsSchema.shape.vitepressConfig._def.description,
  ),
]

export const prepareCmd = addOptions(createCommand(cmdName), prepareOpts)
  .description('Transform doc to the target vitepress format.')
  .action(async (opts) => {
    await prepare(opts)
  })

export async function prepare(opts: PrepareOpts) {
  const options = parseOptions(cmdName, opts) as PrepareOpts
  const { extraHeaderPages, extraPublicContent, extraTheme, vitepressConfig } = options

  const user = getUserInfos()
  const repositories = getUserRepos()
    .reduce((acc: EnhancedRepository[], cur) => {
      if (cur.clone_url && !cur.fork && !cur.private && cur.docpress.includes.length && !cur.docpress.filtered) {
        return [...acc, cur]
      }
      return acc
    }, [])

  const { sidebar, index } = transformDoc(repositories, user)
  const nav: Page[] = []

  if (extraHeaderPages) {
    nav.push(...addExtraPages(extraHeaderPages))
  }
  if (extraPublicContent) {
    addContent(extraPublicContent, resolve(DOCPRESS_DIR, 'public'))
  }
  if (extraTheme) {
    addContent(extraTheme, resolve(DOCPRESS_DIR, '.vitepress/theme'))
  }

  const config = getVitepressConfig(sidebar, nav, vitepressConfig)

  generateVitepressFiles(config, index)
}
