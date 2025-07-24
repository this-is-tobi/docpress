import { appendFileSync, cpSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { Octokit } from '@octokit/rest'
import { simpleGit } from 'simple-git'
import type { GlobalOpts } from '../schemas/global.js'
import type { FetchOpts } from '../schemas/fetch.js'
import { createDir } from '../utils/functions.js'
import { log } from '../utils/logger.js'
import type { EnhancedRepository } from './fetch.js'

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
  const octokit = new Octokit({ auth: token })
  log(`   Get user infos.`, 'debug')
  const { data: user } = await octokit.rest.users.getByUsername({ username })
  log(`   Get repositories infos.`, 'debug')
  const { data: repos } = await octokit.rest.repos.listForUser({ username, sort: 'full_name' })

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
  const octokit = new Octokit({
    auth: token,
    log: {
      debug: () => {},
      info: () => {},
      warn: (message) => {
        if (!message.includes('404')) console.warn(message)
      },
      error: (message) => {
        if (!message.includes('404')) console.error(message)
      },
    },
  })
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
        per_page: 500,
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
 * Clones a repository with sparse checkout
 *
 * @param name - Repository name
 * @param url - Repository URL
 * @param projectDir - Directory to clone into
 * @param branch - Branch to clone
 * @param includes - Patterns to include in sparse checkout
 */
export async function cloneRepo(name: string, url: string, projectDir: string, branch: string, includes: string[]) {
  createDir(projectDir, { clean: true })

  try {
    const git = simpleGit({ baseDir: projectDir })
    await git.init()
      .addConfig('core.sparseCheckout', 'true', true, 'local')
      .addRemote('origin', url)

    for (const item of includes) {
      log(`   Add '${item}' to '${name}' sparse-checkout file.`, 'debug')
      appendFileSync(resolve(projectDir, '.git/info/sparse-checkout'), `${item}\n`, 'utf8')
    }

    log(`   Clone repository '${name}'.`, 'info')
    await git.pull('origin', branch)

    if (includes.some(item => item.includes('docs'))) {
      cpSync(resolve(projectDir, 'docs'), projectDir, { recursive: true })
      rmSync(resolve(projectDir, 'docs'), { recursive: true })
    }
    rmSync(resolve(projectDir, '.git'), { recursive: true })
  } catch (error) {
    log(`   Error when cloning repository: ${error}.`, 'error')
  }
}
