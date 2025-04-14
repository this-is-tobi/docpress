import { describe, expect, it, vi } from 'vitest'
import { Command, Option } from 'commander'
import { vol } from 'memfs'
import type { Config, RawCli } from '../schemas/global.js'
import { addOptions, parseOptions } from './commands.js'
import * as fnMod from './functions.js'

describe('parseOptions', () => {
  it('should parse valid fetch options', () => {
    const validFetchOptions: RawCli = {
      branch: 'main',
      gitProvider: 'github',
      reposFilter: 'repo1,repo2',
      usernames: 'user1',
    }

    const result = parseOptions('fetch', validFetchOptions)

    expect(result).toEqual({
      ...validFetchOptions,
      reposFilter: ['repo1', 'repo2'],
      usernames: ['user1'],
    })
  })

  it('should throw an error for invalid fetch options', () => {
    const invalidFetchOptions: any = {
      branch: 'main',
      gitProvider: 'unknown_provider',
      username: 'username',
    }

    expect(() => parseOptions('fetch', invalidFetchOptions)).toThrow()
  })

  it('should parse valid global options', () => {
    const validGlobalOptions = {
      config: './valid-config.json',
      token: 'private-token',
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
    vol.fromJSON({ [validGlobalOptions.config]: JSON.stringify(config) })

    const result = parseOptions('global', validGlobalOptions)

    expect(result).toEqual({ ...config, token: validGlobalOptions.token })
  })

  it('should parse valid build options', () => {
    const validBuildOptions = {}

    const result = parseOptions('build', validBuildOptions)

    expect(result).toEqual(validBuildOptions)
  })

  it('should parse valid prepare options', () => {
    const validPrepareOptions = {
      usernames: 'user1',
      extraHeaderPages: 'header1.md,header2.md',
      extraPublicContent: 'public1,public2',
      extraTheme: 'theme1,theme2',
      vitepressConfig: './vitepress.config.js',
    }
    const vitepressConfig = {
      lang: 'en-US',
      title: 'Home',
      description: 'Docpress',
    }
    vi.spyOn(fnMod, 'loadConfigFile').mockReturnValueOnce(vitepressConfig)
    vol.fromJSON({ [validPrepareOptions.vitepressConfig]: JSON.stringify(vitepressConfig) })

    const result = parseOptions('prepare', validPrepareOptions)

    expect(result).toEqual({
      usernames: [validPrepareOptions.usernames],
      token: undefined,
      gitProvider: 'github',
      branch: 'main',
      extraHeaderPages: ['header1.md', 'header2.md'],
      extraPublicContent: ['public1', 'public2'],
      extraTheme: ['theme1', 'theme2'],
      vitepressConfig,
    })
  })
})

describe('addOptions', () => {
  it('should add options to a command', () => {
    const command = new Command()
    const options = [
      new Option('-T, --token <token>', 'Git provider token'),
      new Option('-U, --username <username>', 'Git provider username'),
    ]
    addOptions(command, options)

    const addedOptions = command.options.map(opt => ({
      flags: opt.flags,
      description: opt.description,
    }))

    expect(addedOptions).toEqual([
      { flags: '-T, --token <token>', description: 'Git provider token' },
      { flags: '-U, --username <username>', description: 'Git provider username' },
    ])
  })
})
