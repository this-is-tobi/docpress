import type { DefaultTheme, defineConfig } from 'vitepress'
import type { GlobalOpts } from '../schemas/global.js'
import type { PrepareOpts } from '../schemas/prepare.js'
import type { EnhancedRepository } from './fetch.js'
import type { Contribution } from './git.js'
import { appendFileSync, cpSync, existsSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, dirname, parse, resolve } from 'node:path'
import YAML from 'yaml'
import { CONTRIBUTIONS_FILE, DOCPRESS_DIR, DOCS_DIR, INDEX_FILE, TEMPLATE_THEME, VITEPRESS_CONFIG, VITEPRESS_THEME, VITEPRESS_USER_THEME } from '../utils/const.js'
import { createDir, deepMerge, extractFiles, formatError, getMdFiles, getUserInfos, getUserRepos, isFile, parseFrontmatter, prettify, replaceInternalMdLinks, replaceReadmePath, replaceRelativePath } from '../utils/functions.js'
import { log } from '../utils/logger.js'
import { generateFile } from '../utils/templates.js'
import { getContributions, sortContributions } from './git.js'
import { getVitepressConfig } from './vitepress.js'

/**
 * Route of the generated contributions page
 */
export const CONTRIBUTIONS_ROUTE = '/contributions'

/**
 * Layout of the contributions page, resolved by Vue to the `ContributionsPage` component
 */
export const CONTRIBUTIONS_LAYOUT = 'contributions-page'

/**
 * Introduction of the contributions page when the user does not write one
 */
const DEFAULT_CONTRIBUTIONS_INTRO = '# Contributions\n\nPull requests merged into open source projects maintained by others.\n'

/**
 * Header page names that supply the contributions page introduction rather than a page
 * of their own, `forks` being the name it had before
 */
const CONTRIBUTIONS_PAGE_NAMES = ['contributions', 'forks']

/**
 * Represents a navigation page item with text and link
 */
export interface Page {
  text: string
  link: string
}

/**
 * Represents a sidebar project with nested items
 */
export interface SidebarProject {
  text: string
  collapsed?: boolean
  items: (Page | SidebarProject)[]
}

/**
 * Collapse behaviour applied to generated sidebar groups, mirroring Vitepress
 * semantics: `true` collapses groups by default, `false` expands them and
 * `null` makes them plain, non-collapsible sections
 */
export type SidebarCollapsed = boolean | null

/**
 * Shape of the generated sidebar: `single` emits one flat list holding every
 * repository, `multi` emits one sidebar per repository keyed by its route so
 * each project only shows its own pages
 */
export type SidebarMode = 'single' | 'multi'

/**
 * Options driving sidebar generation
 */
export interface SidebarOpts {
  mode?: SidebarMode
  collapsed?: SidebarCollapsed
  /** Words kept exactly as written in every generated label, home page titles included */
  acronyms?: string[]
}

/**
 * Builds the Vitepress `collapsed` property for a sidebar group, omitting it
 * entirely when groups should not be collapsible
 *
 * @param collapsed - Configured collapse behaviour
 * @returns An object holding the `collapsed` key, or an empty object
 */
function collapsedProp(collapsed: SidebarCollapsed) {
  return collapsed === null ? {} : { collapsed }
}

/**
 * Represents a feature to display on the index page
 */
export interface Feature {
  title: string
  details: string
  link: string
}

/**
 * Hero section of the VitePress home page
 */
export interface Hero {
  name?: string
  text?: string
  tagline?: string
  /** Image shown beside the text, `null` to show none */
  image?: string | Record<string, unknown> | null
  actions?: { text: string, link: string, theme?: 'brand' | 'alt' }[]
}

/**
 * Represents the structure of the VitePress index page
 */
export interface Index {
  layout: string
  hero: Hero
  /** List of features to display */
  features: Feature[]
}

