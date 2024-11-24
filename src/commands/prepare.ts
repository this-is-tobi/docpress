import { resolve } from 'node:path'
import { createCommand, createOption } from 'commander'
import type { EnhancedRepository } from '../lib/fetch.js'
import { configSchema } from '../schemas/global.js'
import { DOCPRESS_DIR, VITEPRESS_USER_THEME } from '../utils/const.js'
import { getUserInfos, getUserRepos } from '../utils/functions.js'
import { addOptions, parseOptions } from '../utils/commands.js'
import { getVitepressConfig } from '../lib/vitepress.js'
import { addContent, addExtraPages, generateVitepressFiles, processForks, transformDoc } from '../lib/prepare.js'
import type { Page } from '../lib/prepare.js'
import type { PrepareOpts } from '../schemas/prepare.js'
import { log } from '../utils/logger.js'
import { globalOpts } from './global.js'

const cmdName = 'prepare'

export const prepareOpts = [
  createOption('-c, --extra-public-content <string>', configSchema.shape.extraPublicContent._def.description),
  createOption('-f, --forks', configSchema.shape.forks._def.description),
  createOption('-p, --extra-header-pages <string>', configSchema.shape.extraHeaderPages._def.description),
  createOption('-t, --extra-theme <string>', configSchema.shape.extraTheme._def.description),
  createOption('-v, --vitepress-config <string>', configSchema.shape.vitepressConfig._def.description),
]

export const prepareCmd = addOptions(createCommand(cmdName), [...prepareOpts, ...globalOpts])
  .description('Transform doc to the target vitepress format.')
  .action(async (opts) => {
    const parsedOpts = parseOptions(cmdName, opts)
    await main(parsedOpts)
  })

export async function main(opts: PrepareOpts) {
  const { extraHeaderPages, extraPublicContent, extraTheme, vitepressConfig, forks, token, username } = opts
  log(`\n-> Start transform files to prepare Vitepress build.`, 'info')

  const user = getUserInfos()
  const repositories = getUserRepos()
    .reduce(({ internals, forks }: { internals: EnhancedRepository[], forks: EnhancedRepository[] }, cur) => {
      const { clone_url, private: privateRepo, fork, docpress } = cur
      if (clone_url && !privateRepo && !docpress.filtered) {
        if (!fork && docpress.includes.length) {
          return { internals: [...internals, cur], forks }
        } else if (fork) {
          return { internals, forks: [...forks, cur] }
        }
      }
      return { internals, forks }
    }, { internals: [], forks: [] })

  const { sidebar, index } = transformDoc(repositories.internals, user)
  const nav: Page[] = []

  if (extraHeaderPages) {
    const pages = addExtraPages(extraHeaderPages)
    if (forks) {
      nav.push(...pages.filter(p => p.link !== '/forks'))
    } else {
      nav.push(...pages)
    }
  }
  if (extraPublicContent) {
    log(`   Add extras Vitepress public folder content.`, 'info')
    addContent(extraPublicContent, resolve(DOCPRESS_DIR, 'public'))
  }
  if (extraTheme) {
    log(`   Add extras Vitepress theme files.`, 'info')
    addContent(extraTheme, resolve(VITEPRESS_USER_THEME))
  }
  if (forks && username) {
    log(`   Add fork page to display external contributions.`, 'info')
    await processForks(repositories.forks, username, token)
    nav.push({ text: 'Forks', link: '/forks' })
  }

  const config = getVitepressConfig(sidebar, nav, vitepressConfig)

  generateVitepressFiles(config, index)
}
