import { writeFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkHttpStatus } from '../utils/functions'
import type { FetchOptsUser } from '../schemas/fetch.js'
import type { EnhancedRepository } from './fetch.js'
import {
  checkDoc,
  enhanceRepositories,
  fetchDoc,
  generateInfos,
  getDoc,
  getProviderUrls,
  getSparseCheckout,
  isRepoFiltered,
} from './fetch.js'
import { cloneRepo, getInfos } from './git'
import { getInfos as getGitlabInfos } from './gitlab.js'

vi.mock('node:fs', () => ({ writeFileSync: vi.fn() }))
vi.mock('node:path', () => ({ resolve: vi.fn((...args) => args.join('/')) }))
vi.mock('../utils/functions.js', async importOriginal => ({
  ...(await importOriginal()),
  checkHttpStatus: vi.fn(),
  createDir: vi.fn(),
}))
vi.mock('./git.js', () => ({
  getInfos: vi.fn(),
  cloneRepo: vi.fn(),
}))
vi.mock('./gitlab.js', () => ({
  getInfos: vi.fn(),
}))
vi.spyOn(await import('./fetch.js'), 'generateInfos')
vi.spyOn(await import('./fetch.js'), 'getDoc')

describe('getProviderUrls', () => {
  const repo = {
    name: 'testRepo',
    owner: { login: 'testUser' },
    html_url: 'https://github.com/testUser/testRepo',
  } as Awaited<ReturnType<typeof getInfos>>['repos'][number]

  it('should build github urls by default', () => {
    expect(getProviderUrls(repo, 'main')).toEqual({
      blob_url: 'https://github.com/testUser/testRepo/blob/main',
      tree_url: 'https://github.com/testUser/testRepo/tree/main',
      raw_url: 'https://raw.githubusercontent.com/testUser/testRepo/main',
    })
  })

  it('should build gitlab urls when the provider is gitlab', () => {
    const gitlabRepo = { ...repo, html_url: 'https://gitlab.com/testUser/testRepo' } as typeof repo
    expect(getProviderUrls(gitlabRepo, 'main', 'gitlab')).toEqual({
      blob_url: 'https://gitlab.com/testUser/testRepo/-/blob/main',
      tree_url: 'https://gitlab.com/testUser/testRepo/-/tree/main',
      raw_url: 'https://gitlab.com/testUser/testRepo/-/raw/main',
    })
  })

  it('should fall back to building the base url from owner and name', () => {
    const bareRepo = { name: 'testRepo', owner: { login: 'testUser' } } as typeof repo
    expect(getProviderUrls(bareRepo, 'main').tree_url).toBe('https://github.com/testUser/testRepo/tree/main')
    expect(getProviderUrls(bareRepo, 'main', 'gitlab').tree_url).toBe('https://gitlab.com/testUser/testRepo/-/tree/main')
  })
})

describe('checkDoc', () => {
  it('should return the correct status for each document URL', async () => {
    (checkHttpStatus as any)
      .mockResolvedValueOnce(404) // rootReadmeStatus
      .mockResolvedValueOnce(200) // docsFolderStatus
      .mockResolvedValueOnce(404) // docsReadmeStatus

    const urls = {
      blob_url: 'https://github.com/testUser/testRepo/blob/main',
      tree_url: 'https://github.com/testUser/testRepo/tree/main',
      raw_url: 'https://raw.githubusercontent.com/testUser/testRepo/main',
    }
    const result = await checkDoc(urls)

    expect(result).toEqual({
      rootReadmeStatus: 404,
      docsFolderStatus: 200,
      docsReadmeStatus: 404,
    })
    expect(checkHttpStatus).toHaveBeenCalledWith(`${urls.blob_url}/README.md`)
    expect(checkHttpStatus).toHaveBeenCalledWith(`${urls.tree_url}/docs`)
    expect(checkHttpStatus).toHaveBeenCalledWith(`${urls.blob_url}/docs/01-readme.md`)
  })
})

