import type { Dirent } from 'node:fs'
import { cpSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMdFiles, type getUserInfos, type getUserRepos } from '../utils/functions.js'
import {
  addContent,
  addExtraPages,
  // addSources,
  generateFeatures,
  generateIndex,
  generateSidebarPages,
  generateSidebarProject,
  generateVitepressFiles,
  parseVitepressConfig,
  transformDoc,
} from './prepare.js'

vi.mock('node:fs')
vi.mock('../utils/regex.js')
vi.mock('../utils/functions.js', async importOriginal => ({
  ...await importOriginal<typeof import('../utils/functions.js')>(),
  createDir: vi.fn(),
  extractFiles: vi.fn(paths => paths),
  getMdFiles: vi.fn(),
}))
vi.mock('../utils/const.js', () => ({
  DOCS_DIR: '/mock/docs',
  INDEX_FILE: '/mock/docs/index.md',
  VITEPRESS_CONFIG: '/mock/config.js',
}))

// describe('addSources', () => {
//   it('should append source content to a file', () => {
//     addSources('https://example.com/repo', '/mock/output/readme.md')
//     expect(appendFileSync).toHaveBeenCalledWith(
//       '/mock/output/readme.md',
//       expect.stringContaining('[project sources](https://example.com/repo)'),
//       'utf8',
//     )
//   })
// })

describe('generateIndex', () => {
  it('should return a formatted index object', () => {
    const user = { name: 'John Doe', login: 'johndoe', bio: 'Coder' } as ReturnType<typeof getUserInfos>
    const features = [{ title: 'Feature 1', details: 'Details 1', link: '/feature1' }]
    const result = generateIndex(features, user)
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
    // vi.mocked(getMdFiles).mockReturnValue(['/path/to/01-file3.md', '/path/to/file1.md', '/path/to/FILE2.md', '/path/to/readme.md'])
    // vi.mocked(readdirSync).mockReturnValue(['readme.md', 'file1.md', 'FILE2.md', '01-file3.md'] as unknown as Dirent[])
    vi.mocked(statSync).mockReturnValue({ isFile: () => true } as any)
  })

  it('should transform repositories into index and sidebar data (multi-files docs)', () => {
    vi.mocked(getMdFiles).mockReturnValue(['/path/to/01-file3.md', '/path/to/file1.md', '/path/to/FILE2.md', '/path/to/readme.md'])
    vi.mocked(readdirSync).mockReturnValue(['readme.md', 'file1.md', 'FILE2.md', '01-file3.md'] as unknown as Dirent[])

    const result = transformDoc(repositories, user)
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

    const result = transformDoc(repositories, user)
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
  it('should parse Vitepress configuration from JSON file', () => {
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ title: 'My Project' }))
    const config = parseVitepressConfig('/mock/config.json')
    expect(config).toEqual({ title: 'My Project' })
  })
})

describe('generateVitepressFiles', () => {
  it('should create Vitepress config and index files', () => {
    const vitepressConfig = { title: 'My Project' }
    const index = {
      layout: 'home',
      hero: { name: 'My Projects', tagline: 'Awesome projects' },
      features: [],
    }

    generateVitepressFiles(vitepressConfig, index)
    expect(writeFileSync).toHaveBeenCalledWith(
      '/mock/config.js',
      expect.stringContaining('export default {'),
    )
    expect(writeFileSync).toHaveBeenCalledWith(
      '/mock/docs/index.md',
      expect.stringContaining('layout: home'),
    )
  })
})
