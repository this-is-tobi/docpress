import { writeFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { checkHttpStatus, createDir } from '../utils/functions'
import { USER_INFOS, USER_REPOS_INFOS } from '../utils/const.js'
import type { FetchOpts } from '../schemas/fetch.js'
import type { EnhancedRepository } from './fetch.js'
import {
  checkDoc,
  enhanceRepositories,
  fetchDoc,
  generateInfos,
  getDoc,
  getSparseCheckout,
  isRepoFiltered,
} from './fetch.js'
import { cloneRepo, getInfos } from './git'

vi.mock('node:fs', () => ({ writeFileSync: vi.fn() }))
vi.mock('node:path', () => ({ resolve: vi.fn((...args) => args.join('/')) }))
vi.mock('../utils/functions.js', () => ({
  checkHttpStatus: vi.fn(),
  createDir: vi.fn(),
}))
vi.mock('./git.js', () => ({
  getInfos: vi.fn(),
  cloneRepo: vi.fn(),
}))
vi.spyOn(await import('./fetch.js'), 'generateInfos')
vi.spyOn(await import('./fetch.js'), 'getDoc')

describe('checkDoc', () => {
  it('should return the correct status for each document URL', async () => {
    (checkHttpStatus as any)
      .mockResolvedValueOnce(404) // rootReadmeStatus
      .mockResolvedValueOnce(200) // docsFolderStatus
      .mockResolvedValueOnce(404) // docsReadmeStatus

    const result = await checkDoc('testUser', 'testRepo', 'main')

    expect(result).toEqual({
      rootReadmeStatus: 404,
      docsFolderStatus: 200,
      docsReadmeStatus: 404,
    })
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
    )
    expect(cloneRepo).not.toHaveBeenCalledWith(repos[1].name, expect.anything(), expect.anything(), expect.anything(), expect.anything())
  })

  it('should warn if no repositories are provided', async () => {
    console.warn = vi.fn()

    await getDoc()

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('No repository respect docpress rules.'))
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
    expect(getResult('repo4')?.docpress.filtered).toBe(true)
    expect(getResult('repo5')?.docpress.filtered).toBe(true)
  })
})

describe('generateInfos', () => {
  it('should write user and enhanced repos information to files', async () => {
    const user = { login: 'testUser' } as Awaited<ReturnType<typeof getInfos>>['user']
    const repos = [
      { name: 'repo1', owner: { login: 'testUser' }, default_branch: 'main', fork: false, private: false, size: 100 },
    ] as Awaited<ReturnType<typeof getInfos>>['repos']

    const result = await generateInfos(user, repos, 'main', ['repo1'])

    expect(writeFileSync).toHaveBeenCalledWith(expect.stringContaining(USER_INFOS), JSON.stringify(user, null, 2))
    expect(writeFileSync).toHaveBeenCalledWith(expect.stringContaining(USER_REPOS_INFOS), JSON.stringify(result.repos, null, 2))
    expect(result.user).toEqual(user)
    expect(result.repos).toBeInstanceOf(Array)
  })
})

describe.skip('fetchDoc', () => {
  const mockUsername = 'testUser'
  const mockBranch = 'main'
  const mockToken = 'testToken'
  const mockReposFilter = ['repo1', '!repo2']

  const fetchOpts: FetchOpts = {
    username: mockUsername,
    gitProvider: 'github',
    branch: mockBranch,
    token: mockToken,
    reposFilter: mockReposFilter,
  }

  it('should create the DOCPRESS_DIR and fetch and process repositories', async () => {
    const mockUser = { login: mockUsername }
    const mockRepos = [
      {
        name: 'repo1',
        owner: mockUser,
        clone_url: 'https://github.com/testUser/repo1',
        fork: false,
        private: false,
        docpress: { projectPath: '/path/to/repo1', branch: 'main', includes: ['README.md'] },
      },
      {
        name: 'repo2',
        owner: mockUser,
        clone_url: 'https://github.com/testUser/repo2',
        fork: true,
        private: false,
        docpress: { projectPath: '/path/to/repo2', branch: 'main', includes: [] },
      },
    ] as unknown as EnhancedRepository[]
    const mockEnhancedRepos = [
      { ...mockRepos[0], docpress: { branch: mockBranch, filtered: false, includes: [], projectPath: '', raw_url: '', replace_url: '' } },
    ]

    ;(getInfos as any).mockResolvedValue({ user: mockUser, repos: mockRepos, branch: mockBranch })

    await fetchDoc(fetchOpts)

    expect(createDir).toHaveBeenCalledWith(expect.any(String), { clean: true })
    expect(getInfos).toHaveBeenCalledWith({ username: mockUsername, token: mockToken, branch: mockBranch })
    expect(generateInfos).toHaveBeenCalledWith(mockUser, mockRepos, mockBranch, mockReposFilter)
    expect(getDoc).toHaveBeenCalledWith(mockEnhancedRepos, mockReposFilter)
  })

  it('should handle errors if getInfos fails', async () => {
    ;(getInfos as any).mockRejectedValue(new Error('getInfos failed'))
    console.error = vi.fn()

    await expect(fetchDoc(fetchOpts)).rejects.toThrow('getInfos failed')
    expect(console.error).toHaveBeenCalledWith(expect.any(Error))
    expect(createDir).toHaveBeenCalledWith(expect.any(String), { clean: true })

    const generateInfos = (await import('./fetch.js')).generateInfos as any
    const getDoc = (await import('./fetch.js')).getDoc as any

    expect(generateInfos).not.toHaveBeenCalled()
    expect(getDoc).not.toHaveBeenCalled()
  })
})
