import { appendFileSync, cpSync, existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { Octokit } from 'octokit'
import { CleanOptions, simpleGit } from 'simple-git'
import { createDir } from '../utils/functions.js'
import type { FetchOpts } from '../schemas/fetch.js'

export async function getInfos({ username, token, branch }: Pick<FetchOpts, 'username' | 'branch' | 'token'>) {
  const octokit = new Octokit({ auth: token })
  const { data: user } = await octokit.request('GET /users/{username}', { username })
  const { data: repos } = await octokit.request('GET /users/{username}/repos', { username, sort: 'full_name' })

  return { user, repos, branch }
}

export async function cloneRepo(url: string, projectDir: string, branch: string, includes: string[]) {
  if (!existsSync(projectDir)) {
    createDir(projectDir)
  }

  const git = simpleGit({ baseDir: projectDir }).clean(CleanOptions.FORCE)

  try {
    await git.init().addRemote('origin', url).addConfig('core.sparseCheckout', 'true', true)
    for (const item of includes) {
      appendFileSync(resolve(projectDir, '.git/info/sparse-checkout'), `${item}\n`, 'utf8')
    }

    await git.pull('origin', branch)

    if (includes.some(item => item.includes('docs'))) {
      cpSync(resolve(projectDir, 'docs'), projectDir, { recursive: true })
      rmSync(resolve(projectDir, 'docs'), { recursive: true })
    }
    rmSync(resolve(projectDir, '.git'), { recursive: true })
  } catch (e) {
    console.error(e)
  }
}
