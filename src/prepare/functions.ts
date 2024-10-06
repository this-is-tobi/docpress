import { basename, dirname, parse, resolve } from 'node:path'
import { cpSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import YAML from 'yaml'
import type { defineConfig } from 'vitepress'
import type { getUserInfos } from '../utils/functions.js'
import { createDir, extractFiles, getMdFiles, prettifyName, renameFile } from '../utils/functions.js'
import { INDEX_PATH, PROJECTS_PATH, VITEPRESS_CONFIG_PATH } from '../utils/const.js'
import type { EnhancedRepository } from '../fetch/functions.js'
import { replaceReadmePath, replaceRelativePath } from '../utils/regex.js'
import { addSources, generateFeatures, generateIndex, generateSidebarPages, generateSidebarProject } from './utils.js'
import type { Feature, Index, Page, SidebarProject } from './utils.js'

export function transformDoc(repositories: EnhancedRepository[], user: ReturnType<typeof getUserInfos>) {
  const features: Feature[] = []
  const sidebar: SidebarProject[] = []

  for (const repository of repositories) {
    getMdFiles([repository.docpress.projectPath]).forEach((file) => {
      replaceRelativePath(file, `https://github.com/${repository.owner.login}/${repository.name}/tree/${repository.docpress.branch}`)

      if (basename(file).toLowerCase() === 'readme.md') {
        replaceReadmePath(file, `https://github.com/${repository.owner.login}/${repository.name}/tree/${repository.docpress.branch}`)
      }
    })

    const sidebarItems = readdirSync(repository.docpress.projectPath)
      .filter((file) => {
        return statSync(resolve(repository.docpress.projectPath, file)).isFile()
          && basename(resolve(repository.docpress.projectPath, file)).endsWith('.md')
      })
      .sort((a, b) => a.localeCompare(b))
      .reduce((acc: Page[], cur, idx, arr) => {
        const filename = renameFile(resolve(repository.docpress.projectPath, cur))

        if (idx === arr.length - 1) {
          const sourceFile = arr.length > 1
            ? resolve(repository.docpress.projectPath, 'sources.md')
            : resolve(repository.docpress.projectPath, 'readme.md')
          addSources(repository.html_url, sourceFile)
        }

        return generateSidebarPages(repository.name, parse(filename).name, acc)
      }, [])

    sidebar.push(generateSidebarProject(repository.name, sidebarItems))
    features.push(...generateFeatures(repository.name, repository.description || ''))
  }

  const index = generateIndex(features, user)
  return { sidebar, index }
}

export function addExtraPages(paths: string[]) {
  const files = getMdFiles(paths)
  const nav: Page[] = []

  for (const file of files) {
    const src = resolve(process.cwd(), file)
    const dest = resolve(PROJECTS_PATH, basename(file))
    cpSync(src, dest)
    nav.push({ text: prettifyName(parse(src).name), link: `/${parse(src).name}` })
  }
  return nav
}

export function addContent(path: string | string[], dir: string, fn?: () => void) {
  const files = extractFiles(path)

  for (const file of files) {
    const src = resolve(process.cwd(), file)
    const dest = resolve(dir, basename(file))
    if (fn) {
      fn()
    }
    cpSync(src, dest)
  }
}

export function parseVitepressConfig(path: string) {
  return JSON.parse(readFileSync(resolve(process.cwd(), path)).toString())
}

export function generateVitepressFiles(vitepressConfig: Partial<ReturnType<typeof defineConfig>>, index: Index) {
  createDir(dirname(VITEPRESS_CONFIG_PATH))

  writeFileSync(VITEPRESS_CONFIG_PATH, `import { defineConfig } from 'vitepress'\n\nexport default defineConfig(${JSON.stringify(vitepressConfig, null, 2)})\n`)
  writeFileSync(INDEX_PATH, '---\n'.concat(YAML.stringify(index)))
}
