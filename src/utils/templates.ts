import { readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createDir } from './functions.js'

/**
 * Generates a file by copying content from source to destination
 *
 * @param src - Path to the source file
 * @param dest - Path to the destination file
 */
export function generateFile(src: string, dest: string) {
  const content = readFileSync(src, { encoding: 'utf8' })
  createDir(dirname(dest))
  writeFileSync(dest, content)
}
