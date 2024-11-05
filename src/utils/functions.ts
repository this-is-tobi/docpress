import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import axios from 'axios'
import { rimrafSync } from 'rimraf'
import type { EnhancedRepository } from '../lib/fetch.js'
import type { getInfos } from '../lib/git.js'
import { USER_INFOS, USER_REPOS_INFOS } from './const.js'

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
}

export function prettify(s: string, opts: PrettifyOpts) {
  let u: string = ''

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

export function getUserInfos() {
  return JSON.parse(readFileSync(USER_INFOS).toString()) as Awaited<ReturnType<typeof getInfos>>['user']
}

export function getUserRepos() {
  return JSON.parse(readFileSync(USER_REPOS_INFOS).toString()) as EnhancedRepository[]
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

function isObject(val: any): val is object {
  return val && typeof val === 'object' && !Array.isArray(val)
}
