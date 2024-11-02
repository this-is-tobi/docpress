import { basename, dirname, parse, resolve } from 'node:path'
import { appendFileSync, cpSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import YAML from 'yaml'
import type { defineConfig } from 'vitepress'
import type { getUserInfos } from '../utils/functions.js'
import { createDir, extractFiles, getMdFiles, prettify } from '../utils/functions.js'
import { DOCS_DIR, INDEX_FILE, VITEPRESS_CONFIG } from '../utils/const.js'
import { replaceReadmePath, replaceRelativePath } from '../utils/regex.js'
import type { EnhancedRepository } from './fetch.js'

export interface Page {
  text: string
  link: string
}

export interface SidebarProject {
  text: string
  collapsed: boolean
  items: Page[]
}

export interface Feature {
  title: string
  details: string
  link: string
}

export interface Index {
  layout: string
  hero: {
    name: string
    tagline: string
  }
  features: Feature[]
}

function addSources(repoUrl: string, outputPath: string) {
  const fileName = basename(outputPath)
  const title = fileName === 'readme.md' ? '\n## Sources' : '# Sources'

  const sourcesContent = `${title}\n\nTake a look at the [project sources](${repoUrl}).\n`

  appendFileSync(outputPath, sourcesContent, 'utf8')
}

// export function addContribution(outputPath: string) {
//   const sourcesContent = `
// If you'd like to improve or fix the code, check out the [contribution guidelines](/contribute).
// `

//   appendFileSync(outputPath, sourcesContent, 'utf8')
// }

export function generateIndex(features: Feature[], user: ReturnType<typeof getUserInfos>) {
  const { name, login, bio } = user
  return {
    layout: 'home',
    hero: {
      name: name ? `${name}'s projects` : `${login}'s projects`,
      tagline: bio ?? 'Robots are everywhere 🤖', // \U0001F916
    },
    features,
  }
}

export function generateFeatures(repoName: string, description: string, features?: Feature[]) {
  const content = {
    title: prettify(repoName, { mode: 'capitalize', replaceDash: true }),
    details: description,
    link: `/${repoName}/readme`,
  }

  return features ? [...features, content] : [content]
}

export function generateSidebarProject(repoName: string, sidebarPages: Page[]) {
  return {
    text: prettify(repoName, { mode: 'capitalize', replaceDash: true }),
    collapsed: true,
    items: sidebarPages,
  }
}

export function generateSidebarPages(repoName: string, fileName: string, sidebarPages?: Page[]) {
  const content = {
    text: fileName === 'readme' ? 'Introduction' : prettify(fileName, { mode: 'capitalize', replaceDash: true }),
    link: `/${repoName}/${fileName}`,
  }

  return sidebarPages ? [...sidebarPages, content] : [content]
}

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
        const file = resolve(repository.docpress.projectPath, cur)
        const filename = prettify(basename(file), { mode: 'lowercase', removeIdx: true })

        if (filename !== basename(file)) {
          renameSync(file, resolve(dirname(file), filename))
        }

        if (idx === arr.length - 1) {
          let sourceFile
          if (arr.length > 1) {
            sourceFile = resolve(repository.docpress.projectPath, 'sources.md')
            addSources(repository.html_url, sourceFile)

            return generateSidebarPages(
              repository.name,
              parse(sourceFile).name,
              generateSidebarPages(repository.name, parse(filename).name, acc),
            )
          }
          sourceFile = resolve(repository.docpress.projectPath, 'readme.md')
          addSources(repository.html_url, sourceFile)
        }

        return generateSidebarPages(repository.name, parse(filename).name, acc)
      }, [])

    sidebar.push(generateSidebarProject(repository.name, sidebarItems))
    features.push(...generateFeatures(repository.name, repository.description || ''))
  }

  const index = generateIndex(features.sort((a, b) => a.title.localeCompare(b.title)), user)
  return {
    sidebar: sidebar.sort((a, b) => a.text.localeCompare(b.text)),
    index,
  }
}

export function addExtraPages(paths: string[]) {
  const files = getMdFiles(paths)
  const nav: Page[] = []

  for (const file of files) {
    const src = resolve(process.cwd(), file)
    const dest = resolve(DOCS_DIR, prettify(basename(file), { mode: 'lowercase', removeIdx: true }))
    cpSync(src, dest)
    nav.push({
      text: prettify(parse(src).name, { replaceDash: true, removeIdx: true }),
      link: `/${prettify(parse(src).name, { removeIdx: true, mode: 'lowercase' })}`,
    })
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
  createDir(dirname(VITEPRESS_CONFIG))

  writeFileSync(VITEPRESS_CONFIG, `import { defineConfig } from 'vitepress'\n\nexport default defineConfig(${JSON.stringify(vitepressConfig, null, 2)})\n`)
  writeFileSync(INDEX_FILE, '---\n'.concat(YAML.stringify(index)))
}
