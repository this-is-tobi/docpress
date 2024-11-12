import { appendFileSync, cpSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { Octokit } from 'octokit'
import { simpleGit } from 'simple-git'
import { createDir } from '../utils/functions.js'
import type { FetchOpts } from '../schemas/fetch.js'
import { log } from '../utils/logger.js'

export async function getInfos({ username, token, branch }: Pick<FetchOpts, 'username' | 'branch' | 'token'>) {
  log(`   Get infos for username '${username}'.`, 'info')
  const octokit = new Octokit({ auth: token })
  log(`   Get user infos.`, 'debug')
  const { data: user } = await octokit.request('GET /users/{username}', { username })
  log(`   Get repositories infos.`, 'debug')
  const { data: repos } = await octokit.request('GET /users/{username}/repos', { username, sort: 'full_name' })

  return { user, repos, branch }
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
