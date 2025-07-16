import { basename, dirname, parse, resolve } from 'node:path'
import { appendFileSync, cpSync, existsSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import YAML from 'yaml'
import type { defineConfig } from 'vitepress'
import type { PrepareOpts } from '../schemas/prepare.js'
import { generateFile } from '../utils/templates.js'
import type { GlobalOpts } from '../schemas/global.js'
import { createDir, extractFiles, getMdFiles, getUserInfos, getUserRepos, prettify } from '../utils/functions.js'
import { DOCPRESS_DIR, DOCS_DIR, FORKS_FILE, INDEX_FILE, TEMPLATE_THEME, VITEPRESS_CONFIG, VITEPRESS_THEME, VITEPRESS_USER_THEME } from '../utils/const.js'
import { replaceReadmePath, replaceRelativePath } from '../utils/regex.js'
import { log } from '../utils/logger.js'
import type { EnhancedRepository } from './fetch.js'
import type { getInfos } from './git.js'
import { getContributors } from './git.js'
import { getVitepressConfig } from './vitepress.js'

export interface Page {
  text: string
  link: string
}

export interface SidebarProject {
  text: string
  collapsed: boolean
  items: (Page | SidebarProject)[]
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
    tagline?: string
  }
  features: Feature[]
}

export async function prepareDoc({ extraHeaderPages, extraPublicContent, extraTheme, vitepressConfig, forks, token, username, websiteTitle, websiteTagline }: Omit<PrepareOpts, 'usernames' | 'branch' | 'gitProvider' | 'reposFilter'> & { username: PrepareOpts['usernames'][number] }) {
  const user = getUserInfos(username)
  const repositories = getUserRepos(username)
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

  const websiteInfos = { title: websiteTitle, tagline: websiteTagline }
  const { index, sidebar } = transformDoc(repositories.internals, user, websiteInfos)

  let finalSB
  let finalIndex
  if (existsSync(INDEX_FILE) && existsSync(VITEPRESS_CONFIG)) {
    const actualConfig = await parseVitepressConfig(VITEPRESS_CONFIG)
    const actualIndex = await parseVitepressIndex(INDEX_FILE)
    finalSB = [
      ...(actualConfig.themeConfig?.sidebar as SidebarProject[] ?? []),
      ...sidebar,
    ].sort((a, b) => a.text.localeCompare(b.text))
    finalIndex = {
      ...index,
      features: [
        ...actualIndex.features,
        ...index.features,
      ].sort((a, b) => a.title.localeCompare(b.title)),
    }
  } else {
    finalSB = sidebar
    finalIndex = index
  }
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
  if (forks && username.length) {
    log(`   Add fork page to display external contributions.`, 'info')
    await processForks(repositories.forks, username, token)
    nav.push({ text: 'Forks', link: '/forks' })
  }

  const config = getVitepressConfig(finalSB, nav, vitepressConfig)

  generateVitepressFiles(config, finalIndex)
}

export function addSources(repoUrl: string, outputPath: string) {
  const fileName = basename(outputPath)
  const title = prettify(fileName, { mode: 'lowercase', removeIdx: true }) === 'readme.md' ? '\n## Sources' : '# Sources'

  const sourcesContent = `${title}\n\nTake a look at the [project sources](${repoUrl}).\n`

  appendFileSync(outputPath, sourcesContent, 'utf8')
}

export interface WebsiteInfos {
  title?: string
  tagline?: string
}

