import { appendFileSync, cpSync, rmSync } from 'node:fs'
import { Octokit } from '@octokit/rest'
import { simpleGit } from 'simple-git'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addLastUpdatedFrontmatter, createDir, getMdFiles } from '../utils/functions.js'
import { log } from '../utils/logger.js'
import { applyLastUpdated, cloneRepo, getContributors, getInfos, parseLastCommitDates, quietOctokitLog } from './git.js'
import type { EnhancedRepository } from './fetch.js'

vi.mock('@octokit/rest')
vi.mock('simple-git')
vi.mock('node:fs')
vi.mock('node:path', () => ({
  resolve: vi.fn((...args) => args.join('/')),
  relative: vi.fn((from: string, to: string) => to.replace(`${from}/`, '')),
}))
vi.mock('../utils/functions.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    addLastUpdatedFrontmatter: vi.fn(),
    createDir: vi.fn(),
    getMdFiles: vi.fn(),
  }
})
vi.mock('../utils/logger.js')

describe('quietOctokitLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should suppress 404 warnings and errors but forward the rest', () => {
    quietOctokitLog.warn('boom 404 not found')
    quietOctokitLog.error('boom 404 not found')
    expect(log).not.toHaveBeenCalled()

    quietOctokitLog.warn('real warning')
    quietOctokitLog.error('real error')
    expect(log).toHaveBeenCalledWith('real warning', 'warn')
    expect(log).toHaveBeenCalledWith('real error', 'error')
  })
})

describe('getInfos', () => {
  const mockUser = { login: 'testUser' }
  const mockRepos = [{ name: 'repo1' }, { name: 'repo2' }]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return user info and repos', async () => {
    const mockOctokit = {
      rest: {
        users: {
          getByUsername: vi.fn()
            .mockResolvedValueOnce({ data: mockUser }),
        },
        repos: {
          listForUser: vi.fn(),
        },
      },
      paginate: vi.fn()
        .mockResolvedValueOnce(mockRepos),
    }

    ;(Octokit as any).mockImplementation(function () { return mockOctokit })

    const result = await getInfos({ username: 'testUser', token: 'testToken', branch: 'main' })

    expect(result).toEqual({
      user: mockUser,
      repos: mockRepos,
      branch: 'main',
    })
    expect(mockOctokit.rest.users.getByUsername).toHaveBeenCalledWith({ username: 'testUser' })
    expect(mockOctokit.paginate).toHaveBeenCalledWith(mockOctokit.rest.repos.listForUser, { username: 'testUser', sort: 'full_name', per_page: 100 })
  })

  it('should throw a friendly error when the user does not exist', async () => {
    const mockOctokit = {
      rest: {
        users: {
          getByUsername: vi.fn()
            .mockRejectedValueOnce(Object.assign(new Error('Not Found'), { status: 404 })),
        },
        repos: {
          listForUser: vi.fn(),
        },
      },
      paginate: vi.fn(),
    }

    ;(Octokit as any).mockImplementation(function () { return mockOctokit })

    await expect(getInfos({ username: 'ghostUser', token: 'testToken', branch: 'main' }))
      .rejects
      .toThrow(`No GitHub user found for 'ghostUser'.`)
  })

  it('should rethrow unexpected user lookup errors unchanged', async () => {
    const mockOctokit = {
      rest: {
        users: {
          getByUsername: vi.fn()
            .mockRejectedValueOnce(Object.assign(new Error('Server Error'), { status: 500 })),
        },
        repos: {
          listForUser: vi.fn(),
        },
      },
      paginate: vi.fn(),
    }

    ;(Octokit as any).mockImplementation(function () { return mockOctokit })

    await expect(getInfos({ username: 'testUser', token: 'testToken', branch: 'main' }))
      .rejects
      .toThrow('Server Error')
  })
})

