import { resolve } from 'node:path'

export const VITEPRESS_PATH = resolve(process.cwd(), 'vitepress')
export const USER_REPOS_PATH = resolve(VITEPRESS_PATH, 'repositories.json')
export const USER_INFOS_PATH = resolve(VITEPRESS_PATH, 'owner.json')
export const PUBLIC_PATH = resolve(VITEPRESS_PATH, 'projects')
export const PROJECTS_PATH = resolve(VITEPRESS_PATH, 'projects')
export const INDEX_PATH = resolve(PROJECTS_PATH, 'index.md')
export const VITEPRESS_CONFIG_PATH = resolve(VITEPRESS_PATH, '.vitepress/config.ts')
