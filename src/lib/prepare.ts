import { basename, dirname, parse, resolve } from 'node:path'
import { appendFileSync, cpSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import YAML from 'yaml'
import type { defineConfig } from 'vitepress'
import { generateFile } from '../utils/templates.js'
import type { GlobalOpts } from '../schemas/global.js'
import type { getUserInfos } from '../utils/functions.js'
import { createDir, extractFiles, getMdFiles, prettify } from '../utils/functions.js'
import { DOCS_DIR, FORKS_FILE, INDEX_FILE, TEMPLATE_THEME, VITEPRESS_CONFIG, VITEPRESS_THEME } from '../utils/const.js'
import { replaceReadmePath, replaceRelativePath } from '../utils/regex.js'
import { log } from '../utils/logger.js'
import type { EnhancedRepository } from './fetch.js'
import type { getInfos } from './git.js'
import { getContributors } from './git.js'

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

export function addSources(repoUrl: string, outputPath: string) {
  const fileName = basename(outputPath)
  const title = fileName === 'introduction.md' ? '\n## Sources' : '# Sources'

  const sourcesContent = `${title}\n\nTake a look at the [project sources](${repoUrl}).\n`

  appendFileSync(outputPath, sourcesContent, 'utf8')
}

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
    link: `/${repoName}/introduction`,
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
    text: fileName === 'introduction' ? 'Introduction' : prettify(fileName, { mode: 'capitalize', replaceDash: true }),
    link: `/${repoName}/${fileName}`,
  }

  return sidebarPages ? [...sidebarPages, content] : [content]
}

export function transformDoc(repositories: EnhancedRepository[], user: ReturnType<typeof getUserInfos>) {
  const features: Feature[] = []
  const sidebar: SidebarProject[] = []

  for (const repository of repositories) {
    log(`   Replace urls for repository '${repository.name}'.`, 'info')
    getMdFiles([repository.docpress.projectPath]).forEach((file) => {
      log(`   Processing file '${basename(file)}' for repository '${repository.name}'.`, 'debug')
      replaceRelativePath(file, `https://github.com/${repository.owner.login}/${repository.name}/tree/${repository.docpress.branch}`)

      if (basename(file).toLowerCase() === 'readme.md') {
        replaceReadmePath(file, `https://github.com/${repository.owner.login}/${repository.name}/tree/${repository.docpress.branch}`)
      }
    })

    log(`   Generate sidebar for repository '${repository.name}'.`, 'info')
    const sidebarItems = readdirSync(repository.docpress.projectPath)
      .filter((file) => {
        return statSync(resolve(repository.docpress.projectPath, file)).isFile()
          && basename(resolve(repository.docpress.projectPath, file)).endsWith('.md')
      })
      .sort((a, b) => a.localeCompare(b))
      .reduce((acc: Page[], cur, idx, arr) => {
        const file = resolve(repository.docpress.projectPath, cur)
        let filename = prettify(basename(file), { mode: 'lowercase', removeIdx: true })

        if (filename === 'readme.md') {
          filename = 'introduction.md'
        }
        if (filename !== basename(file)) {
          renameSync(file, resolve(dirname(file), filename))
        }

        if (idx === arr.length - 1) {
          let sourceFile
          if (arr.length > 1) {
            sourceFile = resolve(repository.docpress.projectPath, 'sources.md')
            log(`   Add sources for repository '${repository.name}'.`, 'info')
            addSources(repository.html_url, sourceFile)

            return generateSidebarPages(
              repository.name,
              parse(sourceFile).name,
              generateSidebarPages(repository.name, parse(filename).name, acc),
            )
          }
          sourceFile = resolve(repository.docpress.projectPath, filename)
          addSources(repository.html_url, sourceFile)
        }

        return generateSidebarPages(prettify(repository.name, { removeDot: true }), parse(filename).name, acc)
      }, [])

    sidebar.push(generateSidebarProject(prettify(repository.name, { removeDot: true }), sidebarItems))
    features.push(...generateFeatures(prettify(repository.name, { removeDot: true }), repository.description || ''))
  }

  log(`   Generate index content.`, 'info')
  const index = generateIndex(features.sort((a, b) => a.title.localeCompare(b.title)), user)
  return {
    sidebar: sidebar.sort((a, b) => a.text.localeCompare(b.text)),
    index,
  }
}

