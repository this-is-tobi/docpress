import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import axios from 'axios'

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

export function capitalize(s: string) {
  return (s && s[0].toUpperCase() + s.slice(1).toLowerCase()) || ''
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

export function findMarkdownFiles(dir: string) {
  const markdownFiles: string[] = []

  readdirSync(dir).forEach((file) => {
    const filePath = join(dir, file)
    const stat = statSync(filePath)

    if (stat.isDirectory()) {
      markdownFiles.push(...findMarkdownFiles(filePath))
    } else if (stat.isFile() && file.endsWith('.md')) {
      markdownFiles.push(filePath)
    }
  })
  return markdownFiles
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

export function prettifyName(s: string) {
  return capitalize(s).replace('-', ' ') || ''
}

export function renameFile(file: string) {
  const filename = basename(file).toLocaleLowerCase().replace(/^\d{2}-/, '')
  renameSync(file, resolve(dirname(file), filename))
  return filename
}
