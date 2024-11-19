import { appendFileSync, cpSync, rmSync } from 'node:fs'
import { Octokit } from '@octokit/rest'
import { simpleGit } from 'simple-git'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDir } from '../utils/functions.js'
import { log } from '../utils/logger.js'
import { cloneRepo, getContributors, getInfos } from './git.js'
import type { EnhancedRepository } from './fetch.js'

vi.mock('@octokit/rest')
vi.mock('simple-git')
vi.mock('node:fs')
vi.mock('node:path', () => ({ resolve: vi.fn((...args) => args.join('/')) }))
vi.mock('../utils/functions.js')
vi.mock('../utils/logger.js')

describe('getInfos', () => {
  const mockUser = { login: 'testUser' }
  const mockRepos = [{ name: 'repo1' }, { name: 'repo2' }]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return user info and repos', async () => {
    const mockOctokit = {
      request: vi.fn()
        .mockResolvedValueOnce({ data: mockUser })
        .mockResolvedValueOnce({ data: mockRepos }),
    }

    ;(Octokit as any).mockImplementation(() => mockOctokit)

    const result = await getInfos({ username: 'testUser', token: 'testToken', branch: 'main' })

    expect(result).toEqual({
      user: mockUser,
      repos: mockRepos,
      branch: 'main',
    })
    expect(mockOctokit.request).toHaveBeenCalledWith('GET /users/{username}', { username: 'testUser' })
    expect(mockOctokit.request).toHaveBeenCalledWith('GET /users/{username}/repos', { username: 'testUser', sort: 'full_name' })
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
    const mockContributorsData = [{ login: 'contributor1' }, { login: 'contributor2' }]

    const mockOctokit = {
      request: vi.fn()
        .mockResolvedValueOnce({ data: mockRepoData })
        .mockResolvedValueOnce({ data: mockContributorsData }),
    }

    ;(Octokit as any).mockImplementation(() => mockOctokit)

    const result = await getContributors({ repository: mockRepository, token: mockToken })

    expect(result).toEqual({
      source: mockRepoData.source,
      contributors: mockContributorsData,
    })
  })

  it('should log a warning and return empty contributors if contributors request fails with non-404', async () => {
    const mockRepoData = { source: { owner: { login: 'test-source-owner' } }, name: 'repo1' }

    const mockOctokit = {
      request: vi.fn()
        .mockResolvedValueOnce({ data: mockRepoData })
        .mockRejectedValueOnce(new Error('500 Server Error')),
    }

    ;(Octokit as any).mockImplementation(() => mockOctokit)

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
      request: vi.fn().mockResolvedValueOnce({ data: mockRepoData }),
    }

    ;(Octokit as any).mockImplementation(() => mockOctokit)

    const result = await getContributors({ repository: mockRepository, token: mockToken })

    expect(result).toEqual({
      source: mockRepoData.source,
      contributors: [],
    })
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

    // const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await cloneRepo('repo1', 'https://github.com/testUser/repo.git', 'testDir', 'main', ['docs'])

    // expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(`Error when cloning repository: ${gitError}`))
    // consoleSpy.mockRestore()
    expect(log).toHaveBeenCalledWith(expect.stringContaining(`Error when cloning repository: ${gitError}`), 'error')
  })
})
