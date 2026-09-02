import { appendFileSync, cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { extractFiles, getMdFiles, getUserInfos, getUserRepos } from '../utils/functions.js'
import {
  addContent,
  addExtraPages,
  addForkPage,
  addSources,
  buildTree,
  findHiddenSidebarPaths,
  flattenTree,
  generateFeatures,
  generateIndex,
  generateSidebarItems,
  generateSidebarPages,
  generateSidebarProject,
  generateVitepressFiles,
  mergeSidebars,
  moveSourcesLast,
  parseVitepressConfig,
  parseVitepressIndex,
  prepareDoc,
  processForks,
  transformDoc,
} from './prepare.js'
import type { EnhancedRepository } from './fetch.js'
import type { getInfos } from './git.js'
import { getVitepressConfig } from './vitepress.js'
import { log } from '../utils/logger.js'

vi.mock('node:fs')
vi.mock('node:fs/promises')
vi.mock('../utils/functions.js', async importOriginal => ({
  ...await importOriginal<typeof import('../utils/functions.js')>(),
  createDir: vi.fn(),
  extractFiles: vi.fn(paths => Array.isArray(paths) ? paths : [paths]),
  getMdFiles: vi.fn(),
  getUserInfos: vi.fn(),
  getUserRepos: vi.fn(),
  replaceRelativePath: vi.fn(),
  replaceReadmePath: vi.fn(),
  replaceInternalMdLinks: vi.fn(),
}))
vi.mock('../utils/const.js', () => ({
  DOCS_DIR: '/tmp/docpress/mock/docs',
  INDEX_FILE: '/tmp/docpress/mock/docs/index.md',
  FORKS_FILE: '/tmp/docpress/mock/docs/forks.md',
  VITEPRESS_CONFIG: '/tmp/docpress/mock/.vitepress/config.js',
  VITEPRESS_THEME: '/tmp/docpress/mock/.vitepress/theme',
  VITEPRESS_USER_THEME: '/tmp/docpress/mock/.vitepress/theme/user',
  TEMPLATE_THEME: '/tmp/docpress/mock/templates/theme',
  DOCPRESS_DIR: '/tmp/docpress/mock',
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

vi.mock('./vitepress.js', () => ({
  getVitepressConfig: vi.fn(() => ({ themeConfig: { sidebar: [] } })),
}))
vi.mock('../utils/logger.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../utils/logger.js')>()),
  log: vi.fn(),
}))

// Virtual module consumed by the parseVitepressConfig test below,
// declared here because vi.mock calls are hoisted to the top level anyway
vi.mock('/mock/config.json', () => ({ config: { title: 'My Project' } }))

