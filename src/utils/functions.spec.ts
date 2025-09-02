import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { rimrafSync } from 'rimraf'
import { checkHttpStatus, createDir, deepMerge, extractFiles, getMdFiles, getUserInfos, getUserRepos, isDir, isFile, isObject, loadConfigFile, prettify, prettifyEnum, splitByComma } from './functions.js'

vi.mock('axios')
vi.mock('fs')
vi.mock('rimraf')

describe('checkHttpStatus', () => {
  const testUrl = 'http://example.com'

  it('should return the status code on a successful request', async () => {
    vi.spyOn(axios, 'head').mockResolvedValue({ status: 200 })

    const status = await checkHttpStatus(testUrl)
    expect(status).toBe(200)
  })

  it('should return the status code on an error response', async () => {
    vi.spyOn(axios, 'head').mockRejectedValue({
      response: { status: 404 },
    })

    const status = await checkHttpStatus(testUrl)
    expect(status).toBe(404)
  })

  it('should return 500 when there is no response from the server', async () => {
    vi.spyOn(axios, 'head').mockRejectedValue({
      response: undefined,
    })

    const status = await checkHttpStatus(testUrl)
    expect(status).toBe(500)
  })
})

describe('prettify', () => {
  it('should capitalize the first letter and lowercase the rest', () => {
    const result = prettify('hello world', { mode: 'capitalize' })
    expect(result).toBe('Hello world')
  })

  it('should convert the string to uppercase', () => {
    const result = prettify('hello world', { mode: 'uppercase' })
    expect(result).toBe('HELLO WORLD')
  })

  it('should convert the string to lowercase', () => {
    const result = prettify('HELLO WORLD', { mode: 'lowercase' })
    expect(result).toBe('hello world')
  })

  it('should remove the index at the start of the string', () => {
    const result = prettify('01-hello world', { removeIdx: true })
    expect(result).toBe('hello world')
  })

  it('should replace dashes with spaces', () => {
    const result = prettify('hello-world', { replaceDash: true })
    expect(result).toBe('hello world')
  })

  it('should apply all options together (removeIdx, replaceDash, and mode)', () => {
    const result = prettify('01-hello-world', { removeIdx: true, replaceDash: true, mode: 'capitalize' })
    expect(result).toBe('Hello world')
  })

  it('should apply mode without affecting original string when options are false or undefined', () => {
    const result = prettify('hello-world', { mode: 'uppercase', replaceDash: false, removeIdx: false })
    expect(result).toBe('HELLO-WORLD')
  })

  it('should return the original string if no options are provided', () => {
    const result = prettify('hello world', {})
    expect(result).toBe('hello world')
  })

  it('should handle an empty string correctly', () => {
    const result = prettify('', { mode: 'capitalize' })
    expect(result).toBe('')
  })

  it('should remove the dot at the start of the string', () => {
    const result = prettify('.hello-world', { removeDot: true })
    expect(result).toBe('hello-world')
  })

  it('should replace all dots with dashes when removeDot is true', () => {
    const result = prettify('template.monorepo.ts', { removeDot: true })
    expect(result).toBe('template-monorepo-ts')
  })

  it('should handle both leading dots and internal dots', () => {
    const result = prettify('.github.workflows.test', { removeDot: true })
    expect(result).toBe('github-workflows-test')
  })
})

describe('createDir', () => {
  const testDir = '/path/to/testDir'

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should create the directory if it does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false)

    createDir(testDir)

    expect(mkdirSync).toHaveBeenCalledWith(testDir, { recursive: true })
  })

  it('should not recreate the directory if it already exists and clean is false', () => {
    vi.mocked(existsSync).mockReturnValue(true)

    createDir(testDir, { clean: false })

    expect(mkdirSync).not.toHaveBeenCalled()
    expect(rimrafSync).not.toHaveBeenCalled()
  })

  it('should clean the directory if it exists and clean is true', () => {
    vi.mocked(existsSync).mockReturnValue(true)

    createDir(testDir, { clean: true })

    expect(rimrafSync).toHaveBeenCalledWith(`${testDir}/*`, { glob: true })
    expect(mkdirSync).not.toHaveBeenCalled() // Car le répertoire existe déjà
  })

  it('should log an error if an exception is thrown', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(existsSync).mockImplementation(() => {
      throw new Error('Mocked error')
    })

    createDir(testDir)

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error))
    consoleErrorSpy.mockRestore()
  })
})

