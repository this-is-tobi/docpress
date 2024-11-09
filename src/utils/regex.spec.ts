import { readFileSync, writeFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { replaceReadmePath, replaceRelativePath } from './regex.js'

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
