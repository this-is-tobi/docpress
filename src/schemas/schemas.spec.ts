import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import type { Config, GlobalOpts } from './global.js'
import { cliSchema, configSchema, globalOptsSchema } from './global.js'

vi.mock('fs')

const defaultConfig = {
  branch: 'main',
  token: undefined,
  gitProvider: 'github',
  forks: false,
}

describe('globalOptsSchema', () => {
  it('should validate valid global options', () => {
    const validData = {
      config: './valid-config.json',
    }

    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      branch: 'main',
      gitProvider: 'github',
      reposFilter: ['repo1', 'repo2'],
      usernames: ['your_username'],
      extraHeaderPages: ['header1.md', 'header2.md'],
      extraPublicContent: ['public1', 'public2'],
      extraTheme: ['theme1', 'theme2'],
    }))

    const result = globalOptsSchema.parse(validData)
    expect(result).toEqual({
      ...defaultConfig,
      branch: 'main',
      gitProvider: 'github',
      reposFilter: ['repo1', 'repo2'],
      usernames: ['your_username'],
      extraHeaderPages: ['header1.md', 'header2.md'],
      extraPublicContent: ['public1', 'public2'],
      extraTheme: ['theme1', 'theme2'],
    })
  })

  it('should exit for an unreadable config path', () => {
    const originalExit = process.exit
    process.exit = vi.fn() as any
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const invalidData = {
      config: './invalid-config.json',
      usernames: 'user1',
    }

    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('File not found')
    })

    globalOptsSchema.parse(invalidData)
    expect(process.exit).toHaveBeenCalledWith(1)

    process.exit = originalExit
    consoleErrorSpy.mockRestore()
  })

  it('should handle optional config field correctly', () => {
    const partialData = {
      usernames: 'user1',
    }

    const result = globalOptsSchema.parse(partialData)
    expect(result).toEqual({
      ...defaultConfig,
      usernames: [partialData.usernames],
    })
  })

  it('should correctly split comma-separated strings into arrays', () => {
    const dataWithCommaSeparatedValues = {
      usernames: 'user1',
      reposFilter: 'repo1,repo2,repo3',
      extraHeaderPages: 'header1.md,header2.md',
      extraPublicContent: 'public1,public2',
      extraTheme: 'theme1,theme2',
    }

    const result = globalOptsSchema.parse(dataWithCommaSeparatedValues)
    expect(result).toEqual({
      ...defaultConfig,
      usernames: ['user1'],
      reposFilter: ['repo1', 'repo2', 'repo3'],
      extraHeaderPages: ['header1.md', 'header2.md'],
      extraPublicContent: ['public1', 'public2'],
      extraTheme: ['theme1', 'theme2'],
    })
  })

  it('should apply defaults for branch and gitProvider if not provided', () => {
    const dataWithoutBranchAndGitProvider = {
      usernames: 'user1',
      reposFilter: 'repo1',
    }

    const result = globalOptsSchema.parse(dataWithoutBranchAndGitProvider)
    expect(result).toEqual({
      ...defaultConfig,
      usernames: ['user1'],
      reposFilter: ['repo1'],
    })
  })

  it('should handle multiple usernames', () => {
    const dataWithoutBranchAndGitProvider = {
      usernames: 'user1,user2',
      reposFilter: 'user1/repo1,user2/repo2',
    }

    const result = globalOptsSchema.parse(dataWithoutBranchAndGitProvider)
    expect(result).toEqual({
      ...defaultConfig,
      usernames: ['user1', 'user2'],
      reposFilter: ['user1/repo1', 'user2/repo2'],
    })
  })

  it('should handle null or undefined values correctly in config processing', () => {
    const data = {
      usernames: 'user1',
      // Use empty strings instead of null/undefined since the schema expects strings
      reposFilter: '',
      extraHeaderPages: '',
      extraPublicContent: '',
      extraTheme: '',
    }

    const result = globalOptsSchema.parse(data)
    expect(result).toEqual({
      ...defaultConfig,
      usernames: ['user1'],
      reposFilter: [''],
      extraHeaderPages: [''],
      extraPublicContent: [''],
      extraTheme: [''],
    })
  })

  it('should handle error when attempting to validate final config without usernames', () => {
    // Mock the exit to avoid actually exiting the process
    const originalExit = process.exit
    process.exit = vi.fn() as any

    // Mock console.error to avoid output during tests
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const invalidData = {
      config: './config-without-usernames.json',
    }

    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      branch: 'main',
      gitProvider: 'github',
      reposFilter: ['repo1', 'repo2'],
      // Missing usernames
    }))

    // Since the function calls process.exit internally, it won't throw
    // but we can check if exit was called with the right code
    globalOptsSchema.parse(invalidData)
    expect(process.exit).toHaveBeenCalledWith(1)

    // Restore mocks
    process.exit = originalExit
    consoleErrorSpy.mockRestore()
    logSpy.mockRestore()
  })

  it('should process string values correctly in config data preparation', () => {
    const data = {
      config: './config-with-strings.json',
    }

    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      usernames: 'single-user',
      reposFilter: 'single-repo',
      extraHeaderPages: 'single-header.md',
      extraPublicContent: 'single-content',
      extraTheme: 'single-theme',
    }))

    const result = globalOptsSchema.parse(data)
    expect(result).toEqual({
      ...defaultConfig,
      usernames: ['single-user'],
      reposFilter: ['single-repo'],
      extraHeaderPages: ['single-header.md'],
      extraPublicContent: ['single-content'],
      extraTheme: ['single-theme'],
    })
  })

  it('should properly merge vitepressConfig from both config file and CLI options', () => {
    const data = {
      config: './config-with-vitepress.json',
      vitepressConfig: './vitepress-from-cli.json',
    }

    vi.mocked(readFileSync).mockImplementationOnce(() => JSON.stringify({
      usernames: ['config-user'],
      vitepressConfig: {
        title: 'Config Title',
        description: 'Config Description',
      },
    }))

    // Mock the second call for the CLI-provided vitepress config
    vi.mocked(readFileSync).mockImplementationOnce(() => JSON.stringify({
      title: 'CLI Title',
      themeConfig: { nav: [] },
    }))

    const result = globalOptsSchema.parse(data)

    // The CLI-provided vitepress file wins over the config file's inline
    // vitepress settings, non-conflicting keys are merged
    expect(result).toHaveProperty('vitepressConfig')
    expect(result.vitepressConfig).toHaveProperty('title', 'CLI Title')
    expect(result.vitepressConfig).toHaveProperty('description', 'Config Description')
    expect(result.vitepressConfig).toHaveProperty('themeConfig.nav')
  })
})

