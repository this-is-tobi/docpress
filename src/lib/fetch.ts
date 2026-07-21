import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
import type { FetchOpts, FetchOptsUser } from '../schemas/fetch.js'
import { checkHttpStatus, prettify, sanitizeSegment } from '../utils/functions.js'
import { DOCPRESS_DIR, DOCS_DIR } from '../utils/const.js'
import { log } from '../utils/logger.js'
import { cloneRepo, getInfos } from './git.js'
import { getInfos as getGitlabInfos } from './gitlab.js'

/**
 * Enhanced repository type with DocPress-specific metadata
 */
export type EnhancedRepository = Awaited<ReturnType<typeof getInfos>>['repos'][number] & {
  docpress: {
    branch: string
    filtered: boolean
    includes: string[]
    projectPath: string
    raw_url: string
    replace_url: string
    /** URL/path prefix ('' or '<username>/') used to namespace multi-user runs */
    routePrefix: string
  }
}

/**
 * Web URLs of a repository for a given branch, depending on the Git provider
 */
export interface ProviderUrls {
  blob_url: string
  tree_url: string
  raw_url: string
}

/**
 * Builds the web URLs of a repository for a given branch and Git provider
 *
 * @param repo - Repository information
 * @param branch - Branch to build URLs for
 * @param gitProvider - Git provider used to retrieve data
 * @returns Object containing blob, tree and raw base URLs
 */
export function getProviderUrls(repo: Awaited<ReturnType<typeof getInfos>>['repos'][number], branch: FetchOpts['branch'], gitProvider?: FetchOpts['gitProvider']): ProviderUrls {
  if (gitProvider === 'gitlab') {
    const base = repo.html_url ?? `https://gitlab.com/${repo.owner.login}/${repo.name}`
    return {
      blob_url: `${base}/-/blob/${branch}`,
      tree_url: `${base}/-/tree/${branch}`,
      raw_url: `${base}/-/raw/${branch}`,
    }
  }
  const base = repo.html_url ?? `https://github.com/${repo.owner.login}/${repo.name}`
  return {
    blob_url: `${base}/blob/${branch}`,
    tree_url: `${base}/tree/${branch}`,
    raw_url: `https://raw.githubusercontent.com/${repo.owner.login}/${repo.name}/${branch}`,
  }
}

/**
 * Checks for the existence of documentation files in a repository
 *
 * @param urls - Web URLs of the repository for the target branch
 * @returns Object containing HTTP status codes for different documentation paths
 */
export async function checkDoc(urls: ProviderUrls) {
  const [rootReadmeStatus, docsFolderStatus, docsReadmeStatus] = await Promise.all([
    checkHttpStatus(`${urls.blob_url}/README.md`),
    checkHttpStatus(`${urls.tree_url}/docs`),
    checkHttpStatus(`${urls.blob_url}/docs/01-readme.md`),
  ])

  return {
    rootReadmeStatus,
    docsFolderStatus,
    docsReadmeStatus,
  }
}

/**
 * Fetches documentation from a user's repositories
 *
 * @param options - Options for fetching documentation
 * @param options.username - Git provider username
 * @param options.branch - Branch to use for documentation
 * @param options.reposFilter - Optional filter for repositories
 * @param options.gitProvider - Git provider used to retrieve data
 * @param options.token - Git provider API token
 * @param options.lastUpdated - Whether or not to inject each page's last Git commit date as frontmatter
 * @param options.multiUser - Whether the run spans multiple usernames; namespaces paths/routes by username to avoid collisions
 */
export async function fetchDoc({ username, branch, reposFilter, gitProvider, token, lastUpdated, multiUser }: FetchOptsUser & { multiUser?: boolean }) {
  const getProviderInfos = gitProvider === 'gitlab' ? getGitlabInfos : getInfos
  const { user, repos, branch: resolvedBranch } = await getProviderInfos({ username, token, branch })
  // In multi-user runs, namespace on-disk paths and site routes by username so
  // two users owning a same-named repository do not collide (data loss / merged routes)
  const routePrefix = multiUser ? `${sanitizeSegment(username)}/` : ''
  const { repos: enhancedRepos } = await generateInfos(user, repos, resolvedBranch, reposFilter, gitProvider, routePrefix)
  await getDoc(enhancedRepos, reposFilter, lastUpdated)
}

/**
 * Enhances repository information with DocPress metadata
 *
 * @param repos - List of repositories from Git provider
 * @param branch - Branch to use for documentation
 * @param reposFilter - Optional filter for repositories
 * @returns Array of enhanced repositories with DocPress metadata
 */
