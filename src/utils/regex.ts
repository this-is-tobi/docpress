// Markdown link whose target is a parent-relative path, e.g. `[text](../foo/bar)`
// Captures: 1) link text, 2) the path after `../`
export const relativePathRegex = /\[([^\]]+)\]\(\.\.\/([^)]+)\)/g

// Markdown link in a README pointing outside `docs/` and not an http/anchor link,
// e.g. `[text](./src/index.ts)`. Captures: 1) text, 2) optional `./`, 3) the path
export const readmePathRegex = /\[([^\]]+)\]\((?!\.?\/docs\/|docs\/|http|#)(\.\/)?([^/][^)]+)\)/g

// Markdown link in a README pointing into `docs/`, e.g. `[text](./docs/guide.md)`
// Captures: 1) text, 2) the `docs/` prefix, 3) the path within docs
export const readmeDocsPathRegex = /\[([^\]]+)\]\((\.?\/docs\/|docs\/)([^)]*)\)/g

// Leading two-digit ordering prefix stripped from file names, e.g. `01-` in `01-intro.md`
export const removeIdxRegex = /^\d{2}-/

// YAML frontmatter block at the top of a markdown file. Captures: 1) the inner YAML
export const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/

// Relative markdown-to-markdown link (not http/anchor/mailto/root), e.g. `[t](./dir/page.md#a)`
// Captures: 1) text, 2) optional directory, 3) the `.md` file, 4) optional `#anchor`
export const internalMdLinkRegex = /\[([^\]]+)\]\((?!https?:|\/|#|mailto:)([^)#]*\/)?([^)#/]+\.md)(#[^)]*)?\)/g
