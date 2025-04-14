import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fs } from 'memfs'
import type { PrepareOpts } from '../schemas/prepare.js'
import { prepareOptsSchema } from '../schemas/prepare.js'
import { createDir, getUserInfos, getUserRepos } from '../utils/functions.js'
import { addExtraPages, prepareDoc, transformDoc } from '../lib/prepare.js'
import { getVitepressConfig } from '../lib/vitepress.js'
import { log } from '../utils/logger.js'
import type { EnhancedRepository } from '../lib/fetch.js'
import type { getInfos } from '../lib/git.js'
import * as prepareMod from './prepare.js'
import { globalOpts } from './global.js'

vi.mock('../utils/functions.js', async originalMod => ({
  ...(await originalMod()),
  getUserInfos: vi.fn(() => ({ usernames: ['testUser'] })),
  getUserRepos: vi.fn(() => ([{ name: 'repo1' }, { name: 'repo2' }])),
  createDir: vi.fn(),
}))
vi.mock('../lib/prepare.js', () => ({
  addContent: vi.fn(),
  addExtraPages: vi.fn(),
  generateVitepressFiles: vi.fn(),
  transformDoc: vi.fn(),
  prepareDoc: vi.fn(),
}))
vi.mock('../lib/vitepress.js', () => ({ getVitepressConfig: vi.fn() }))
vi.mock('../utils/logger.js', () => ({ log: vi.fn() }))
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
const mockOpts: Partial<PrepareOpts> = {
  token: undefined,
  usernames: ['user1'],
  extraHeaderPages: ['header/pages'],
  extraPublicContent: ['public/content'],
  extraTheme: ['theme/path'],
  vitepressConfig: mockVitepressConfig,
}

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
    await prepareCmd.parseAsync(['-U', 'testUser'], { from: 'user' })
    expect(main).toHaveBeenCalled()
  })
})

describe('main', () => {
  beforeEach(() => {
    vi.mocked(getUserInfos).mockReturnValueOnce(mockUser)
    vi.mocked(getUserRepos).mockReturnValueOnce(mockRepos)
    vi.mocked(transformDoc).mockReturnValueOnce(mockTransformed)
    vi.mocked(addExtraPages).mockReturnValueOnce(mockNav)
    vi.mocked(getVitepressConfig).mockReturnValueOnce(mockVitepressConfig)
    vi.spyOn(fs, 'readFileSync').mockReturnValueOnce(JSON.stringify(mockVitepressConfig))
  })

  it('should log the start message and call getUserInfos and getUserRepos', async () => {
    await main(mockOpts)
    expect(log).toHaveBeenCalledWith(
      `\n-> Start transform files to prepare Vitepress build.`,
      'info',
    )
    expect(createDir).toHaveBeenCalled()
    expect(prepareDoc).toHaveBeenCalled()
  })

  // it('should filter and transform repositories correctly', async () => {
  //   await main(mockOpts)
  //   expect(transformDoc).toHaveBeenCalledWith(
  //     [mockRepos[0]],
  //     mockUser,
  //   )
  // })

  // it('should add extra header pages if provided', async () => {
  //   await main(mockOpts)
  //   expect(addExtraPages).toHaveBeenCalledWith(mockOpts.extraHeaderPages)
  // })

  // it('should log and add extra public content if provided', async () => {
  //   await main(mockOpts)
  //   expect(log).toHaveBeenCalledWith(`   Add extras Vitepress public folder content.`, 'info')
  //   expect(addContent).toHaveBeenCalledWith(mockOpts.extraPublicContent, resolve(DOCPRESS_DIR, 'public'))
  // })

  // it('should log and add both template and extra themes if provided', async () => {
  //   await main(mockOpts)
  //   if (mockOpts.extraTheme) {
  //     expect(log).toHaveBeenCalledWith(`   Add extras Vitepress theme files.`, 'info')
  //     expect(addContent).toHaveBeenCalledWith(mockOpts.extraTheme, resolve(VITEPRESS_USER_THEME))
  //   }
  // })

  // it('should call getVitepressConfig with sidebar, nav, and vitepressConfig options', async () => {
  //   await main(mockOpts)
  //   expect(getVitepressConfig).toHaveBeenCalledWith(mockTransformed.sidebar, mockNav, mockVitepressConfig)
  // })

  // it('should call generateVitepressFiles with the generated config and index', async () => {
  //   await main(mockOpts)
  //   expect(generateVitepressFiles).toHaveBeenCalledWith(mockVitepressConfig, mockTransformed.index)
  // })
})

describe('prepareOpts', () => {
  it('should configure options with correct descriptions and default values', () => {
    const extraThemeOption = prepareOpts.find(opt => opt.flags.includes('--extra-theme'))
    const extraHeaderPagesOption = prepareOpts.find(opt => opt.flags.includes('--extra-header-pages'))

    expect(extraThemeOption?.description).toBe(prepareOptsSchema.innerType().shape.extraTheme._def.description)
    expect(extraHeaderPagesOption?.description).toBe(prepareOptsSchema.innerType().shape.extraHeaderPages._def.description)
  })
})
