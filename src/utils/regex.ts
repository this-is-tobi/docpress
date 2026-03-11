export const relativePathRegex = /\[([^\]]+)\]\(\.\.\/([^)]+)\)/g
export const readmePathRegex = /\[([^\]]+)\]\((?!\.?\/docs\/|docs\/|http|#)(\.\/)?([^/][^)]+)\)/g
export const readmeDocsPathRegex = /\[([^\]]+)\]\((\.?\/docs\/|docs\/)([^)]*)\)/g
export const removeIdxRegex = /^\d{2}-/
