import { appendFileSync, cpSync, rmSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { Octokit } from '@octokit/rest'
import { simpleGit } from 'simple-git'
import type { SimpleGit } from 'simple-git'
import type { GlobalOpts } from '../schemas/global.js'
import type { FetchOpts } from '../schemas/fetch.js'
import { addLastUpdatedFrontmatter, createDir, formatError, getMdFiles } from '../utils/functions.js'
import { log } from '../utils/logger.js'
import type { EnhancedRepository } from './fetch.js'

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
 * Gets contributors for a repository
 *
 * @param options - Options for retrieving contributors
 * @param options.repository - Repository information
 * @param options.token - GitHub API token
 * @returns Object with source repository and contributors list
 */
export async function getContributors({
  repository,
  token,
}: {
  repository: EnhancedRepository
  token: GlobalOpts['token']
}) {
  log(`   Get contributors infos for repository '${repository.name}'.`, 'info')
  const octokit = new Octokit({ auth: token, log: quietOctokitLog })
  let repo
  try {
    repo = (await octokit.rest.repos.get({
      owner: repository.owner.login,
      repo: repository.name,
    })).data
  } catch (error) {
    // A deleted / private / rate-limited upstream must not abort the whole
    // prepare step: degrade to "no source" so this single fork is skipped.
    log(`   Failed to get repository infos for '${repository.name}'. Error : ${formatError(error)}`, 'warn')
    return { source: undefined, contributors: [] }
  }
  if (!repo.source?.owner?.login) {
    return { source: repo.source, contributors: [] }
  }
  const contributors: Array<any> = []
  try {
    for await (const { data } of octokit.paginate.iterator(
      octokit.rest.repos.listContributors,
      {
        owner: repo.source.owner.login,
        repo: repo.parent?.name ?? repo.name,
        per_page: 100,
      },
    )) {
      contributors.push(...data)
    }
  } catch (error) {
    log(
      `   Failed to get contributors infos for repository '${repository.name}'. Error : ${formatError(error)}`,
      'warn',
    )
    return { source: repo.source, contributors: [] }
  }

  return { source: repo.source, contributors }
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
