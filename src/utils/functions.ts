import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import axios from 'axios'
import { rimrafSync } from 'rimraf'
import type { GlobalOpts } from '../schemas/global.js'
import type { EnhancedRepository } from '../lib/fetch.js'
import type { getInfos } from '../lib/git.js'
import { DOCPRESS_DIR } from './const.js'

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
}

export async function checkHttpStatus(url: string): Promise<number> {
  try {
    const response = await axios.head(url)
    return response.status
  } catch (error) {
    return error.response?.status || error.status || 500
  }
}

interface PrettifyOpts {
  mode?: 'capitalize' | 'uppercase' | 'lowercase'
  replaceDash?: boolean
  removeIdx?: boolean
  removeDot?: boolean
}

export function prettify(s: string, opts: PrettifyOpts) {
  let u: string = ''

  if (!s) {
    s = ''
  }

  if (s.startsWith('.') && opts?.removeDot) {
    u = s.slice(1)
  }

  if (opts?.removeIdx) {
    u = s.replace(/^\d{2}-/, '')
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

export function isDir(path: string) {
  try {
    return statSync(path).isDirectory()
  } catch (_error) {
    return false
  }
}

export function isFile(path: string) {
  try {
    return statSync(path).isFile()
  } catch (_error) {
    return false
  }
}

export function extractFiles(paths: string[] | string): string[] {
  return (Array.isArray(paths) ? paths : [paths]).flatMap((path) => {
    if (isFile(path)) {
      console.log('file : ', path)
      return [path]
    }
    if (isDir(path)) {
      return readdirSync(path).flatMap(file => extractFiles(join(path, file)))
    }
    return []
  })
}

export function getMdFiles(path: string[]) {
  return extractFiles(path).filter(file => basename(file).endsWith('.md'))
}

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

export function getUserInfos(username: GlobalOpts['usernames'][number]) {
  return JSON.parse(readFileSync(`${DOCPRESS_DIR}/user-${username}.json`).toString()) as Awaited<ReturnType<typeof getInfos>>['user']
}

export function getUserRepos(username: GlobalOpts['usernames'][number]) {
  return JSON.parse(readFileSync(`${DOCPRESS_DIR}/repos-${username}.json`).toString()) as EnhancedRepository[]
}

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

export function isObject(val: any): val is object {
  return val && typeof val === 'object' && !Array.isArray(val)
}

export function loadConfigFile(configPath?: string) {
  if (!configPath) {
    return {}
  }
  try {
    const fullPath = configPath.startsWith('/')
      ? configPath
      : resolve(process.cwd(), configPath)
    const fileContents = readFileSync(fullPath, 'utf8')
    console.log(fileContents)
    return JSON.parse(fileContents)
  } catch (_error) {
    return {}
  }
}

export function splitByComma(s: string) {
  return s.split(',')
}
