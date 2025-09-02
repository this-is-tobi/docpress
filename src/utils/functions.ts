import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import axios from 'axios'
import { rimrafSync } from 'rimraf'
import type { GlobalOpts } from '../schemas/global.js'
import type { EnhancedRepository } from '../lib/fetch.js'
import type { getInfos } from '../lib/git.js'
import { DOCPRESS_DIR } from './const.js'

/**
 * Checks the HTTP status code of a URL
 *
 * @param url - URL to check
 * @returns HTTP status code (404 if not found, 500 for errors)
 */
export async function checkHttpStatus(url: string): Promise<number> {
  try {
    const response = await axios.head(url)
    return response.status
  } catch (error) {
    return error.response?.status || error.status || 500
  }
}

/**
 * Options for prettifying strings
 */
interface PrettifyOpts {
  mode?: 'capitalize' | 'uppercase' | 'lowercase'
  replaceDash?: boolean
  removeIdx?: boolean
  removeDot?: boolean
  removeExt?: boolean
}

/**
 * Formats a string based on specified options
 *
 * @param s - Input string to format
 * @param opts - Formatting options
 * @returns Formatted string
 */
export function prettify(s: string, opts: PrettifyOpts) {
  let u: string = ''

  if (opts?.removeDot) {
    if (s.startsWith('.')) {
      u = s.slice(1)
    } else {
      u = s
    }
    // Replace all remaining dots with dashes to ensure consistency
    u = u.replaceAll('.', '-')
  }

  if (opts?.removeIdx) {
    u = (u || s).replace(/^\d{2}-/, '')
  }

  if (opts?.removeExt) {
    u = (u || s).split('.')[0]
  }

  if (opts?.replaceDash) {
    u = (u || s).replaceAll('-', ' ')
  }

  if (opts?.mode === 'capitalize') {
    u = (u || s).slice(0, 1).toUpperCase() + (u || s).slice(1).toLowerCase()
  } else if (opts?.mode === 'lowercase') {
    u = (u || s).toLowerCase()
  } else if (opts?.mode === 'uppercase') {
    u = (u || s).toUpperCase()
  }

  return u || s
}

/**
 * Creates a directory, optionally cleaning it first
 *
 * @param directory - Path to the directory to create
 * @param options - Options object
 * @param options.clean - Whether to clean the directory before creating it
 */
export function createDir(directory: string, { clean }: { clean?: boolean } = { clean: false }) {
  try {
    if (clean && existsSync(directory)) {
      rimrafSync(`${directory}/*`, { glob: true })
    }
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true })
    }
  } catch (err) {
    console.error(err)
  }
}

/**
 * Checks if a path is a directory
 *
 * @param path - Path to check
 * @returns True if path is a directory, false otherwise
 */
export function isDir(path: string) {
  try {
    return statSync(path).isDirectory()
  } catch (_error) {
    return false
  }
}

/**
 * Checks if a path is a file
 *
 * @param path - Path to check
 * @returns True if path is a file, false otherwise
 */
export function isFile(path: string) {
  try {
    return statSync(path).isFile()
  } catch (_error) {
    return false
  }
}

/**
 * Extracts a list of file paths from directories and files
 *
 * @param paths - Path or array of paths to extract files from
 * @returns Array of file paths
 */
export function extractFiles(paths: string[] | string): string[] {
  return (Array.isArray(paths) ? paths : [paths]).flatMap((path) => {
    if (isFile(path)) {
      return [path]
    }
    if (isDir(path)) {
      return readdirSync(path).flatMap(file => extractFiles(join(path, file)))
    }
    return []
  })
}

/**
 * Gets all markdown files from specified paths
 *
 * @param path - Array of paths to search for markdown files
 * @returns Array of markdown file paths
 */
export function getMdFiles(path: string[]) {
  return extractFiles(path).filter(file => basename(file).endsWith('.md'))
}

/**
 * Formats an array of strings into a readable comma-separated list
 *
 * @param arr - Array of strings to format
 * @returns Formatted string (e.g., "a", "b" or "c")
 */
export function prettifyEnum(arr: readonly string[]) {
  return arr.reduce((acc, cur, idx, arr) => {
    if (!idx) {
      return `"${cur}"`
    } else if (idx === arr.length - 1) {
      return `${acc} or "${cur}"`
    } else {
      return `${acc}, "${cur}"`
    }
  }, '')
}

/**
 * Gets user information from cached JSON file
 *
 * @param username - GitHub username
 * @returns User information object
 */
export function getUserInfos(username: GlobalOpts['usernames'][number]) {
  return JSON.parse(readFileSync(`${DOCPRESS_DIR}/user-${username}.json`).toString()) as Awaited<ReturnType<typeof getInfos>>['user']
}

/**
 * Gets repository information from cached JSON file
 *
 * @param username - GitHub username
 * @returns Array of enhanced repository objects
 */
export function getUserRepos(username: GlobalOpts['usernames'][number]) {
  return JSON.parse(readFileSync(`${DOCPRESS_DIR}/repos-${username}.json`).toString()) as EnhancedRepository[]
}

/**
 * Deep merges multiple objects
 *
 * @param objects - Objects to merge
 * @returns Merged object
 */
export function deepMerge<T extends Record<string, any> | null>(...objects: T[]): T {
  return objects.reduce((acc, obj) => {
    if (obj === null) {
      return acc
    }

    Object.keys(obj).forEach((key) => {
      const accValue = acc ? acc[key] : null
      const objValue = obj[key]

      if (isObject(accValue) && isObject(objValue)) {
        (acc as Record<string, any>)[key] = deepMerge(accValue, objValue)
      } else {
        (acc as Record<string, any>)[key] = objValue
      }
    })
    return acc
  }, {} as T)
}

/**
 * Checks if a value is an object (not an array or null)
 *
 * @param val - Value to check
 * @returns True if value is an object, false otherwise
 */
export function isObject(val: any): val is object {
  return val && typeof val === 'object' && !Array.isArray(val)
}

/**
 * Loads and parses a JSON configuration file
 *
 * @param configPath - Path to the configuration file
 * @returns Parsed configuration object or empty object if file doesn't exist
 */
export function loadConfigFile(configPath?: string) {
  if (!configPath) {
    return {}
  }
  try {
    const fullPath = resolve(process.cwd(), configPath)
    const fileContents = readFileSync(fullPath, 'utf8')
    return JSON.parse(fileContents)
  } catch (_error) {
    return {}
  }
}

/**
 * Splits a comma-separated string into an array of strings
 *
 * @param s - Comma-separated string
 * @returns Array of strings
 */
export function splitByComma(s: string) {
  return s.split(',')
}
