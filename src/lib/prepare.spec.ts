import path, { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fs, vol } from 'memfs'
import { extractFiles, getMdFiles, getUserInfos, getUserRepos } from '../utils/functions.js'
import { DOCPRESS_DIR, TEMPLATE_THEME, VITEPRESS_USER_THEME } from '../utils/const.js'
import type { PrepareOpts } from '../schemas/prepare.js'
import { log } from '../utils/logger.js'
import type { EnhancedRepository } from './fetch.js'
import type { getInfos } from './git.js'
import { getVitepressConfig } from './vitepress.js'

vi.mock('../utils/functions.js', async (importOriginal) => {
  const mockUser = { name: 'user1', login: 'user1' } as Awaited<ReturnType<typeof getInfos>>['user']
  const mockRepos = [
    {
      clone_url: 'https://github.com/user1/repo1',
      fork: false,
      private: false,
      description: 'bliblibli',
      docpress: { includes: ['docs'], filtered: false, projectPath: 'repo1' },
      owner: (mockUser as Partial<Awaited<ReturnType<typeof getInfos>>['user']>),
    },
    {
      clone_url: 'https://github.com/user1/repo2',
      fork: true,
      private: false,
      description: '',
      docpress: { includes: [], filtered: false, projectPath: 'repo2' },
      owner: (mockUser as Partial<Awaited<ReturnType<typeof getInfos>>['user']>),
    },
  ] as EnhancedRepository[]
  return {
    ...(await importOriginal<typeof import('../utils/functions.js')>()),
    getUserInfos: vi.fn(() => mockUser),
    getUserRepos: vi.fn(() => mockRepos),
    createDir: vi.fn(),
    // extractFiles: vi.fn(paths => Array.isArray(paths) ? paths : [paths]),
    getMdFiles: vi.fn(() => ['/path/to/file1.md']),
  }
})
vi.mock('./git.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../utils/functions.js')>()),
  getContributors: () => ({
    source: {
      name: 'repo1',
      owner: { login: 'user1' },
      html_url: 'https://github.com/test/repo',
      description: 'Test repo description',
      stargazers_count: 10,
    },
    contributors: [{ login: 'user1', contributions: 10 }],
  }),
}))
vi.mock('./vitepress.js', () => ({ getVitepressConfig: vi.fn() }))
vi.mock('../utils/regex.js')
vi.mock('../utils/logger.js', () => ({ log: vi.fn() }))
vi.mock('./prepare.js', async importOriginal => (await importOriginal<typeof import('./prepare.js')>()))

beforeEach(() => {
  vol.fromJSON({
    'docpress/.vitepress/config.ts': '',
    'docpress/.vitepress/theme/layouts/ForkPage.vue': '',
    'docpress/.vitepress/theme/index.md': '',
    'docpress/docs/readme.md': '',
    'docpress/docs/forks.md': '',
    'docpress/docs/01-file3.md': '',
    'docpress/docs/FILE2.md': '',
    'docpress/repos-user1.json': '[{ "name": "repo1" }, { "name": "repo2" }]',
    'src/utils/templates/theme/index.md': '', // to update
    'src/utils/templates/theme/layouts/ForkPage.vue': '', // to update
    'repo1/.gitkeep': '',
    'repo2/.gitkeep': '',
  })
  // console.log(vol.toJSON())
})

describe('addSources', async () => {
  const { addSources } = await import('./prepare.js')

  it('should append source content to a file', () => {
    vi.spyOn(fs, 'appendFileSync')
    const file = '/mock/output/readme.md'
    const link = 'https://example.com/repo'
    vol.fromJSON({ [file]: '' })

    addSources(link, file)

    expect(vi.mocked(fs).appendFileSync).toHaveBeenCalledWith(
      file,
      expect.stringContaining(`[project sources](${link})`),
      'utf8',
    )
  })
})

