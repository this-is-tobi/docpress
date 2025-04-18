import type { Dirent } from 'node:fs'
import { appendFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { extractFiles, getMdFiles, type getUserInfos, type getUserRepos } from '../utils/functions.js'
import { TEMPLATE_THEME } from '../utils/const.js'
import {
  addContent,
  addExtraPages,
  addForkPage,
  addSources,
  generateFeatures,
  generateIndex,
  generateSidebarPages,
  generateSidebarProject,
  generateVitepressFiles,
  parseVitepressConfig,
  processForks,
  transformDoc,
} from './prepare.js'
import type { EnhancedRepository } from './fetch.js'
import type { getInfos } from './git.js'

vi.mock('node:fs')
vi.mock('../utils/regex.js')
vi.mock('../utils/functions.js', async importOriginal => ({
  ...await importOriginal<typeof import('../utils/functions.js')>(),
  createDir: vi.fn(),
  extractFiles: vi.fn(paths => Array.isArray(paths) ? paths : [paths]),
  getMdFiles: vi.fn(),
}))
vi.mock('../utils/const.js', () => ({
  DOCS_DIR: '/tmp/docpress/mock/docs',
  INDEX_FILE: '/tmp/docpress/mock/docs/index.md',
  FORKS_FILE: '/tmp/docpress/mock/docs/forks.md',
  VITEPRESS_CONFIG: '/tmp/docpress/mock/.vitepress/config.js',
  VITEPRESS_THEME: '/tmp/docpress/mock/.vitepress/theme',
  TEMPLATE_THEME: resolve(import.meta.dirname, '../../public/templates/theme'),
}))
vi.mock('./git.js', async importOriginal => ({
  ...await importOriginal<typeof import('../utils/functions.js')>(),
  getContributors: () => ({
    source: {
      name: 'test-repo',
      owner: { login: 'test-user' },
      html_url: 'https://github.com/test/repo',
      description: 'Test repo description',
      stargazers_count: 10,
    },
    contributors: [{ login: 'test-user', contributions: 10 }],
  }),
}))

const tempDir = resolve(__dirname, 'temp-test-dir')

describe('addSources', () => {
  it('should append source content to a file', () => {
    addSources('https://example.com/repo', '/mock/output/readme.md')
    expect(appendFileSync).toHaveBeenCalledWith(
      '/mock/output/readme.md',
      expect.stringContaining('[project sources](https://example.com/repo)'),
      'utf8',
    )
  })
})

describe('generateIndex', () => {
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

describe('generateFeatures', () => {
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

describe('generateSidebarProject', () => {
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

describe('generateSidebarPages', () => {
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

describe('transformDoc', () => {
  const repositories = [
    {
      name: 'my-repo',
      description: 'Repo description',
      html_url: 'https://example.com/repo',
      owner: { login: 'user' },
      docpress: { projectPath: '/mock/path', branch: 'main' },
    },
  ] as ReturnType<typeof getUserRepos>
  const user = { name: 'John Doe', login: 'johndoe', bio: 'Developer' } as ReturnType<typeof getUserInfos>

  beforeEach(() => {
    vi.mocked(statSync).mockReturnValue({ isFile: () => true } as any)
  })

  it('should transform repositories into index and sidebar data (multi-files docs)', () => {
    vi.mocked(getMdFiles).mockReturnValue(['/path/to/01-file3.md', '/path/to/file1.md', '/path/to/FILE2.md', '/path/to/readme.md'])
    vi.mocked(readdirSync).mockReturnValue(['readme.md', 'file1.md', 'FILE2.md', '01-file3.md'] as unknown as Dirent[])

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
    vi.mocked(readdirSync).mockReturnValue(['readme.md'] as unknown as Dirent[])

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

describe('addExtraPages', () => {
  it('should copy files and return nav pages', () => {
    vi.mocked(getMdFiles).mockReturnValue(['/path/to/File1.md', '/path/to/file2.md'])
    const result = addExtraPages(['/path/to/File1.md', '/path/to/file2.md'])

    expect(result).toEqual([
      { text: 'File1', link: '/file1' },
      { text: 'file2', link: '/file2' },
    ])
    expect(cpSync).toHaveBeenCalledTimes(2)
  })
})

describe('addContent', () => {
  it('should copy files and call callback if provided', () => {
    const callback = vi.fn()
    addContent(['/path/to/file1.md'], '/mock/dir', callback)

    expect(cpSync).toHaveBeenCalled()
    expect(callback).toHaveBeenCalled()
  })
})

describe('parseVitepressConfig', () => {
  it('should parse Vitepress configuration from JSON file', async () => {
    vi.mock('/mock/config.json', () => ({ config: { title: 'My Project' } }))

    const config = await parseVitepressConfig('/mock/config.json')
    expect(config).toEqual({ title: 'My Project' })
  })
})

describe('generateVitepressFiles', () => {
  it('should create Vitepress config and index files', async () => {
    const vitepressConfig = { title: 'My Project' }
    const index = {
      layout: 'home',
      hero: { name: 'My Projects', tagline: 'Awesome projects' },
      features: [],
    }

    generateVitepressFiles(vitepressConfig, index)

    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/docpress/mock/.vitepress/config.js',
      expect.stringContaining('export default config'),
    )
    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/docpress/mock/docs/index.md',
      expect.stringContaining('layout: home'),
    )

    const templates = extractFiles(TEMPLATE_THEME)
    templates.forEach(async (filePath) => {
      const content = await import(resolve(TEMPLATE_THEME, filePath), { with: { type: 'raw' } })
      const destPath = resolve('/tmp/docpress/mock/.vitepress/theme', filePath.replace('../templates/theme/', ''))
      expect(writeFileSync).toHaveBeenCalledWith(destPath, content)
    })
  })
})

describe('addForkPage', () => {
  beforeAll(() => {
    if (!existsSync(tempDir)) mkdirSync(tempDir)
  })
  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

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
    addForkPage(mockForks)

    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/docpress/mock/docs/forks.md',
      expect.stringContaining('layout: fork-page'),
    )
    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/docpress/mock/docs/forks.md',
      expect.stringContaining('example-repo'),
    )
    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/docpress/mock/docs/forks.md',
      expect.stringContaining('example-user'),
    )
    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/docpress/mock/docs/forks.md',
      expect.stringContaining('example-user'),
    )
    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/docpress/mock/docs/forks.md',
      expect.stringContaining('An example repository'),
    )
    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/docpress/mock/docs/forks.md',
      expect.stringContaining('5'),
    )
  })
})

describe('processForks', () => {
  beforeAll(() => {
    if (!existsSync(tempDir)) mkdirSync(tempDir)
  })
  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  const mockRepositories = [
    {
      name: 'test-repo',
      owner: { login: 'test-user' },
      docpress: { projectPath: '/test/path', branch: 'main' },
      html_url: 'https://github.com/test/repo',
    },
  ] as EnhancedRepository[]
  const mockUsername = 'test-user'

  it('should process forks and generate the forks page', async () => {
    await processForks(mockRepositories, mockUsername)

    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/docpress/mock/docs/forks.md',
      expect.stringContaining('test-repo'),
    )
    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/docpress/mock/docs/forks.md',
      expect.stringContaining('test-user'),
    )
    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/docpress/mock/docs/forks.md',
      expect.stringContaining('Test repo description'),
    )
  })
})
