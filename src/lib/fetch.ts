import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
import type { FetchOpts } from '../schemas/fetch.js'
import { checkHttpStatus, createDir } from '../utils/functions.js'
import { DOCPRESS_DIR, DOCS_DIR, USER_INFOS, USER_REPOS_INFOS } from '../utils/const.js'
import { cloneRepo, getInfos } from './git.js'

export type EnhancedRepository = Awaited<ReturnType<typeof getInfos>>['repos'][number] & {
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

export async function main({ username, branch, reposFilter, token }: FetchOpts) {
  createDir(DOCPRESS_DIR, { clean: true })

  await getInfos({ username, token, branch })
    .then(async ({ user, repos, branch }) => generateInfos(user, repos, branch, reposFilter))
    .then(async ({ repos }) => fetchDoc(repos, reposFilter))
}

async function enhanceRepositories(repos: Awaited<ReturnType<typeof getInfos>>['repos'], branch?: string, reposFilter?: string[]) {
  const enhancedRepos: EnhancedRepository[] = []

  await Promise.all(repos.map(async (repo) => {
    const computedBranch = branch ?? repo.default_branch ?? 'main'
    const projectPath = resolve(DOCS_DIR, repo.name)
    const filtered = isRepoFiltered(repo, reposFilter)
    let includes: string[] = []

    if (!repo.fork && !repo.private && !filtered) {
      includes = await getSparseCheckout(repo, computedBranch)
    }

    enhancedRepos.push({
      ...repo,
      docpress: {
        filtered,
        branch: computedBranch,
        includes,
        projectPath,
        raw_url: `https://raw.githubusercontent.com/${repo.owner.login}/${repo.name}/${computedBranch}`,
        replace_url: `https://github.com/${repo.owner.login}/${repo.name}/tree/${computedBranch}`,
      },
    })
  }))

  return enhancedRepos
}

async function getSparseCheckout(repo: Awaited<ReturnType<typeof getInfos>>['repos'][number], branch: string) {
  const docsStatus = await checkDoc(repo.owner.login, repo.name, branch)

  const includes: string[] = []
  if (Object.values(docsStatus).every(status => status === 404) || !repo.size) {
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

async function generateInfos(user: Awaited<ReturnType<typeof getInfos>>['user'], repos: Awaited<ReturnType<typeof getInfos>>['repos'], branch?: FetchOpts['branch'], reposFilter?: FetchOpts['reposFilter']) {
  writeFileSync(USER_INFOS, JSON.stringify(user, null, 2))

  const enhancedRepos = await enhanceRepositories(repos, branch, reposFilter)
  writeFileSync(USER_REPOS_INFOS, JSON.stringify(enhancedRepos, null, 2))

  return { user, repos: enhancedRepos }
}

async function fetchDoc(repos?: EnhancedRepository[], reposFilter?: FetchOpts['reposFilter']) {
  if (!repos) {
    console.warn('No repository respect docpress rules.')
    return
  }

  await Promise.all(
    repos
      .filter(repo => !isRepoFiltered(repo, reposFilter))
      .map(async repo => cloneRepo(repo.clone_url as string, repo.docpress.projectPath, repo.docpress.branch, repo.docpress.includes)),
  )
}

export function isRepoFiltered(repo: EnhancedRepository | Awaited<ReturnType<typeof getInfos>>['repos'][number], reposFilter?: string[]) {
  const isExcluded = reposFilter?.filter(filter => filter.startsWith('!'))
    .some(filter => repo.name === filter.substring(1))
  const isIncluded = reposFilter?.filter(filter => !filter.startsWith('!'))
    .includes(repo.name)

  const isFiltered = isExcluded || !isIncluded

  if ('docpress' in repo && !repo.docpress.includes.length) {
    return true
  }

  if (!!repo.clone_url && !repo.fork && !repo.private && !isFiltered) {
    return false
  }
  return true
}
