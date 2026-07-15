import { readFileSync, writeFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { replaceInternalMdLinks, replaceReadmePath, replaceRelativePath } from './functions.js'

vi.mock('fs')

describe('file Path Replacements', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('replaceRelativePath', () => {
    it('should replace relative paths correctly', () => {
      const file = 'test.md'
      const url = 'https://example.com'
      const content = '[Link](../path/to/file)'

      ;(readFileSync as any).mockReturnValue(content)

      replaceRelativePath(file, url)

      expect(readFileSync).toHaveBeenCalledWith(file, 'utf8')
      expect(writeFileSync).toHaveBeenCalledWith(file, '[Link](https://example.com/path/to/file)', 'utf8')
    })

    it('should not modify content if there are no relative paths', () => {
      const file = 'test.md'
      const url = 'https://example.com'
      const content = '[Link](https://google.com)'

      ;(readFileSync as any).mockReturnValue(content)

      replaceRelativePath(file, url)

      expect(readFileSync).toHaveBeenCalledWith(file, 'utf8')
      expect(writeFileSync).toHaveBeenCalledWith(file, content, 'utf8')
    })
  })

  describe('replaceInternalMdLinks', () => {
    it('should strip index prefixes and lowercase linked markdown filenames', () => {
      const file = 'installation.md'
      const content = 'See the [category](04-profiles.md#devops-profile) and [Guide](./05-SHELL.md).'

      ;(readFileSync as any).mockReturnValue(content)

      replaceInternalMdLinks(file)

      expect(writeFileSync).toHaveBeenCalledWith(
        file,
        'See the [category](profiles.md#devops-profile) and [Guide](./shell.md).',
        'utf8',
      )
    })

    it('should rewrite readme links to introduction', () => {
      const file = 'installation.md'
      const content = 'Back to [home](01-readme.md).'

      ;(readFileSync as any).mockReturnValue(content)

      replaceInternalMdLinks(file)

      expect(writeFileSync).toHaveBeenCalledWith(file, 'Back to [home](introduction.md).', 'utf8')
    })

    it('should preserve directory prefixes and only rename the file part', () => {
      const file = 'installation.md'
      const content = '[Nested](sub/dir/02-page.md#anchor)'

      ;(readFileSync as any).mockReturnValue(content)

      replaceInternalMdLinks(file)

      expect(writeFileSync).toHaveBeenCalledWith(file, '[Nested](sub/dir/page.md#anchor)', 'utf8')
    })

    it('should not modify external, absolute or anchor links', () => {
      const file = 'installation.md'
      const content = '[Ext](https://example.com/01-page.md) [Abs](/01-page.md) [Anchor](#section) [Mail](mailto:a@b.c)'

      ;(readFileSync as any).mockReturnValue(content)

      replaceInternalMdLinks(file)

      expect(writeFileSync).toHaveBeenCalledWith(file, content, 'utf8')
    })

    it('should not modify links to non-markdown files', () => {
      const file = 'installation.md'
      const content = '[Script](scripts/01-setup.sh) ![Image](./assets/01-diagram.png)'

      ;(readFileSync as any).mockReturnValue(content)

      replaceInternalMdLinks(file)

      expect(writeFileSync).toHaveBeenCalledWith(file, content, 'utf8')
    })
  })

  describe('replaceReadmePath', () => {
    it('should replace README paths correctly', () => {
      const file = 'README.md'
      const url = 'https://example.com'
      const content = '[Link](some/path) and [Doc](docs/some/doc)'

      ;(readFileSync as any).mockReturnValue(content)

      replaceReadmePath(file, url)

      expect(readFileSync).toHaveBeenCalledWith(file, 'utf8')
      expect(writeFileSync).toHaveBeenCalledWith(file, '[Link](https://example.com/some/path) and [Doc](some/doc)', 'utf8')
    })

    it('should not modify content if there are no matching paths', () => {
      const file = 'README.md'
      const url = 'https://example.com'
      const content = '[Link](https://google.com) and [Section](#section)'

      ;(readFileSync as any).mockReturnValue(content)

      replaceReadmePath(file, url)

      expect(readFileSync).toHaveBeenCalledWith(file, 'utf8')
      expect(writeFileSync).toHaveBeenCalledWith(file, content, 'utf8')
    })
  })
})
