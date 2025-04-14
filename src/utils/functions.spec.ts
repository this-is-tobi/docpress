import { resolve } from 'node:path'
import { fs, vol } from 'memfs'
import { describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { rimrafSync } from 'rimraf'

vi.mock('axios')
vi.mock('rimraf')

describe('checkHttpStatus', async () => {
  const { checkHttpStatus } = await import('./functions.js')

  const testUrl = 'http://example.com'

  it('should return the status code on a successful request', async () => {
    vi.spyOn(axios, 'head').mockResolvedValue({ status: 200 })

    const status = await checkHttpStatus(testUrl)

    expect(status).toBe(200)
  })

  it('should return the status code on an error response', async () => {
    vi.spyOn(axios, 'head').mockRejectedValue({ response: { status: 404 } })

    const status = await checkHttpStatus(testUrl)

    expect(status).toBe(404)
  })

  it('should return 500 when there is no response from the server', async () => {
    vi.spyOn(axios, 'head').mockRejectedValue({ response: undefined })

    const status = await checkHttpStatus(testUrl)

    expect(status).toBe(500)
  })
})

describe('prettify', async () => {
  const { prettify } = await import('./functions.js')

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
})

describe('createDir', async () => {
  const { createDir } = await import('./functions.js')

  const testDir = '/path/to/testDir'

  it('should create the directory if it does not exist', () => {
    vi.spyOn(fs, 'mkdirSync')

    createDir(testDir)

    expect(vi.mocked(fs).mkdirSync).toHaveBeenCalledWith(testDir, { recursive: true })
  })

  it('should not recreate the directory if it already exists and clean is false', () => {
    vi.spyOn(fs, 'mkdirSync')
    vol.fromJSON({ [testDir]: '' })

    createDir(testDir, { clean: false })

    expect(rimrafSync).not.toHaveBeenCalled()
    expect(vi.mocked(fs).mkdirSync).not.toHaveBeenCalled()
  })

  it('should clean the directory if it exists and clean is true', () => {
    vi.spyOn(fs, 'mkdirSync')
    vol.fromJSON({ [testDir]: '' })

    createDir(testDir, { clean: true })

    expect(vi.mocked(fs).mkdirSync).not.toHaveBeenCalled()
    expect(rimrafSync).toHaveBeenCalledWith(`${testDir}/*`, { glob: true })
  })

  it('should log an error if an exception is thrown', () => {
    vi.spyOn(fs, 'existsSync').mockImplementationOnce(() => { throw new Error('Mocked error') })
    vi.spyOn(console, 'error').mockImplementationOnce(vi.fn())

    createDir(testDir)

    expect(vi.mocked(console).error).toHaveBeenCalledWith(expect.any(Error))
  })
})

describe('isDir', async () => {
  const { isDir } = await import('./functions.js')

  it('should return true if the path is a directory', () => {
    vol.fromJSON({ '/some/directory/file.txt': '' })

    const result = isDir('/some/directory')
    expect(result).toBe(true)
  })

  it('should return false if the path is not a directory', () => {
    vol.fromJSON({ '/some/file.txt': '' })

    const result = isDir('/some/file.txt')
    expect(result).toBe(false)
  })
})

describe('isFile', async () => {
  const { isFile } = await import('./functions.js')

  it('should return true if the path is a file', () => {
    vol.fromJSON({ '/some/file.txt': '' })

    const result = isFile('/some/file.txt')

    expect(result).toBe(true)
  })

  it('should return false if the path is not a file', () => {
    vol.fromJSON({ '/some/directory/file.txt': '' })

    const result = isFile('/some/directory')

    expect(result).toBe(false)
  })
})

describe('extractFiles', async () => {
  const { extractFiles } = await import('./functions.js')

  it('should return an array containing a single file path if the path is a file', () => {
    vol.fromJSON({ '/path/to/file.txt': '' })

    const result = extractFiles('/path/to/file.txt')

    expect(result).toEqual(['/path/to/file.txt'])
  })

  it('should return an array of all files in a directory recursively', () => {
    vol.fromJSON({
      '/path/to/dir/file1.txt': '',
      '/path/to/dir/subdir/file2.txt': '',
      '/path/to/dir/subdir/file3.txt': '',
    })

    const result = extractFiles('/path/to/dir')

    expect(result).toEqual([
      '/path/to/dir/file1.txt',
      '/path/to/dir/subdir/file2.txt',
      '/path/to/dir/subdir/file3.txt',
    ])
  })

  it('should return an array containing multiple file paths if multiple paths are provided', () => {
    vol.fromJSON({
      '/path/to/file1.txt': '',
      '/path/to/file2.txt': '',
    })

    const result = extractFiles(['/path/to/file1.txt', '/path/to/file2.txt'])

    expect(result).toEqual(['/path/to/file1.txt', '/path/to/file2.txt'])
  })

  it('should return an empty array if no files or directories are found', () => {
    const result = extractFiles('/path/to/nonexistent')

    expect(result).toEqual([])
  })
})

describe('getMdFiles', async () => {
  const { getMdFiles } = await import('./functions.js')

  it('should return only .md files from the given paths', () => {
    vol.fromJSON({
      '/path/to/file1.md': '',
      '/path/to/dir/file2.txt': '',
      '/path/to/dir/subdir/file3.md': '',
    })

    const result = getMdFiles(['/path/to/file1.md', '/path/to/dir'])

    expect(result).toEqual(['/path/to/file1.md', '/path/to/dir/subdir/file3.md'])
  })

  it('should return an empty array if no .md files are found', () => {
    const result = getMdFiles(['/path/to/dir'])

    expect(result).toEqual([])
  })

  it('should return an empty array if extractFiles returns an empty array', () => {
    const result = getMdFiles(['/path/to/nonexistent'])

    expect(result).toEqual([])
  })
})

describe('prettifyEnum', async () => {
  const { prettifyEnum } = await import('./functions.js')
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

describe('getUserInfos', async () => {
  const { getUserInfos } = await import('./functions.js')

  const mockUserInfo = {
    username: 'testUser',
    name: 'Test User',
    bio: 'This is a test user.',
  }

  it('should return parsed user information from USER_INFOS file', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValueOnce(JSON.stringify(mockUserInfo))

    const userInfo = getUserInfos('user1')
    expect(userInfo).toEqual(mockUserInfo)
  })
})

describe('getUserRepos', async () => {
  const { getUserRepos } = await import('./functions.js')

  const mockRepos = [
    { name: 'repo1', description: 'Test repo 1', stars: 5 },
    { name: 'repo2', description: 'Test repo 2', stars: 3 },
  ]

  it('should return parsed repository information from USER_REPOS_INFOS file', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValueOnce(JSON.stringify(mockRepos))

    const repos = getUserRepos('user1')

    expect(repos).toEqual(mockRepos)
  })
})

describe('deepMerge', async () => {
  const { deepMerge } = await import('./functions.js')

  it('should merge two flat objects', () => {
    interface Foo { a?: number, b: number, c?: number }
    const obj1: Foo = { a: 1, b: 2 }
    const obj2: Foo = { b: 3, c: 4 }

    const result = deepMerge(obj1, obj2)

    expect(result).toEqual({ a: 1, b: 3, c: 4 })
  })

  it('should merge nested objects', () => {
    interface Foo { a: { x?: number, y?: number }, b: number, c?: number }
    const obj1: Foo = { a: { x: 1 }, b: 2 }
    const obj2: Foo = { a: { y: 2 }, b: 3, c: 4 }

    const result = deepMerge(obj1, obj2)

    expect(result).toEqual({ a: { x: 1, y: 2 }, b: 3, c: 4 })
  })

  it('should handle null values correctly', () => {
    interface Foo { a: { x?: number, y?: number }, b: number | null, c?: number }
    const obj1: Foo = { a: { x: 1 }, b: null }
    const obj2: Foo = { a: { y: 2 }, b: 3, c: 4 }

    const result = deepMerge(obj1, obj2)

    expect(result).toEqual({ a: { x: 1, y: 2 }, b: 3, c: 4 })
  })

  it('should handle multiple objects', () => {
    interface Foo { a?: number, b?: { c?: number, d?: number }, e?: number }
    const obj1: Foo = { a: 1 }
    const obj2: Foo = { b: { c: 2 } }
    const obj3: Foo = { b: { d: 3 }, e: 4 }

    const result = deepMerge(obj1, obj2, obj3)

    expect(result).toEqual({ a: 1, b: { c: 2, d: 3 }, e: 4 })
  })

  it('should return an empty object when no objects are provided', () => {
    const result = deepMerge()

    expect(result).toEqual({})
  })

  it('should merge arrays of objects', () => {
    interface Foo { a: number[], b: { x?: number, y?: number } }
    const obj1: Foo = { a: [1, 2], b: { x: 10 } }
    const obj2: Foo = { a: [3, 4], b: { y: 20 } }

    const result = deepMerge(obj1, obj2)

    expect(result).toEqual({ a: [3, 4], b: { x: 10, y: 20 } })
  })

  it('should merge deeply nested objects', () => {
    interface Foo { a: { b?: { c?: number, d?: number } } }
    const obj1: Foo = { a: { b: { c: 1 } } }
    const obj2: Foo = { a: { b: { d: 2 } } }

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
    interface Foo { a: { x?: number, y?: number }, b?: number, c?: number }
    const obj1: Foo = { a: { x: 1 }, b: 2 }
    const obj2: Foo = { a: { y: 2 }, c: 3 }

    const result = deepMerge(
      obj1,
      null,
      obj2,
    )

    expect(result).toEqual({ a: { x: 1, y: 2 }, b: 2, c: 3 })
  })
})

describe('isObject', async () => {
  const { isObject } = await import('./functions.js')

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

describe('loadConfigFile', async () => {
  const { loadConfigFile } = await import('./functions.js')

  const mockConfigContent = { key: 'value' }
  const mockPath = './config.json'

  it('should return an empty object if configPath is undefined', () => {
    expect(loadConfigFile()).toEqual({})
  })

  it('should return parsed config object if file exists', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementationOnce(() => JSON.stringify(mockConfigContent))

    const result = loadConfigFile(mockPath)

    expect(result).toEqual(mockConfigContent)
    expect(vi.mocked(fs).readFileSync).toHaveBeenCalledWith(resolve(process.cwd(), mockPath), 'utf8')
  })

  it('should return an empty object if file does not exist or JSON parsing fails', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementationOnce(() => { throw new Error('File not found') })

    const result = loadConfigFile(mockPath)

    expect(result).toEqual({})
  })
})

describe('splitByComma', async () => {
  const { splitByComma } = await import('./functions.js')

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
