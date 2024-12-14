import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { configSchema, globalOptsSchema } from './global.js'
import { fetchOptsSchema } from './fetch.js'
import { prepareOptsSchema } from './prepare.js'

vi.mock('fs')

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

    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      branch: 'main',
      gitProvider: 'github',
      reposFilter: ['repo1', 'repo2'],
      username: 'your_username',
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
      username: 'your_username',
      extraHeaderPages: ['header1.md', 'header2.md'],
      extraPublicContent: ['public1', 'public2'],
      extraTheme: ['theme1', 'theme2'],
    })
  })

  it('should return empty config for invalid config path', () => {
    const invalidData = {
      config: './invalid-config.json',
      username: 'user1',
    }

    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('File not found')
    })

    const result = globalOptsSchema.parse(invalidData)
    expect(result).toEqual({
      ...defaultConfig,
      username: invalidData.username,
    })
  })

  it('should handle optional config field correctly', () => {
    const partialData = {
      username: 'user1',
    }

    const result = globalOptsSchema.parse(partialData)
    expect(result).toEqual({
      ...defaultConfig,
      username: partialData.username,
    })
  })

  it('should correctly split comma-separated strings into arrays', () => {
    const dataWithCommaSeparatedValues = {
      username: 'user1',
      reposFilter: 'repo1,repo2,repo3',
      extraHeaderPages: 'header1.md,header2.md',
      extraPublicContent: 'public1,public2',
      extraTheme: 'theme1,theme2',
    }

    const result = globalOptsSchema.parse(dataWithCommaSeparatedValues)
    expect(result).toEqual({
      ...defaultConfig,
      username: 'user1',
      reposFilter: ['repo1', 'repo2', 'repo3'],
      extraHeaderPages: ['header1.md', 'header2.md'],
      extraPublicContent: ['public1', 'public2'],
      extraTheme: ['theme1', 'theme2'],
    })
  })

  it('should apply defaults for branch and gitProvider if not provided', () => {
    const dataWithoutBranchAndGitProvider = {
      username: 'user1',
      reposFilter: 'repo1',
    }

    const result = globalOptsSchema.parse(dataWithoutBranchAndGitProvider)
    expect(result).toEqual({
      ...defaultConfig,
      username: 'user1',
      reposFilter: ['repo1'],
    })
  })
})

describe('configSchema', () => {
  it('should validate valid combined config', () => {
    const validCombinedData = {
      branch: 'main',
      gitProvider: 'github',
      forks: false,
      token: 'your_token',
      username: 'your_username',
      reposFilter: ['repo1', 'repo2'],
      extraHeaderPages: ['header1.md', 'header2.md'],
      extraPublicContent: ['public1', 'public2'],
      extraTheme: ['theme1', 'theme2'],
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
    const partialData = {
      username: 'your_username',
      reposFilter: [],
      extraHeaderPages: [],
      extraPublicContent: [],
      extraTheme: [],
    }

    const result = configSchema.parse(partialData)
    expect(result).toEqual({
      ...defaultConfig,
      ...partialData,
      username: 'your_username',
      forks: false,
    })
  })

  it('should throw an error if gitProvider is not in the allowed enum values', () => {
    const invalidData = {
      username: 'user1',
      gitProvider: 'invalid_provider',
    }

    expect(() => configSchema.parse(invalidData)).toThrow()
  })

  it('should allow empty arrays for optional list fields', () => {
    const dataWithEmptyArrays = {
      username: 'user1',
      reposFilter: [],
      extraHeaderPages: [],
      extraPublicContent: [],
      extraTheme: [],
    }
    const { token: _token, ...rest } = defaultConfig

    const result = configSchema.parse(dataWithEmptyArrays)
    expect(result).toEqual({
      ...rest,
      forks: false,
      username: 'user1',
      reposFilter: [],
      extraHeaderPages: [],
      extraPublicContent: [],
      extraTheme: [],
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
      username: 'user123',
    }

    const result = fetchOptsSchema.parse(validData)
    expect(result).toEqual({ ...validData, reposFilter: ['repo1', 'repo2'] })
  })

  it('should apply default values for optional fields', () => {
    const partialData = {
      username: 'user123',
    }

    const result = fetchOptsSchema.parse(partialData)
    expect(result).toEqual({
      ...defaultConfig,
      username: partialData.username,
    })
  })

  it('should transform reposFilter into an array', () => {
    const dataWithString = {
      gitProvider: 'github',
      username: 'user123',
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
      username: 'user1',
      extraHeaderPages: 'header1.md,header2.md',
      extraPublicContent: 'public1,public2',
      extraTheme: 'theme1,theme2',
      vitepressConfig: './vitepress.config.json',
    }

    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ title: 'VitePress Config' }))

    const result = prepareOptsSchema.parse(validData)
    expect(result).toEqual({
      ...defaultConfig,
      ...validData,
      extraHeaderPages: ['header1.md', 'header2.md'],
      extraPublicContent: ['public1', 'public2'],
      extraTheme: ['theme1', 'theme2'],
      vitepressConfig: { title: 'VitePress Config' },
    })
  })

  it('should apply default values for optional fields', () => {
    const partialData = {
      username: 'user1',
      vitepressConfig: './vitepress.config.json',
    }

    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ title: 'VitePress Config' }))

    const result = prepareOptsSchema.parse(partialData)
    expect(result).toEqual({
      ...defaultConfig,
      ...partialData,
      vitepressConfig: { title: 'VitePress Config' },
    })
  })

  it('should transform string fields into arrays', () => {
    const dataWithStrings = {
      username: 'user1',
      extraHeaderPages: 'header1.md,header2.md',
      extraPublicContent: 'public1,public2',
      extraTheme: 'theme1,theme2',
    }

    const result = prepareOptsSchema.parse(dataWithStrings)
    expect(result.extraHeaderPages).toEqual(['header1.md', 'header2.md'])
    expect(result.extraPublicContent).toEqual(['public1', 'public2'])
    expect(result.extraTheme).toEqual(['theme1', 'theme2'])
  })

  it('should throw an error for invalid vitepressConfig path', () => {
    const invalidData = {
      username: 'user1',
      vitepressConfig: './invalid-config.json',
    }

    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('File not found')
    })

    const result = globalOptsSchema.parse(invalidData)
    expect(result).toEqual({
      ...defaultConfig,
      username: invalidData.username,
    })
  })
})