describe('isDir', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should return true if the path is a directory', () => {
    vi.mocked(statSync).mockReturnValue({
      isDirectory: () => true,
      isFile: () => false,
    } as unknown as ReturnType<typeof statSync>)

    const result = isDir('/some/directory')
    expect(result).toBe(true)
  })

  it('should return false if the path is not a directory', () => {
    vi.mocked(statSync).mockReturnValue({
      isDirectory: () => false,
      isFile: () => true,
    } as unknown as ReturnType<typeof statSync>)

    const result = isDir('/some/file')
    expect(result).toBe(false)
  })
})

describe('isFile', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should return true if the path is a file', () => {
    vi.mocked(statSync).mockReturnValue({
      isDirectory: () => false,
      isFile: () => true,
    } as unknown as ReturnType<typeof statSync>)

    const result = isFile('/some/file')
    expect(result).toBe(true)
  })

  it('should return false if the path is not a file', () => {
    vi.mocked(statSync).mockReturnValue({
      isDirectory: () => true,
      isFile: () => false,
    } as unknown as ReturnType<typeof statSync>)

    const result = isFile('/some/directory')
    expect(result).toBe(false)
  })
})

describe('extractFiles', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should return an array containing a single file path if the path is a file', () => {
    // Simule statSync pour retourner un objet avec isFile = true et isDirectory = false
    vi.mocked(statSync).mockReturnValue({
      isFile: () => true,
      isDirectory: () => false,
    } as unknown as ReturnType<typeof statSync>)

    const result = extractFiles('/path/to/file.txt')
    expect(result).toEqual(['/path/to/file.txt'])
  })

  it('should return an array of all files in a directory recursively', () => {
    vi.mocked(statSync).mockImplementation(path => ({
      isFile: () => (path as string).endsWith('.txt'),
      isDirectory: () => !(path as string).endsWith('.txt'),
    } as unknown as ReturnType<typeof statSync>))

    vi.mocked(readdirSync).mockImplementation((path) => {
      if (path === '/path/to/dir') return ['file1.txt', 'subdir'] as any
      if (path === '/path/to/dir/subdir') return ['file2.txt', 'file3.txt'] as any
      return []
    })

    const result = extractFiles('/path/to/dir')
    expect(result).toEqual([
      '/path/to/dir/file1.txt',
      '/path/to/dir/subdir/file2.txt',
      '/path/to/dir/subdir/file3.txt',
    ])
  })

  it('should return an array containing multiple file paths if multiple paths are provided', () => {
    vi.mocked(statSync).mockImplementation(path => ({
      isFile: () => (path as string).endsWith('.txt'),
      isDirectory: () => !(path as string).endsWith('.txt'),
    } as unknown as ReturnType<typeof statSync>))

    vi.mocked(readdirSync).mockImplementation(() => [])

    const result = extractFiles(['/path/to/file1.txt', '/path/to/file2.txt'])
    expect(result).toEqual(['/path/to/file1.txt', '/path/to/file2.txt'])
  })

  it('should return an empty array if no files or directories are found', () => {
    vi.mocked(statSync).mockReturnValue({
      isFile: () => false,
      isDirectory: () => false,
    } as unknown as ReturnType<typeof statSync>)

    const result = extractFiles('/path/to/nonexistent')
    expect(result).toEqual([])
  })
})