/**
 * Prepares the documentation structure for a user's repositories
 *
 * @param options - Options for documentation preparation
 * @param options.extraHeaderPages - Array of paths to additional header pages
 * @param options.extraPublicContent - Array of paths to additional public content
 * @param options.extraTheme - Array of paths to additional theme files
 * @param options.vitepressConfig - Path to the VitePress configuration file
 * @param options.contributions - Flag to generate the contributions page
 * @param options.contributionsFilter - Owners or repositories kept on, or hidden from, the contributions page
 * @param options.gitProvider - Git provider used to retrieve data
 * @param options.hero - Hero settings merged over the generated home page hero
 * @param options.lastUpdated - Flag to display each page's last Git commit date, computed by the fetch step
 * @param options.sidebarMode - Shape of the generated sidebar, one flat list or one sidebar per repository
 * @param options.sidebarCollapsed - Collapse behaviour applied to generated sidebar groups
 * @param options.acronyms - Words kept exactly as written in generated labels
 * @param options.token - Git provider token for API access
 * @param options.username - Git provider username to fetch repositories for
 * @param options.websiteTitle - Custom title for the documentation website
 * @param options.websiteTagline - Custom tagline for the documentation website
 */
export async function prepareDoc({ extraHeaderPages, extraPublicContent, extraTheme, vitepressConfig, contributions, contributionsFilter, gitProvider, hero, lastUpdated, sidebarMode, sidebarCollapsed, acronyms, token, username, websiteTitle, websiteTagline }: Omit<PrepareOpts, 'usernames' | 'branch' | 'reposFilter'> & { username: PrepareOpts['usernames'][number] }) {
  // Merged pull requests are searched through the GitHub API, which GitLab has no equivalent of
  const contributionsEnabled = contributions && gitProvider !== 'gitlab'
  if (contributions && !contributionsEnabled) {
    log(`   The contributions page is not supported with the 'gitlab' provider, skipping.`, 'warn')
  }
  const user = getUserInfos(username)
  const repositories = getUserRepos(username)
    .filter(({ clone_url, private: privateRepo, fork, docpress }) => clone_url && !privateRepo && !fork && !docpress.filtered && docpress.includes.length)

  const websiteInfos = { title: websiteTitle, tagline: websiteTagline, hero }
  const { index, sidebar } = transformDoc(repositories, user, websiteInfos, { mode: sidebarMode, collapsed: sidebarCollapsed, acronyms })

  let finalSB
  let finalIndex
  if (existsSync(INDEX_FILE) && existsSync(VITEPRESS_CONFIG)) {
    const actualConfig = await parseVitepressConfig(VITEPRESS_CONFIG)
    const actualIndex = await parseVitepressIndex(INDEX_FILE)
    finalSB = mergeSidebars(actualConfig.themeConfig?.sidebar, sidebar)
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

  // A header page named after the contributions page writes its introduction, rather
  // than a page of its own that the generated one would overwrite
  const contributionsIntro = contributionsEnabled && extraHeaderPages
    ? getMdFiles(extraHeaderPages).find(isContributionsPage)
    : undefined
  if (extraHeaderPages) {
    nav.push(...addExtraPages(extraHeaderPages, contributionsIntro ? [contributionsIntro] : []))
  }
  if (extraPublicContent) {
    log(`   Add extras Vitepress public folder content.`, 'info')
    addContent(extraPublicContent, resolve(DOCPRESS_DIR, 'public'))
  }
  if (extraTheme) {
    log(`   Add extras Vitepress theme files.`, 'info')
    addContent(extraTheme, resolve(VITEPRESS_USER_THEME))
  }
  if (contributionsEnabled && username.length) {
    log(`   Add contributions page to display merged pull requests.`, 'info')
    if (await processContributions({ username, token, filter: contributionsFilter, introPage: contributionsIntro })) {
      nav.push({ text: (contributionsIntro && getNavTitle(contributionsIntro)) || 'Contributions', link: CONTRIBUTIONS_ROUTE })
    }
  }

  // Vitepress only renders the last updated date once its own "lastUpdated" flag is on;
  // default it to true when the docpress equivalent is enabled, without overriding an explicit user choice
  const finalVitepressConfig = lastUpdated ? { lastUpdated: true, ...vitepressConfig } : vitepressConfig
  const config = getVitepressConfig(finalSB, nav, finalVitepressConfig)

  generateVitepressFiles(config, finalIndex)
}

/**
 * Adds a source reference section to a markdown file
 *
 * @param repoUrl - URL of the GitHub repository
 * @param outputPath - Path to the markdown file where sources will be added
 */
export function addSources(repoUrl: string, outputPath: string) {
  const fileName = basename(outputPath)
  const title = prettify(fileName, { mode: 'lowercase', removeIdx: true }) === 'readme.md' ? '\n## Sources' : '# Sources'

  const sourcesContent = `${title}\n\nTake a look at the [project sources](${repoUrl}).\n`

  appendFileSync(outputPath, sourcesContent, 'utf8')
}

/**
 * Information about website title and tagline
 */
export interface WebsiteInfos {
  title?: string
  tagline?: string
  /** Hero settings merged over the generated hero */
  hero?: Hero
}

/**
 * Generates the index page content for the documentation site
 *
 * @param features - Array of features to display on the homepage
 * @param user - User information retrieved from GitHub
 * @param websiteInfos - Custom title and tagline information
 * @returns An object with index page configuration
 */
export function generateIndex(features: Feature[], user: ReturnType<typeof getUserInfos>, websiteInfos: WebsiteInfos): Index {
  const { name, login, bio, avatar_url } = user
  const { title, tagline, hero: heroSettings } = websiteInfos

  const hero: Hero = {
    ...(title
      ? { name: title, tagline }
      : { name: name ? `${name}'s projects` : `${login}'s projects`, tagline: bio ?? 'Robots are everywhere 🤖' }),
    ...(avatar_url ? { image: { src: avatar_url, alt: name ?? login } } : {}),
  }

  return {
    layout: 'home',
    // Settings win over the generated values, and a `null` image hides the avatar
    hero: heroSettings ? deepMerge<Hero>(hero, heroSettings) : hero,
    features,
  }
}

/**
 * Generates feature cards for the homepage
 *
 * @param repoName - Name of the repository
 * @param description - Description of the repository
 * @param features - Optional existing features to append to
 * @param routePrefix - Route prefix namespacing the repository in multi-user runs
 * @param acronyms - Words kept exactly as written in the title
 * @returns Array of feature objects for the homepage
 */
export function generateFeatures(repoName: string, description: string, features?: Feature[], routePrefix: string = '', acronyms: string[] = []) {
  const content: Feature = {
    title: prettify(repoName, { mode: 'capitalize', replaceDash: true, acronyms }),
    details: description,
    link: `/${routePrefix}${prettify(repoName, { removeDot: true })}/introduction`,
  }

  return features ? [...features, content] : [content]
}

/**
 * Generates a sidebar project entry for the documentation navigation
 *
 * @param repoName - Name of the repository
 * @param sidebarPages - Array of sidebar pages to include in this project
 * @param collapsed - Collapse behaviour applied to the generated group
 * @param acronyms - Words kept exactly as written in the group label
 * @returns A sidebar project configuration object
 */
export function generateSidebarProject(repoName: string, sidebarPages: (SidebarProject | Page)[], collapsed: SidebarCollapsed = true, acronyms: string[] = []) {
  return {
    text: prettify(repoName, { mode: 'capitalize', replaceDash: true, acronyms }),
    ...collapsedProp(collapsed),
    items: sidebarPages,
  }
}

/**
 * Generates sidebar page entries for the documentation navigation
 *
 * @param repoName - Name of the repository
 * @param fileName - Name of the file
 * @param sidebarPages - Optional existing sidebar pages to append to
 * @returns Array of page objects for the sidebar
 */
export function generateSidebarPages(repoName: string, fileName: string, sidebarPages?: Page[]) {
  const content = {
    text: fileName === 'introduction' ? 'Introduction' : prettify(fileName, { mode: 'capitalize', replaceDash: true }),
    link: `/${prettify(repoName, { removeDot: true })}/${fileName}`,
  }

  return sidebarPages ? [...sidebarPages, content] : [content]
}

/**
 * Generates sidebar items from a repository's file structure
 *
 * @param repository - Repository information
 * @param obj - Object representing the file tree structure
 * @param collapsed - Collapse behaviour applied to generated folder groups
 * @param acronyms - Words kept exactly as written in page and folder labels
 * @returns Array of sidebar items (projects and pages)
 */
export function generateSidebarItems(repository: EnhancedRepository, obj: any, collapsed: SidebarCollapsed = true, acronyms: string[] = []): (SidebarProject | Page)[] {
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
              : prettify(filename, { mode: 'capitalize', replaceDash: true, removeExt: true, acronyms }),
            link: `/${repository.docpress.routePrefix ?? ''}${prettify(repository.name, { removeDot: true })}/${parse(filename).name}`,
          } as Page
        })
      }
      return []
    } else if (typeof value === 'object') {
      // Folders carry the ordering prefix for the same reason files do, and it is
      // stripped the same way. Without this a folder is ordered alphabetically and
      // nothing can change that, so a project whose sections have a reading order —
      // install before configure before reference — cannot express it at all, while
      // the files inside those sections can. The prefix also has to leave the path,
      // not just the label: the route is built from the folder name, so a group
      // reading 'Guide' whose pages live under '01-guide' would link into nothing.
      const folder = prettify(key, { removeIdx: true })
      const source = resolve(repository.docpress.projectPath, key)
      const renamed = resolve(repository.docpress.projectPath, folder)
      if (folder !== key) {
        renameSync(source, renamed)
      }

      return [{
        text: prettify(folder, { mode: 'capitalize', replaceDash: true, acronyms }),
        ...collapsedProp(collapsed),
        items: generateSidebarItems({
          ...repository,
          name: `${repository.name}/${folder}`,
          // Descend into the subfolder so file renames target the nested file and
          // not a same-named file at the repository root
          docpress: { ...repository.docpress, projectPath: renamed },
        }, value, collapsed, acronyms),
      } as SidebarProject]
    }

    return []
  })
}