describe('prepareDoc', async () => {
  const mockUser = { name: 'user1', login: 'user1' } as Awaited<ReturnType<typeof getInfos>>['user']
  const mockRepos = [
    {
      clone_url: 'https://github.com/user1/repo1',
      fork: false,
      private: false,
      description: 'bloubloublou',
      docpress: { includes: ['docs'], filtered: false, projectPath: 'repo1' },
      owner: (mockUser as Partial<Awaited<ReturnType<typeof getInfos>>['user']>),
    },
    {
      clone_url: 'https://github.com/user1/repo2',
      fork: true,
      private: false,
      description: '',
      docpress: { includes: [], filtered: false, projectPath: 'repo2' },
      owner: (mockUser as Partial<Awaited<ReturnType<typeof getInfos>>['user']>),
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
  const mockOpts: Partial<Omit<PrepareOpts, 'usernames'>> & { username: PrepareOpts['usernames'][number] } = {
    username: 'user1',
    extraHeaderPages: ['header/pages'],
    extraPublicContent: ['public/content'],
    extraTheme: ['theme/path'],
    vitepressConfig: mockVitepressConfig,
  }

  beforeEach(async () => {
    vi.spyOn(await import('./vitepress.js'), 'getVitepressConfig').mockImplementation(vi.fn())
    vi.spyOn(await import('./prepare.js'), 'transformDoc').mockImplementation(() => mockTransformed)
    vi.spyOn(await import('./prepare.js'), 'addExtraPages').mockImplementation(() => mockNav)
    vi.spyOn(await import('./prepare.js'), 'addContent').mockImplementation(vi.fn())
    vi.spyOn(await import('./prepare.js'), 'generateVitepressFiles')
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockVitepressConfig))
  })

  const { prepareDoc } = await import('./prepare.js')

  it('should log the start message and call getUserInfos and getUserRepos', async () => {
    await prepareDoc(mockOpts)
    expect(log).toHaveBeenCalledWith(`   Replace urls for repository 'undefined'.`, 'info')
    expect(log).toHaveBeenCalledWith(`   Generate sidebar for repository 'undefined'.`, 'info')
    expect(log).toHaveBeenCalledWith(`   Generate index content.`, 'info')
    expect(log).toHaveBeenCalledWith(`   Add extras Vitepress headers pages.`, 'info')
    expect(log).toHaveBeenCalledWith(`   Add extras Vitepress public folder content.`, 'info')
    expect(log).toHaveBeenCalledWith(`   Add extras Vitepress theme files.`, 'info')
    expect(log).toHaveBeenCalledWith(`   Generate Vitepress config.`, 'info')
    expect(log).toHaveBeenCalledWith(`   Generate index file.`, 'info')
    expect(log).toHaveBeenCalledWith(`   Add Docpress theme files.`, 'info')
    expect(getUserInfos).toHaveBeenCalled()
    expect(getUserRepos).toHaveBeenCalled()
  })

  it.skip('should filter and transform repositories correctly', async () => {
    const { transformDoc } = await import('./prepare.js')

    await prepareDoc(mockOpts)
    expect(transformDoc).toHaveBeenCalled()
    expect(transformDoc).toHaveBeenCalledWith(
      [mockRepos[0]],
      mockUser,
    )
  })

  it.skip('should add extra header pages if provided', async () => {
    vi.spyOn(await import('./prepare.js'), 'addExtraPages').mockImplementation(() => mockNav)
    const { addExtraPages } = await import('./prepare.js')

    await prepareDoc(mockOpts)
    expect(addExtraPages).toHaveBeenCalledWith(mockOpts.extraHeaderPages)
  })

  it.skip('should log and add extra public content if provided', async () => {
    const { addContent } = await import('./prepare.js')

    await prepareDoc(mockOpts)
    expect(log).toHaveBeenCalledWith(`   Add extras Vitepress public folder content.`, 'info')
    expect(addContent).toHaveBeenCalledWith(mockOpts.extraPublicContent, resolve(DOCPRESS_DIR, 'public'))
  })

  it.skip('should log and add both template and extra themes if provided', async () => {
    const { addContent } = await import('./prepare.js')

    await prepareDoc(mockOpts)
    if (mockOpts.extraTheme) {
      expect(log).toHaveBeenCalledWith(`   Add extras Vitepress theme files.`, 'info')
      expect(addContent).toHaveBeenCalledWith(mockOpts.extraTheme, resolve(VITEPRESS_USER_THEME))
    }
  })

  it.skip('should call getVitepressConfig with sidebar, nav, and vitepressConfig options', async () => {
    await prepareDoc(mockOpts)
    expect(getVitepressConfig).toHaveBeenCalledWith(mockTransformed.sidebar, mockNav, mockVitepressConfig)
  })

  it.skip('should call generateVitepressFiles with the generated config and index', async () => {
    const { generateVitepressFiles } = await import('./prepare.js')

    await prepareDoc(mockOpts)
    expect(generateVitepressFiles).toHaveBeenCalledWith(mockVitepressConfig, mockTransformed.index)
  })
})