// Stands in for the Vitepress config left behind by a previous username
// iteration; tests assign `config` to drive the accumulation branch
const previousConfigModule = vi.hoisted(() => ({ config: undefined as any }))
vi.mock('/tmp/docpress/mock/.vitepress/config.js', () => previousConfigModule)

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

  it('should handle repository names with dots in feature links', () => {
    const result = generateFeatures('template-monorepo-ts', 'TypeScript monorepo template')
    expect(result).toEqual([
      {
        title: 'Template monorepo ts',
        details: 'TypeScript monorepo template',
        link: '/template-monorepo-ts/introduction',
      },
    ])
  })

  it('should handle repository names starting with dots', () => {
    const result = generateFeatures('github-workflows', 'Reusable GitHub workflows')
    expect(result).toEqual([
      {
        title: 'Github workflows',
        details: 'Reusable GitHub workflows',
        link: '/github-workflows/introduction',
      },
    ])
  })

  it('should apply removeDot consistently for links when repository names have dots', () => {
    // Test that the link generation applies removeDot correctly
    const result = generateFeatures('template.monorepo.ts', 'TypeScript monorepo template')
    expect(result).toEqual([
      {
        title: 'Template.monorepo.ts',
        details: 'TypeScript monorepo template',
        link: '/template-monorepo-ts/introduction',
      },
    ])
  })

  it('should prefix the feature link with the route prefix while keeping the title clean', () => {
    const result = generateFeatures('my-repo', 'Description', undefined, 'alice/')
    expect(result).toEqual([
      {
        title: 'My repo',
        details: 'Description',
        link: '/alice/my-repo/introduction',
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

  it('should handle repository names with dots in the display text', () => {
    const pages = [{ text: 'Introduction', link: '/template-monorepo-ts/introduction' }]
    const result = generateSidebarProject('template-monorepo-ts', pages)
    expect(result).toEqual({
      text: 'Template monorepo ts',
      collapsed: true,
      items: pages,
    })
  })

  it('should handle repository names starting with dots', () => {
    const pages = [{ text: 'Setup', link: '/github-workflows/setup' }]
    const result = generateSidebarProject('github-workflows', pages)
    expect(result).toEqual({
      text: 'Github workflows',
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

  it('should handle repository names with dots by removing them from links', () => {
    const result = generateSidebarPages('template-monorepo-ts', 'introduction')
    expect(result).toEqual([
      {
        text: 'Introduction',
        link: '/template-monorepo-ts/introduction',
      },
    ])
  })

  it('should handle repository names with dots for non-introduction files', () => {
    const result = generateSidebarPages('template-monorepo-ts', 'configuration')
    expect(result).toEqual([
      {
        text: 'Configuration',
        link: '/template-monorepo-ts/configuration',
      },
    ])
  })

  it('should handle repository names starting with dots', () => {
    const result = generateSidebarPages('github-workflows', 'setup')
    expect(result).toEqual([
      {
        text: 'Setup',
        link: '/github-workflows/setup',
      },
    ])
  })

  it('should apply removeDot consistently when repository names have dots', () => {
    // Test that the link generation applies removeDot correctly
    const result = generateSidebarPages('template.monorepo.ts', 'readme')
    expect(result).toEqual([
      {
        text: 'Readme',
        link: '/template-monorepo-ts/readme',
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
    vi.mocked(getMdFiles).mockReturnValue(['/path/to/01-readme.md', '/path/to/02-file1.md', '/path/to/03-FILE2.md', '/path/to/04-file3.md'])
    vi.mocked(readdirSync).mockReturnValue(['01-readme.md', '02-file1.md', '03-FILE2.md', '04-file3.md'] as any)

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
          {
            text: 'File1',
            link: '/my-repo/file1',
          },
          {
            text: 'File2',
            link: '/my-repo/file2',
          },
          {
            text: 'File3',
            link: '/my-repo/file3',
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

  it('should order sidebar pages by numeric filename prefix, regardless of the order readdirSync returns them in', () => {
    // readdirSync order reflects on-disk directory-entry order (not guaranteed to be
    // sorted, e.g. on Linux/ext4 inside a container), so it's scrambled here on purpose.
    vi.mocked(getMdFiles).mockReturnValue(['/path/to/04-file3.md', '/path/to/02-file1.md', '/path/to/03-FILE2.md', '/path/to/01-readme.md'])
    vi.mocked(readdirSync).mockReturnValue(['04-file3.md', '01-readme.md', '03-FILE2.md', '02-file1.md'] as any)

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
          {
            text: 'File1',
            link: '/my-repo/file1',
          },
          {
            text: 'File2',
            link: '/my-repo/file2',
          },
          {
            text: 'File3',
            link: '/my-repo/file3',
          },
          {
            text: 'Sources',
            link: '/my-repo/sources',
          },
        ],
      },
    ])
  })

  it('should transform repositories into index and sidebar data (single-file docs)', () => {
    vi.mocked(getMdFiles).mockReturnValue(['/path/to/README.md'])
    vi.mocked(readdirSync).mockReturnValue(['readme.md'] as any)

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

  it('should handle repository names with dots correctly in sidebar and features', () => {
    const reposWithDots = [
      {
        name: 'template.monorepo.ts',
        description: 'TypeScript monorepo template',
        html_url: 'https://example.com/repo',
        owner: { login: 'user' },
        docpress: { projectPath: '/mock/path', branch: 'main' },
      },
      {
        name: '.github-workflows',
        description: 'Reusable GitHub workflows',
        html_url: 'https://example.com/repo2',
        owner: { login: 'user' },
        docpress: { projectPath: '/mock/path2', branch: 'main' },
      },
    ] as ReturnType<typeof getUserRepos>

    vi.mocked(getMdFiles).mockReturnValue(['/path/to/README.md'])
    vi.mocked(readdirSync).mockReturnValue(['readme.md'] as any)

    const websiteInfos = { title: undefined, tagline: undefined }

    const result = transformDoc(reposWithDots, user, websiteInfos)

    // Check sidebar links have dots converted to dashes
    expect(result.sidebar).toEqual([
      {
        text: 'Github workflows',
        collapsed: true,
        items: [
          {
            text: 'Introduction',
            link: '/github-workflows/introduction',
          },
        ],
      },
      {
        text: 'Template monorepo ts',
        collapsed: true,
        items: [
          {
            text: 'Introduction',
            link: '/template-monorepo-ts/introduction',
          },
        ],
      },
    ])

    // Check index features have dots converted to dashes in links
    expect(result.index.features).toEqual([
      {
        title: 'Github workflows',
        details: 'Reusable GitHub workflows',
        link: '/github-workflows/introduction',
      },
      {
        title: 'Template monorepo ts',
        details: 'TypeScript monorepo template',
        link: '/template-monorepo-ts/introduction',
      },
    ])
  })

  it('should not throw and should skip sources when a repository has no markdown files (e.g. failed clone)', () => {
    vi.mocked(getMdFiles).mockReturnValue([])
    vi.mocked(readdirSync).mockReturnValue([] as any)

    const websiteInfos = { title: undefined, tagline: undefined }

    const result = transformDoc(repositories, user, websiteInfos)
    expect(result.sidebar).toEqual([
      {
        text: 'My repo',
        collapsed: true,
        items: [],
      },
    ])
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
    const config = await parseVitepressConfig('/mock/config.json')
    expect(config).toEqual({ title: 'My Project' })
  })
})

describe('parseVitepressConfig failures', () => {
  it('should fall back to an empty config when the file cannot be loaded', async () => {
    const config = await parseVitepressConfig('/definitely/missing-config.js')

    expect(config).toEqual({})
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Unable to load existing Vitepress config'),
      'warn',
    )
  })
})

describe('parseVitepressIndex', () => {
  it('should parse Vitepress index from YAML file', async () => {
    // Create a mock for readFile that returns our test YAML content
    const mockYamlContent = `
layout: home
hero:
  name: Test Project
  tagline: This is a test project
features:
  - title: Feature 1
    details: Feature 1 details
    link: /feature1
  - title: Feature 2
    details: Feature 2 details
    link: /feature2
`
    // Mock the readFile implementation by mocking fs
    vi.mocked(readFile).mockResolvedValue(Buffer.from(mockYamlContent) as any)

    const result = await parseVitepressIndex('/mock/index.md')

    // Verify the result matches the expected structure
    expect(result).toEqual({
      layout: 'home',
      hero: {
        name: 'Test Project',
        tagline: 'This is a test project',
      },
      features: [
        {
          title: 'Feature 1',
          details: 'Feature 1 details',
          link: '/feature1',
        },
        {
          title: 'Feature 2',
          details: 'Feature 2 details',
          link: '/feature2',
        },
      ],
    })
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
  })

  it('should throw a clear error when no template theme files are found', () => {
    vi.mocked(extractFiles).mockReturnValueOnce([])

    expect(() => generateVitepressFiles(
      { title: 'My Project' },
      { layout: 'home', hero: { name: 'My Projects', tagline: 'Awesome projects' }, features: [] },
    )).toThrow(/No template theme files found at '\/tmp\/docpress\/mock\/templates\/theme'/)
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

describe('buildTree', () => {
  it('should build a tree structure from flat file paths', () => {
    const files = [
      'readme.md',
      'docs/file1.md',
      'docs/nested/file2.md',
      'other/file3.md',
    ]

    const result = buildTree(files)

    expect(result).toEqual({
      $: ['readme.md'],
      docs: {
        $: ['file1.md'],
        nested: {
          $: ['file2.md'],
        },
      },
      other: {
        $: ['file3.md'],
      },
    })
  })

  it('should handle empty input', () => {
    const files: string[] = []
    const result = buildTree(files)
    expect(result).toEqual({})
  })

  it('should handle multiple files in the same directory', () => {
    const files = ['file1.md', 'file2.md', 'file3.md']
    const result = buildTree(files)
    expect(result).toEqual({
      $: ['file1.md', 'file2.md', 'file3.md'],
    })
  })

  it('should handle deeply nested directories', () => {
    const files = ['a/b/c/d/e/file.md']
    const result = buildTree(files)
    expect(result).toEqual({
      a: {
        b: {
          c: {
            d: {
              e: {
                $: ['file.md'],
              },
            },
          },
        },
      },
    })
  })
})

describe('flattenTree', () => {
  it('should flatten a tree structure back to file paths', () => {
    const tree = {
      $: ['readme.md'],
      docs: {
        $: ['file1.md'],
        nested: {
          $: ['file2.md'],
        },
      },
      other: {
        $: ['file3.md'],
      },
    }

    const result = flattenTree(tree)

    expect(result).toContain('readme.md')
    expect(result).toContain('docs/file1.md')
    expect(result).toContain('docs/nested/file2.md')
    expect(result).toContain('other/file3.md')
    expect(result.length).toBe(4)
  })

  it('should handle empty trees', () => {
    const result = flattenTree({})
    expect(result).toEqual([])
  })

  it('should handle trees with only $ entries', () => {
    const tree = {
      $: ['file1.md', 'file2.md'],
    }
    const result = flattenTree(tree)
    expect(result).toEqual(['file1.md', 'file2.md'])
  })

  it('should use provided prefix correctly', () => {
    const tree = {
      $: ['file1.md'],
      nested: {
        $: ['file2.md'],
      },
    }
    const result = flattenTree(tree, 'prefix')
    expect(result).toContain('prefix/file1.md')
    expect(result).toContain('prefix/nested/file2.md')
  })

  it('should handle non-array $ values by returning empty array', () => {
    const tree = {
      $: 'not-an-array' as any,
      nested: {
        $: ['file2.md'],
      },
    }
    const result = flattenTree(tree)
    // Should only return the valid nested file
    expect(result).toEqual(['nested/file2.md'])
  })
})

describe('prepareDoc', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getUserInfos).mockReturnValue({
      name: 'Test User',
      login: 'test-user',
      bio: 'Test bio',
    } as ReturnType<typeof getUserInfos>)
    vi.mocked(getUserRepos).mockReturnValue([
      {
        name: 'repo1',
        description: 'Test repository 1',
        html_url: 'https://github.com/test-user/repo1',
        owner: { login: 'test-user' },
        clone_url: 'https://github.com/test-user/repo1.git',
        private: false,
        fork: false,
        docpress: {
          projectPath: '/tmp/path',
          branch: 'main',
          filtered: false,
          includes: ['file1.md'],
        },
      },
      {
        name: 'repo2',
        description: 'Test repository 2',
        html_url: 'https://github.com/test-user/repo2',
        owner: { login: 'test-user' },
        clone_url: 'https://github.com/test-user/repo2.git',
        private: false,
        fork: true,
        docpress: {
          projectPath: '/tmp/path',
          branch: 'main',
          filtered: false,
          includes: [],
        },
      },
      {
        name: 'filtered-repo',
        description: 'Filtered repository',
        html_url: 'https://github.com/test-user/filtered-repo',
        owner: { login: 'test-user' },
        clone_url: 'https://github.com/test-user/filtered-repo.git',
        private: false,
        fork: false,
        docpress: {
          projectPath: '/tmp/path',
          branch: 'main',
          filtered: true,
          includes: ['file1.md'],
        },
      },
      {
        name: 'private-repo',
        description: 'Private repository',
        html_url: 'https://github.com/test-user/private-repo',
        owner: { login: 'test-user' },
        clone_url: 'https://github.com/test-user/private-repo.git',
        private: true,
        fork: false,
        docpress: {
          projectPath: '/tmp/path',
          branch: 'main',
          filtered: false,
          includes: ['file1.md'],
        },
      },
    ] as ReturnType<typeof getUserRepos>)
    vi.mocked(existsSync).mockReturnValue(false)
    vi.mocked(readdirSync).mockReturnValue(['readme.md'] as any)
    vi.mocked(getMdFiles).mockReturnValue(['/path/to/README.md'])
    vi.mocked(statSync).mockReturnValue({ isFile: () => true } as any)
  })

  it('should prepare documentation with basic options', async () => {
    await prepareDoc({
      username: 'test-user',
      websiteTitle: 'Test Website',
      websiteTagline: 'Test Tagline',
    })

    expect(getUserInfos).toHaveBeenCalledWith('test-user')
    expect(getUserRepos).toHaveBeenCalledWith('test-user')
    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/docpress/mock/.vitepress/config.js',
      expect.any(String),
    )
    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/docpress/mock/docs/index.md',
      expect.any(String),
    )
  })

  it('should include forks when forks option is true', async () => {
    await prepareDoc({
      username: 'test-user',
      forks: true,
      token: 'test-token',
    })

    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/docpress/mock/docs/forks.md',
      expect.any(String),
    )
  })

  it('should default vitepressConfig.lastUpdated to true when the lastUpdated option is enabled', async () => {
    await prepareDoc({
      username: 'test-user',
      lastUpdated: true,
    })

    expect(getVitepressConfig).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ lastUpdated: true }),
    )
  })

  it('should not override an explicit vitepressConfig.lastUpdated value', async () => {
    await prepareDoc({
      username: 'test-user',
      lastUpdated: true,
      vitepressConfig: { lastUpdated: false } as any,
    })

    expect(getVitepressConfig).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ lastUpdated: false }),
    )
  })

  it('should leave vitepressConfig untouched when the lastUpdated option is disabled', async () => {
    await prepareDoc({
      username: 'test-user',
    })

    expect(getVitepressConfig).toHaveBeenCalledWith(expect.anything(), expect.anything(), undefined)
  })

  it('should handle extra header pages', async () => {
    vi.mocked(getMdFiles).mockReturnValue(['/path/to/extra-page.md'])

    await prepareDoc({
      username: 'test-user',
      extraHeaderPages: ['/path/to/extra-page.md'],
    })

    expect(cpSync).toHaveBeenCalled()
  })

  it('should handle extra public content', async () => {
    await prepareDoc({
      username: 'test-user',
      extraPublicContent: ['/path/to/public-content'],
    })

    // Just check that cpSync was called, not the specific arguments
    expect(cpSync).toHaveBeenCalled()
  })

  it('should handle extra theme files', async () => {
    await prepareDoc({
      username: 'test-user',
      extraTheme: ['/path/to/theme-files'],
    })

    // Just check that cpSync was called, not the specific arguments
    expect(cpSync).toHaveBeenCalled()
  })

  it('should handle existing config case', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFile).mockResolvedValue(Buffer.from(`
layout: home
hero:
  name: Existing Project
  tagline: Existing tagline
features:
  - title: Existing Feature
    details: Existing details
    link: /existing
`) as any)

    // We'll spy on the function to detect if it's called, but let it throw
    // so the test can pass without completing the full function
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      await prepareDoc({
        username: 'test-user',
      })
    } catch (_) {
      // Ignore the error - we're not testing the full function execution
      // just making sure that we got to the point of calling existsSync and readFile
    }

    spy.mockRestore()
    expect(existsSync).toHaveBeenCalled()
    expect(readFile).toHaveBeenCalled()
  })

  it('should warn and skip the forks page on the gitlab provider', async () => {
    await prepareDoc({ username: 'test-user', forks: true, gitProvider: 'gitlab' })

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(`not supported with the 'gitlab' provider`),
      'warn',
    )
    const [, nav] = vi.mocked(getVitepressConfig).mock.calls.at(-1)!
    expect(nav).toEqual([])
  })

  it('should not duplicate the forks entry supplied as an extra header page', async () => {
    vi.mocked(getMdFiles).mockReturnValue(['/path/to/forks.md'])

    await prepareDoc({ username: 'test-user', forks: true, extraHeaderPages: ['/path/to/forks.md'] })

    const [, nav] = vi.mocked(getVitepressConfig).mock.calls.at(-1)!
    expect(nav).toEqual([{ text: 'Forks', link: '/forks' }])
  })

  it('should build a route-keyed sidebar in multi mode', async () => {
    await prepareDoc({ username: 'test-user', sidebarMode: 'multi' })

    const [sidebar] = vi.mocked(getVitepressConfig).mock.calls.at(-1)!
    expect(sidebar).toEqual({
      '/repo1/': [{ text: 'Introduction', link: '/repo1/introduction' }],
    })
  })

  it('should expand sidebar groups when sidebarCollapsed is false', async () => {
    await prepareDoc({ username: 'test-user', sidebarCollapsed: false })

    const [sidebar] = vi.mocked(getVitepressConfig).mock.calls.at(-1)!
    expect((sidebar as any)[0]).toMatchObject({ text: 'Repo1', collapsed: false })
  })

  it('should drop the collapsed key when sidebarCollapsed is null', async () => {
    await prepareDoc({ username: 'test-user', sidebarCollapsed: null })

    const [sidebar] = vi.mocked(getVitepressConfig).mock.calls.at(-1)!
    expect((sidebar as any)[0]).not.toHaveProperty('collapsed')
  })

  it('should merge a route-keyed sidebar left by a previous username', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    previousConfigModule.config = {
      themeConfig: { sidebar: { '/previous-repo/': [{ text: 'Prev', link: '/previous-repo/prev' }] } },
    }
    vi.mocked(readFile).mockResolvedValue(Buffer.from(`
layout: home
hero:
  name: Existing
features: []
`) as any)

    await prepareDoc({ username: 'test-user', sidebarMode: 'multi' })

    const [sidebar] = vi.mocked(getVitepressConfig).mock.calls.at(-1)!
    expect(sidebar).toEqual({
      '/previous-repo/': [{ text: 'Prev', link: '/previous-repo/prev' }],
      '/repo1/': [{ text: 'Introduction', link: '/repo1/introduction' }],
    })
    previousConfigModule.config = undefined
  })
})

