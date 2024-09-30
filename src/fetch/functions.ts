import { basename, parse, resolve } from 'node:path'
import { cpSync, readdirSync, statSync } from 'node:fs'
import { cloneRepo, getUserRepos, initGit } from './git.js'
import type { RepoSidebar } from './utils.js'
import { addSources, generateGlobalSidebar, generateIndex, generateRepoSidebar } from './utils.js'
import { checkHttpStatus, createDir, findMarkdownFiles, renameFile } from '~/utils/functions.js'
import { INDEX_PATH, PROJECTS_PATH, SIDEBAR_PATH, TEMPLATES_PATH, VITEPRESS_PATH } from '~/utils/const.js'
import { replaceReadmePath, replaceRelativePath } from '~/utils/regex.js'

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

export async function main(owner: string, branch: string, reposFilter: string[]) {
  const repositories = await getUserRepos(owner, reposFilter)

  for (const repository of repositories) {
    const projectPath = resolve(PROJECTS_PATH, repository.name)

    createDir(projectPath, { clean: true })
    await fetchDoc(owner, repository.name, branch, projectPath)
    transformDoc(owner, repository.name, repository.description ?? '', branch, projectPath)
  }
}

async function fetchDoc(owner: string, name: string, branch: string, projectPath: string) {
  const docsStatus = await checkDoc(owner, name, branch)
  const includes: string[] = []

  if (Object.values(docsStatus).every(status => status === 404)) {
    return
  }
  if (docsStatus.docsFolderStatus !== 404) {
    includes.push('docs/*')
  }
  if (docsStatus.docsFolderStatus === 404 || docsStatus.docsReadmeStatus === 404) {
    includes.push('README.md', '!*/README.md')
  }

  initGit(projectPath)

  await cloneRepo(`https://github.com/${owner}/${name}.git`, projectPath, branch, includes)
}

function transformDoc(owner: string, name: string, description: string, branch: string, projectPath: string) {
  findMarkdownFiles([projectPath]).forEach((file) => {
    replaceRelativePath(file, `https://github.com/${owner}/${name}/tree/${branch}`)

    if (basename(file).toLowerCase() === 'readme.md') {
      replaceReadmePath(file, `https://github.com/${owner}/${name}/tree/${branch}`)
    }
  })

  readdirSync(projectPath)
    .filter(file => statSync(resolve(projectPath, file)).isFile() && basename(resolve(projectPath, file)).endsWith('.md'))
    .sort((a, b) => a.localeCompare(b))
    .reduce((acc: RepoSidebar | undefined, cur, idx, arr) => {
      const filename = renameFile(resolve(projectPath, cur))

      if (idx === arr.length - 1) {
        const sourceFile = arr.length > 1 ? resolve(projectPath, 'sources.md') : resolve(projectPath, 'readme.md')
        addSources(`https://github.com/${owner}/${name}`, sourceFile)

        generateGlobalSidebar(SIDEBAR_PATH, name, generateRepoSidebar(name, parse(filename).name, acc))
        return undefined
      }

      return generateRepoSidebar(name, parse(filename).name, acc)
    }, undefined)

  generateIndex(INDEX_PATH, name, description)

  cpSync(resolve(TEMPLATES_PATH, 'theme'), resolve(VITEPRESS_PATH, '.vitepress/theme'), { recursive: true })
  cpSync(resolve(TEMPLATES_PATH, 'config.ts'), resolve(VITEPRESS_PATH, '.vitepress/config.ts'))
}