describe('generateIndex', async () => {
  const { generateIndex } = await import('./prepare.js')

  it('should return a formatted index object (with website infos)', () => {
    const user = { name: 'John Doe', login: 'johndoe', bio: 'Coder' } as ReturnType<typeof getUserInfos>
    const features = [{ title: 'Feature 1', details: 'Details 1', link: '/feature1' }]
    const websiteInfos = { title: 'Awesome website', tagline: 'Awesome tagline' }

    const result = generateIndex(features, user, websiteInfos)
    expect(result).toEqual({
      layout: 'home',
      hero: {
        name: websiteInfos.title,
        tagline: websiteInfos.tagline,
      },
      features,
    })
  })

  it('should return a formatted index object (without website infos)', () => {
    const user = { name: 'John Doe', login: 'johndoe', bio: 'Coder' } as ReturnType<typeof getUserInfos>
    const features = [{ title: 'Feature 1', details: 'Details 1', link: '/feature1' }]
    const websiteInfos = { title: undefined, tagline: undefined }

    const result = generateIndex(features, user, websiteInfos)
    expect(result).toEqual({
      layout: 'home',
      hero: {
        name: 'John Doe\'s projects',
        tagline: 'Coder',
      },
      features,
    })
  })
})

describe('generateFeatures', async () => {
  const { generateFeatures } = await import('./prepare.js')

  it('should create a feature object with prettified repo name', () => {
    const result = generateFeatures('my-repo', 'Description')
    expect(result).toEqual([
      {
        title: 'My repo',
        details: 'Description',
        link: '/my-repo/introduction',
      },
    ])
  })
})

describe('generateSidebarProject', async () => {
  const { generateSidebarProject } = await import('./prepare.js')

  it('should generate a sidebar project with prettified title and items', () => {
    const pages = [{ text: 'Introduction', link: '/my-repo/readme' }]
    const result = generateSidebarProject('my-repo', pages)
    expect(result).toEqual({
      text: 'My repo',
      collapsed: true,
      items: pages,
    })
  })
})

describe('generateSidebarPages', async () => {
  const { generateSidebarPages } = await import('./prepare.js')

  it('should generate sidebar pages with Introduction if filename is introduction', () => {
    const result = generateSidebarPages('my-repo', 'introduction')
    expect(result).toEqual([
      {
        text: 'Introduction',
        link: '/my-repo/introduction',
      },
    ])
  })

  it('should generate sidebar pages with Introduction if filename is not introduction', () => {
    const result = generateSidebarPages('my-repo', 'foo')
    expect(result).toEqual([
      {
        text: 'Foo',
        link: '/my-repo/foo',
      },
    ])
  })
})