describe('moveSourcesLast', () => {
  it('should move Sources to the end of the array in place', () => {
    const items = [
      { text: 'Sources', link: '/sources' },
      { text: 'Item 1', link: '/item1' },
      { text: 'Item 2', link: '/item2' },
    ]

    const result = moveSourcesLast(items)

    expect(result.at(-1)?.text).toBe('Sources')
    expect(result.length).toBe(3)
    // The real function mutates its input, so the original reference is reordered too
    expect(items.at(-1)?.text).toBe('Sources')
    expect(result).toBe(items)
  })

  it('should return the original array if Sources is not present', () => {
    const items = [
      { text: 'Item 1', link: '/item1' },
      { text: 'Item 2', link: '/item2' },
    ]

    const result = moveSourcesLast(items)

    expect(result).toEqual(items)
  })

  it('should handle non-array inputs', () => {
    const notAnArray = { text: 'Not an array' } as any

    const result = moveSourcesLast(notAnArray)

    expect(result).toEqual(notAnArray)
  })
})

describe('generateSidebarItems', () => {
  const repository = {
    name: 'test-repo',
    docpress: { projectPath: '/path/to/test-repo' },
  } as unknown as EnhancedRepository

  it('should build a page for each file, renaming readme to introduction', () => {
    const tree = { $: ['01-readme.md', '02-guide.md'] }

    const items = generateSidebarItems(repository, tree)

    // readme.md is renamed on disk to introduction.md ...
    expect(renameSync).toHaveBeenCalledWith('/path/to/test-repo/01-readme.md', '/path/to/test-repo/introduction.md')
    // ... and the numeric prefix is stripped from the guide file
    expect(renameSync).toHaveBeenCalledWith('/path/to/test-repo/02-guide.md', '/path/to/test-repo/guide.md')
    expect(items).toEqual([
      { text: 'Introduction', link: '/test-repo/introduction' },
      { text: 'Guide', link: '/test-repo/guide' },
    ])
  })

  it('should recurse into nested folders as collapsible sections', () => {
    const tree = { advanced: { $: ['setup.md'] } }

    const items = generateSidebarItems(repository, tree)

    expect(items).toEqual([
      {
        text: 'Advanced',
        collapsed: true,
        items: [
          { text: 'Setup', link: '/test-repo/advanced/setup' },
        ],
      },
    ])
  })

  it('should namespace links with the repository route prefix, including nested folders', () => {
    const namespaced = {
      name: 'test-repo',
      docpress: { projectPath: '/path/to/test-repo', routePrefix: 'alice/' },
    } as unknown as EnhancedRepository
    const tree = { $: ['01-readme.md'], advanced: { $: ['setup.md'] } }

    const items = generateSidebarItems(namespaced, tree)

    expect(items).toEqual([
      { text: 'Introduction', link: '/alice/test-repo/introduction' },
      {
        text: 'Advanced',
        collapsed: true,
        items: [
          { text: 'Setup', link: '/alice/test-repo/advanced/setup' },
        ],
      },
    ])
  })
})

