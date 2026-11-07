import { appendFileSync, cpSync, rmSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { Octokit } from '@octokit/rest'
import { simpleGit } from 'simple-git'
import type { SimpleGit } from 'simple-git'
import type { GlobalOpts } from '../schemas/global.js'
import type { FetchOpts } from '../schemas/fetch.js'
import { addLastUpdatedFrontmatter, createDir, formatError, getMdFiles } from '../utils/functions.js'
import { log } from '../utils/logger.js'

/**
 * Octokit logger that stays quiet on 404s, which are handled explicitly
 */
export const quietOctokitLog = {
  debug: () => {},
  info: () => {},
  warn: (message: string) => {
    if (!message.includes('404')) log(message, 'warn')
  },
  error: (message: string) => {
    if (!message.includes('404')) log(message, 'error')
  },
}

/**
 * Fetches user and repository information from GitHub
 *
 * @param options - Options for retrieving GitHub data
 * @param options.username - GitHub username
 * @param options.token - GitHub API token
 * @param options.branch - Branch to use for documentation
 * @returns Object containing user information, repositories, and branch
 */
export async function getInfos({ username, token, branch }: Pick<FetchOpts, 'branch'> & Pick<GlobalOpts, 'token'> & { username: GlobalOpts['usernames'][number] }) {
  log(`   Get infos for username '${username}'.`, 'info')
  const octokit = new Octokit({ auth: token, log: quietOctokitLog })
  log(`   Get user infos.`, 'debug')
  const { data: user } = await octokit.rest.users.getByUsername({ username })
    .catch((error) => {
      throw error.status === 404 ? new Error(`No GitHub user found for '${username}'.`) : error
    })
  log(`   Get repositories infos.`, 'debug')
  const repos = await octokit.paginate(octokit.rest.repos.listForUser, { username, sort: 'full_name', per_page: 100 })

  return { user, repos, branch }
}

/**
 * Pull requests of a user merged into a repository owned by someone else
 */
export interface Contribution {
  /** Login of the user who authored the pull requests */
  author: string
  /** Login of the repository owner */
  owner: string
  /** Repository name */
  name: string
  /** Avatar of the repository owner */
  avatar_url?: string
  html_url: string
  description: string | null
  stargazers_count: number
  language: string | null
  archived?: boolean
  /** Number of pull requests authored by the user and merged */
  pull_requests: number
  /** Merge date of the most recent of these pull requests */
  last_merged_at?: string
  /** Link listing these pull requests on GitHub */
  pull_requests_url: string
}

/**
 * The GitHub search API never returns more than this many results for one query
 */
export const SEARCH_RESULTS_CAP = 1000

/**
 * Reads a contributions filter, whose entries are owners (`owner`) or repositories
 * (`owner/repo`), each prefixed with `!` to hide it rather than keep it. Exclusions are
 * also turned into search qualifiers, so that hidden repositories do not count against
 * the search results cap
 *
 * @param filter - Filter entries
 * @returns The search qualifiers and a predicate telling whether a repository is shown
 */
export function parseContributionsFilter(filter: string[] = []) {
  const entries = filter.map(entry => entry.trim().toLowerCase()).filter(Boolean)
  const exclusions = entries.filter(entry => entry.startsWith('!')).map(entry => entry.slice(1))
  const inclusions = entries.filter(entry => !entry.startsWith('!'))
  const matches = (pattern: string, owner: string, name: string) => pattern.includes('/')
    ? pattern === `${owner}/${name}`.toLowerCase()
    : pattern === owner.toLowerCase()

  return {
    qualifiers: exclusions.map(pattern => pattern.includes('/') ? `-repo:${pattern}` : `-user:${pattern}`),
    isShown: (owner: string, name: string) => !exclusions.some(pattern => matches(pattern, owner, name))
      && (!inclusions.length || inclusions.some(pattern => matches(pattern, owner, name))),
  }
}

/**
 * Orders contributions from the most starred repository to the least, then by merged pull
 * requests and name
 *
 * @param contributions - Contributions to order
 * @returns A sorted copy of the contributions
 */
export function sortContributions(contributions: Contribution[]): Contribution[] {
  return contributions.toSorted((a, b) => b.stargazers_count - a.stargazers_count
    || b.pull_requests - a.pull_requests
    || `${a.owner}/${a.name}`.localeCompare(`${b.owner}/${b.name}`))
}

/**
 * Lists the public repositories owned by others where a user's pull requests were merged.
 * Merged pull requests are searched directly, so a contribution stays listed once its
 * fork is deleted, or when it was pushed without one
 *
 * @param options - Options for retrieving contributions
 * @param options.username - GitHub username whose pull requests are searched
 * @param options.token - GitHub API token
 * @param options.filter - Owners or repositories to keep, or to hide with a `!` prefix
 * @returns Contributions, from the most starred repository to the least
 */
export async function getContributions({ username, token, filter }: {
  username: GlobalOpts['usernames'][number]
  token?: GlobalOpts['token']
  filter?: string[]
}): Promise<Contribution[]> {
  log(`   Search merged pull requests of '${username}'.`, 'info')
  const octokit = new Octokit({ auth: token, log: quietOctokitLog })
  const { qualifiers, isShown } = parseContributionsFilter(filter)
  // `is:public` keeps private repositories the token can read out of a public page
  const q = ['is:pr', 'is:merged', 'is:public', `author:${username}`, `-user:${username}`, ...qualifiers].join(' ')

  const repositories = new Map<string, { owner: string, name: string, count: number, lastMergedAt?: string }>()
  let total = 0
  try {
    for await (const { data } of octokit.paginate.iterator(octokit.rest.search.issuesAndPullRequests, { q, per_page: 100 })) {
      total = (data as { total_count?: number }).total_count ?? total
      for (const pull of data) {
        const [owner, name] = pull.repository_url.split('/').slice(-2)
        const mergedAt = pull.pull_request?.merged_at ?? pull.closed_at ?? undefined
        const key = `${owner}/${name}`.toLowerCase()
        const entry = repositories.get(key) ?? { owner, name, count: 0 }
        entry.count++
        if (mergedAt && (!entry.lastMergedAt || mergedAt > entry.lastMergedAt)) {
          entry.lastMergedAt = mergedAt
        }
        repositories.set(key, entry)
      }
    }
  } catch (error) {
    log(`   Failed to search merged pull requests of '${username}'. Error : ${formatError(error)}`, 'warn')
    return []
  }
  if (total > SEARCH_RESULTS_CAP) {
    log(`   '${username}' has ${total} merged pull requests in repositories owned by others, only the first ${SEARCH_RESULTS_CAP} are listed: hide owners with the contributions filter to narrow the search.`, 'warn')
  }

  const contributions: Contribution[] = []
  // One repository at a time keeps clear of the secondary rate limit on concurrent requests
  for (const { owner, name, count, lastMergedAt } of repositories.values()) {
    if (owner.toLowerCase() === username.toLowerCase() || !isShown(owner, name)) {
      continue
    }
    try {
      const { data: repo } = await octokit.rest.repos.get({ owner, repo: name })
      if (repo.private) {
        continue
      }
      contributions.push({
        author: username,
        owner: repo.owner.login,
        name: repo.name,
        avatar_url: repo.owner.avatar_url,
        html_url: repo.html_url,
        description: repo.description,
        stargazers_count: repo.stargazers_count,
        language: repo.language,
        archived: repo.archived,
        pull_requests: count,
        last_merged_at: lastMergedAt,
        pull_requests_url: `${repo.html_url}/pulls?q=${encodeURIComponent(`is:pr is:merged author:${username}`)}`,
      })
    } catch (error) {
      // A repository deleted or made private since the merge only loses its own card
      log(`   Failed to get repository infos for '${owner}/${name}'. Error : ${formatError(error)}`, 'warn')
    }
  }

  return sortContributions(contributions)
}

/**
 * Parses `git log --format=%cI --name-only` output into a map of file path to
 * its most recent commit date
 * The log is newest-first, so the first date seen for a given file is the latest one
 *
 * @param logOutput - Raw output of the git log command
 * @returns Map of repository-relative file path to ISO commit date
 */
export function parseLastCommitDates(logOutput: string): Map<string, string> {
  const dates = new Map<string, string>()
  let currentDate: string | null = null

  for (const rawLine of logOutput.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(line)) {
      currentDate = line
      continue
    }
    if (currentDate && !dates.has(line)) {
      dates.set(line, currentDate)
    }
  }

  return dates
}

