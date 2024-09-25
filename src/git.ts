import { appendFileSync, cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { Octokit } from 'octokit'
import { CleanOptions, simpleGit } from 'simple-git'
import type { SimpleGit } from 'simple-git'
import type { Options } from './schemas.js'

let git: SimpleGit

export function initGit(projectDir: string) {
  git = simpleGit({ baseDir: projectDir }).clean(CleanOptions.FORCE)
}

let octokit: Octokit

export function initProvider(token?: Options['token']) {
  octokit = new Octokit({ auth: token })
}

export async function getUserRepos(username: Options['username'], repoList: Options['repositories']) {
  const { data } = await octokit.request('GET /users/{username}/repos', { username, sort: 'full_name' })
  if (repoList) {
    return data.filter(repo => repoList?.some(filter => filter === repo.name))
  }
  return data.filter(repo => !repo.private && !repo.fork)
}

export async function cloneRepo(url: string, projectDir: string, branch: string, include: string[]) {
  if (!existsSync(projectDir)) mkdirSync(projectDir, { recursive: true })

  try {
    await git.init().addRemote('origin', url).addConfig('core.sparseCheckout', 'true', true)
    for (const item of include) {
      appendFileSync(resolve(projectDir, '.git/info/sparse-checkout'), `${item}\n`, 'utf8')
    }

    await git.pull('origin', branch)

    if (include.some(item => item.includes('docs'))) {
      cpSync(resolve(projectDir, 'docs'), projectDir, { recursive: true })
      rmSync(resolve(projectDir, 'docs'), { recursive: true })
    }
    rmSync(resolve(projectDir, '.git'), { recursive: true })
  } catch (e) {
    console.error(e)
  }
}
