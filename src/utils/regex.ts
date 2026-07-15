export const relativePathRegex = /\[([^\]]+)\]\(\.\.\/([^)]+)\)/g
export const readmePathRegex = /\[([^\]]+)\]\((?!\.?\/docs\/|docs\/|http|#)(\.\/)?([^/][^)]+)\)/g
export const readmeDocsPathRegex = /\[([^\]]+)\]\((\.?\/docs\/|docs\/)([^)]*)\)/g
export const removeIdxRegex = /^\d{2}-/
export const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/