describe('isRepoFiltered', () => {
  it('should correctly identify repos to exclude based on reposFilter', () => {
    const repo = {
      name: 'repo1',
      clone_url: 'https://github.com/testUser/repo1',
      fork: false,
      private: false,
    } as unknown as Awaited<ReturnType<typeof getInfos>>['repos'][number]
    const filter = ['!repo1', 'repo2']

    expect(isRepoFiltered(repo, filter)).toBe(true)
  })

  it('should correctly identify repos to include if they match the filter', () => {
    const repo = {
      name: 'repo2',
      clone_url: 'https://github.com/testUser/repo2',
      fork: false,
      private: false,
    } as unknown as Awaited<ReturnType<typeof getInfos>>['repos'][number]
    const filter = ['repo2']

    expect(isRepoFiltered(repo, filter)).toBe(false)
  })

  it('should correctly identify repos to include if they are not excluded and all filters are exclusions', () => {
    const repo = {
      name: 'repo3',
      clone_url: 'https://github.com/testUser/repo3',
      fork: false,
      private: false,
    } as unknown as Awaited<ReturnType<typeof getInfos>>['repos'][number]
    const filter = ['!repo1', '!repo2']

    expect(isRepoFiltered(repo, filter)).toBe(false)
  })

  it('should filter out an enhanced repo whose docpress metadata has no includable files', () => {
    const repo = {
      name: 'repo1',
      clone_url: 'https://github.com/testUser/repo1',
      fork: false,
      private: false,
      docpress: { includes: [] },
    } as unknown as EnhancedRepository

    // The empty docpress.includes short-circuits to filtered regardless of the filter
    expect(isRepoFiltered(repo)).toBe(true)
  })

  it('should keep an enhanced repo that has includable files', () => {
    const repo = {
      name: 'repo1',
      clone_url: 'https://github.com/testUser/repo1',
      fork: false,
      private: false,
      docpress: { includes: ['docs/*'] },
    } as unknown as EnhancedRepository

    expect(isRepoFiltered(repo)).toBe(false)
  })
})

describe('getSparseCheckout', () => {
  it('should return includes paths based on checkDoc statuses', async () => {
    (checkHttpStatus as any)
      .mockResolvedValueOnce(404) // rootReadmeStatus
      .mockResolvedValueOnce(200) // docsFolderStatus
      .mockResolvedValueOnce(404) // docsReadmeStatus

    const repo = { name: 'repo1', owner: { login: 'user1' }, size: 100 } as Awaited<ReturnType<typeof getInfos>>['repos'][number]
    const result = await getSparseCheckout(repo, 'main')

    expect(result).toEqual(['docs/*', 'README.md', '!*/**/README.md'])
  })

  it('should return an empty array if all statuses are 404', async () => {
    (checkHttpStatus as any)
      .mockResolvedValueOnce(404) // rootReadmeStatus
      .mockResolvedValueOnce(404) // docsFolderStatus
      .mockResolvedValueOnce(404) // docsReadmeStatus

    const repo = { name: 'repo2', owner: { login: 'user2' }, size: 100 } as Awaited<ReturnType<typeof getInfos>>['repos'][number]
    const result = await getSparseCheckout(repo, 'main')

    expect(result).toEqual([])
  })
})

describe('getDoc', () => {
  it('should clone repositories that are not filtered', async () => {
    const repos = [
      {
        name: 'repo1',
        clone_url: 'https://github.com/testUser/repo1',
        fork: false,
        private: false,
        docpress: { projectPath: '/path/to/repo1', branch: 'main', includes: ['README.md'] },
      },
      {
        name: 'repo2',
        clone_url: 'https://github.com/testUser/repo2',
        fork: true,
        private: false,
        docpress: { projectPath: '/path/to/repo2', branch: 'main', includes: [] },
      },
    ] as unknown as EnhancedRepository[]

    await getDoc(repos, ['repo1'])

    expect(cloneRepo).toHaveBeenCalledWith(
      repos[0].name,
      repos[0].clone_url,
      repos[0].docpress.projectPath,
      repos[0].docpress.branch,
      repos[0].docpress.includes,
      undefined,
    )
    expect(cloneRepo).not.toHaveBeenCalledWith(repos[1].name, expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything())
  })

  it('should forward the lastUpdated flag to cloneRepo', async () => {
    const repos = [
      {
        name: 'repo1',
        clone_url: 'https://github.com/testUser/repo1',
        fork: false,
        private: false,
        docpress: { projectPath: '/path/to/repo1', branch: 'main', includes: ['README.md'] },
      },
    ] as unknown as EnhancedRepository[]

    await getDoc(repos, ['repo1'], true)

    expect(cloneRepo).toHaveBeenCalledWith(
      repos[0].name,
      repos[0].clone_url,
      repos[0].docpress.projectPath,
      repos[0].docpress.branch,
      repos[0].docpress.includes,
      true,
    )
  })

  it('should warn if no repositories are provided', async () => {
    console.warn = vi.fn()

    await getDoc()

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('No repository respect docpress rules.'))
  })

  it('should clone repositories starting with a dot', async () => {
    const repos = [
      {
        name: '.repo3',
        clone_url: 'https://github.com/testUser/.repo3',
        fork: false,
        private: false,
        docpress: { projectPath: '/path/to/repo3', branch: 'main', includes: ['README.md'] },
      },
    ] as unknown as EnhancedRepository[]

    await getDoc(repos, ['.repo3'])

    expect(cloneRepo).toHaveBeenCalledWith(
      repos[0].name,
      repos[0].clone_url,
      repos[0].docpress.projectPath,
      repos[0].docpress.branch,
      repos[0].docpress.includes,
      undefined,
    )
  })
})