describe('getContributors', () => {
  const mockRepository = {
    name: 'repo1',
    owner: { login: 'testOwner' },
  } as EnhancedRepository
  const mockToken = 'testToken'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return repository source and contributors on success', async () => {
    const mockRepoData = { source: { owner: { login: 'test-source-owner' } }, name: 'repo1' }
    const mockContributorsDataPage1 = [{ login: 'contributor1' }, { login: 'contributor2' }]
    const mockContributorsDataPage2 = [{ login: 'contributor3' }]

    const mockOctokit = {
      rest: {
        repos: {
          get: vi.fn()
            .mockResolvedValueOnce({ data: mockRepoData }),
          listContributors: vi.fn(),
        },
      },
      paginate: {
        iterator: vi.fn()
          .mockReturnValueOnce([
            { data: mockContributorsDataPage1 },
            { data: mockContributorsDataPage2 },
          ]),
      },
    }

    ;(Octokit as any).mockImplementation(function () { return mockOctokit })

    const result = await getContributors({ repository: mockRepository, token: mockToken })

    expect(result).toEqual({
      source: mockRepoData.source,
      contributors: [...mockContributorsDataPage1, ...mockContributorsDataPage2],
    })
  })

  it('should log a warning and return empty contributors if contributors request fails with non-404', async () => {
    const mockRepoData = { source: { owner: { login: 'test-source-owner' } }, name: 'repo1' }

    const mockOctokit = {
      rest: {
        repos: {
          get: vi.fn()
            .mockResolvedValueOnce({ data: mockRepoData }),
          listContributors: vi.fn(),
        },
      },
      // paginate lives at the top level of the Octokit client; make its iterator
      // reject so the real catch branch (not a mock-shape TypeError) is exercised
      paginate: {
        iterator: vi.fn(() => {
          throw new Error('500 Server Error')
        }),
      },
    }

    ;(Octokit as any).mockImplementation(function () { return mockOctokit })

    const result = await getContributors({ repository: mockRepository, token: mockToken })

    expect(log).toHaveBeenCalledWith(`   Failed to get contributors infos for repository '${mockRepository.name}'. Error : 500 Server Error`, 'warn')
    expect(result).toEqual({
      source: mockRepoData.source,
      contributors: [],
    })
  })

  it('should degrade gracefully when the repository lookup itself fails', async () => {
    const mockOctokit = {
      rest: {
        repos: {
          get: vi.fn().mockRejectedValueOnce(new Error('404 Not Found')),
          listContributors: vi.fn(),
        },
      },
      paginate: { iterator: vi.fn() },
    }

    ;(Octokit as any).mockImplementation(function () { return mockOctokit })

    const result = await getContributors({ repository: mockRepository, token: mockToken })

    // A deleted/private upstream must not throw: it returns no source so the
    // fork is skipped rather than aborting the whole prepare step
    expect(log).toHaveBeenCalledWith(`   Failed to get repository infos for '${mockRepository.name}'. Error : 404 Not Found`, 'warn')
    expect(result).toEqual({ source: undefined, contributors: [] })
  })

  it('should return empty contributors if source owner login is undefined', async () => {
    const mockRepoData = { source: { owner: {} }, name: 'repo1' }

    const mockOctokit = {
      rest: {
        repos: {
          get: vi.fn()
            .mockResolvedValueOnce({ data: mockRepoData }),
          listContributors: vi.fn(),
        },
        paginate: {
          iterator: vi.fn(),
        },
      },
    }

    ;(Octokit as any).mockImplementation(function () { return mockOctokit })

    const result = await getContributors({ repository: mockRepository, token: mockToken })

    expect(result).toEqual({
      source: mockRepoData.source,
      contributors: [],
    })
  })
})