describe('transformDoc', async () => {
  const { transformDoc } = await import('./prepare.js')

  const repositories = [
    {
      name: 'my-repo',
      description: 'Repo description',
      html_url: 'https://example.com/repo',
      owner: { login: 'user' },
      docpress: { projectPath: './docpress/docs', branch: 'main' },
    },
  ] as ReturnType<typeof getUserRepos>
  const user = { name: 'John Doe', login: 'johndoe', bio: 'Developer' } as ReturnType<typeof getUserInfos>

  beforeEach(() => {
    vi.spyOn(fs, 'statSync')
    vi.spyOn(fs, 'readdirSync')
    vi.mocked(fs).statSync.mockReturnValue({ isFile: () => true } as any)
  })

  it('should transform repositories into index and sidebar data (multi-files docs)', () => {
    vi.mocked(getMdFiles).mockReturnValueOnce(['/path/to/01-file3.md', '/path/to/file1.md', '/path/to/FILE2.md', '/path/to/readme.md'])
    vi.mocked(fs).readdirSync.mockReturnValueOnce(['readme.md', 'file1.md', 'FILE2.md', '01-file3.md'])

    const websiteInfos = { title: undefined, tagline: undefined }

    const result = transformDoc(repositories, user, websiteInfos)
    expect(result.sidebar).toEqual([
      {
        text: 'My repo',
        collapsed: true,
        items: [
          {
            text: 'File3',
            link: '/my-repo/file3',
          },
          {
            text: 'File1',
            link: '/my-repo/file1',
          },
          {
            text: 'File2',
            link: '/my-repo/file2',
          },
          {
            text: 'Introduction',
            link: '/my-repo/introduction',
          },
          {
            text: 'Sources',
            link: '/my-repo/sources',
          },
        ],
      },
    ])
    expect(result.index.hero.name).toContain('John Doe\'s projects')
  })

  it('should transform repositories into index and sidebar data (single-file docs)', () => {
    vi.mocked(getMdFiles).mockReturnValue(['/path/to/README.md'])
    vi.mocked(fs).readdirSync.mockReturnValue(['readme.md'])

    const websiteInfos = { title: undefined, tagline: undefined }

    const result = transformDoc(repositories, user, websiteInfos)
    expect(result.sidebar).toEqual([
      {
        text: 'My repo',
        collapsed: true,
        items: [
          {
            text: 'Introduction',
            link: '/my-repo/introduction',
          },
        ],
      },
    ])
    expect(result.index.hero.name).toContain('John Doe\'s projects')
  })
})

describe('addExtraPages', async () => {
  const { addExtraPages } = await import('./prepare.js')

  it('should copy files and return nav pages', () => {
    vi.mocked(getMdFiles).mockReturnValue(['/path/to/File1.md', '/path/to/file2.md'])
    vi.spyOn(fs, 'cpSync')
    const result = addExtraPages(['/path/to/File1.md', '/path/to/file2.md'])

    expect(result).toEqual([
      { text: 'File1', link: '/file1' },
      { text: 'file2', link: '/file2' },
    ])
    // expect(vi.mocked(fs).cpSync.toHaveBeenCalledTimes(2))
  })
})

describe('addContent', async () => {
  const { addContent } = await import('./prepare.js')
  it('should copy files and call callback if provided', () => {
    const callback = vi.fn()
    addContent(['/path/to/file1.md'], '/mock/dir', callback)

    // expect(vi.mocked(fs).cpSync.toHaveBeenCalled()
    expect(callback).toHaveBeenCalled()
  })
})

describe('parseVitepressConfig', async () => {
  const { parseVitepressConfig } = await import('./prepare.js')

  it('should parse Vitepress configuration from JSON file', async () => {
    vi.mock('/mock/config.json', () => ({ config: { title: 'My Project' } }))

    const config = await parseVitepressConfig('/mock/config.json')
    expect(config).toEqual({ title: 'My Project' })
  })
})