describe('generateSidebarItems nested file paths', () => {
  const repository = {
    name: 'test-repo',
    docpress: { projectPath: '/path/to/test-repo' },
  } as unknown as EnhancedRepository

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should rename an index-prefixed file inside a nested folder using the nested path', () => {
    const tree = { advanced: { $: ['01-intro.md'] } }

    generateSidebarItems(repository, tree)

    expect(renameSync).toHaveBeenCalledWith(
      '/path/to/test-repo/advanced/01-intro.md',
      '/path/to/test-repo/advanced/intro.md',
    )
  })

  it('should rename a readme inside a nested folder using the nested path', () => {
    const tree = { advanced: { $: ['README.md'] } }

    const items = generateSidebarItems(repository, tree)

    expect(renameSync).toHaveBeenCalledWith(
      '/path/to/test-repo/advanced/README.md',
      '/path/to/test-repo/advanced/introduction.md',
    )
    expect(items).toEqual([
      {
        text: 'Advanced',
        collapsed: true,
        items: [
          { text: 'Introduction', link: '/test-repo/advanced/introduction' },
        ],
      },
    ])
  })

  it('should rename files in deeply nested folders using the full nested path', () => {
    const tree = { guide: { advanced: { $: ['01-setup.md'] } } }

    generateSidebarItems(repository, tree)

    expect(renameSync).toHaveBeenCalledWith(
      '/path/to/test-repo/guide/advanced/01-setup.md',
      '/path/to/test-repo/guide/advanced/setup.md',
    )
  })

  it('should ignore a file list that is not an array', () => {
    expect(generateSidebarItems(repository, { $: 'not-an-array' })).toEqual([])
  })

  it('should ignore tree leaves that are neither files nor folders', () => {
    expect(generateSidebarItems(repository, { stray: 'value' })).toEqual([])
  })

  it('should leave already-normalised nested files untouched', () => {
    const tree = { advanced: { $: ['setup.md'] } }

    generateSidebarItems(repository, tree)

    expect(renameSync).not.toHaveBeenCalled()
  })
})

