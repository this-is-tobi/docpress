import { appendFileSync, cpSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { Octokit } from '@octokit/rest'
import { simpleGit } from 'simple-git'
import type { GetResponseTypeFromEndpointMethod } from '@octokit/types'
import type { GlobalOpts } from '../schemas/global.js'
import type { FetchOpts } from '../schemas/fetch.js'
import { createDir } from '../utils/functions.js'
import { log } from '../utils/logger.js'
import type { EnhancedRepository } from './fetch.js'

export async function getInfos({ username, token, branch }: Pick<FetchOpts, 'branch'> & Pick<GlobalOpts, 'token'> & Required<Pick<GlobalOpts, 'username'>>) {
  log(`   Get infos for username '${username}'.`, 'info')
  const octokit = new Octokit({ auth: token })
  log(`   Get user infos.`, 'debug')
  const { data: user } = await octokit.request('GET /users/{username}', { username })
  log(`   Get repositories infos.`, 'debug')
  const { data: repos } = await octokit.request('GET /users/{username}/repos', { username, sort: 'full_name' })

  return { user, repos, branch }
}

export async function getContributors({ repository, token }: { repository: EnhancedRepository, token: GlobalOpts['token'] }) {
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
  const { data: repo } = await octokit.request('GET /repos/{owner}/{repo}', { owner: repository.owner.login, repo: repository.name })
  if (!repo.source?.owner.login) {
    return { source: repo.source, contributors: [] }
  }
  const { data: contributors } = await octokit.request('GET /repos/{owner}/{repo}/contributors', { owner: repo.source.owner.login, repo: repo.name }).catch((_error) => {
    log(`   Failed to get contributors infos for repository '${repository.name}'.`, 'warn')
    return { data: [] } as unknown as GetResponseTypeFromEndpointMethod<typeof octokit.repos.listContributors>
  })

  return { source: repo.source, contributors }
}

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
