import { appendFileSync, cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, parse, resolve } from 'node:path'
import YAML from 'yaml'
import { NAV_PATH, TEMPLATES_PATH } from '../index.js'
import { prettifyName } from './functions.js'

interface RepoSidebarItem {
  text: string
  link: string
}
export type RepoSidebar = RepoSidebarItem[]

interface RepoIndexItem {
  title: string
  details: string
  link: string
}
export type RepoIndex = RepoIndexItem[]

export function addSources(repoUrl: string, outputPath: string) {
  const fileName = basename(outputPath)
  const title = fileName === 'readme.md' ? '## Sources' : '# Sources'

  const sourcesContent = `
${title}

Take a look at the [project sources](${repoUrl}).

If you'd like to improve or fix the code, check out the [contribution guidelines](/contribute).
`

  appendFileSync(outputPath, sourcesContent, 'utf8')
}

export function generateExtraPages(projectsPath: string, files: string[]) {
  const nav: Record<string, string>[] = []
  for (const file of files) {
    const src = resolve(process.cwd(), file)
    const dest = resolve(projectsPath, basename(file))
    cpSync(src, dest)
    nav.push({ text: prettifyName(parse(src).name), link: `/${parse(src).name}` })
  }
  writeFileSync(NAV_PATH, JSON.stringify(nav))
}

export function generateIndex(indexPath: string, repo: string, description: string) {
  const content = {
    title: prettifyName(repo),
    details: description,
    link: `/${repo}/readme`,
  }
  let index

  if (existsSync(indexPath)) {
    index = YAML.parse(readFileSync(indexPath).toString())
  } else {
    index = YAML.parse(readFileSync(resolve(TEMPLATES_PATH, 'index.md')).toString())
  }
  index.features.push(content)
  writeFileSync(indexPath, '---\n'.concat(YAML.stringify(index)))
}

export function generateGlobalSidebar(configPath: string, repo: string, repoSidebar: RepoSidebar) {
  const content = {
    text: prettifyName(repo),
    collapsed: true,
    items: repoSidebar,
  }

  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, 'utf8'))
    writeFileSync(configPath, JSON.stringify([...config, content], null, 2))
  } else {
    writeFileSync(configPath, JSON.stringify([content], null, 2))
  }
}

export function generateRepoSidebar(repo: string, filename: string, repoSidebar: RepoSidebar | undefined): RepoSidebar {
  const content = {
    text: filename === 'readme' ? 'Introduction' : prettifyName(filename),
    link: `/${repo}/${filename}`,
  }
  return repoSidebar ? [...repoSidebar, content] : [content]
}