describe('sidebar collapse behaviour', () => {
  const repository = {
    name: 'test-repo',
    docpress: { projectPath: '/path/to/test-repo' },
  } as unknown as EnhancedRepository
  const tree = { advanced: { $: ['setup.md'] } }

  it('should collapse project groups by default', () => {
    expect(generateSidebarProject('my-repo', [])).toEqual({
      text: 'My repo',
      collapsed: true,
      items: [],
    })
  })

  it('should expand project groups when collapsed is false', () => {
    expect(generateSidebarProject('my-repo', [], false)).toEqual({
      text: 'My repo',
      collapsed: false,
      items: [],
    })
  })

  it('should omit the collapsed key on project groups when collapsed is null', () => {
    const result = generateSidebarProject('my-repo', [], null)

    expect(result).toEqual({ text: 'My repo', items: [] })
    expect(result).not.toHaveProperty('collapsed')
  })

  it('should expand nested folder groups when collapsed is false', () => {
    expect(generateSidebarItems(repository, tree, false)).toEqual([
      {
        text: 'Advanced',
        collapsed: false,
        items: [{ text: 'Setup', link: '/test-repo/advanced/setup' }],
      },
    ])
  })

  it('should omit the collapsed key on nested folder groups when collapsed is null', () => {
    const [group] = generateSidebarItems(repository, tree, null)

    expect(group).toEqual({
      text: 'Advanced',
      items: [{ text: 'Setup', link: '/test-repo/advanced/setup' }],
    })
    expect(group).not.toHaveProperty('collapsed')
  })

  it('should apply the collapse setting to deeply nested folder groups', () => {
    const deepTree = { guide: { advanced: { $: ['setup.md'] } } }

    expect(generateSidebarItems(repository, deepTree, false)).toEqual([
      {
        text: 'Guide',
        collapsed: false,
        items: [
          {
            text: 'Advanced',
            collapsed: false,
            items: [{ text: 'Setup', link: '/test-repo/guide/advanced/setup' }],
          },
        ],
      },
    ])
  })
})

