import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
import type { GlobalOpts } from '../schemas/global.js'
import type { FetchOpts, FetchOptsUser } from '../schemas/fetch.js'
import { checkHttpStatus, prettify } from '../utils/functions.js'
import { DOCPRESS_DIR, DOCS_DIR } from '../utils/const.js'
import { log } from '../utils/logger.js'
import { cloneRepo, getInfos } from './git.js'

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
  }
}

/**
 * Checks for the existence of documentation files in a repository
 *
 * @param repoOwner - Owner of the repository (username)
 * @param repoName - Name of the repository
 * @param branch - Branch to check for documentation
 * @returns Object containing HTTP status codes for different documentation paths
 */
export async function checkDoc(repoOwner: GlobalOpts['usernames'][number], repoName: string, branch: FetchOpts['branch']) {
  const rootReadmeUrl = `https://github.com/${repoOwner}/${repoName}/tree/${branch}/README.md`
  const docsFolderUrl = `https://github.com/${repoOwner}/${repoName}/tree/${branch}/docs`
  const docsReadmeUrl = `https://github.com/${repoOwner}/${repoName}/tree/${branch}/docs/01-readme.md`

  const rootReadmeStatus = await checkHttpStatus(rootReadmeUrl)
  const docsFolderStatus = await checkHttpStatus(docsFolderUrl)
  const docsReadmeStatus = await checkHttpStatus(docsReadmeUrl)

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
 * @param options.username - GitHub username
 * @param options.branch - Branch to use for documentation
 * @param options.reposFilter - Optional filter for repositories
 * @param options.token - GitHub API token
 */
export async function fetchDoc({ username, branch, reposFilter, token }: FetchOptsUser) {
  await getInfos({ username, token, branch })
    .then(async ({ user, repos, branch }) => generateInfos(user, repos, branch, reposFilter))
    .then(async ({ repos }) => getDoc(repos, reposFilter))
}

/**
 * Enhances repository information with DocPress metadata
 *
 * @param repos - List of repositories from Git provider
 * @param branch - Branch to use for documentation
 * @param reposFilter - Optional filter for repositories
 * @returns Array of enhanced repositories with DocPress metadata
 */
export async function enhanceRepositories(repos: Awaited<ReturnType<typeof getInfos>>['repos'], branch?: FetchOpts['branch'], reposFilter?: FetchOpts['reposFilter']) {
  const enhancedRepos: EnhancedRepository[] = []

  await Promise.all(
    repos.map(async (repo) => {
      const computedBranch = branch ?? repo.default_branch ?? 'main'
      const projectPath = resolve(DOCS_DIR, prettify(repo.name, { removeDot: true }))
      const filtered = isRepoFiltered(repo, reposFilter)
      let includes: string[] = []

      if (!repo.fork && !repo.private && !filtered) {
        includes = await getSparseCheckout(repo, computedBranch)
      }

      enhancedRepos.push({
        ...repo,
        docpress: {
          filtered,
          branch: computedBranch,
          includes,
          projectPath,
          raw_url: `https://raw.githubusercontent.com/${repo.owner.login}/${repo.name}/${computedBranch}`,
          replace_url: `https://github.com/${repo.owner.login}/${repo.name}/tree/${computedBranch}`,
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
 * @returns Array of file patterns to include in sparse checkout
 */
export async function getSparseCheckout(repo: Awaited<ReturnType<typeof getInfos>>['repos'][number], branch: FetchOpts['branch']) {
  const docsStatus = await checkDoc(repo.owner.login, repo.name, branch)

  const includes: string[] = []
  if (Object.values(docsStatus).every(status => status === 404) || !repo.size) {
    return []
  }
  if (docsStatus.docsFolderStatus !== 404) {
    includes.push('docs/*')
  }
  if (docsStatus.docsFolderStatus === 404 || docsStatus.docsReadmeStatus === 404) {
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
 * @returns Object containing user and enhanced repository information
 */
export async function generateInfos(user: Awaited<ReturnType<typeof getInfos>>['user'], repos: Awaited<ReturnType<typeof getInfos>>['repos'], branch?: FetchOpts['branch'], reposFilter?: FetchOpts['reposFilter']) {
  writeFileSync(`${DOCPRESS_DIR}/user-${user.login}.json`, JSON.stringify(user, null, 2))

  const enhancedRepos = await enhanceRepositories(repos, branch, reposFilter)
  writeFileSync(`${DOCPRESS_DIR}/repos-${user.login}.json`, JSON.stringify(enhancedRepos, null, 2))

  return { user, repos: enhancedRepos }
}

/**
 * Fetches documentation from repositories
 *
 * @param repos - List of enhanced repositories
 * @param reposFilter - Optional filter for repositories
 */
export async function getDoc(repos?: EnhancedRepository[], reposFilter?: FetchOpts['reposFilter']) {
  if (!repos) {
    log(`   No repository respect docpress rules.`, 'warn')
    return
  }

  await Promise.all(
    repos
      .filter(repo => !isRepoFiltered(repo, reposFilter))
      .map(async (repo) => {
        await cloneRepo(repo.name, repo.clone_url as string, repo.docpress.projectPath, repo.docpress.branch, repo.docpress.includes)
      }),
  )
}

/**
 * Determines if a repository should be filtered out based on filter rules
 *
 * @param repo - Repository information
 * @param reposFilter - Optional filter for repositories
 * @returns True if the repository should be filtered out, false otherwise
 */
export function isRepoFiltered(repo: EnhancedRepository | Awaited<ReturnType<typeof getInfos>>['repos'][number], reposFilter?: FetchOpts['reposFilter']) {
  const hasOnlyExclusions = reposFilter?.every((filter: string) => filter.startsWith('!'))
  const isExcluded = reposFilter?.filter((filter: string) => filter.startsWith('!'))
    .some((filter: string) => repo.name === filter.substring(1))
  const isIncluded = !reposFilter
    || reposFilter?.filter((filter: string) => !filter.startsWith('!')).includes(repo.name)
    || (repo.fork && !isExcluded)
    || (hasOnlyExclusions && !isExcluded)

  const isFiltered = isExcluded || !isIncluded

  if ('docpress' in repo && !repo.docpress.includes.length) {
    return true
  }

  if (!!repo.clone_url && !repo.private && !isFiltered) {
    return false
  }
  return true
}
