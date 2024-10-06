import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
import { checkHttpStatus, createDir } from '../utils/functions.js'
import { PROJECTS_PATH, USER_INFOS_PATH, USER_REPOS_PATH, VITEPRESS_PATH } from '../utils/const.js'
import { cloneRepo, getUserInfos, getUserRepos, initGit } from './git.js'
import type { Options } from './schemas.js'

export type EnhancedRepository = Awaited<ReturnType<typeof getUserRepos>>[number] & {
  docpress: {
    branch: string
    filtered: boolean
    includes: string[]
    projectPath: string
    raw_url: string
    replace_url: string
  }
}

export async function checkDoc(repoOwner: string, repoName: string, branch: string) {
  const rootReadmeUrl = `https://github.com/${repoOwner}/${repoName}/tree/${branch}/README.md`
  const docsFolderUrl = `https://github.com/${repoOwner}/${repoName}/tree/${branch}/docs`
  const docsReadmeUrl = `https://github.com/${repoOwner}/${repoName}/tree/${branch}/docs/01-readme.md`

  const rootReadmeStatus = await checkHttpStatus(rootReadmeUrl)
  const docsFolderStatus = await checkHttpStatus(docsFolderUrl)
  const docsReadmeStatus = await checkHttpStatus(docsReadmeUrl)

  return {
    rootReadmeStatus,
    docsFolderStatus,
    docsReadmeStatus,
  }
}

export async function main(owner: string, branch?: string, reposFilter?: string[]) {
  createDir(VITEPRESS_PATH, { clean: true })

  await getUserInfos(owner)
    .then(user => generateUserInfos(user))
  await getUserRepos(owner)
    .then(async repos => enhanceRepositories(repos, branch, reposFilter))
    .then(repos => generateReposInfos(repos))
    .then(async repos => fetchDoc(repos, reposFilter))
}

async function enhanceRepositories(repositories: Awaited<ReturnType<typeof getUserRepos>>, branch?: string, reposFilter?: string[]) {
  const enhancedRepos: EnhancedRepository[] = []

  for (const repository of repositories) {
    const computedBranch = branch ?? repository.default_branch ?? 'main'
    const projectPath = resolve(PROJECTS_PATH, repository.name)
    const filtered = isFiltered(repository, reposFilter)
    let includes: string[] = []

    if (!repository.fork && !repository.private && !filtered) {
      includes = await getSparseCheckout(repository, computedBranch)
    }

    enhancedRepos.push({
      ...repository,
      docpress: {
        filtered,
        branch: computedBranch,
        includes,
        projectPath,
        raw_url: `https://raw.githubusercontent.com/${repository.owner.login}/${repository.name}/${computedBranch}`,
        replace_url: `https://github.com/${repository.owner.login}/${repository.name}/tree/${computedBranch}`,
      },
    })
  }

  return enhancedRepos
}

async function getSparseCheckout(repository: Awaited<ReturnType<typeof getUserRepos>>[number], branch: string) {
  const docsStatus = await checkDoc(repository.owner.login, repository.name, branch)

  const includes: string[] = []
  if (Object.values(docsStatus).every(status => status === 404)) {
    return []
  }
  if (docsStatus.docsFolderStatus !== 404) {
    includes.push('docs/*')
  }
  if (docsStatus.docsFolderStatus === 404 || docsStatus.docsReadmeStatus === 404) {
    includes.push('README.md', '!*/**/README.md')
  }
  return includes
}

function generateUserInfos(user?: Awaited<ReturnType<typeof getUserInfos>>) {
  writeFileSync(
    USER_INFOS_PATH,
    JSON.stringify(user, null, 2),
  )

  return user
}

function generateReposInfos(repositories: EnhancedRepository[]) {
  writeFileSync(
    USER_REPOS_PATH,
    JSON.stringify(repositories, null, 2),
  )

  return repositories
}

async function fetchDoc(repositories?: EnhancedRepository[], reposFilter?: Options['repositories']) {
  if (!repositories) {
    console.warn('No repository respect docpress rules.')
    return
  }

  for (const repository of repositories) {
    const filtered = isFiltered(repository, reposFilter)
    if (repository.clone_url && !repository.fork && !repository.private && repository.docpress.includes.length && !filtered) {
      createDir(repository.docpress.projectPath)
      initGit(repository.docpress.projectPath)
      await cloneRepo(repository.clone_url, repository.docpress.projectPath, repository.docpress.branch, repository.docpress.includes)
    }
  }
}

export function isFiltered(repository: EnhancedRepository | Awaited<ReturnType<typeof getUserRepos>>[number], reposFilter?: string[]) {
  return reposFilter
    ? reposFilter.some(filter => filter.startsWith('!')
      ? repository.name === filter.substring(1)
      : repository.name !== filter.substring(1))
    : true
}
