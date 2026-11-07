import { appendFileSync, cpSync, rmSync } from 'node:fs'
import { Octokit } from '@octokit/rest'
import { simpleGit } from 'simple-git'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addLastUpdatedFrontmatter, createDir, getMdFiles } from '../utils/functions.js'
import { log } from '../utils/logger.js'
import type { Contribution } from './git.js'
import { applyLastUpdated, cloneRepo, getContributions, getInfos, parseContributionsFilter, parseLastCommitDates, quietOctokitLog, SEARCH_RESULTS_CAP, sortContributions } from './git.js'

vi.mock('@octokit/rest')
vi.mock('simple-git')
vi.mock('node:fs')
vi.mock('node:path', () => ({
  resolve: vi.fn((...args) => args.join('/')),
  relative: vi.fn((from: string, to: string) => to.replace(`${from}/`, '')),
}))
vi.mock('../utils/functions.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/functions.js')>()
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

describe('parseContributionsFilter', () => {
  it('should show every repository when there is no filter', () => {
    const { qualifiers, isShown } = parseContributionsFilter()

    expect(qualifiers).toEqual([])
    expect(isShown('anyone', 'anything')).toBe(true)
  })

  it('should turn exclusions into search qualifiers and hide what they match, ignoring case', () => {
    const { qualifiers, isShown } = parseContributionsFilter(['!Work-Org', '!friend/side-project'])

    expect(qualifiers).toEqual(['-user:work-org', '-repo:friend/side-project'])
    expect(isShown('work-org', 'platform')).toBe(false)
    expect(isShown('Friend', 'Side-Project')).toBe(false)
    expect(isShown('friend', 'other-project')).toBe(true)
  })

  it('should only show included repositories when the filter holds inclusions, exclusions still winning', () => {
    const { qualifiers, isShown } = parseContributionsFilter(['open-webui', 'upciti/wakemeops', '!open-webui/legacy'])

    expect(qualifiers).toEqual(['-repo:open-webui/legacy'])
    expect(isShown('open-webui', 'helm-charts')).toBe(true)
    expect(isShown('upciti', 'wakemeops')).toBe(true)
    expect(isShown('upciti', 'other')).toBe(false)
    expect(isShown('open-webui', 'legacy')).toBe(false)
  })
})

describe('sortContributions', () => {
  it('should order by stars, then merged pull requests, then name', () => {
    const contribution = (name: string, pull_requests: number, stargazers_count: number) => ({ name, pull_requests, stargazers_count, owner: 'o' }) as Contribution

    const sorted = sortContributions([contribution('b', 1, 10), contribution('a', 1, 10), contribution('c', 1, 50), contribution('d', 9, 0), contribution('e', 4, 10)])

    expect(sorted.map(({ name }) => name)).toEqual(['c', 'e', 'a', 'b', 'd'])
  })
})

