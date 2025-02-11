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
    }

    const result = parseOptions('fetch', validFetchOptions)
    expect(result).toEqual({
      ...validFetchOptions,
      reposFilter: ['repo1', 'repo2'],
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

    expect(result).toEqual({ ...config, token: validGlobalOptions.token })
  })

  it('should parse valid build options', () => {
    const validBuildOptions = {}

    const result = parseOptions('build', validBuildOptions)
    expect(result).toEqual(validBuildOptions)
  })

  it('should parse valid prepare options', () => {
    const validPrepareOptions: RawCli = {
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

    ;(loadConfigFileMock as any).mockReturnValue(vitepressConfig)
    ;(readFileSync as any).mockReturnValue(vitepressConfig)
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