/**
 * Builds a tree structure from an array of file paths
 *
 * @param files - Array of file paths to be organized into a tree
 * @returns A nested object representing the directory structure
 */
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

/**
 * Flattens a nested tree structure into an array of file paths
 *
 * @param subtree - The tree object to flatten
 * @param prefix - Optional path prefix to prepend to each result
 * @returns An array of file paths
 */
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

/**
 * Reorders sidebar items to ensure 'Sources' appears last
 *
 * @param arr - Array of sidebar items to reorder
 * @returns Reordered array with 'Sources' as the last item
 */
export function moveSourcesLast(arr: (SidebarProject | Page)[]) {
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

/**
 * Deepest sidebar level Vitepress renders. Its `VPSidebarGroup` mounts top level
 * items at depth 0 and `VPSidebarItem` only recurses while `depth < 5`, so the
 * children of a group sitting at this depth are silently dropped
 */
const MAX_SIDEBAR_DEPTH = 5

/**
 * Finds sidebar groups nested so deeply that Vitepress will not render their
 * children, so the caller can warn instead of silently losing navigation
 *
 * @param items - Sidebar items to inspect
 * @param depth - Depth at which those items are rendered
 * @param trail - Group texts walked so far, used to build a readable path
 * @returns Paths of the groups whose children will not be displayed
 */
export function findHiddenSidebarPaths(items: (SidebarProject | Page)[], depth: number, trail: string[] = []): string[] {
  return items.flatMap((item) => {
    if (!('items' in item) || !item.items?.length) {
      return []
    }
    const path = [...trail, item.text]
    return depth >= MAX_SIDEBAR_DEPTH
      ? [path.join('/')]
      : findHiddenSidebarPaths(item.items, depth + 1, path)
  })
}

/**
 * Merges a previously generated sidebar with the one built by the current run,
 * used to accumulate repositories across usernames
 *
 * Flat sidebars are concatenated and sorted by group text, route-keyed sidebars
 * are merged by key with the current run winning. When the two shapes disagree,
 * the flat side is filed under the root key so nothing is silently dropped
 *
 * @param previous - Sidebar read back from the config written by a previous run
 * @param current - Sidebar generated by the current run
 * @returns The merged sidebar
 */
export function mergeSidebars(previous: DefaultTheme.Sidebar | undefined, current: DefaultTheme.Sidebar): DefaultTheme.Sidebar {
  if (!previous) {
    return current
  }
  if (Array.isArray(previous) && Array.isArray(current)) {
    return [...previous, ...current]
      .toSorted((a, b) => (a.text ?? '').localeCompare(b.text ?? ''))
  }
  const toMulti = (sidebar: DefaultTheme.Sidebar): DefaultTheme.SidebarMulti =>
    Array.isArray(sidebar) ? { '/': sidebar } : sidebar

  return sortSidebarRoutes({ ...toMulti(previous), ...toMulti(current) })
}

/**
 * Sorts the route keys of a multi sidebar so generated configurations stay
 * stable between runs regardless of repository processing order
 *
 * @param sidebarByRoute - Multi sidebar keyed by repository route
 * @returns The same sidebar with alphabetically ordered route keys
 */
export function sortSidebarRoutes(sidebarByRoute: DefaultTheme.SidebarMulti): DefaultTheme.SidebarMulti {
  return Object.fromEntries(
    Object.entries(sidebarByRoute).toSorted(([routeA], [routeB]) => routeA.localeCompare(routeB)),
  )
}

/**
 * Transforms repository data into documentation structure
 *
 * @param repositories - Array of enhanced repositories
 * @param user - User information retrieved from GitHub
 * @param websiteInfos - Custom title and tagline information
 * @param sidebarOpts - Options driving sidebar shape, collapse behaviour and label spelling
 * @returns Object containing sidebar and index page configurations
 */
export function transformDoc(repositories: EnhancedRepository[], user: ReturnType<typeof getUserInfos>, websiteInfos: WebsiteInfos, sidebarOpts: SidebarOpts = {}) {
  const { mode = 'single', collapsed = true, acronyms = [] } = sidebarOpts
  const features: Feature[] = []
  const sidebar: SidebarProject[] = []
  const sidebarByRoute: DefaultTheme.SidebarMulti = {}

  for (const repository of repositories) {
    log(`   Replace urls for repository '${repository.name}'.`, 'info')
    getMdFiles([repository.docpress.projectPath]).forEach((file) => {
      log(`   Processing file '${basename(file)}' for repository '${repository.name}'.`, 'debug')
      replaceRelativePath(file, repository.docpress.replace_url, repository.docpress.projectPath)

      if (basename(file).toLowerCase() === 'readme.md') {
        replaceReadmePath(file, repository.docpress.replace_url)
      }
      // Runs last so remaining relative links are rewritten to match the
      // renamed files (index prefix stripped, lowercased, readme -> introduction)
      replaceInternalMdLinks(file)
    })

    log(`   Generate sidebar for repository '${repository.name}'.`, 'info')
    const projectFiles = readdirSync(repository.docpress.projectPath, { recursive: true })
      .filter((file) => {
        const filePath = resolve(repository.docpress.projectPath, file.toString())
        // Name check first, then a stat that tolerates files vanishing between
        // the directory scan and the check (e.g. leftover git lock files)
        return basename(filePath).endsWith('.md') && isFile(filePath)
      })
      .sort() as string[]

    log(`   Add sources for repository '${repository.name}'.`, 'info')
    let sourceFile
    if (projectFiles.length > 1) {
      sourceFile = resolve(repository.docpress.projectPath, 'sources.md')
      projectFiles.push('sources.md')
    } else if (projectFiles.length === 1) {
      sourceFile = resolve(repository.docpress.projectPath, projectFiles[0])
    }
    if (sourceFile) {
      addSources(repository.html_url, sourceFile)
    } else {
      log(`   No markdown files found for repository '${repository.name}', skipping sources.`, 'warn')
    }

    const projectTree = buildTree(projectFiles)
    const sidebarItems = moveSourcesLast(generateSidebarItems(repository, projectTree, collapsed, acronyms))

    // Single mode wraps each repository in its own group, which costs one level
    const hidden = findHiddenSidebarPaths(sidebarItems, mode === 'multi' ? 0 : 1)
    if (hidden.length) {
      log(`   Sidebar for repository '${repository.name}' nests deeper than Vitepress renders, pages under ${hidden.map(path => `'${path}'`).join(', ')} will not appear in the sidebar.`, 'warn')
    }

    if (mode === 'multi') {
      // Vitepress picks the sidebar whose key is the longest prefix of the current
      // route, so keying on the repository route scopes it to that project alone
      sidebarByRoute[`/${repository.docpress.routePrefix ?? ''}${prettify(repository.name, { removeDot: true })}/`] = sidebarItems
    } else {
      sidebar.push(generateSidebarProject(prettify(repository.name, { removeDot: true }), sidebarItems, collapsed, acronyms))
    }
    features.push(...generateFeatures(prettify(repository.name, { removeDot: true }), repository.description || '', undefined, repository.docpress.routePrefix ?? '', acronyms))
  }

  log(`   Generate index content.`, 'info')
  const index = generateIndex(features.toSorted((a, b) => a.title.localeCompare(b.title)), user, websiteInfos)
  return {
    sidebar: mode === 'multi'
      ? sortSidebarRoutes(sidebarByRoute)
      : sidebar.toSorted((a, b) => a.text.localeCompare(b.text)),
    index,
  }
}

/**
 * Reads the label a page asks for in the navigation, through its `navTitle` frontmatter
 *
 * @param file - Path to the markdown page
 * @returns The label, or undefined when the page sets none
 */
export function getNavTitle(file: string): string | undefined {
  const { navTitle } = parseFrontmatter(readFileSync(resolve(process.cwd(), file), 'utf8')).data
  return typeof navTitle === 'string' && navTitle.trim() ? navTitle.trim() : undefined
}

/**
 * Tells whether a header page supplies the contributions page introduction
 *
 * @param file - Path to the markdown page
 * @returns True for a page named `contributions` or `forks`, ordering prefix aside
 */
export function isContributionsPage(file: string): boolean {
  return CONTRIBUTIONS_PAGE_NAMES.includes(prettify(parse(file).name, { removeIdx: true, mode: 'lowercase' }))
}

/**
 * Adds extra pages to the documentation from specified paths. Each page is named in the
 * navigation by its `navTitle` frontmatter, or else after its file name
 *
 * @param paths - Array of paths to markdown files
 * @param exclude - Pages to leave out
 * @returns Array of navigation page objects
 */
export function addExtraPages(paths: string[], exclude: string[] = []) {
  const files = getMdFiles(paths).filter(file => !exclude.includes(file))
  const nav: Page[] = []

  log(`   Add extras Vitepress headers pages.`, 'info')
  for (const file of files) {
    log(`   Processing file '${file}'.`, 'debug')
    const src = resolve(process.cwd(), file)
    const dest = resolve(DOCS_DIR, prettify(basename(file), { mode: 'lowercase', removeIdx: true }))
    cpSync(src, dest)
    nav.push({
      text: getNavTitle(src) ?? prettify(parse(src).name, { replaceDash: true, removeIdx: true }),
      link: `/${prettify(parse(src).name, { removeIdx: true, mode: 'lowercase' })}`,
    })
  }
  return nav
}

/**
 * Adds content from specified paths to a target directory
 *
 * @param paths - String or array of paths to content
 * @param dir - Target directory to copy content to
 * @param fn - Optional callback function to execute for each file
 */
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

/**
 * Merges contribution lists, a later entry replacing an earlier one for the same author
 * and repository
 *
 * @param lists - Contribution lists to merge
 * @returns The merged contributions, from the most starred repository to the least
 */
export function mergeContributions(...lists: Contribution[][]): Contribution[] {
  const byKey = new Map<string, Contribution>()
  for (const contribution of lists.flat()) {
    byKey.set(`${contribution.author}/${contribution.owner}/${contribution.name}`.toLowerCase(), contribution)
  }
  return sortContributions([...byKey.values()])
}

/**
 * Writes the contributions page: its frontmatter carries the contributions rendered by
 * the `ContributionsPage` layout, and the introduction page, when given, supplies the
 * markdown above them and frontmatter of its own
 *
 * @param contributions - Contributions to list
 * @param introPage - Header page holding the introduction
 */
export function addContributionsPage(contributions: Contribution[], introPage?: string) {
  const { data, body } = introPage
    ? parseFrontmatter(readFileSync(resolve(process.cwd(), introPage), 'utf8'))
    : { data: {}, body: DEFAULT_CONTRIBUTIONS_INTRO }
  // The sidebar is left out by default: the cards are laid out for the full width
  const frontmatter = { sidebar: false, ...data, layout: CONTRIBUTIONS_LAYOUT, contributions }

  log(`   Generate contributions page.`, 'info')
  writeFileSync(CONTRIBUTIONS_FILE, `---\n${YAML.stringify(frontmatter)}---\n\n${body.trimStart()}`)
}

/**
 * Generates the contributions page of a username. Every username of a run shares the
 * page, so it is extended with the contributions a previous username wrote; the Vitepress
 * config only exists once one has been prepared in this run, which tells such a page
 * apart from one left over by an earlier run
 *
 * @param options - Options for the contributions page
 * @param options.username - GitHub username whose merged pull requests are listed
 * @param options.token - GitHub API token
 * @param options.filter - Owners or repositories to keep, or to hide with a `!` prefix
 * @param options.introPage - Header page holding the introduction
 * @returns True when the page was written, false when there is nothing to list
 */
export async function processContributions({ username, token, filter, introPage }: {
  username: GlobalOpts['usernames'][number]
  token?: GlobalOpts['token']
  filter?: string[]
  introPage?: string
}): Promise<boolean> {
  const current = await getContributions({ username, token, filter })
  const { contributions: previous }: Record<string, unknown> = existsSync(VITEPRESS_CONFIG) && existsSync(CONTRIBUTIONS_FILE)
    ? parseFrontmatter(readFileSync(CONTRIBUTIONS_FILE, 'utf8')).data
    : {}
  const contributions = mergeContributions(Array.isArray(previous) ? previous : [], current)

  if (!contributions.length) {
    log(`   No merged pull request found in repositories owned by others, skipping the contributions page.`, 'info')
    // A page left over by an earlier run would otherwise be built, unlisted
    rmSync(CONTRIBUTIONS_FILE, { force: true })
    return false
  }
  addContributionsPage(contributions, introPage)
  return true
}

/**
 * Parses a VitePress configuration file
 *
 * @param path - Path to the VitePress config file
 * @returns The parsed configuration object
 */
export async function parseVitepressConfig(path: string): Promise<Partial<ReturnType<typeof defineConfig>>> {
  try {
    const { config } = await import(resolve(process.cwd(), path))
    return config ?? {}
  } catch (error) {
    log(`   Unable to load existing Vitepress config '${path}', starting from an empty config. ${formatError(error)}`, 'warn')
    return {}
  }
}

/**
 * Parses a VitePress index file
 *
 * @param path - Path to the index file
 * @returns The parsed index object
 */
export async function parseVitepressIndex(path: string): Promise<Index> {
  const index = (await readFile(resolve(process.cwd(), path))).toString()
  return YAML.parse(index)
}

/**
 * Tail of the generated VitePress config. `config` stays plain JSON so a later run can
 * re-import it, while the default export adds what JSON cannot hold.
 *
 * Vue compiles every page as a template: VitePress keeps fenced blocks out of it with
 * `v-pre`, but not inline code, so a `${{ always() }}` from a GitHub Actions doc is
 * evaluated as an expression and breaks the build.
 */
const VITEPRESS_CONFIG_EXPORT = `
function escapeInlineCode(md) {
  const render = md.renderer.rules.code_inline
  md.renderer.rules.code_inline = (tokens, idx, options, env, self) => {
    tokens[idx].attrSet('v-pre', '')
    return render(tokens, idx, options, env, self)
  }
}

export default { ...config, markdown: { ...config.markdown, config: escapeInlineCode } }
`

/**
 * Generates VitePress configuration and index files
 *
 * @param vitepressConfig - VitePress configuration object
 * @param index - Index page configuration
 * @throws Error if no template theme files are found
 */
export function generateVitepressFiles(vitepressConfig: Partial<ReturnType<typeof defineConfig>>, index: Index) {
  const separator = '---\n'
  createDir(dirname(VITEPRESS_CONFIG))

  log(`   Generate Vitepress config.`, 'info')
  writeFileSync(VITEPRESS_CONFIG, `export const config = ${JSON.stringify(vitepressConfig, null, 2)}\n${VITEPRESS_CONFIG_EXPORT}`)
  log(`   Generate index file.`, 'info')
  writeFileSync(INDEX_FILE, separator + YAML.stringify(index))

  // Fail here (not during the later Vitepress build) so the error points at the
  // actual missing source instead of surfacing as an opaque Vite ENOENT
  const themeFiles = extractFiles(TEMPLATE_THEME)
  if (!themeFiles.length) {
    throw new Error(`No template theme files found at '${TEMPLATE_THEME}'. The Vitepress build cannot succeed without them.`)
  }

  log(`   Add Docpress theme files.`, 'info')
  themeFiles.forEach((path) => {
    const relativePath = path.replace(`${TEMPLATE_THEME}/`, '')
    generateFile(path, resolve(VITEPRESS_THEME, relativePath))
  })
}
