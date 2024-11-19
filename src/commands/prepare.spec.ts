import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DOCPRESS_DIR } from '../utils/const.js'
import type { PrepareOpts } from '../schemas/prepare.js'
import { prepareOptsSchema } from '../schemas/prepare.js'
import { getUserInfos, getUserRepos } from '../utils/functions.js'
import { addContent, addExtraPages, generateVitepressFiles, transformDoc } from '../lib/prepare.js'
import { getVitepressConfig } from '../lib/vitepress.js'
import { log } from '../utils/logger.js'
import type { EnhancedRepository } from '../lib/fetch.js'
import type { getInfos } from '../lib/git.js'
import * as prepareMod from './prepare.js'
import { globalOpts } from './global.js'

vi.mock('node:fs')
vi.mock('../utils/functions.js', async originalMod => ({
  ...(await originalMod()),
  getUserInfos: vi.fn(() => ({ username: 'testUser' })),
  getUserRepos: vi.fn(() => ([{ name: 'repo1' }, { name: 'repo2' }])),
}))
vi.mock('../lib/prepare.js', () => ({
  addContent: vi.fn(),
  addExtraPages: vi.fn(),
  generateVitepressFiles: vi.fn(),
  transformDoc: vi.fn(),
}))
vi.mock('../lib/vitepress.js', () => ({
  getVitepressConfig: vi.fn(),
}))
vi.mock('../utils/logger.js', () => ({
  log: vi.fn(),
}))
vi.spyOn(prepareMod, 'main')

const { prepareCmd, prepareOpts, main } = prepareMod

const mockUser = { name: 'testUser' } as Awaited<ReturnType<typeof getInfos>>['user']
const mockRepos = [
  {
    clone_url: 'https://github.com/test/repo1',
    fork: false,
    private: false,
    description: 'blablabla',
    docpress: { includes: ['docs'], filtered: false },
  },
  {
    clone_url: 'https://github.com/test/repo2',
    fork: true,
    private: false,
    description: '',
    docpress: { includes: [], filtered: false },
  },
] as EnhancedRepository[]
const mockTransformed = {
  sidebar: [{
    text: 'Repo1',
    collapsed: true,
    items: [{ text: 'Introduction', link: '/introduction' }],
  }],
  index: {
    layout: 'home',
    hero: { name: 'myDocs', tagline: 'faster than light' },
    features: [{
      title: 'Repo1',
      details: 'blablabla',
      link: '/introduction',
    }],
  },
}
const mockNav = [{ text: 'About', link: '/about' }]
const mockVitepressConfig = { title: 'My Project' }
const mockOpts = {
  extraHeaderPages: ['header/pages'],
  extraPublicContent: ['public/content'],
  extraTheme: ['theme/path'],
  vitepressConfig: mockVitepressConfig,
} as unknown as PrepareOpts

describe('prepareCmd', () => {
  beforeEach(() => {
    vi.mocked(transformDoc).mockReturnValue(mockTransformed)
  })

  it('should have the correct command name', () => {
    expect(prepareCmd.name()).toBe('prepare')
  })

  it('should include global and prepare-specific options', () => {
    const allOptions = [...prepareOpts, ...globalOpts]
    const { options } = prepareCmd
    expect(options).toEqual(expect.arrayContaining(allOptions))
  })

  it('should have the correct description', () => {
    expect(prepareCmd.description()).toBe('Transform doc to the target vitepress format.')
  })

  it('should call main function when action is triggered', async () => {
    prepareCmd.action(main)
    await prepareCmd.parseAsync(['--extra-theme', 'theme/path'], { from: 'user' })
    expect(main).toHaveBeenCalled()
  })
})

describe('main', () => {
  beforeEach(() => {
    vi.mocked(getUserInfos).mockReturnValue(mockUser)
    vi.mocked(getUserRepos).mockReturnValue(mockRepos)
    vi.mocked(transformDoc).mockReturnValue(mockTransformed)
    vi.mocked(addExtraPages).mockReturnValue(mockNav)
    vi.mocked(getVitepressConfig).mockReturnValue(mockVitepressConfig)
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockVitepressConfig))
  })

  it('should log the start message and call getUserInfos and getUserRepos', async () => {
    await main(mockOpts)
    expect(log).toHaveBeenCalledWith(
      `\n-> Start transform files to prepare Vitepress build.`,
      'info',
    )
    expect(getUserInfos).toHaveBeenCalled()
    expect(getUserRepos).toHaveBeenCalled()
  })

  it('should filter and transform repositories correctly', async () => {
    await main(mockOpts)
    expect(transformDoc).toHaveBeenCalledWith(
      [mockRepos[0]],
      mockUser,
    )
  })

  it('should add extra header pages if provided', async () => {
    await main(mockOpts)
    expect(addExtraPages).toHaveBeenCalledWith(mockOpts.extraHeaderPages)
  })

  it('should log and add extra public content if provided', async () => {
    await main(mockOpts)
    expect(log).toHaveBeenCalledWith(`   Add extras Vitepress public folder content.`, 'info')
    expect(addContent).toHaveBeenCalledWith(mockOpts.extraPublicContent, resolve(DOCPRESS_DIR, 'public'))
  })

  it('should log and add extra theme if provided', async () => {
    await main(mockOpts)
    expect(log).toHaveBeenCalledWith(`   Add extras Vitepress theme files.`, 'info')
    expect(addContent).toHaveBeenCalledWith(mockOpts.extraTheme, resolve(DOCPRESS_DIR, '.vitepress/theme'))
  })

  it('should call getVitepressConfig with sidebar, nav, and vitepressConfig options', async () => {
    await main(mockOpts)
    expect(getVitepressConfig).toHaveBeenCalledWith(mockTransformed.sidebar, mockNav, mockVitepressConfig)
  })

  it('should call generateVitepressFiles with the generated config and index', async () => {
    await main(mockOpts)
    expect(generateVitepressFiles).toHaveBeenCalledWith(mockVitepressConfig, mockTransformed.index)
  })
})

describe('prepareOpts', () => {
  it('should configure options with correct descriptions and default values', () => {
    const extraThemeOption = prepareOpts.find(opt => opt.flags.includes('--extra-theme'))
    const extraHeaderPagesOption = prepareOpts.find(opt => opt.flags.includes('--extra-header-pages'))

    expect(extraThemeOption?.description).toBe(prepareOptsSchema.innerType().shape.extraTheme._def.description)
    expect(extraHeaderPagesOption?.description).toBe(prepareOptsSchema.innerType().shape.extraHeaderPages._def.description)
  })
})