export function generateIndex(features: Feature[], user: ReturnType<typeof getUserInfos>, websiteInfos: WebsiteInfos) {
  const { name, login, bio } = user
  const { title, tagline } = websiteInfos

  const hero = title
    ? { name: title, tagline }
    : { name: name ? `${name}'s projects` : `${login}'s projects`, tagline: bio ?? 'Robots are everywhere 🤖' }

  return {
    layout: 'home',
    hero,
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

export function generateSidebarProject(repoName: string, sidebarPages: (SidebarProject | Page)[]) {
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

export function generateSidebarItems(repository: EnhancedRepository, obj: any): (SidebarProject | Page)[] {
  return Object.entries(obj).flatMap(([key, value]): (SidebarProject | Page)[] => {
    if (key === '$') {
      if (Array.isArray(value)) {
        return value.map((element) => {
          const file = resolve(repository.docpress.projectPath, element)
          let filename = prettify(basename(file), { mode: 'lowercase', removeIdx: true })
          if (filename === 'readme.md') {
            filename = 'introduction.md'
          }
          if (filename !== basename(file)) {
            renameSync(file, resolve(dirname(file), filename))
          }

          return {
            text: parse(filename).name === 'introduction'
              ? 'Introduction'
              : prettify(filename, { mode: 'capitalize', replaceDash: true, removeExt: true }),
            link: prettify(`/${repository.name}/${parse(filename).name}`, { removeDot: true }),
          } as Page
        })
      }
      return []
    } else if (typeof value === 'object') {
      return [{
        text: prettify(key, { mode: 'capitalize', replaceDash: true }),
        collapsed: true,
        items: generateSidebarItems({ ...repository, name: `${repository.name}/${key}` }, value),
      } as SidebarProject]
    }

    return []
  })
}

export function buildTree(files: string[]): any {
  return files.reduce((tree, file) => {
    const [first, ...rest] = file.split('/')
    if (!rest.length) {
      // eslint-disable-next-line dot-notation
      tree['$'] = [...(tree['$'] || []), first]
    } else {
      tree[first] = buildTree([
        ...(tree[first] ? flattenTree(tree[first], '') : []),
        rest.join('/'),
      ])
    }
    return tree
  }, {} as Record<string, any>)
}

export function flattenTree(subtree: any, prefix = ''): string[] {
  return Object.entries(subtree).flatMap(([key, value]) => {
    if (key === '$') {
      if (Array.isArray(value)) {
        return value.map((v: string) => (prefix ? `${prefix}/${v}` : v))
      } else {
        return []
      }
    }
    return flattenTree(value, prefix ? `${prefix}/${key}` : key)
  })
}

function moveSourcesLast(arr: (SidebarProject | Page)[]) {
  if (!Array.isArray(arr)) {
    return arr
  }
  const sourcesIdx = arr.findIndex(item => item.text === 'Sources')
  if (sourcesIdx === -1) {
    return arr
  }
  const [sources] = arr.splice(sourcesIdx, 1)
  arr.push(sources)
  return arr
}

export function transformDoc(repositories: EnhancedRepository[], user: ReturnType<typeof getUserInfos>, websiteInfos: WebsiteInfos) {
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
    const projectFiles = readdirSync(repository.docpress.projectPath, { recursive: true })
      .filter((file) => {
        return statSync(resolve(repository.docpress.projectPath, file.toString())).isFile()
          && basename(resolve(repository.docpress.projectPath, file.toString())).endsWith('.md')
      }) as string[]

    log(`   Add sources for repository '${repository.name}'.`, 'info')
    let sourceFile
    if (projectFiles.length > 1) {
      sourceFile = resolve(repository.docpress.projectPath, 'sources.md')
      projectFiles.push('sources.md')
    } else {
      sourceFile = resolve(repository.docpress.projectPath, projectFiles[0])
    }
    addSources(repository.html_url, sourceFile)

    const projectTree = buildTree(projectFiles)
    const sidebarItems = moveSourcesLast(generateSidebarItems(repository, projectTree))

    sidebar.push(generateSidebarProject(prettify(repository.name, { removeDot: true }), sidebarItems))
    features.push(...generateFeatures(prettify(repository.name, { removeDot: true }), repository.description || ''))
  }

  log(`   Generate index content.`, 'info')
  const index = generateIndex(features.toSorted((a, b) => a.title.localeCompare(b.title)), user, websiteInfos)
  return {
    sidebar: sidebar.toSorted((a, b) => a.text.localeCompare(b.text)),
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

export async function processForks(repositories: EnhancedRepository[], username: GlobalOpts['usernames'][number], token?: GlobalOpts['token']) {
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

export async function parseVitepressConfig(path: string): Promise<Partial<ReturnType<typeof defineConfig>>> {
  const { config } = await import(resolve(process.cwd(), path)).catch(e => e)
  return config
}

export async function parseVitepressIndex(path: string): Promise<Index> {
  const index = (await readFile(resolve(process.cwd(), path))).toString()
  return YAML.parse(index)
}

export function generateVitepressFiles(vitepressConfig: Partial<ReturnType<typeof defineConfig>>, index: Index) {
  const separator = '---\n'
  createDir(dirname(VITEPRESS_CONFIG))

  log(`   Generate Vitepress config.`, 'info')
  writeFileSync(VITEPRESS_CONFIG, `export const config = ${JSON.stringify(vitepressConfig, null, 2)}\n\nexport default config\n`)
  log(`   Generate index file.`, 'info')
  writeFileSync(INDEX_FILE, separator.concat(YAML.stringify(index)))
  log(`   Add Docpress theme files.`, 'info')
  return extractFiles(TEMPLATE_THEME).forEach((path) => {
    const relativePath = path.replace(`${TEMPLATE_THEME}/`, '')
    generateFile(path, resolve(VITEPRESS_THEME, relativePath))
  })
}
