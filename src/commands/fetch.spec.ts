import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createOption } from 'commander'
import { fetchDoc } from '../lib/fetch.js'
import { log } from '../utils/logger.js'
import { configSchema } from '../schemas/global.js'
import * as fetchMod from './fetch.js'
import { globalOpts } from './global.js'

vi.mock('../lib/fetch.js', () => ({ fetchDoc: vi.fn() }))
vi.mock('../utils/logger.js', () => ({ log: vi.fn() }))
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
    })
  })
})

describe('fetchOpts', () => {
  it('should configure options with correct descriptions and default values', () => {
    const branchOption = fetchOpts.find(opt => opt.flags.includes('--branch'))
    const gitProviderOption = fetchOpts.find(opt => opt.flags.includes('--git-provider'))

    expect(branchOption?.description).toBe(configSchema.shape.branch.description || '')
    expect(branchOption?.defaultValue).toBe(configSchema.shape.branch.default)

    expect(gitProviderOption?.description).toBe(configSchema.shape.gitProvider.description || '')
    expect(gitProviderOption?.defaultValue).toBe(configSchema.shape.gitProvider.default)
  })
})
