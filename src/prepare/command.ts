import { resolve } from 'node:path'
import { createCommand, createOption } from 'commander'
import { getUserInfos, getUserRepos } from '../utils/functions.js'
import { VITEPRESS_PATH } from '../utils/const.js'
import { addOptions, parseOptions } from '../utils/commands.js'
import type { EnhancedRepository } from '../fetch/functions.js'
import { addContent, addExtraPages, generateVitepressFiles, transformDoc } from './functions.js'
import { type Options, optionsSchema } from './schemas.js'
import type { Page } from './utils.js'
import { getVitepressConfig } from './vitepress.js'

const cmdName = 'prepare'

export const opts = [
  createOption('-c, --extra-public-content <string>', optionsSchema.shape.extraPublicContent._def.description),

  createOption('-p, --extra-header-pages <string>', optionsSchema.shape.extraHeaderPages._def.description),

  createOption('-t, --extra-theme <string>', optionsSchema.shape.extraTheme._def.description),

  createOption('-v, --vitepress-config <string>', optionsSchema.shape.vitepressConfig._def.description),
]

export const cmd = addOptions(createCommand(cmdName), opts)
  .description('Transform doc to the target vitepress format.')
  .action(async (opts) => {
    // const options = parseOptions(cmdName, opts) as Options
    await main(opts)
  })

export async function main(opts: Options) {
  const options = parseOptions(cmdName, opts) as Options
  const { extraHeaderPages, extraPublicContent, extraTheme, vitepressConfig } = options

  const user = getUserInfos()
  const repositories = getUserRepos()
    .reduce((acc: EnhancedRepository[], cur) => {
      if (cur.clone_url && !cur.fork && !cur.private && cur.docpress.includes.length && !cur.docpress.filtered) {
        return [...acc, cur]
      }
      return acc
    }, [])

  // console.log({ repositories })

  const { sidebar, index } = transformDoc(repositories, user)
  const nav: Page[] = []

  if (extraHeaderPages) {
    nav.push(...addExtraPages(extraHeaderPages))
  }
  if (extraPublicContent) {
    addContent(extraPublicContent, resolve(VITEPRESS_PATH, 'public'))
  }
  if (extraTheme) {
    addContent(extraTheme, resolve(VITEPRESS_PATH, '.vitepress/theme'))
  }

  const config = getVitepressConfig(sidebar, nav, vitepressConfig)

  generateVitepressFiles(config, index)
}
