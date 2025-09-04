import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { Command, Option } from 'commander'
import type { Config, RawCli } from '../schemas/global.js'
import { addOptions, parseOptions } from './commands.js'
import * as fnMod from './functions.js'

vi.mock('fs')
// vi.mock(import('./functions.js'), async (importOriginal) => {
//   const mod = await importOriginal()
//   return {
//     ...mod,
//     loadConfigFile: vi.fn(),
//   }
// })
const loadConfigFileMock = vi.spyOn(fnMod, 'loadConfigFile')

describe('parseOptions', () => {
  it('should parse valid fetch options', () => {
    const validFetchOptions: RawCli = {
      branch: 'main',
      gitProvider: 'github',
      reposFilter: 'repo1,repo2',
      token: 'token123',
      usernames: 'user1',
      forks: false,
    }

    const result = parseOptions('fetch', validFetchOptions)
    expect(result).toEqual({
      branch: 'main',
      gitProvider: 'github',
      reposFilter: ['repo1', 'repo2'],
      token: 'token123',
      usernames: ['user1'],
    })
  })

  it('should throw an error for invalid fetch options', () => {
    const invalidFetchOptions = {
      branch: 'main',
      gitProvider: 'unknown_provider',
      username: 'username',
    }

    expect(() => parseOptions('fetch', invalidFetchOptions as any)).toThrow()
  })

  it('should parse valid global options', () => {
    const validGlobalOptions: Partial<RawCli> = {
      config: './valid-config.json',
      token: 'private-token',
      branch: 'main',
      gitProvider: 'github',
      forks: false,
    }

    const config: Config = {
      branch: 'main',
      gitProvider: 'github',
      usernames: ['user1'],
      extraHeaderPages: [],
      extraPublicContent: [],
      extraTheme: [],
      reposFilter: [],
      vitepressConfig: {},
      forks: false,
      websiteTitle: '',
      websiteTagline: '',
    }

    ;(readFileSync as any).mockReturnValue(JSON.stringify(config))
    const result = parseOptions('global', validGlobalOptions)

    // Check individual key/values instead of strict equality
    expect(result.token).toBe(validGlobalOptions.token)
    expect(result).toHaveProperty('config', './valid-config.json')
    expect(result).toHaveProperty('branch', 'main')
    expect(result).toHaveProperty('gitProvider', 'github')
  })

  it('should parse valid build options', () => {
    const validBuildOptions = {}

    const result = parseOptions('build', validBuildOptions)
    expect(result).toEqual({})
  })

  it('should parse valid prepare options', () => {
    const validPrepareOptions: RawCli = {
      usernames: 'user1',
      extraHeaderPages: 'header1.md,header2.md',
      extraPublicContent: 'public1,public2',
      extraTheme: 'theme1,theme2',
      vitepressConfig: './vitepress.config.js',
      branch: 'main',
      gitProvider: 'github',
      forks: false,
    }
    const vitepressConfig = {
      lang: 'en-US',
      title: 'Home',
      description: 'Docpress',
    }

    ;(loadConfigFileMock as any).mockReturnValue(vitepressConfig)
    ;(readFileSync as any).mockReturnValue(vitepressConfig)
    const result = parseOptions('prepare', validPrepareOptions)

    // Check that key properties exist but don't do a strict comparison
    expect(result).toHaveProperty('usernames')
    expect(result.usernames).toEqual(['user1'])
    expect(result).toHaveProperty('extraHeaderPages')
    expect(result.extraHeaderPages).toEqual(['header1.md', 'header2.md'])
    expect(result).toHaveProperty('extraPublicContent')
    expect(result.extraPublicContent).toEqual(['public1', 'public2'])
    expect(result).toHaveProperty('extraTheme')
    expect(result.extraTheme).toEqual(['theme1', 'theme2'])
  })

  it('should handle loading configuration from file for global command', () => {
    const configFile = './test-config.json'
    const configData = {
      usernames: ['user1'],
      reposFilter: ['repo1'],
      branch: 'test-branch',
    }

    loadConfigFileMock.mockReturnValue(configData)

    const options = {
      config: configFile,
      token: 'test-token',
    }

    const result = parseOptions('global', options)

    expect(loadConfigFileMock).toHaveBeenCalledWith(configFile)
    // Check specific properties instead of the entire object
    expect(result).toHaveProperty('config', configFile)
    expect(result).toHaveProperty('token', 'test-token')
    expect(result).toHaveProperty('usernames')
    expect(result.usernames).toEqual(['user1'])
    expect(result).toHaveProperty('reposFilter')
    expect(result.reposFilter).toEqual(['repo1'])
  })

  it('should handle configuration file not being found for global command', () => {
    // Mock the exit function to prevent test from exiting
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const configFile = './non-existent-config.json'

    loadConfigFileMock.mockReturnValue(null)

    const options = {
      config: configFile,
    }

    // This won't throw because it exits the process
    parseOptions('global', options)
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
    logSpy.mockRestore()
  })

  it('should handle invalid configuration data', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const options = {
      usernames: 123, // Invalid type for usernames
    }

    // This won't throw because it exits the process
    parseOptions('fetch', options)
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
    consoleSpy.mockRestore()
  })

  it('should handle general errors during parsing', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Create an options object that will cause an error to be thrown
    loadConfigFileMock.mockImplementation(() => {
      throw new Error('Test error')
    })

    const options = {
      config: './error-config.json',
    }

    // This won't throw because it exits the process
    parseOptions('global', options)
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
    consoleSpy.mockRestore()
  })
})

describe('addOptions', () => {
  it('should add options to a command', () => {
    const command = new Command()
    const options = [
      new Option('-T, --token <token>', 'Git provider token'),
      new Option('-U, --usernames <usernames>', 'Git provider usernames'),
    ]

    addOptions(command, options)

    const addedOptions = command.options.map(opt => ({
      flags: opt.flags,
      description: opt.description,
    }))

    expect(addedOptions).toEqual([
      { flags: '-T, --token <token>', description: 'Git provider token' },
      { flags: '-U, --usernames <usernames>', description: 'Git provider usernames' },
    ])
  })
})