describe('getMdFiles', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should return only .md files from the given paths', () => {
    vi.mocked(statSync).mockImplementation(path => ({
      isFile: () => (path as string).endsWith('.md') || (path as string).endsWith('.txt'),
      isDirectory: () => !(path as string).endsWith('.md') && !(path as string).endsWith('.txt'),
    } as unknown as ReturnType<typeof statSync>))

    vi.mocked(readdirSync).mockImplementation((path) => {
      if (path === '/path/to/dir') return ['file1.md', 'file2.txt', 'subdir'] as any
      if (path === '/path/to/dir/subdir') return ['file3.md', 'file4.txt'] as any
      return []
    })

    const result = getMdFiles(['/path/to/dir', '/path/to/file1.md'])
    expect(result).toEqual(['/path/to/dir/file1.md', '/path/to/dir/subdir/file3.md', '/path/to/file1.md'])
  })

  it('should return an empty array if no .md files are found', () => {
    vi.mocked(statSync).mockImplementation(path => ({
      isFile: () => (path as string).endsWith('.txt'),
      isDirectory: () => !(path as string).endsWith('.txt'),
    } as unknown as ReturnType<typeof statSync>))

    vi.mocked(readdirSync).mockImplementation((path) => {
      if (path === '/path/to/dir') return ['file2.txt'] as any
      return []
    })

    const result = getMdFiles(['/path/to/dir'])
    expect(result).toEqual([])
  })

  it('should return an empty array if extractFiles returns an empty array', () => {
    vi.mocked(statSync).mockImplementation(_path => ({
      isFile: () => false,
      isDirectory: () => false,
    } as unknown as ReturnType<typeof statSync>))

    const result = getMdFiles(['/path/to/nonexistent'])
    expect(result).toEqual([])
  })
})

describe('prettifyEnum', () => {
  it('should return a single string for a single element', () => {
    const result = prettifyEnum(['apple'])
    expect(result).toEqual('"apple"')
  })

  it('should return a formatted string for two elements', () => {
    const result = prettifyEnum(['apple', 'banana'])
    expect(result).toEqual('"apple" or "banana"')
  })

  it('should return a formatted string for multiple elements', () => {
    const result = prettifyEnum(['apple', 'banana', 'cherry'])
    expect(result).toEqual('"apple", "banana" or "cherry"')
  })

  it('should handle an empty array', () => {
    const result = prettifyEnum([])
    expect(result).toEqual('')
  })

  it('should handle arrays with one empty string', () => {
    const result = prettifyEnum([''])
    expect(result).toEqual('""')
  })

  it('should handle arrays with multiple empty strings', () => {
    const result = prettifyEnum(['', ''])
    expect(result).toEqual('"" or ""')
  })
})

describe('getUserInfos', () => {
  it('should return parsed user information from USER_INFOS file', () => {
    const mockUserInfo = {
      username: 'testUser',
      name: 'Test User',
      bio: 'This is a test user.',
    }

    ;(readFileSync as any).mockReturnValue(JSON.stringify(mockUserInfo))

    const userInfo = getUserInfos('testUser')
    expect(userInfo).toEqual(mockUserInfo)
  })
})

describe('getUserRepos', () => {
  it('should return parsed repository information from USER_REPOS_INFOS file', () => {
    const mockRepos = [
      { name: 'repo1', description: 'Test repo 1', stars: 5 },
      { name: 'repo2', description: 'Test repo 2', stars: 3 },
    ]

    ;(readFileSync as any).mockReturnValue(JSON.stringify(mockRepos))

    const repos = getUserRepos('testUser')
    expect(repos).toEqual(mockRepos)
  })
})