/**
 * Injects each markdown file's last Git commit date as a "lastUpdated" frontmatter field,
 * reading the local clone's history in a single pass
 *
 * @param git - Simple-git instance scoped to the cloned repository, with history still intact
 * @param projectDir - Directory containing the cloned repository
 * @param name - Repository name, used for logging
 */
export async function applyLastUpdated(git: SimpleGit, projectDir: string, name: string) {
  const files = getMdFiles([projectDir])
  if (!files.length) {
    return
  }

  let dates: Map<string, string>
  try {
    // core.quotePath=false keeps non-ASCII paths unescaped so they match the
    // relative() lookup below (default quoting would octal-escape them)
    const logOutput = await git.raw(['-c', 'core.quotePath=false', 'log', '--format=%cI', '--name-only'])
    dates = parseLastCommitDates(logOutput)
  } catch (error) {
    log(`   Unable to read commit history for repository '${name}'. Error : ${formatError(error)}`, 'warn')
    return
  }

  for (const file of files) {
    const date = dates.get(relative(projectDir, file))
    if (date) {
      addLastUpdatedFrontmatter(file, date)
    }
  }
}

/**
 * Clones a repository with sparse checkout
 *
 * @param name - Repository name
 * @param url - Repository URL
 * @param projectDir - Directory to clone into
 * @param branch - Branch to clone
 * @param includes - Patterns to include in sparse checkout
 * @param lastUpdated - Whether or not to inject each page's last Git commit date as frontmatter
 * @returns True when the repository was cloned successfully, false otherwise
 */
