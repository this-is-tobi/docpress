import { resolve } from 'node:path'

export const DOCPRESS_DIR = resolve(process.cwd(), 'docpress')

export const USER_REPOS_INFOS = resolve(process.cwd(), 'docpress/repositories.json')

export const USER_INFOS = resolve(process.cwd(), 'docpress/owner.json')

export const DOCS_DIR = resolve(process.cwd(), 'docpress/docs')

export const INDEX_FILE = resolve(process.cwd(), 'docpress/docs/index.md')

export const VITEPRESS_CONFIG = resolve(process.cwd(), 'docpress/.vitepress/config.ts')
