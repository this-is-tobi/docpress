import { basename, parse, resolve } from 'node:path'
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { findMarkdownFiles, prettifyName } from '~/utils/functions.js'
import { NAV_PATH, PROJECTS_PATH } from '~/utils/const.js'

export function generateExtraPages(paths: string[]) {
  const files = findMarkdownFiles(paths)
  let nav: Record<string, string>[]

  if (existsSync(NAV_PATH)) {
    nav = JSON.parse(readFileSync(NAV_PATH).toString())
  } else {
    nav = []
  }

  files.forEach((file) => {
    const src = resolve(process.cwd(), file)
    const dest = resolve(PROJECTS_PATH, basename(file))
    cpSync(src, dest)
    nav.push({ text: prettifyName(parse(src).name), link: `/${parse(src).name}` })
  })

  writeFileSync(NAV_PATH, JSON.stringify(nav))
  return nav
}