export async function cloneRepo(name: string, url: string, projectDir: string, branch: string, includes: string[], lastUpdated?: boolean): Promise<boolean> {
  // Refuse values Git could parse as CLI options (argument injection)
  if (url.startsWith('-') || branch.startsWith('-')) {
    log(`   Refusing to clone '${name}': unsafe repository URL or branch name.`, 'error')
    return false
  }

  createDir(projectDir, { clean: true })

  try {
    // Background maintenance is disabled so no git process keeps writing into
    // .git (e.g. commit-graph files) while it is being removed below
    const git = simpleGit({ baseDir: projectDir, config: ['maintenance.auto=false', 'gc.auto=0', 'fetch.writeCommitGraph=false'] })
    await git.init()
      .addConfig('core.sparseCheckout', 'true', true, 'local')
      .addRemote('origin', url)

    for (const item of includes) {
      log(`   Add '${item}' to '${name}' sparse-checkout file.`, 'debug')
      appendFileSync(resolve(projectDir, '.git/info/sparse-checkout'), `${item}\n`, 'utf8')
    }

    log(`   Clone repository '${name}'.`, 'info')
    await git.pull('origin', branch)

    if (lastUpdated) {
      await applyLastUpdated(git, projectDir, name)
    }

    if (includes.some(item => item.includes('docs'))) {
      cpSync(resolve(projectDir, 'docs'), projectDir, { recursive: true })
      rmSync(resolve(projectDir, 'docs'), { recursive: true })
    }
    rmSync(resolve(projectDir, '.git'), { recursive: true })
    return true
  } catch (error) {
    log(`   Error when cloning repository '${name}': ${formatError(error)}.`, 'error')
    return false
  }
}