describe('applyLastUpdated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should inject the latest commit date for each markdown file in a single pass', async () => {
    // Only a.md appears in history (with two commits, newest first); b.md has none
    const mockRaw = vi.fn().mockResolvedValue(
      '2024-05-01T12:00:00+00:00\n\ndocs/a.md\n\n2024-01-01T12:00:00+00:00\n\ndocs/a.md\n',
    )
    const mockGit = { raw: mockRaw }

    ;(getMdFiles as any).mockReturnValue(['testDir/docs/a.md', 'testDir/docs/b.md'])

    await applyLastUpdated(mockGit as any, 'testDir', 'repo1')

    expect(mockRaw).toHaveBeenCalledTimes(1)
    expect(mockRaw).toHaveBeenCalledWith(['-c', 'core.quotePath=false', 'log', '--format=%cI', '--name-only'])
    // Newest date wins for a.md; b.md is absent from history so it is skipped
    expect(addLastUpdatedFrontmatter).toHaveBeenCalledWith('testDir/docs/a.md', '2024-05-01T12:00:00+00:00')
    expect(addLastUpdatedFrontmatter).toHaveBeenCalledTimes(1)
  })

  it('should warn and continue when reading the git history fails', async () => {
    const mockGit = { raw: vi.fn().mockRejectedValueOnce(new Error('boom')) }

    ;(getMdFiles as any).mockReturnValue(['testDir/docs/a.md'])

    await applyLastUpdated(mockGit as any, 'testDir', 'repo1')

    expect(log).toHaveBeenCalledWith(expect.stringContaining(`Unable to read commit history for repository 'repo1'`), 'warn')
    expect(addLastUpdatedFrontmatter).not.toHaveBeenCalled()
  })

  it('should not read history when the repository has no markdown files', async () => {
    const mockGit = { raw: vi.fn() }

    ;(getMdFiles as any).mockReturnValue([])

    await applyLastUpdated(mockGit as any, 'testDir', 'repo1')

    expect(mockGit.raw).not.toHaveBeenCalled()
    expect(addLastUpdatedFrontmatter).not.toHaveBeenCalled()
  })
})

describe('parseLastCommitDates', () => {
  it('should map each file to its newest commit date', () => {
    const output = '2024-05-01T12:00:00+00:00\n\ndocs/a.md\ndocs/b.md\n\n2024-01-01T12:00:00+00:00\n\ndocs/a.md\n'
    const dates = parseLastCommitDates(output)

    expect(dates.get('docs/a.md')).toBe('2024-05-01T12:00:00+00:00')
    expect(dates.get('docs/b.md')).toBe('2024-05-01T12:00:00+00:00')
    expect(dates.size).toBe(2)
  })

  it('should return an empty map for empty output', () => {
    expect(parseLastCommitDates('').size).toBe(0)
  })
})