describe('generateVitepressFiles', async () => {
  const { generateVitepressFiles } = await import('./prepare.js')

  it('should create Vitepress config and index files', async () => {
    console.log(vol.toJSON())
    vi.spyOn(fs, 'writeFileSync')

    const vitepressConfig = { title: 'My Project' }
    const index = {
      layout: 'home',
      hero: { name: 'My Projects', tagline: 'Awesome projects' },
      features: [],
    }

    generateVitepressFiles(vitepressConfig, index)

    expect(vi.mocked(fs).writeFileSync).toHaveBeenCalledWith(
      path.resolve(process.cwd(), 'docpress/.vitepress/config.ts'),
      expect.stringContaining('export default config'),
    )
    expect(vi.mocked(fs).writeFileSync).toHaveBeenCalledWith(
      path.resolve(process.cwd(), 'docpress/docs/index.md'),
      expect.stringContaining('layout: home'),
    )

    const templates = extractFiles(TEMPLATE_THEME)
    templates.forEach(async (filePath) => {
      const content = await import(resolve(TEMPLATE_THEME, filePath), { with: { type: 'raw' } })
      const destPath = resolve(process.cwd(), 'docpress/.vitepress/theme', filePath.replace('../templates/theme/', ''))
      expect(fs.writeFileSync).toHaveBeenCalledWith(destPath, content)
    })
  })
})

describe('addForkPage', async () => {
  const { addForkPage } = await import('./prepare.js')

  const mockForks = [
    {
      repository: {
        name: 'example-repo',
        owner: { login: 'example-user' },
        html_url: 'https://github.com/example/repo',
        description: 'An example repository',
        stargazers_count: 42,
      },
      contributions: 5,
    },
  ] as { repository: Awaited<ReturnType<typeof getInfos>>['repos'][number], contributions: number }[]

  it('should generate a forks page file', () => {
    vi.spyOn(fs, 'writeFileSync')

    addForkPage(mockForks)

    expect(vi.mocked(fs).writeFileSync).toHaveBeenCalledWith(
      path.resolve(process.cwd(), 'docpress/docs/forks.md'),
      expect.stringContaining('layout: fork-page'),
    )
    expect(vi.mocked(fs).writeFileSync).toHaveBeenCalledWith(
      path.resolve(process.cwd(), 'docpress/docs/forks.md'),
      expect.stringContaining('example-repo'),
    )
    expect(vi.mocked(fs).writeFileSync).toHaveBeenCalledWith(
      path.resolve(process.cwd(), 'docpress/docs/forks.md'),
      expect.stringContaining('example-user'),
    )
    expect(vi.mocked(fs).writeFileSync).toHaveBeenCalledWith(
      path.resolve(process.cwd(), 'docpress/docs/forks.md'),
      expect.stringContaining('example-user'),
    )
    expect(vi.mocked(fs).writeFileSync).toHaveBeenCalledWith(
      path.resolve(process.cwd(), 'docpress/docs/forks.md'),
      expect.stringContaining('An example repository'),
    )
    expect(vi.mocked(fs).writeFileSync).toHaveBeenCalledWith(
      path.resolve(process.cwd(), 'docpress/docs/forks.md'),
      expect.stringContaining('5'),
    )
  })
})

describe('processForks', async () => {
  const { processForks } = await import('./prepare.js')

  const mockRepositories = [
    {
      name: 'repo1',
      owner: { login: 'user1' },
      docpress: { projectPath: '/test/path', branch: 'main' },
      html_url: 'https://github.com/test/repo',
    },
  ] as EnhancedRepository[]
  const mockUsername = 'user1'

  it('should process forks and generate the forks page', async () => {
    vi.spyOn(fs, 'writeFileSync')

    await processForks(mockRepositories, mockUsername)

    expect(vi.mocked(fs).writeFileSync).toHaveBeenCalledWith(
      path.resolve(process.cwd(), 'docpress/docs/forks.md'),
      expect.stringContaining('repo1'),
    )
    expect(vi.mocked(fs).writeFileSync).toHaveBeenCalledWith(
      path.resolve(process.cwd(), 'docpress/docs/forks.md'),
      expect.stringContaining('user1'),
    )
    expect(vi.mocked(fs).writeFileSync).toHaveBeenCalledWith(
      path.resolve(process.cwd(), 'docpress/docs/forks.md'),
      expect.stringContaining('Test repo description'),
    )
  })
})
