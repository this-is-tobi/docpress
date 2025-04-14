// import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { fs } from 'memfs'
import type { Config, GlobalOpts } from './global.js'
import { configSchema, globalOptsSchema } from './global.js'
import { fetchOptsSchema } from './fetch.js'
import { prepareOptsSchema } from './prepare.js'

const defaultConfig = {
  branch: 'main',
  token: undefined,
  gitProvider: 'github',
}

describe('globalOptsSchema', () => {
  it('should validate valid global options', () => {
    const validData = {
      config: './valid-config.json',
    }
    vi.spyOn(fs, 'readFileSync').mockReturnValueOnce(JSON.stringify({
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

  it('should return empty config for invalid config path', () => {
    const invalidData = {
      config: './invalid-config.json',
      usernames: 'user1',
    }
    vi.spyOn(fs, 'readFileSync').mockImplementationOnce(() => {
      throw new Error('File not found')
    })

    const result = globalOptsSchema.parse(invalidData)

    expect(result).toEqual({
      ...defaultConfig,
      usernames: [invalidData.usernames],
    })
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

describe('fetchOptsSchema', () => {
  it('should validate valid fetch options', () => {
    const validData = {
      branch: 'develop',
      gitProvider: 'github',
      reposFilter: 'repo1,repo2',
      token: 'some-token',
      usernames: 'user1',
    }

    const result = fetchOptsSchema.parse(validData)

    expect(result).toEqual({ ...validData, reposFilter: ['repo1', 'repo2'], usernames: ['user1'] })
  })

  it('should apply default values for optional fields', () => {
    const partialData = {
      usernames: 'user1',
    }

    const result = fetchOptsSchema.parse(partialData)

    expect(result).toEqual({
      ...defaultConfig,
      usernames: [partialData.usernames],
    })
  })

  it('should transform reposFilter into an array', () => {
    const dataWithString = {
      gitProvider: 'github',
      usernames: 'user1',
      reposFilter: 'repo1,repo2,repo3',
    }

    const result = fetchOptsSchema.parse(dataWithString)

    expect(result.reposFilter).toEqual(['repo1', 'repo2', 'repo3'])
  })

  it('should validate required fields', () => {
    const invalidData = {
      branch: 'develop',
      token: 'some-token',
    }

    expect(() => fetchOptsSchema.parse(invalidData)).toThrow()
  })

  it('should throw an error for invalid gitProvider', () => {
    const invalidData = {
      branch: 'develop',
      gitProvider: 'bitbucket',
    }

    expect(() => fetchOptsSchema.parse(invalidData)).toThrow()
  })
})

describe('prepareOptsSchema', () => {
  it('should validate valid prepare options', () => {
    const validData = {
      usernames: 'user1',
      extraHeaderPages: 'header1.md,header2.md',
      extraPublicContent: 'public1,public2',
      extraTheme: 'theme1,theme2',
      vitepressConfig: './vitepress.config.json',
    }
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ title: 'VitePress Config' }))

    const result = prepareOptsSchema.parse(validData)

    expect(result).toEqual({
      ...defaultConfig,
      ...validData,
      usernames: [validData.usernames],
      extraHeaderPages: ['header1.md', 'header2.md'],
      extraPublicContent: ['public1', 'public2'],
      extraTheme: ['theme1', 'theme2'],
      vitepressConfig: { title: 'VitePress Config' },
    })
  })

  it('should apply default values for optional fields', () => {
    const partialData = {
      usernames: 'user1',
      vitepressConfig: './vitepress.config.json',
    }
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ title: 'VitePress Config' }))

    const result = prepareOptsSchema.parse(partialData)

    expect(result).toEqual({
      ...defaultConfig,
      ...partialData,
      usernames: [partialData.usernames],
      vitepressConfig: { title: 'VitePress Config' },
    })
  })

  it('should transform string fields into arrays', () => {
    const dataWithStrings = {
      usernames: 'user1,user2',
      extraHeaderPages: 'header1.md,header2.md',
      extraPublicContent: 'public1,public2',
      extraTheme: 'theme1,theme2',
    }

    const result = prepareOptsSchema.parse(dataWithStrings)

    expect(result.usernames).toEqual(['user1', 'user2'])
    expect(result.extraHeaderPages).toEqual(['header1.md', 'header2.md'])
    expect(result.extraPublicContent).toEqual(['public1', 'public2'])
    expect(result.extraTheme).toEqual(['theme1', 'theme2'])
  })

  it('should throw an error for invalid vitepressConfig path', () => {
    const invalidData = {
      usernames: 'user1',
      vitepressConfig: './invalid-config.json',
    }
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('File not found')
    })

    const result = globalOptsSchema.parse(invalidData)

    expect(result).toEqual({
      ...defaultConfig,
      usernames: [invalidData.usernames],
    })
  })
})
