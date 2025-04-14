// import { appendFileSync, cpSync, rmSync } from 'node:fs'
import { Octokit } from '@octokit/rest'
import { simpleGit } from 'simple-git'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fs } from 'memfs'
import { log } from '../utils/logger.js'
import * as fnMod from '../utils/functions.js'
import { cloneRepo, getContributors, getInfos } from './git.js'

vi.mock('@octokit/rest')
vi.mock('simple-git')
vi.mock('node:path', () => ({ resolve: vi.fn((...args) => args.join('/')) }))
// vi.mock('../utils/functions.js')
vi.mock('../utils/logger.js')

describe('getInfos', () => {
  const mockUser = { login: 'testUser' }
  const mockRepos = [{ name: 'repo1' }, { name: 'repo2' }]
  const mockOctokit = {
    rest: {
      users: {
        getByUsername: vi.fn()
          .mockResolvedValueOnce({ data: mockUser }),
      },
      repos: {
        listForUser: vi.fn()
          .mockResolvedValueOnce({ data: mockRepos }),
      },
    },
  } as unknown as Octokit

  it('should return user info and repos', async () => {
    vi.mocked(Octokit).mockImplementation(() => mockOctokit)

    const result = await getInfos({ username: 'testUser', token: 'testToken', branch: 'main' })

    expect(result).toEqual({ user: mockUser, repos: mockRepos, branch: 'main' })
    expect(mockOctokit.rest.users.getByUsername).toHaveBeenCalledWith({ username: 'testUser' })
    expect(mockOctokit.rest.repos.listForUser).toHaveBeenCalledWith({ username: 'testUser', sort: 'full_name' })
  })
})

describe('getContributors', () => {
  const mockRepository: any = {
    id: 1,
    name: 'repo1',
    owner: { login: 'testOwner' },
  }
  const mockToken = 'testToken'

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
    } as unknown as Octokit
    vi.mocked(Octokit).mockImplementation(() => mockOctokit)

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
          listContributors: vi.fn()
            .mockResolvedValueOnce(new Error('500 Server Error')),
        },
        paginate: {
          iterator: vi.fn(),
        },
      },
    } as unknown as Octokit
    vi.mocked(Octokit).mockImplementation(() => mockOctokit)

    const result = await getContributors({ repository: mockRepository, token: mockToken })

    expect(log).toHaveBeenCalledWith(`   Failed to get contributors infos for repository '${mockRepository.name}'.`, 'warn')
    expect(result).toEqual({
      source: mockRepoData.source,
      contributors: [],
    })
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
    } as unknown as Octokit
    vi.mocked(Octokit).mockImplementation(() => mockOctokit)

    const result = await getContributors({ repository: mockRepository, token: mockToken })

    expect(result).toEqual({
      source: mockRepoData.source,
      contributors: [],
    })
  })
})

describe('cloneRepo', () => {
  const repoName = 'repo1'
  const projectDir = 'testDir'
  const branch = 'main'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize git, set sparse checkout, add remote, and pull the specified branch', async () => {
    const includes = ['docs/file1.md', 'docs/file2.md']
    const mockGit = {
      init: vi.fn().mockReturnThis(),
      addConfig: vi.fn().mockReturnThis(),
      addRemote: vi.fn().mockReturnThis(),
      pull: vi.fn().mockReturnThis(),
    } as unknown as ReturnType<typeof simpleGit>
    vi.mocked(simpleGit).mockImplementation(() => mockGit)
    vi.spyOn(fs, 'appendFileSync')
    vi.spyOn(fnMod, 'createDir')

    await cloneRepo(repoName, 'https://github.com/testUser/repo.git', projectDir, branch, includes)

    expect(fnMod.createDir).toHaveBeenCalledWith(projectDir, { clean: true })
    expect(mockGit.init).toHaveBeenCalled()
    expect(mockGit.addConfig).toHaveBeenCalledWith('core.sparseCheckout', 'true', true, 'local')
    expect(mockGit.addRemote).toHaveBeenCalledWith('origin', 'https://github.com/testUser/repo.git')
    expect(vi.mocked(fs).appendFileSync).toHaveBeenCalledWith(`${projectDir}/.git/info/sparse-checkout`, 'docs/file1.md\n', 'utf8')
    expect(vi.mocked(fs).appendFileSync).toHaveBeenCalledWith(`${projectDir}/.git/info/sparse-checkout`, 'docs/file2.md\n', 'utf8')
    expect(mockGit.pull).toHaveBeenCalledWith('origin', branch)
  })

  it('should copy docs directory to project root and remove .git directory', async () => {
    const includes = ['docs/file1.md']
    const mockGit = {
      init: vi.fn().mockReturnThis(),
      addConfig: vi.fn().mockReturnThis(),
      addRemote: vi.fn().mockReturnThis(),
      pull: vi.fn().mockReturnThis(),
    } as unknown as ReturnType<typeof simpleGit>
    vi.mocked(simpleGit).mockImplementation(() => mockGit)
    // vi.spyOn(fs, 'cpSync')
    vi.spyOn(fs, 'rmSync')

    await cloneRepo(repoName, 'https://github.com/testUser/repo.git', projectDir, branch, includes)

    // expect(vi.mocked(fs).cpSync).toHaveBeenCalledWith(`${projectDir}/docs`, projectDir, { recursive: true })
    expect(vi.mocked(fs).rmSync).toHaveBeenCalledWith(`${projectDir}/docs`, { recursive: true })
    expect(vi.mocked(fs).rmSync).toHaveBeenCalledWith(`${projectDir}/.git`, { recursive: true })
  })

  it('should handle errors and log them to the console', async () => {
    const gitError = new Error('Git error')
    const mockGit = {
      init: vi.fn().mockReturnThis(),
      addConfig: vi.fn().mockImplementation(() => { throw gitError }),
    } as unknown as ReturnType<typeof simpleGit>
    vi.mocked(simpleGit).mockImplementation(() => mockGit)

    await cloneRepo('repo1', 'https://github.com/testUser/repo.git', 'testDir', 'main', ['docs'])

    expect(log).toHaveBeenCalledWith(expect.stringContaining(`Error when cloning repository: ${gitError}`), 'error')
  })
})
