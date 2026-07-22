import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createOption } from 'commander'
import { fetchDoc } from '../lib/fetch.js'
import { log } from '../utils/logger.js'
import { configSchema } from '../schemas/global.js'
import * as fetchMod from './fetch.js'
import { globalOpts } from './global.js'
import { createDir } from '../utils/functions.js'

vi.mock('../lib/fetch.js', () => ({ fetchDoc: vi.fn() }))
vi.mock('../utils/logger.js', async importOriginal => ({
  ...(await importOriginal()),
  log: vi.fn(),
}))
vi.mock('../utils/functions.js', () => ({
  createDir: vi.fn(),
  formatDuration: vi.fn(() => '0ms'),
  formatError: vi.fn(error => (error instanceof Error ? error.message : String(error))),
  prettifyEnum: vi.fn(arr => arr.join('|')),
  splitByComma: vi.fn(str => str.split(',')),
}))
vi.mock('./global.js', () => ({
  globalOpts: [
    createOption('-C, --config <string>', 'Path to the docpress configuration file'),
    createOption('-T, --token <string>', 'Git provider token used to collect data.'),
    createOption('-U, --usernames <string>', 'Git provider username(s) used to collect data.'),
  ],
}))
vi.spyOn(fetchMod, 'main')

const { fetchCmd, fetchOpts, main } = fetchMod

describe('fetchCmd', () => {
  it('should have the correct command name', () => {
    expect(fetchCmd.name()).toBe('fetch')
  })

  it('should include global and fetch-specific options', () => {
    const allOptions = [...fetchOpts, ...globalOpts]
    const { options } = fetchCmd
    expect(options).toEqual(expect.arrayContaining(allOptions))
  })

  it('should have the correct description', () => {
    expect(fetchCmd.description()).toBe('Fetch docs with the given username(s) and git provider.')
  })

  it('should call main function when action is triggered', async () => {
    fetchCmd.action(main)
    await fetchCmd.parseAsync(['-U', 'testUser'], { from: 'user' })
    expect(main).toHaveBeenCalled()
  })
})

describe('main', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should log the start message and call fetchDoc with expected arguments', async () => {
    const mockOpts = {
      usernames: ['testUser'],
      reposFilter: ['testRepo'],
      token: 'testToken',
      branch: 'main',
      gitProvider: 'github' as const,
    }

    await main(mockOpts)

    expect(log).toHaveBeenCalledWith(
      `\n-> Start fetching documentation files. This may take a moment, especially for larger repositories.`,
      'info',
    )
    expect(fetchDoc).toHaveBeenCalledWith({
      username: mockOpts.usernames[0],
      reposFilter: mockOpts.reposFilter,
      token: mockOpts.token,
      branch: mockOpts.branch,
      gitProvider: mockOpts.gitProvider,
      multiUser: false,
    })
  })

  it('should handle multiple usernames correctly', async () => {
    const mockOpts = {
      usernames: ['user1', 'user2'],
      reposFilter: ['user1/repo1', 'user2/repo2'],
      token: 'testToken',
      branch: 'main',
      gitProvider: 'github' as const,
    }

    await main(mockOpts)

    // Should call fetchDoc once for each username
    expect(fetchDoc).toHaveBeenCalledTimes(2)

    // First call with user1 and only user1's repo
    expect(fetchDoc).toHaveBeenCalledWith({
      username: 'user1',
      reposFilter: ['repo1'],
      token: 'testToken',
      branch: 'main',
      gitProvider: 'github',
      multiUser: true,
    })

    // Second call with user2 and only user2's repo
    expect(fetchDoc).toHaveBeenCalledWith({
      username: 'user2',
      reposFilter: ['repo2'],
      token: 'testToken',
      branch: 'main',
      gitProvider: 'github',
      multiUser: true,
    })
  })

  it('should keep exclusion filters when handling multiple usernames', async () => {
    const mockOpts = {
      usernames: ['user1', 'user2'],
      reposFilter: ['user1/repo1', '!user1/repo2', '!user2/repo3'],
      token: 'testToken',
      branch: 'main',
      gitProvider: 'github' as const,
    }

    await main(mockOpts)

    expect(fetchDoc).toHaveBeenCalledWith({
      username: 'user1',
      reposFilter: ['repo1', '!repo2'],
      token: 'testToken',
      branch: 'main',
      gitProvider: 'github',
      multiUser: true,
    })
    expect(fetchDoc).toHaveBeenCalledWith({
      username: 'user2',
      reposFilter: ['!repo3'],
      token: 'testToken',
      branch: 'main',
      gitProvider: 'github',
      multiUser: true,
    })
  })

  it('should forward the lastUpdated flag to fetchDoc', async () => {
    const mockOpts = {
      usernames: ['testUser'],
      branch: 'main',
      gitProvider: 'github' as const,
      lastUpdated: true,
    }

    await main(mockOpts)

    expect(fetchDoc).toHaveBeenCalledWith(expect.objectContaining({ lastUpdated: true }))
  })

  it('should create the docpress directory before fetching', async () => {
    const mockOpts = {
      usernames: ['testUser'],
      branch: 'main',
      gitProvider: 'github' as const,
    }

    await main(mockOpts)

    expect(vi.mocked(createDir)).toHaveBeenCalledWith(expect.any(String), { clean: true })
    expect(fetchDoc).toHaveBeenCalled()
  })

  it('should log a success summary once every username succeeds', async () => {
    const mockOpts = {
      usernames: ['testUser'],
      branch: 'main',
      gitProvider: 'github' as const,
    }

    await main(mockOpts)

    expect(log).toHaveBeenCalledWith('   Fetched documentation for 1/1 username(s) in 0ms.', 'success')
  })

  it('should continue with remaining usernames when one fails, and log a warn summary', async () => {
    const mockOpts = {
      usernames: ['goodUser', 'badUser'],
      branch: 'main',
      gitProvider: 'github' as const,
    }

    vi.mocked(fetchDoc)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('network error'))

    await main(mockOpts)

    expect(fetchDoc).toHaveBeenCalledTimes(2)
    expect(log).toHaveBeenCalledWith(`   Failed to fetch documentation for 'badUser': network error`, 'error')
    expect(log).toHaveBeenCalledWith('   Fetched documentation for 1/2 username(s) in 0ms.', 'warn')
  })

  it('should throw when every username fails', async () => {
    const mockOpts = {
      usernames: ['user1', 'user2'],
      branch: 'main',
      gitProvider: 'github' as const,
    }

    vi.mocked(fetchDoc)
      .mockRejectedValueOnce(new Error('boom1'))
      .mockRejectedValueOnce(new Error('boom2'))

    await expect(main(mockOpts)).rejects.toThrow(
      'Failed to fetch documentation for all requested username(s): user1, user2.',
    )
  })
})

describe('fetchOpts', () => {
  it('should configure options with correct descriptions and default values', () => {
    const branchOption = fetchOpts.find(opt => opt.flags.includes('--branch'))
    const gitProviderOption = fetchOpts.find(opt => opt.flags.includes('--git-provider'))
    const lastUpdatedOption = fetchOpts.find(opt => opt.flags.includes('--last-updated'))

    expect(branchOption?.description).toBe(configSchema.shape.branch.description || '')
    // No CLI default: an unset branch resolves per-repo to each repo's default branch
    expect(branchOption?.defaultValue).toBeUndefined()

    expect(gitProviderOption?.description).toBe(configSchema.shape.gitProvider.description || '')
    expect(gitProviderOption?.defaultValue).toBe('github')

    expect(lastUpdatedOption?.description).toBe(configSchema.shape.lastUpdated.description || '')
  })
})
