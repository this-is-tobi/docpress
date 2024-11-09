import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createOption } from 'commander'
import { fetchDoc } from '../lib/fetch.js'
import { fetchOptsSchema } from '../schemas/fetch.js'
import { log } from '../utils/logger.js'
import * as fetchMod from './fetch.js'
import { globalOpts } from './global.js'

vi.mock('../lib/fetch.js', () => ({
  fetchDoc: vi.fn(),
}))
vi.mock('../utils/logger.js', () => ({
  log: vi.fn(),
}))
vi.mock('./global.js', () => ({
  globalOpts: [
    createOption('-C, --config <string>', 'Path to the configuration file'),
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
    expect(fetchCmd.description()).toBe('Fetch docs with the given username and git provider.')
  })

  it('should call main function when action is triggered', async () => {
    fetchCmd.action(main)
    await fetchCmd.parseAsync(['-u', 'testUser'], { from: 'user' })
    expect(main).toHaveBeenCalled()
  })
})

describe('main', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should log the start message and call fetchDoc with expected arguments', async () => {
    const mockOpts = {
      username: 'testUser',
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
      username: mockOpts.username,
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

    expect(branchOption?.description).toBe(fetchOptsSchema.shape.branch._def.description)
    expect(branchOption?.defaultValue).toBe(fetchOptsSchema.shape.branch._def.defaultValue())

    expect(gitProviderOption?.description).toBe(fetchOptsSchema.shape.gitProvider._def.description)
    expect(gitProviderOption?.defaultValue).toBe(fetchOptsSchema.shape.gitProvider._def.defaultValue())
  })
})
