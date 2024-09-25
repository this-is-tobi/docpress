import { resolve } from 'node:path'
import { existsSync, rmSync } from 'node:fs'
import { getUserRepos, initGit, initProvider } from './git.js'
import { generateDoc } from './docs.js'
import { options, type Options } from './schemas.js'
import { createDir } from './utils/functions.js'
import { generateExtraPages } from './utils/docs.js'

export function parseOptions(opts: Options) {
  return options.parse(opts)
}

export async function fetch(opts: Options) {
  const { username, repositories: reposFilter, token, branch, extraPages } = opts

  initProvider(token)
  if (existsSync(resolve(import.meta.dirname, 'projects'))) {
    rmSync(resolve(import.meta.dirname, 'projects'), { recursive: true })
  }

  const repositories = await getUserRepos(username, reposFilter)

  for (const repository of repositories) {
    const projectPath = resolve(import.meta.dirname, 'projects', repository.name)

    createDir(projectPath, { clean: true })
    initGit(projectPath)

    await generateDoc(username, repository.name, repository.description ?? '', projectPath, branch)
  }

  if (extraPages?.length) {
    generateExtraPages(resolve(import.meta.dirname, 'projects'), extraPages)
  }
}