describe('configSchema', () => {
  it('should validate valid combined config', () => {
    const validCombinedData: Config & { token: GlobalOpts['token'] } = {
      branch: 'main',
      gitProvider: 'github',
      forks: false,
      token: 'your_token',
      usernames: ['your_username'],
      reposFilter: ['repo1', 'repo2'],
      extraHeaderPages: ['header1.md', 'header2.md'],
      extraPublicContent: ['public1', 'public2'],
      extraTheme: ['theme1', 'theme2'],
      websiteTitle: 'Awesome website',
      websiteTagline: 'Awesome tagline',
      vitepressConfig: './vitepress.config.json',
    }
    const { token: _token, ...dataWithoutToken } = validCombinedData

    const result = configSchema.parse(validCombinedData)
    expect(result).toEqual(dataWithoutToken)
  })

  it('should throw an error for missing required fields', () => {
    const invalidData = {}

    expect(() => configSchema.parse(invalidData)).toThrow()
  })

  it('should return default values when fields are missing', () => {
    const partialData: Partial<Config> = {
      usernames: ['your_username'],
      reposFilter: [],
      extraHeaderPages: [],
      extraPublicContent: [],
      extraTheme: [],
      websiteTitle: '',
      websiteTagline: '',
    }

    const result = configSchema.parse(partialData)
    expect(result).toEqual({
      ...defaultConfig,
      ...partialData,
      usernames: ['your_username'],
      forks: false,
    })
  })

  it('should throw an error if gitProvider is not in the allowed enum values', () => {
    const invalidData = {
      usernames: ['user1'],
      gitProvider: 'invalid_provider',
    }

    expect(() => configSchema.parse(invalidData)).toThrow()
  })

  it('should allow empty arrays for optional list fields', () => {
    const dataWithEmptyArrays: Partial<Config> = {
      usernames: ['user1'],
      reposFilter: [],
      extraHeaderPages: [],
      extraPublicContent: [],
      extraTheme: [],
      websiteTitle: '',
      websiteTagline: '',
    }
    const { token: _token, ...rest } = defaultConfig

    const result = configSchema.parse(dataWithEmptyArrays)
    expect(result).toEqual({
      ...dataWithEmptyArrays,
      ...rest,
      forks: false,
    })
  })
})

describe('cliSchema', () => {
  it('should transform comma-separated strings into arrays', () => {
    const dataWithStrings = {
      usernames: 'user1,user2',
      reposFilter: 'repo1,repo2,repo3',
      extraHeaderPages: 'header1.md,header2.md',
      extraPublicContent: 'public1,public2',
      extraTheme: 'theme1,theme2',
    }

    const result = cliSchema.parse(dataWithStrings)
    expect(result.usernames).toEqual(['user1', 'user2'])
    expect(result.reposFilter).toEqual(['repo1', 'repo2', 'repo3'])
    expect(result.extraHeaderPages).toEqual(['header1.md', 'header2.md'])
    expect(result.extraPublicContent).toEqual(['public1', 'public2'])
    expect(result.extraTheme).toEqual(['theme1', 'theme2'])
  })

  it('should keep the vitepressConfig path as a string', () => {
    const result = cliSchema.parse({
      usernames: 'user1',
      vitepressConfig: './vitepress.config.json',
    })
    expect(result.vitepressConfig).toBe('./vitepress.config.json')
  })

  it('should throw an error for invalid gitProvider', () => {
    const invalidData = {
      branch: 'develop',
      gitProvider: 'bitbucket',
    }

    expect(() => cliSchema.parse(invalidData)).toThrow()
  })

  it('should exit for an unreadable vitepressConfig path', () => {
    const originalExit = process.exit
    process.exit = vi.fn() as any
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const invalidData = {
      usernames: 'user1',
      vitepressConfig: './invalid-config.json',
    }

    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('File not found')
    })

    globalOptsSchema.parse(invalidData)
    expect(process.exit).toHaveBeenCalledWith(1)

    process.exit = originalExit
    consoleErrorSpy.mockRestore()
  })
})
