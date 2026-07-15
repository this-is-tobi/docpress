import { appendFileSync, cpSync, rmSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { Octokit } from '@octokit/rest'
import { simpleGit } from 'simple-git'
import type { SimpleGit } from 'simple-git'
import type { GlobalOpts } from '../schemas/global.js'
import type { FetchOpts } from '../schemas/fetch.js'
import { addLastUpdatedFrontmatter, createDir, getMdFiles } from '../utils/functions.js'
import { log } from '../utils/logger.js'
import type { EnhancedRepository } from './fetch.js'

/**
 * Octokit logger that stays quiet on 404s, which are handled explicitly
 */
const quietOctokitLog = {
  debug: () => {},
  info: () => {},
  warn: (message: string) => {
    if (!message.includes('404')) console.warn(message)
  },
  error: (message: string) => {
    if (!message.includes('404')) console.error(message)
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
  const { data: repo } = await octokit.rest.repos.get({
    owner: repository.owner.login,
    repo: repository.name,
  })
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
      `   Failed to get contributors infos for repository '${repository.name}'. Error : ${error.message}`,
      'warn',
    )
    return { source: repo.source, contributors: [] }
  }

  return { source: repo.source, contributors }
}

/**
 * Injects each markdown file's last Git commit date as a "lastUpdated" frontmatter field
 * Reads the commit history straight from the local clone, so no Git provider API call is
 * needed and no rate limit is spent, regardless of how many files or repositories are processed
 *
 * @param git - Simple-git instance scoped to the cloned repository, with history still intact
 * @param projectDir - Directory containing the cloned repository
 * @param name - Repository name, used for logging
 */
export async function applyLastUpdated(git: SimpleGit, projectDir: string, name: string) {
  for (const file of getMdFiles([projectDir])) {
    const filePath = relative(projectDir, file)

    try {
      const { latest } = await git.log({ file: filePath, maxCount: 1 })
      if (latest?.date) {
        addLastUpdatedFrontmatter(file, latest.date)
      }
    } catch (error) {
      log(`   Unable to get last commit date for '${filePath}' in repository '${name}'. Error : ${error}`, 'warn')
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
 */
export async function cloneRepo(name: string, url: string, projectDir: string, branch: string, includes: string[], lastUpdated?: boolean) {
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
  } catch (error) {
    log(`   Error when cloning repository: ${error}.`, 'error')
  }
}
