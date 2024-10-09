import { resolve } from 'node:path'

export const DOCPRESS_DIR = resolve(process.cwd(), 'docpress')

export const USER_REPOS_INFOS = resolve(DOCPRESS_DIR, 'repositories.json')

export const USER_INFOS = resolve(DOCPRESS_DIR, 'owner.json')

export const DOCS_DIR = resolve(DOCPRESS_DIR, 'docs')

export const INDEX_PATH = resolve(DOCS_DIR, 'index.md')

export const VITEPRESS_CONFIG = resolve(DOCPRESS_DIR, '.vitepress/config.ts')