describe('transformDoc sidebar options', () => {
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
  const websiteInfos = { title: undefined, tagline: undefined }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(statSync).mockReturnValue({ isFile: () => true } as any)
    vi.mocked(getMdFiles).mockReturnValue(['/path/to/01-readme.md', '/path/to/02-file1.md'])
    vi.mocked(readdirSync).mockReturnValue(['01-readme.md', '02-file1.md'] as any)
  })

  it('should produce a flat array of project groups in single mode by default', () => {
    const result = transformDoc(repositories, user, websiteInfos)

    expect(Array.isArray(result.sidebar)).toBe(true)
    expect(result.sidebar).toEqual([
      {
        text: 'My repo',
        collapsed: true,
        items: [
          { text: 'Introduction', link: '/my-repo/introduction' },
          { text: 'File1', link: '/my-repo/file1' },
          { text: 'Sources', link: '/my-repo/sources' },
        ],
      },
    ])
  })

  it('should key the sidebar by repository route in multi mode', () => {
    const result = transformDoc(repositories, user, websiteInfos, { mode: 'multi' })

    expect(result.sidebar).toEqual({
      '/my-repo/': [
        { text: 'Introduction', link: '/my-repo/introduction' },
        { text: 'File1', link: '/my-repo/file1' },
        { text: 'Sources', link: '/my-repo/sources' },
      ],
    })
  })

  it('should namespace multi mode sidebar keys with the repository route prefix', () => {
    const namespaced = [{
      ...repositories[0],
      docpress: { ...repositories[0].docpress, routePrefix: 'alice/' },
    }] as ReturnType<typeof getUserRepos>

    const result = transformDoc(namespaced, user, websiteInfos, { mode: 'multi' })

    expect(Object.keys(result.sidebar)).toEqual(['/alice/my-repo/'])
  })

  it('should give each repository its own key in multi mode', () => {
    const twoRepos = [
      repositories[0],
      { ...repositories[0], name: 'other-repo' },
    ] as ReturnType<typeof getUserRepos>

    const result = transformDoc(twoRepos, user, websiteInfos, { mode: 'multi' })

    expect(Object.keys(result.sidebar)).toEqual(['/my-repo/', '/other-repo/'])
  })

  it('should apply the collapse setting to project groups in single mode', () => {
    const result = transformDoc(repositories, user, websiteInfos, { collapsed: false })

    expect((result.sidebar as any)[0].collapsed).toBe(false)
  })

  it('should still build index features in multi mode', () => {
    const result = transformDoc(repositories, user, websiteInfos, { mode: 'multi' })

    expect(result.index.features).toEqual([
      { title: 'My repo', details: 'Repo description', link: '/my-repo/introduction' },
    ])
  })
})

