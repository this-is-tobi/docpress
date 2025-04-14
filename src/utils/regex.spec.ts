import { fs, vol } from 'memfs'
import { describe, expect, it, vi } from 'vitest'

describe('file Path Replacements', () => {
  describe('replaceRelativePath', async () => {
    const { replaceRelativePath } = await import('./regex.js')

    it('should replace relative paths correctly', () => {
      vi.spyOn(fs, 'readFileSync')
      vi.spyOn(fs, 'writeFileSync')

      const file = 'test.md'
      const url = 'https://example.com'
      const content = '[Link](../path/to/file)'
      vol.fromJSON({ [file]: content })

      replaceRelativePath(file, url)

      expect(vi.mocked(fs).readFileSync).toHaveBeenCalledWith(file, 'utf8')
      expect(vi.mocked(fs).writeFileSync).toHaveBeenCalledWith(file, '[Link](https://example.com/path/to/file)', 'utf8')
    })

    it('should not modify content if there are no relative paths', () => {
      vi.spyOn(fs, 'readFileSync')
      vi.spyOn(fs, 'writeFileSync')

      const file = 'test.md'
      const url = 'https://example.com'
      const content = '[Link](https://google.com)'
      vol.fromJSON({ [file]: content })

      replaceRelativePath(file, url)

      expect(vi.mocked(fs).readFileSync).toHaveBeenCalledWith(file, 'utf8')
      expect(vi.mocked(fs).writeFileSync).toHaveBeenCalledWith(file, content, 'utf8')
    })
  })

  describe('replaceReadmePath', async () => {
    const { replaceReadmePath } = await import('./regex.js')

    it('should replace README paths correctly', () => {
      vi.spyOn(fs, 'readFileSync')
      vi.spyOn(fs, 'writeFileSync')

      const file = 'README.md'
      const url = 'https://example.com'
      const content = '[Link](some/path) and [Doc](docs/some/doc)'
      vol.fromJSON({ [file]: content })

      replaceReadmePath(file, url)

      expect(vi.mocked(fs).readFileSync).toHaveBeenCalledWith(file, 'utf8')
      expect(vi.mocked(fs).writeFileSync).toHaveBeenCalledWith(file, '[Link](https://example.com/some/path) and [Doc](some/doc)', 'utf8')
    })

    it('should not modify content if there are no matching paths', () => {
      vi.spyOn(fs, 'readFileSync')
      vi.spyOn(fs, 'writeFileSync')

      const file = 'README.md'
      const url = 'https://example.com'
      const content = '[Link](https://google.com) and [Section](#section)'
      vol.fromJSON({ [file]: content })

      replaceReadmePath(file, url)

      expect(vi.mocked(fs).readFileSync).toHaveBeenCalledWith(file, 'utf8')
      expect(vi.mocked(fs).writeFileSync).toHaveBeenCalledWith(file, content, 'utf8')
    })
  })
})
