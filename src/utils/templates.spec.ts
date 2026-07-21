import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createDir } from './functions.js'
import { generateFile } from './templates.js'

vi.mock('node:fs')
vi.mock('./functions.js', () => ({
  createDir: vi.fn(),
}))

describe('generateFile', () => {
  it('should read the source, create the destination directory and write the content', () => {
    vi.mocked(readFileSync).mockReturnValue('template content')

    generateFile('/src/theme/index.ts', '/dest/theme/index.ts')

    expect(readFileSync).toHaveBeenCalledWith('/src/theme/index.ts', { encoding: 'utf8' })
    // The parent directory of the destination is created before writing
    expect(createDir).toHaveBeenCalledWith('/dest/theme')
    expect(writeFileSync).toHaveBeenCalledWith('/dest/theme/index.ts', 'template content')
  })
})