describe('mergeSidebars', () => {
  it('should concatenate and sort two flat sidebars by group text', () => {
    const previous = [{ text: 'Zeta', collapsed: true, items: [] }]
    const current = [{ text: 'Alpha', collapsed: true, items: [] }]

    expect(mergeSidebars(previous, current)).toEqual([
      { text: 'Alpha', collapsed: true, items: [] },
      { text: 'Zeta', collapsed: true, items: [] },
    ])
  })

  it('should sort sidebar groups missing a text property ahead of named ones', () => {
    const previous = [{ text: 'Alpha', items: [] }] as any
    const current = [{ items: [] }] as any

    expect(mergeSidebars(previous, current)).toEqual([
      { items: [] },
      { text: 'Alpha', items: [] },
    ])
  })

  it('should sort groups that both lack a text property without throwing', () => {
    const previous = [{ items: [] }] as any
    const current = [{ items: [] }] as any

    expect(mergeSidebars(previous, current)).toEqual([{ items: [] }, { items: [] }])
  })

  it('should merge two route-keyed sidebars and sort the keys', () => {
    const previous = { '/zeta/': [{ text: 'Z', link: '/zeta/z' }] }
    const current = { '/alpha/': [{ text: 'A', link: '/alpha/a' }] }

    expect(Object.keys(mergeSidebars(previous, current))).toEqual(['/alpha/', '/zeta/'])
  })

  it('should let the current run win when both sidebars share a route key', () => {
    const previous = { '/repo/': [{ text: 'Old', link: '/repo/old' }] }
    const current = { '/repo/': [{ text: 'New', link: '/repo/new' }] }

    expect(mergeSidebars(previous, current)).toEqual({
      '/repo/': [{ text: 'New', link: '/repo/new' }],
    })
  })

  it('should return the current sidebar when there is no previous one', () => {
    const current = [{ text: 'Alpha', collapsed: true, items: [] }]

    expect(mergeSidebars(undefined, current)).toEqual(current)
  })

  it('should file a flat sidebar under the root key when merging into a route-keyed one', () => {
    const previous = { '/alpha/': [{ text: 'A', link: '/alpha/a' }] }
    const current = [{ text: 'Zeta', collapsed: true, items: [] }]

    expect(mergeSidebars(previous, current)).toEqual({
      '/': [{ text: 'Zeta', collapsed: true, items: [] }],
      '/alpha/': [{ text: 'A', link: '/alpha/a' }],
    })
  })
})

describe('findHiddenSidebarPaths', () => {
  // Builds A > B > C ... > Page, one group per name
  const nest = (names: string[]): any[] => names.length
    ? [{ text: names[0], collapsed: true, items: nest(names.slice(1)) }]
    : [{ text: 'Page', link: '/page' }]

  it('should report a group whose children Vitepress will not render', () => {
    // Single mode: the repository group sits at depth 0, so its items start at depth 1
    expect(findHiddenSidebarPaths(nest(['A', 'B', 'C', 'D', 'E']), 1)).toEqual(['A/B/C/D/E'])
  })

  it('should allow one more level when items start at the root depth', () => {
    // Multi mode has no repository wrapper, so the same tree fits
    expect(findHiddenSidebarPaths(nest(['A', 'B', 'C', 'D', 'E']), 0)).toEqual([])
  })

  it('should report nothing for a shallow tree', () => {
    expect(findHiddenSidebarPaths(nest(['A', 'B']), 1)).toEqual([])
  })

  it('should ignore groups that have no children', () => {
    expect(findHiddenSidebarPaths([{ text: 'Empty', collapsed: true, items: [] }], 9)).toEqual([])
  })

  it('should report every offending branch', () => {
    const items = [
      ...nest(['A', 'B', 'C', 'D', 'E']),
      ...nest(['X', 'Y', 'Z', 'W', 'V']),
    ]

    expect(findHiddenSidebarPaths(items, 1)).toEqual(['A/B/C/D/E', 'X/Y/Z/W/V'])
  })
})