describe('enhanceRepositories', () => {
  it('should enhance repositories with docpress data', async () => {
    const repos = [
      {
        name: 'repo1',
        owner: { login: 'user1' },
        default_branch: 'main',
        fork: false,
        private: false,
        size: 100,
        clone_url: 'https://github.com/this-is-tobi/test',
      },
      {
        name: 'repo2',
        owner: { login: 'user1' },
        default_branch: 'main',
        fork: false,
        private: false,
        size: 100,
        clone_url: 'https://github.com/this-is-tobi/test',
      },
      {
        name: 'repo3',
        owner: { login: 'user1' },
        default_branch: 'main',
        fork: false,
        private: false,
        size: 100,
      },
      {
        name: 'repo4',
        owner: { login: 'user1' },
        default_branch: 'main',
        fork: true,
        private: false,
        size: 100,
        clone_url: 'https://github.com/this-is-tobi/test',
      },
      {
        name: 'repo5',
        owner: { login: 'user1' },
        default_branch: 'main',
        fork: false,
        private: true,
        size: 100,
        clone_url: 'https://github.com/this-is-tobi/test',
      },
    ] as Awaited<ReturnType<typeof getInfos>>['repos']

    const result = await enhanceRepositories(repos, 'main', ['repo1', 'repo3', 'repo4'])

    const getResult = (repoName: string) => result.find(repo => repo.name === repoName)

    expect(result).toHaveLength(repos.length)
    expect(getResult('repo1')?.docpress.filtered).toBe(false)
    expect(getResult('repo2')?.docpress.filtered).toBe(true)
    expect(getResult('repo3')?.docpress.filtered).toBe(true)
    expect(getResult('repo4')?.docpress.filtered).toBe(false)
    expect(getResult('repo5')?.docpress.filtered).toBe(true)
  })

  it('should fall back to each repository\'s default branch when no branch is given', async () => {
    const repos = [
      { name: 'repo1', owner: { login: 'user1' }, default_branch: 'master', fork: false, private: false, size: 100, clone_url: 'https://github.com/user1/repo1' },
      { name: 'repo2', owner: { login: 'user1' }, default_branch: 'develop', fork: false, private: false, size: 100, clone_url: 'https://github.com/user1/repo2' },
    ] as Awaited<ReturnType<typeof getInfos>>['repos']

    const result = await enhanceRepositories(repos, undefined)

    expect(result.find(r => r.name === 'repo1')?.docpress.branch).toBe('master')
    expect(result.find(r => r.name === 'repo2')?.docpress.branch).toBe('develop')
  })

  it('should let an explicit branch override each repository\'s default branch', async () => {
    const repos = [
      { name: 'repo1', owner: { login: 'user1' }, default_branch: 'master', fork: false, private: false, size: 100, clone_url: 'https://github.com/user1/repo1' },
    ] as Awaited<ReturnType<typeof getInfos>>['repos']

    const result = await enhanceRepositories(repos, 'stable')

    expect(result[0]?.docpress.branch).toBe('stable')
  })

  it('should namespace project paths and route prefixes when a routePrefix is provided', async () => {
    const repos = [
      { name: 'shared', owner: { login: 'alice' }, default_branch: 'main', fork: false, private: false, size: 100, clone_url: 'https://github.com/alice/shared' },
    ] as Awaited<ReturnType<typeof getInfos>>['repos']

    const namespaced = await enhanceRepositories(repos, 'main', undefined, 'github', 'alice/')
    const flat = await enhanceRepositories(repos, 'main', undefined, 'github')

    expect(namespaced[0]?.docpress.routePrefix).toBe('alice/')
    expect(namespaced[0]?.docpress.projectPath).toContain('/alice/shared')
    // Single-user (empty prefix) keeps the flat, un-namespaced path
    expect(flat[0]?.docpress.routePrefix).toBe('')
    expect(flat[0]?.docpress.projectPath).not.toContain('/alice/')
    expect(flat[0]?.docpress.projectPath).toContain('/shared')
  })
})