export function addExtraPages(paths: string[]) {
  const files = getMdFiles(paths)
  const nav: Page[] = []

  log(`   Add extras Vitepress headers pages.`, 'info')
  for (const file of files) {
    log(`   Processing file '${file}'.`, 'debug')
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

export function addContent(paths: string | string[], dir: string, fn?: () => void) {
  for (const path of Array.isArray(paths) ? paths : [paths]) {
    const absolutePath = resolve(process.cwd(), path)
    const files = extractFiles(absolutePath)

    for (const file of files) {
      const formattedFile = file.replace(absolutePath, '.')
      log(`   Processing file '${formattedFile}' for entry '${path}'.`, 'debug')
      const src = resolve(process.cwd(), file)
      const dest = resolve(dir, formattedFile)
      if (fn) {
        fn()
      }
      cpSync(src, dest)
    }
  }
}

export function addForkPage(forks: { repository: Awaited<ReturnType<typeof getInfos>>['repos'][number], contributions: number }[]) {
  const separator = '---\n'
  const header = 'layout: fork-page\nrepoList:\n'
  const text = '\n# External contributions\n\nThis gallery is a visual representation of the collaborative work done across a variety of open-source projects, each driven by a shared passion for innovation and community growth.\n\nEvery tile below represents a unique project where contributions have been made-ranging from code enhancements to documentation improvements. Each project includes a summary of its goals, features, and links to GitHub for direct access.\n\nThis page serves as both a portfolio of past work and a resource for revisiting projects that have made a meaningful impact.\n'
  const frontmatter = forks.map(({ repository, contributions }) => {
    const { name, owner, html_url, description, stargazers_count } = repository
    return { name, owner: owner.login, html_url, description, stargazers_count, contributions }
  })
  log(`   Generate forks page.`, 'info')
  writeFileSync(FORKS_FILE, separator.concat(header, YAML.stringify(frontmatter), separator, text))
}

type Source = Required<Awaited<ReturnType<typeof getContributors>>['source']>

type AdaptedLicense = Omit<NonNullable<Source>['license'], 'spdx_id'> & { spdx_id?: string }

type AdaptedRepository = Omit<NonNullable<Source>, 'license'> & { license: AdaptedLicense }

export async function processForks(repositories: EnhancedRepository[], username: GlobalOpts['username'], token?: GlobalOpts['token']) {
  const forks = await Promise.all(
    repositories.map(async (repository) => {
      const { source, contributors } = await getContributors({ repository, token })
      return {
        contributions: contributors?.find(contributor => contributor.login === username)?.contributions ?? 0,
        repository: source as AdaptedRepository,
      }
    }),
  ).then(f => f.filter(({ repository, contributions }) => !!repository && contributions))

  addForkPage(forks)
}

export function parseVitepressConfig(path: string) {
  return JSON.parse(readFileSync(resolve(process.cwd(), path)).toString())
}

export function generateVitepressFiles(vitepressConfig: Partial<ReturnType<typeof defineConfig>>, index: Index) {
  const separator = '---\n'
  createDir(dirname(VITEPRESS_CONFIG))

  log(`   Generate Vitepress config.`, 'info')
  writeFileSync(VITEPRESS_CONFIG, `export default ${JSON.stringify(vitepressConfig, null, 2)}\n`)
  log(`   Generate index file.`, 'info')
  writeFileSync(INDEX_FILE, separator.concat(YAML.stringify(index), separator))
  log(`   Add Docpress theme files.`, 'info')
  return extractFiles(TEMPLATE_THEME).forEach((path) => {
    const relativePath = path.replace(`${TEMPLATE_THEME}/`, '')
    generateFile(path, resolve(VITEPRESS_THEME, relativePath))
  })
}
