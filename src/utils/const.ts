import { resolve } from 'node:path'

export const DOCPRESS_DIR = resolve(process.cwd(), 'docpress')

export const USER_REPOS_INFOS = resolve(process.cwd(), 'docpress/repositories.json')

export const USER_INFOS = resolve(process.cwd(), 'docpress/owner.json')

export const DOCS_DIR = resolve(process.cwd(), 'docpress/docs')

export const INDEX_FILE = resolve(process.cwd(), 'docpress/docs/index.md')

export const FORKS_FILE = resolve(process.cwd(), 'docpress/docs/forks.md')

export const VITEPRESS_CONFIG = resolve(process.cwd(), 'docpress/.vitepress/config.ts')

export const VITEPRESS_THEME = resolve(process.cwd(), 'docpress/.vitepress/theme')

export const VITEPRESS_USER_THEME = resolve(process.cwd(), 'docpress/.vitepress/theme/extras')

export const TEMPLATE_THEME = resolve(import.meta.dirname, '../templates/theme')
