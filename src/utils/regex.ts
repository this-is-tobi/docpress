import { readFileSync, writeFileSync } from 'node:fs'

export function replaceRelativePath(file: string, url: string) {
  const fileContent = readFileSync(file, 'utf8')
  const updatedContent = fileContent.replace(/\[([^\]]+)\]\(\.\.\/([^)]+)\)/g, (_match, p1, p2) => {
    return `[${p1}](${url}/${p2})`
  })
  writeFileSync(file, updatedContent, 'utf8')
}

export function replaceReadmePath(file: string, url: string) {
  const readmeContent = readFileSync(file, 'utf8')
  const updatedContent = readmeContent
    .replace(/\[([^\]]+)\]\((?!\.?\/docs\/|docs\/|http)(\.?\/)?([^/][^)]+)\)/g, (_match, p1, _p2, p3) => {
      return `[${p1}](${url}/${p3})`
    })
    .replace(/\[([^\]]+)\]\((\.?\/docs\/|docs\/)([^)]*)\)/g, (_match, p1, _p2, p3) => {
      return `[${p1}](${p3})`
    })
  writeFileSync(file, updatedContent, 'utf8')
}
