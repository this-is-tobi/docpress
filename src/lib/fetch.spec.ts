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
  getSparseCheckout,
  isRepoFiltered,
} from './fetch.js'
import { cloneRepo, getInfos } from './git'

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

  // it('should create the docpress directory', async () => {
  //   ;(getInfos as any).mockResolvedValue({ user: mockUser, repos: mockRepos, branch: 'main' })
  //   ;(generateInfos as any).mockResolvedValue({ user: mockUser, repos: mockRepos })
  //   ;(getDoc as any).mockResolvedValue(undefined)

  //   await fetchDoc(mockFetchOpts)

  //   expect(createDir).toHaveBeenCalledWith(DOCPRESS_DIR, { clean: true })
  // })

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
  })

  it.skip('should call generateInfos and getDoc with the correct data', async () => {
    const enhancedRepos = mockRepos.map(repo => ({
      ...repo,
      docpress: {
        filtered: false,
        branch: 'main',
        includes: ['docs/*'],
        projectPath: `/path/to/${repo.name}`,
        raw_url: `https://raw.githubusercontent.com/${repo.owner.login}/${repo.name}/main`,
        replace_url: `https://github.com/${repo.owner.login}/${repo.name}/tree/main`,
      },
    }))

    ;(getInfos as any).mockResolvedValue({ user: mockUser, repos: mockRepos, branch: 'main' })
    ;(generateInfos as any).mockResolvedValue({ user: mockUser, repos: enhancedRepos })
    ;(getDoc as any).mockResolvedValue(undefined)

    await fetchDoc(mockFetchOpts)

    expect(generateInfos).toHaveBeenCalledWith(mockUser, mockRepos, 'main', mockFetchOpts.reposFilter)
    expect(getDoc).toHaveBeenCalledWith(enhancedRepos, mockFetchOpts.reposFilter)
  })

  it.skip('should handle cases with no matching repositories', async () => {
    ;(getInfos as any).mockResolvedValue({ user: mockUser, repos: [], branch: 'main' })
    ;(generateInfos as any).mockResolvedValue({ user: mockUser, repos: [] })

    await fetchDoc(mockFetchOpts)

    expect(generateInfos).toHaveBeenCalledWith(mockUser, [], 'main', mockFetchOpts.reposFilter)
    expect(getDoc).toHaveBeenCalledWith([], mockFetchOpts.reposFilter)
  })

  it('should throw an error if getInfos fails', async () => {
    ;(getInfos as any).mockRejectedValue(new Error('Failed to fetch infos'))

    await expect(fetchDoc(mockFetchOpts)).rejects.toThrow('Failed to fetch infos')

    expect(getInfos).toHaveBeenCalledWith({
      username: mockFetchOpts.username,
      token: mockFetchOpts.token,
      branch: mockFetchOpts.branch,
    })
    expect(generateInfos).not.toHaveBeenCalled()
    expect(getDoc).not.toHaveBeenCalled()
  })

  it.skip('should throw an error if generateInfos fails', async () => {
    ;(getInfos as any).mockResolvedValue({ user: mockUser, repos: mockRepos, branch: 'main' })
    ;(generateInfos as any).mockRejectedValue(new Error('Failed to generate infos'))

    await expect(fetchDoc(mockFetchOpts)).rejects.toThrow('Failed to generate infos')

    expect(getInfos).toHaveBeenCalledWith({
      username: mockFetchOpts.username,
      token: mockFetchOpts.token,
      branch: mockFetchOpts.branch,
    })
    expect(generateInfos).toHaveBeenCalledWith(mockUser, mockRepos, 'main', mockFetchOpts.reposFilter)
    expect(getDoc).not.toHaveBeenCalled()
  })
})
