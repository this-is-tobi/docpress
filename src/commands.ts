import { resolve } from 'node:path'
import { existsSync, rmSync } from 'node:fs'
import { getUserRepos, initGit, initProvider } from './git.ts'
import { generateDoc } from './docs.ts'
import { options, type Options } from './schemas.ts'
import { createDir } from './utils/functions.ts'
import { generateHeaders } from './utils/docs.ts'

export function parseOptions(opts: Options) {
  return options.parse(opts)
}

export async function fetch(opts: Options) {
  const { username, repositories: reposFilter, token, branch, headerPages } = opts

  initProvider(token)
  if (existsSync(resolve(__dirname, 'projects'))) {
    rmSync(resolve(__dirname, 'projects'), { recursive: true })
  }

  const repositories = await getUserRepos(username, reposFilter)

  for (const repository of repositories) {
    const projectPath = resolve(__dirname, `projects/${repository.name}`)
    console.log({ projectPath })

    createDir(projectPath, { clean: true })
    initGit(projectPath)

    await generateDoc(username, repository.name, repository.description ?? '', branch)
  }

  if (headerPages?.length) {
    generateHeaders(resolve(__dirname, 'projects'), headerPages)
  }
}
