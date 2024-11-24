import { readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createDir } from '../utils/functions.js'

export function generateFile(src: string, dest: string) {
  const content = readFileSync(src, { encoding: 'utf8' })
  createDir(dirname(dest))
  writeFileSync(dest, content)
}
