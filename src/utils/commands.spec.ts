import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Command, Option } from 'commander'
import type { Config } from '../schemas/global.js'
import { addOptions, explicitOptions, parseOptions } from './commands.js'
import * as fnMod from './functions.js'

vi.mock('fs')

const loadConfigFileMock = vi.spyOn(fnMod, 'loadConfigFile')

describe('parseOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadConfigFileMock.mockReturnValue({})
  })

  it('should parse valid fetch options', () => {
    const validFetchOptions = {
      branch: 'main',
      gitProvider: 'github',
      reposFilter: 'repo1,repo2',
      token: 'token123',
      usernames: 'user1',
    }

    const result = parseOptions('fetch', validFetchOptions)
    expect(result).toEqual({
      branch: 'main',
      gitProvider: 'github',
      forks: false,
      lastUpdated: false,
      reposFilter: ['repo1', 'repo2'],
      token: 'token123',
      usernames: ['user1'],
    })
  })

  it('should exit for invalid fetch options', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const invalidFetchOptions = {
      branch: 'main',
      gitProvider: 'unknown_provider',
      usernames: 'user1',
    }

    parseOptions('fetch', invalidFetchOptions)
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
    consoleSpy.mockRestore()
  })

  it('should parse valid global options', () => {
    const config: Partial<Config> = {
      branch: 'main',
      gitProvider: 'github',
      usernames: ['user1'],
      extraHeaderPages: [],
      extraPublicContent: [],
      extraTheme: [],
      reposFilter: [],
      forks: false,
    }

    loadConfigFileMock.mockReturnValue(config)
    const result = parseOptions('global', { config: './valid-config.json', token: 'private-token' })

    expect(result.token).toBe('private-token')
    expect(result).toHaveProperty('branch', 'main')
    expect(result).toHaveProperty('gitProvider', 'github')
    expect(result.usernames).toEqual(['user1'])
  })

  it('should parse valid prepare options', () => {
    const validPrepareOptions = {
      usernames: 'user1',
      extraHeaderPages: 'header1.md,header2.md',
      extraPublicContent: 'public1,public2',
      extraTheme: 'theme1,theme2',
      vitepressConfig: './vitepress.config.json',
    }

    loadConfigFileMock.mockReturnValue({})
    const result = parseOptions('prepare', validPrepareOptions)

    expect(result.usernames).toEqual(['user1'])
    expect(result.extraHeaderPages).toEqual(['header1.md', 'header2.md'])
    expect(result.extraPublicContent).toEqual(['public1', 'public2'])
    expect(result.extraTheme).toEqual(['theme1', 'theme2'])
  })

  it('should load configuration from file for any command', () => {
    const configFile = './test-config.json'
    const configData = {
      usernames: ['user1'],
      reposFilter: ['repo1'],
      branch: 'test-branch',
    }

    loadConfigFileMock.mockReturnValue(configData)

    const result = parseOptions('fetch', { config: configFile, token: 'test-token' })

    expect(loadConfigFileMock).toHaveBeenCalledWith(configFile)
    expect(result).toHaveProperty('token', 'test-token')
    expect(result.usernames).toEqual(['user1'])
    expect(result.reposFilter).toEqual(['repo1'])
    expect(result).toHaveProperty('branch', 'test-branch')
  })

  it('should give CLI options precedence over config file values', () => {
    loadConfigFileMock.mockReturnValue({
      usernames: ['config-user'],
      branch: 'config-branch',
    })

    const result = parseOptions('global', { config: './config.json', branch: 'cli-branch' })

    expect(result).toHaveProperty('branch', 'cli-branch')
    expect(result.usernames).toEqual(['config-user'])
  })

  it('should exit when the configuration file is invalid', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    loadConfigFileMock.mockReturnValue({ gitProvider: 'not-a-provider', usernames: ['user1'] })

    parseOptions('global', { config: './invalid-config.json' })
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
    consoleSpy.mockRestore()
  })

  it('should exit when usernames are missing', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    parseOptions('global', { branch: 'main' })
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
    consoleSpy.mockRestore()
  })

  it('should handle invalid option types', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    parseOptions('fetch', { usernames: 123 })
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
    consoleSpy.mockRestore()
  })

  it('should handle general errors during parsing', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    loadConfigFileMock.mockImplementation(() => {
      throw new Error('Test error')
    })

    parseOptions('global', { config: './error-config.json' })
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
    consoleSpy.mockRestore()
  })
})

describe('explicitOptions', () => {
  it('should keep options explicitly provided by the user and drop defaults', () => {
    const command = new Command('test')
    addOptions(command, [
      new Option('-b, --branch <string>', 'Branch').default('main'),
      new Option('-U, --usernames <string>', 'Usernames'),
    ])
    command.action(() => {})
    command.parse(['-U', 'user1'], { from: 'user' })

    const result = explicitOptions(command, command.opts())

    expect(result).toEqual({ usernames: 'user1' })
  })

  it('should keep default-valued options when explicitly passed', () => {
    const command = new Command('test')
    addOptions(command, [
      new Option('-b, --branch <string>', 'Branch').default('main'),
    ])
    command.action(() => {})
    command.parse(['-b', 'main'], { from: 'user' })

    const result = explicitOptions(command, command.opts())

    expect(result).toEqual({ branch: 'main' })
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