describe('getContributions', () => {
  const pull = (repo: string, merged_at: string | null, closed_at = '2020-01-01T00:00:00Z') => ({
    repository_url: `https://api.github.com/repos/${repo}`,
    pull_request: { merged_at },
    closed_at,
  })
  const page = (items: ReturnType<typeof pull>[], total_count = items.length) => ({ data: Object.assign(items, { total_count }) })
  const repository = (owner: string, name: string, extra: Record<string, unknown> = {}) => ({
    data: {
      owner: { login: owner, avatar_url: `https://avatars.example/${owner}` },
      name,
      html_url: `https://github.com/${owner}/${name}`,
      description: `${name} description`,
      stargazers_count: 42,
      language: 'Go',
      archived: false,
      private: false,
      ...extra,
    },
  })
  const mockOctokit = (pages: unknown[], get: ReturnType<typeof vi.fn>) => {
    const octokit = {
      rest: { search: { issuesAndPullRequests: vi.fn() }, repos: { get } },
      paginate: { iterator: vi.fn().mockReturnValueOnce(pages) },
    }
    ;(Octokit as any).mockImplementation(function () { return octokit })
    return octokit
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should count merged pull requests per repository and describe each repository', async () => {
    const get = vi.fn()
      .mockResolvedValueOnce(repository('open-webui', 'helm-charts', { description: null }))
      .mockResolvedValueOnce(repository('upciti', 'wakemeops', { stargazers_count: 215, archived: true }))
    const octokit = mockOctokit([
      page([pull('open-webui/helm-charts', '2026-01-10T10:00:00Z'), pull('upciti/wakemeops', null, '2025-05-02T08:00:00Z')]),
      page([pull('open-webui/helm-charts', '2026-03-01T10:00:00Z'), pull('open-webui/helm-charts', '2025-12-24T10:00:00Z')]),
    ], get)

    const result = await getContributions({ username: 'me', token: 'token', filter: ['!work-org'] })

    expect(octokit.paginate.iterator).toHaveBeenCalledWith(octokit.rest.search.issuesAndPullRequests, {
      q: 'is:pr is:merged is:public author:me -user:me -user:work-org',
      per_page: 100,
    })
    expect(get).toHaveBeenNthCalledWith(1, { owner: 'open-webui', repo: 'helm-charts' })
    expect(result).toEqual([
      expect.objectContaining({ name: 'wakemeops', pull_requests: 1, last_merged_at: '2025-05-02T08:00:00Z', archived: true }),
      {
        author: 'me',
        owner: 'open-webui',
        name: 'helm-charts',
        avatar_url: 'https://avatars.example/open-webui',
        html_url: 'https://github.com/open-webui/helm-charts',
        description: null,
        stargazers_count: 42,
        language: 'Go',
        archived: false,
        pull_requests: 3,
        last_merged_at: '2026-03-01T10:00:00Z',
        pull_requests_url: 'https://github.com/open-webui/helm-charts/pulls?q=is%3Apr%20is%3Amerged%20author%3Ame',
      },
    ])
  })

  it('should skip hidden, self-owned and private repositories, and repositories that cannot be read', async () => {
    const get = vi.fn()
      .mockResolvedValueOnce(repository('secret', 'repo', { private: true }))
      .mockRejectedValueOnce(new Error('404 Not Found'))
      .mockResolvedValueOnce(repository('kept', 'repo'))
    mockOctokit([page([
      pull('ME/own-repo', '2026-01-01T00:00:00Z'),
      pull('friend/hidden', '2026-01-01T00:00:00Z'),
      pull('secret/repo', '2026-01-01T00:00:00Z'),
      pull('deleted/repo', '2026-01-01T00:00:00Z'),
      pull('kept/repo', '2026-01-01T00:00:00Z'),
    ])], get)

    const result = await getContributions({ username: 'me', filter: ['!friend/hidden'] })

    expect(get).toHaveBeenCalledTimes(3)
    expect(log).toHaveBeenCalledWith(`   Failed to get repository infos for 'deleted/repo'. Error : 404 Not Found`, 'warn')
    expect(result.map(({ owner, name }) => `${owner}/${name}`)).toEqual(['kept/repo'])
  })

  it('should warn when the search holds more results than GitHub returns', async () => {
    mockOctokit([page([], SEARCH_RESULTS_CAP + 52)], vi.fn())

    await getContributions({ username: 'me' })

    expect(log).toHaveBeenCalledWith(expect.stringContaining(`'me' has ${SEARCH_RESULTS_CAP + 52} merged pull requests`), 'warn')
  })

  it('should warn and list nothing when the search fails', async () => {
    const octokit = {
      rest: { search: { issuesAndPullRequests: vi.fn() }, repos: { get: vi.fn() } },
      paginate: { iterator: vi.fn(() => { throw new Error('403 rate limit exceeded') }) },
    }
    ;(Octokit as any).mockImplementation(function () { return octokit })

    const result = await getContributions({ username: 'me' })

    expect(log).toHaveBeenCalledWith(`   Failed to search merged pull requests of 'me'. Error : 403 rate limit exceeded`, 'warn')
    expect(result).toEqual([])
    expect(octokit.rest.repos.get).not.toHaveBeenCalled()
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
