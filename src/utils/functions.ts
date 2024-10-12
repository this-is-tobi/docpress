import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import axios from 'axios'
import type { EnhancedRepository } from '../lib/fetch.js'
import type { getInfos } from '../lib/git.js'
import { USER_INFOS, USER_REPOS_INFOS } from './const.js'

export async function checkHttpStatus(url: string): Promise<number> {
  try {
    const response = await axios.head(url)
    return response.status
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return error.response.status
    }
    return 500
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

  return u
}

export function createDir(directory: string, { clean }: { clean?: boolean } = { clean: false }) {
  try {
    if (existsSync(directory) && clean) {
      rmSync(directory, { recursive: true })
    }
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true })
    }
  } catch (err) {
    console.error(err)
  }
}

export function isDir(path: string) {
  return statSync(path).isDirectory()
}

export function isFile(path: string) {
  return statSync(path).isFile()
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
      return cur
    } else if (idx === arr.length - 1) {
      return `${JSON.stringify(acc)} or ${JSON.stringify(cur)}`
    } else {
      return `${JSON.stringify(acc)}, ${JSON.stringify(cur)}`
    }
  }, '')
}

export function getUserInfos() {
  return JSON.parse(readFileSync(USER_INFOS).toString()) as Awaited<ReturnType<typeof getInfos>>['user']
}

export function getUserRepos() {
  return JSON.parse(readFileSync(USER_REPOS_INFOS).toString()) as EnhancedRepository[]
}

export function deepMerge<T extends Record<string, any>>(...objects: T[]): T {
  return objects.reduce((acc, obj) => {
    Object.keys(obj).forEach((key) => {
      const accValue = acc[key]
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