describe('cloneRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize git, set sparse checkout, add remote, and pull the specified branch', async () => {
    const mockGit = {
      init: vi.fn().mockReturnThis(),
      addConfig: vi.fn().mockReturnThis(),
      addRemote: vi.fn().mockReturnThis(),
      pull: vi.fn().mockReturnThis(),
    }

    ;(simpleGit as any).mockImplementation(() => mockGit)

    const repoName = 'repo1'
    const projectDir = 'testDir'
    const includes = ['docs/file1.md', 'docs/file2.md']
    const branch = 'main'

    await cloneRepo(repoName, 'https://github.com/testUser/repo.git', projectDir, branch, includes)

    expect(createDir).toHaveBeenCalledWith(projectDir, { clean: true })
    expect(mockGit.init).toHaveBeenCalled()
    expect(mockGit.addConfig).toHaveBeenCalledWith('core.sparseCheckout', 'true', true, 'local')
    expect(mockGit.addRemote).toHaveBeenCalledWith('origin', 'https://github.com/testUser/repo.git')
    expect(appendFileSync).toHaveBeenCalledWith(`${projectDir}/.git/info/sparse-checkout`, 'docs/file1.md\n', 'utf8')
    expect(appendFileSync).toHaveBeenCalledWith(`${projectDir}/.git/info/sparse-checkout`, 'docs/file2.md\n', 'utf8')
    expect(mockGit.pull).toHaveBeenCalledWith('origin', branch)
  })

  it('should copy docs directory to project root and remove .git directory', async () => {
    const mockGit = {
      init: vi.fn().mockReturnThis(),
      addConfig: vi.fn().mockReturnThis(),
      addRemote: vi.fn().mockReturnThis(),
      pull: vi.fn().mockReturnThis(),
    }

    ;(simpleGit as any).mockImplementation(() => mockGit)

    const repoName = 'repo1'
    const projectDir = 'testDir'
    const includes = ['docs/file1.md']
    const branch = 'main'

    await cloneRepo(repoName, 'https://github.com/testUser/repo.git', projectDir, branch, includes)

    expect(cpSync).toHaveBeenCalledWith(`${projectDir}/docs`, projectDir, { recursive: true })
    expect(rmSync).toHaveBeenCalledWith(`${projectDir}/docs`, { recursive: true })
    expect(rmSync).toHaveBeenCalledWith(`${projectDir}/.git`, { recursive: true })
  })

  it('should handle errors and log them to the console', async () => {
    const gitError = new Error('Git error')
    const mockGit = {
      init: vi.fn().mockReturnThis(),
      addConfig: vi.fn().mockImplementation(() => { throw gitError }),
    }

    ;(simpleGit as any).mockImplementation(() => mockGit)

    const result = await cloneRepo('repo1', 'https://github.com/testUser/repo.git', 'testDir', 'main', ['docs'])

    expect(result).toBe(false)
    expect(log).toHaveBeenCalledWith(expect.stringContaining(`Error when cloning repository 'repo1': ${gitError.message}`), 'error')
  })

  it('should refuse to clone when the url or branch looks like a CLI option', async () => {
    const optionInjectionResult = await cloneRepo('repo1', '--upload-pack=touch /tmp/pwned', 'testDir', 'main', ['docs'])
    expect(optionInjectionResult).toBe(false)

    const unsafeBranchResult = await cloneRepo('repo1', 'https://github.com/testUser/repo.git', 'testDir', '--upload-pack=x', ['docs'])
    expect(unsafeBranchResult).toBe(false)

    expect(log).toHaveBeenCalledWith(expect.stringContaining('Refusing to clone'), 'error')
  })

  it('should look up and inject last updated dates when lastUpdated is enabled', async () => {
    const mockGit = {
      init: vi.fn().mockReturnThis(),
      addConfig: vi.fn().mockReturnThis(),
      addRemote: vi.fn().mockReturnThis(),
      pull: vi.fn().mockReturnThis(),
      raw: vi.fn().mockResolvedValue('2024-05-01T12:00:00+00:00\n\ndocs/file1.md\n'),
    }

    ;(simpleGit as any).mockImplementation(() => mockGit)
    ;(getMdFiles as any).mockReturnValue(['testDir/docs/file1.md'])

    await cloneRepo('repo1', 'https://github.com/testUser/repo.git', 'testDir', 'main', ['docs/file1.md'], true)

    expect(mockGit.raw).toHaveBeenCalledWith(['-c', 'core.quotePath=false', 'log', '--format=%cI', '--name-only'])
    expect(addLastUpdatedFrontmatter).toHaveBeenCalledWith('testDir/docs/file1.md', '2024-05-01T12:00:00+00:00')
  })

  it('should not look up last updated dates when lastUpdated is disabled', async () => {
    const mockGit = {
      init: vi.fn().mockReturnThis(),
      addConfig: vi.fn().mockReturnThis(),
      addRemote: vi.fn().mockReturnThis(),
      pull: vi.fn().mockReturnThis(),
      raw: vi.fn(),
    }

    ;(simpleGit as any).mockImplementation(() => mockGit)

    await cloneRepo('repo1', 'https://github.com/testUser/repo.git', 'testDir', 'main', ['docs/file1.md'])

    expect(mockGit.raw).not.toHaveBeenCalled()
  })
})
