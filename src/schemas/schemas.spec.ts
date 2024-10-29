import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { configSchema, globalOptsSchema } from './global.js'
import { fetchOptsSchema } from './fetch.js'
import { prepareOptsSchema } from './prepare.js'

vi.mock('fs')

describe('globalOptsSchema', () => {
  it('should validate valid global options', () => {
    const validData = {
      config: './valid-config.json',
    }

    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      branch: 'main',
      gitProvider: 'github',
      reposFilter: ['repo1', 'repo2'],
      token: 'your_token',
      username: 'your_username',
      extraHeaderPages: ['header1.md', 'header2.md'],
      extraPublicContent: ['public1', 'public2'],
      extraTheme: ['theme1', 'theme2'],
    }))

    const result = globalOptsSchema.parse(validData)
    expect(result).toEqual({
      ...validData,
      config: {
        branch: 'main',
        gitProvider: 'github',
        reposFilter: ['repo1', 'repo2'],
        token: 'your_token',
        username: 'your_username',
        extraHeaderPages: ['header1.md', 'header2.md'],
        extraPublicContent: ['public1', 'public2'],
        extraTheme: ['theme1', 'theme2'],
      },
    })
  })

  it('should throw an error for invalid config path', () => {
    const invalidData = {
      config: './invalid-config.json',
    }

    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('File not found')
    })

    expect(() => globalOptsSchema.parse(invalidData)).toThrow('File not found')
  })

  it('should handle optional config field correctly', () => {
    const partialData = {}

    const result = globalOptsSchema.parse(partialData)
    expect(result).toEqual({
      config: undefined,
    })
  })
})

describe('configSchema', () => {
  it('should validate valid combined config', () => {
    const validCombinedData = {
      branch: 'main',
      gitProvider: 'github',
      reposFilter: 'repo1,repo2',
      token: 'your_token',
      username: 'your_username',
      extraHeaderPages: 'header1.md,header2.md',
      extraPublicContent: 'public1,public2',
      extraTheme: 'theme1,theme2',
    }
    const transformedData = {
      reposFilter: ['repo1', 'repo2'],
      extraHeaderPages: ['header1.md', 'header2.md'],
      extraPublicContent: ['public1', 'public2'],
      extraTheme: ['theme1', 'theme2'],
    }

    const result = configSchema.parse(validCombinedData)
    expect(result).toEqual({ ...validCombinedData, ...transformedData })
  })

  it('should throw an error for missing required fields', () => {
    const invalidData = {
    }

    expect(() => configSchema.parse(invalidData)).toThrow()
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
      branch: 'main',
      gitProvider: 'github',
      username: 'user123',
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
      username: 'user123',
    }

    expect(() => fetchOptsSchema.parse(invalidData)).toThrow()
  })
})

describe('prepareOptsSchema', () => {
  it('should validate valid prepare options', () => {
    const validData = {
      extraHeaderPages: 'header1.md,header2.md',
      extraPublicContent: 'public1,public2',
      extraTheme: 'theme1,theme2',
      vitepressConfig: './vitepress.config.json',
    }

    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ title: 'VitePress Config' }))

    const result = prepareOptsSchema.parse(validData)
    expect(result).toEqual({
      ...validData,
      extraHeaderPages: ['header1.md', 'header2.md'],
      extraPublicContent: ['public1', 'public2'],
      extraTheme: ['theme1', 'theme2'],
      vitepressConfig: { title: 'VitePress Config' },
    })
  })

  it('should apply default values for optional fields', () => {
    const partialData = {
      vitepressConfig: './vitepress.config.json',
    }

    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ title: 'VitePress Config' }))

    const result = prepareOptsSchema.parse(partialData)
    expect(result).toEqual({
      ...partialData,
      extraHeaderPages: undefined,
      extraPublicContent: undefined,
      extraTheme: undefined,
      vitepressConfig: { title: 'VitePress Config' },
    })
  })

  it('should transform string fields into arrays', () => {
    const dataWithStrings = {
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
      vitepressConfig: './invalid-config.json',
    }

    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('File not found')
    })

    expect(() => prepareOptsSchema.parse(invalidData)).toThrow('File not found')
  })
})