describe('deepMerge', () => {
  it('should merge two flat objects', () => {
    const obj1 = { a: 1, b: 2 } as { a?: number, b: number }
    const obj2 = { b: 3, c: 4 }
    const result = deepMerge(obj1, obj2)
    expect(result).toEqual({ a: 1, b: 3, c: 4 })
  })

  it('should merge nested objects', () => {
    const obj1 = { a: { x: 1 }, b: 2 } as { a: { x?: number, y?: number }, b: number }
    const obj2 = { a: { y: 2 }, b: 3, c: 4 }
    const result = deepMerge(obj1, obj2)
    expect(result).toEqual({ a: { x: 1, y: 2 }, b: 3, c: 4 })
  })

  it('should handle null values correctly', () => {
    const obj1 = { a: { x: 1 }, b: null } as { a: { x?: number, y?: number }, b: number | null, c?: number }
    const obj2 = { a: { y: 2 }, b: 3, c: 4 }
    const result = deepMerge(obj1, obj2)
    expect(result).toEqual({ a: { x: 1, y: 2 }, b: 3, c: 4 })
  })

  it('should handle multiple objects', () => {
    const obj1 = { a: 1 } as { a?: number, b: { c?: number, d?: number }, e?: number }
    const obj2 = { b: { c: 2 } }
    const obj3 = { b: { d: 3 }, e: 4 }
    const result = deepMerge(obj1, obj2, obj3)
    expect(result).toEqual({ a: 1, b: { c: 2, d: 3 }, e: 4 })
  })

  it('should return an empty object when no objects are provided', () => {
    const result = deepMerge()
    expect(result).toEqual({})
  })

  it('should merge arrays of objects', () => {
    const obj1 = { a: [1, 2], b: { x: 10 } } as { a: number[], b: { x?: number, y?: number } }
    const obj2 = { a: [3, 4], b: { y: 20 } }
    const result = deepMerge(obj1, obj2)
    expect(result).toEqual({ a: [3, 4], b: { x: 10, y: 20 } })
  })

  it('should merge deeply nested objects', () => {
    const obj1 = { a: { b: { c: 1 } } } as { a: { b?: { c?: number, d?: number } } }
    const obj2 = { a: { b: { d: 2 } } }
    const result = deepMerge(obj1, obj2)
    expect(result).toEqual({ a: { b: { c: 1, d: 2 } } })
  })

  it('should handle arrays without merging them', () => {
    const obj1 = { a: [1, 2] }
    const obj2 = { a: [3, 4] }
    const result = deepMerge(obj1, obj2)
    expect(result).toEqual({ a: [3, 4] })
  })

  it('should ignore null values', () => {
    const result = deepMerge(
      { a: { x: 1 }, b: 2 },
      null,
      { a: { y: 2 }, c: 3 },
    )
    expect(result).toEqual({ a: { x: 1, y: 2 }, b: 2, c: 3 })
  })
})

describe('isObject', () => {
  it('should return true for an object', () => {
    expect(isObject({ key: 'value' })).toBe(true)
  })

  it('should return false for null', () => {
    expect(isObject(null)).oneOf([false, null])
  })

  it('should return false for an array', () => {
    expect(isObject([1, 2, 3])).toBe(false)
  })

  it('should return false for a string', () => {
    expect(isObject('string')).toBe(false)
  })

  it('should return false for a number', () => {
    expect(isObject(42)).toBe(false)
  })
})

describe('loadConfigFile', () => {
  const mockConfigContent = JSON.stringify({ key: 'value' })
  const mockPath = 'config.json'

  it('should return an empty object if configPath is undefined', () => {
    expect(loadConfigFile()).toEqual({})
  })

  it('should return parsed config object if file exists', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/mock')
    ;(readFileSync as any).mockReturnValue(mockConfigContent)

    const result = loadConfigFile(mockPath)

    expect(result).toEqual({ key: 'value' })
    expect(readFileSync).toHaveBeenCalledWith(resolve('/mock', mockPath), 'utf8')
  })

  it('should return an empty object if file does not exist or JSON parsing fails', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/mock')
    ;(readFileSync as any).mockImplementation(() => { throw new Error('File not found') })

    const result = loadConfigFile(mockPath)

    expect(result).toEqual({})
  })
})

describe('splitByComma', () => {
  it('should split a comma-separated string into an array', () => {
    expect(splitByComma('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  it('should handle empty strings by returning an array with an empty string', () => {
    expect(splitByComma('')).toEqual([''])
  })

  it('should handle strings without commas by returning a single-element array', () => {
    expect(splitByComma('single')).toEqual(['single'])
  })

  it('should handle multiple consecutive commas by returning empty elements', () => {
    expect(splitByComma('a,,b,,c')).toEqual(['a', '', 'b', '', 'c'])
  })
})