describe('generateInfos', () => {
  it('should write user and enhanced repos information to files', async () => {
    const user = { login: 'testUser' } as Awaited<ReturnType<typeof getInfos>>['user']
    const repos = [
      { name: 'repo1', owner: { login: 'testUser' }, default_branch: 'main', fork: false, private: false, size: 100 },
    ] as Awaited<ReturnType<typeof getInfos>>['repos']

    const result = await generateInfos(user, repos, 'main', ['repo1'])

    expect(writeFileSync).toHaveBeenCalledWith(expect.stringContaining(`user-${user.login}`), JSON.stringify(user, null, 2))
    expect(writeFileSync).toHaveBeenCalledWith(expect.stringContaining(`repos-${user.login}`), JSON.stringify(result.repos, null, 2))
    expect(result.user).toEqual(user)
    expect(result.repos).toBeInstanceOf(Array)
  })
})

describe('fetchDoc', () => {
  const mockFetchOpts: FetchOptsUser = {
    username: 'testUser',
    branch: 'main',
    reposFilter: ['repo1', 'repo2'],
    token: 'fake-token',
  }

  const mockUser = { login: 'testUser' }
  const mockRepos = [
    {
      name: 'repo1',
      clone_url: 'https://github.com/testUser/repo1',
      owner: mockUser,
      fork: false,
      private: false,
      size: 100,
      docpress: { projectPath: '/path/to/repo1', branch: 'main', includes: ['README.md'] },
    },
    {
      name: 'repo2',
      clone_url: 'https://github.com/testUser/repo2',
      owner: mockUser,
      fork: false,
      private: false,
      size: 100,
      docpress: { projectPath: '/path/to/repo2', branch: 'main', includes: ['README.md'] },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call getInfos with correct parameters', async () => {
    ;(getInfos as any).mockResolvedValue({ user: mockUser, repos: mockRepos, branch: 'main' })
    ;(generateInfos as any).mockResolvedValue({ user: mockUser, repos: mockRepos })
    ;(getDoc as any).mockResolvedValue(undefined)

    await fetchDoc(mockFetchOpts)

    expect(getInfos).toHaveBeenCalledWith({
      username: mockFetchOpts.username,
      token: mockFetchOpts.token,
      branch: mockFetchOpts.branch,
    })
    expect(getGitlabInfos).not.toHaveBeenCalled()
  })

  it('should forward the lastUpdated flag down through generateInfos/getDoc to cloneRepo', async () => {
    ;(getInfos as any).mockResolvedValue({ user: mockUser, repos: mockRepos, branch: 'main' })
    ;(checkHttpStatus as any).mockResolvedValue(200)

    await fetchDoc({ ...mockFetchOpts, lastUpdated: true })

    expect(cloneRepo).toHaveBeenCalledWith(
      mockRepos[0].name,
      mockRepos[0].clone_url,
      expect.any(String),
      'main',
      expect.any(Array),
      true,
    )
  })

  it('should use the gitlab provider when configured', async () => {
    ;(getGitlabInfos as any).mockResolvedValue({ user: mockUser, repos: mockRepos, branch: 'main' })

    await fetchDoc({ ...mockFetchOpts, gitProvider: 'gitlab' })

    expect(getGitlabInfos).toHaveBeenCalledWith({
      username: mockFetchOpts.username,
      token: mockFetchOpts.token,
      branch: mockFetchOpts.branch,
    })
    expect(getInfos).not.toHaveBeenCalled()
  })
})