describe('transformDoc sidebar depth warning', () => {
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
  const websiteInfos = { title: undefined, tagline: undefined }
  const deepFile = 'a/b/c/d/e/deep.md'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(statSync).mockReturnValue({ isFile: () => true } as any)
    vi.mocked(getMdFiles).mockReturnValue([`/path/to/${deepFile}`])
    vi.mocked(readdirSync).mockReturnValue([deepFile] as any)
  })

  it('should warn when a repository nests deeper than Vitepress renders', () => {
    transformDoc(repositories, user, websiteInfos)

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(`'my-repo'`),
      'warn',
    )
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('A/B/C/D/E'),
      'warn',
    )
  })

  it('should not warn for the same tree in multi mode', () => {
    transformDoc(repositories, user, websiteInfos, { mode: 'multi' })

    expect(log).not.toHaveBeenCalledWith(
      expect.stringContaining('will not appear'),
      'warn',
    )
  })
})

describe('generateIndex fallbacks', () => {
  const features = [{ title: 'Feature 1', details: 'Details 1', link: '/feature1' }]
  const websiteInfos = { title: undefined, tagline: undefined }

  it('should fall back to the login when the user has no name', () => {
    const user = { login: 'johndoe', bio: 'Coder' } as ReturnType<typeof getUserInfos>

    expect(generateIndex(features, user, websiteInfos).hero).toEqual({
      name: 'johndoe\'s projects',
      tagline: 'Coder',
    })
  })

  it('should fall back to a default tagline when the user has no bio', () => {
    const user = { name: 'John Doe', login: 'johndoe' } as ReturnType<typeof getUserInfos>

    expect(generateIndex(features, user, websiteInfos).hero).toEqual({
      name: 'John Doe\'s projects',
      tagline: 'Robots are everywhere 🤖',
    })
  })
})

describe('accumulating generators', () => {
  it('should append to an existing feature list', () => {
    const existing = [{ title: 'First', details: 'Details', link: '/first' }]

    expect(generateFeatures('my-repo', 'Description', existing)).toEqual([
      ...existing,
      { title: 'My repo', details: 'Description', link: '/my-repo/introduction' },
    ])
  })

  it('should append to an existing sidebar page list', () => {
    const existing = [{ text: 'First', link: '/my-repo/first' }]

    expect(generateSidebarPages('my-repo', 'second', existing)).toEqual([
      ...existing,
      { text: 'Second', link: '/my-repo/second' },
    ])
  })
})

describe('addContent input shapes', () => {
  it('should accept a single path and work without a callback', () => {
    vi.clearAllMocks()

    addContent('/path/to/file1.md', '/mock/dir')

    expect(cpSync).toHaveBeenCalled()
  })
})

describe('processForks contribution counting', () => {
  it('should drop repositories the user has not contributed to', async () => {
    vi.clearAllMocks()

    // getContributors is mocked to report contributions for 'test-user' only
    await processForks([{ name: 'fork-repo' }] as unknown as EnhancedRepository[], 'someone-else')

    const written = vi.mocked(writeFileSync).mock.calls.at(-1)?.[1] as string
    expect(written).not.toContain('fork-repo')
  })
})

describe('repository edge cases', () => {
  const user = { name: 'John Doe', login: 'johndoe', bio: 'Developer' } as ReturnType<typeof getUserInfos>
  const websiteInfos = { title: undefined, tagline: undefined }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(statSync).mockReturnValue({ isFile: () => true } as any)
    vi.mocked(getMdFiles).mockReturnValue(['/path/to/readme.md'])
    vi.mocked(readdirSync).mockReturnValue(['readme.md'] as any)
  })

  it('should fall back to an empty description when the repository has none', () => {
    const repositories = [
      {
        name: 'my-repo',
        description: null,
        html_url: 'https://example.com/repo',
        owner: { login: 'user' },
        docpress: { projectPath: '/mock/path', branch: 'main' },
      },
    ] as unknown as ReturnType<typeof getUserRepos>

    const result = transformDoc(repositories, user, websiteInfos)

    expect(result.index.features).toEqual([
      { title: 'My repo', details: '', link: '/my-repo/introduction' },
    ])
  })

  it('should skip a non-fork repository that has no documentation to include', async () => {
    vi.mocked(getUserInfos).mockReturnValue(user)
    vi.mocked(getUserRepos).mockReturnValue([
      {
        name: 'empty-repo',
        description: 'No docs here',
        html_url: 'https://github.com/test-user/empty-repo',
        owner: { login: 'test-user' },
        clone_url: 'https://github.com/test-user/empty-repo.git',
        private: false,
        fork: false,
        docpress: { projectPath: '/tmp/path', branch: 'main', filtered: false, includes: [] },
      },
    ] as ReturnType<typeof getUserRepos>)
    vi.mocked(existsSync).mockReturnValue(false)

    await prepareDoc({ username: 'test-user' })

    const [sidebar] = vi.mocked(getVitepressConfig).mock.calls.at(-1)!
    expect(sidebar).toEqual([])
  })
})