export async function enhanceRepositories(repos: Awaited<ReturnType<typeof getInfos>>['repos'], branch?: FetchOpts['branch'], reposFilter?: FetchOpts['reposFilter'], gitProvider?: FetchOpts['gitProvider'], routePrefix: string = '') {
  const enhancedRepos: EnhancedRepository[] = []

  await Promise.all(
    repos.map(async (repo) => {
      const computedBranch = branch ?? repo.default_branch ?? 'main'
      const projectPath = resolve(DOCS_DIR, `${routePrefix}${prettify(sanitizeSegment(repo.name), { removeDot: true })}`)
      const filtered = isRepoFiltered(repo, reposFilter)
      const urls = getProviderUrls(repo, computedBranch, gitProvider)
      let includes: string[] = []

      if (!repo.fork && !repo.private && !filtered) {
        includes = await getSparseCheckout(repo, computedBranch, gitProvider, urls)
      }

      enhancedRepos.push({
        ...repo,
        docpress: {
          filtered,
          branch: computedBranch,
          includes,
          projectPath,
          raw_url: urls.raw_url,
          replace_url: urls.tree_url,
          routePrefix,
        },
      })
    }),
  )

  return enhancedRepos
}

/**
 * Determines which files to include in the sparse checkout based on repository structure
 *
 * @param repo - Repository information
 * @param branch - Branch to check for documentation
 * @param gitProvider - Git provider used to retrieve data
 * @param urls - Optional pre-computed provider URLs to avoid recomputing them
 * @returns Array of file patterns to include in sparse checkout
 */
export async function getSparseCheckout(repo: Awaited<ReturnType<typeof getInfos>>['repos'][number], branch: FetchOpts['branch'], gitProvider?: FetchOpts['gitProvider'], urls?: ProviderUrls) {
  const docsStatus = await checkDoc(urls ?? getProviderUrls(repo, branch, gitProvider))

  const includes: string[] = []
  if (Object.values(docsStatus).every(status => status !== 200) || !repo.size) {
    return []
  }
  if (docsStatus.docsFolderStatus === 200) {
    includes.push('docs/*')
  }
  if (docsStatus.docsFolderStatus !== 200 || docsStatus.docsReadmeStatus !== 200) {
    includes.push('README.md', '!*/**/README.md')
  }
  return includes
}

/**
 * Generates and saves user and repository information
 *
 * @param user - User information from Git provider
 * @param repos - List of repositories from Git provider
 * @param branch - Branch to use for documentation
 * @param reposFilter - Optional filter for repositories
 * @param gitProvider - Git provider used to retrieve data
 * @returns Object containing user and enhanced repository information
 */
export async function generateInfos(user: Awaited<ReturnType<typeof getInfos>>['user'], repos: Awaited<ReturnType<typeof getInfos>>['repos'], branch?: FetchOpts['branch'], reposFilter?: FetchOpts['reposFilter'], gitProvider?: FetchOpts['gitProvider'], routePrefix: string = '') {
  writeFileSync(`${DOCPRESS_DIR}/user-${sanitizeSegment(user.login)}.json`, JSON.stringify(user, null, 2))

  const enhancedRepos = await enhanceRepositories(repos, branch, reposFilter, gitProvider, routePrefix)
  writeFileSync(`${DOCPRESS_DIR}/repos-${sanitizeSegment(user.login)}.json`, JSON.stringify(enhancedRepos, null, 2))

  return { user, repos: enhancedRepos }
}

/**
 * Fetches documentation from repositories
 *
 * @param repos - List of enhanced repositories
 * @param reposFilter - Optional filter for repositories
 * @param lastUpdated - Whether or not to inject each page's last Git commit date as frontmatter
 */
export async function getDoc(repos?: EnhancedRepository[], reposFilter?: FetchOpts['reposFilter'], lastUpdated?: boolean) {
  if (!repos) {
    log(`   No repository respect docpress rules.`, 'warn')
    return
  }

  const results = await Promise.all(
    repos
      .filter(repo => !isRepoFiltered(repo, reposFilter))
      .map(async (repo) => {
        const success = await cloneRepo(repo.name, repo.clone_url as string, repo.docpress.projectPath, repo.docpress.branch, repo.docpress.includes, lastUpdated)
        return { name: repo.name, success }
      }),
  )

  const failed = results.filter(({ success }) => !success).map(({ name }) => name)
  if (failed.length) {
    log(`   ${failed.length} repository(ies) failed to clone: ${failed.join(', ')}.`, 'warn')
  }
}

/**
 * Determines if a repository should be filtered out based on filter rules
 *
 * @param repo - Repository information
 * @param reposFilter - Optional filter for repositories
 * @returns True if the repository should be filtered out, false otherwise
 */
export function isRepoFiltered(repo: EnhancedRepository | Awaited<ReturnType<typeof getInfos>>['repos'][number], reposFilter?: FetchOpts['reposFilter']) {
  if ('docpress' in repo && !repo.docpress.includes.length) {
    return true
  }

  const inclusions = reposFilter?.filter((filter: string) => !filter.startsWith('!')) ?? []
  const hasOnlyExclusions = reposFilter?.every((filter: string) => filter.startsWith('!'))
  const isExcluded = reposFilter?.filter((filter: string) => filter.startsWith('!'))
    .some((filter: string) => repo.name === filter.substring(1))

  const isIncluded = !reposFilter
    || inclusions.includes(repo.name)
    || (repo.fork && !isExcluded)
    || (hasOnlyExclusions && !isExcluded)

  const isFiltered = isExcluded || !isIncluded

  return !(!!repo.clone_url && !repo.private && !isFiltered)
}
