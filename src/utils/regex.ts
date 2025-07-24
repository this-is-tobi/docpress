import { readFileSync, writeFileSync } from 'node:fs'

/**
 * Replaces relative paths in markdown links with absolute URLs
 *
 * @param file - Path to the markdown file to process
 * @param url - Base URL to use for absolute links
 */
export function replaceRelativePath(file: string, url: string) {
  const fileContent = readFileSync(file, 'utf8')
  const updatedContent = fileContent.replace(/\[([^\]]+)\]\(\.\.\/([^)]+)\)/g, (_match, p1, p2) => {
    return `[${p1}](${url}/${p2})`
  })
  writeFileSync(file, updatedContent, 'utf8')
}

/**
 * Processes README files to fix various link formats
 *
 * @param file - Path to the README file to process
 * @param url - Base URL to use for absolute links
 */
export function replaceReadmePath(file: string, url: string) {
  const readmeContent = readFileSync(file, 'utf8')
  const updatedContent = readmeContent
    .replace(/\[([^\]]+)\]\((?!\.?\/docs\/|docs\/|http|#)(\.?\/)?([^/][^)]+)\)/g, (_match, p1, _p2, p3) => {
      return `[${p1}](${url}/${p3})`
    })
    .replace(/\[([^\]]+)\]\((\.?\/docs\/|docs\/)([^)]*)\)/g, (_match, p1, _p2, p3) => {
      return `[${p1}](${p3})`
    })
  writeFileSync(file, updatedContent, 'utf8')
}
