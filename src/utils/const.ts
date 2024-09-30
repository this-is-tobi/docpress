import { resolve } from 'node:path'

export const VITEPRESS_PATH = resolve(process.cwd(), 'vitepress')

export const PROJECTS_PATH = resolve(VITEPRESS_PATH, 'projects')
export const SIDEBAR_PATH = resolve(PROJECTS_PATH, 'sidebar.json')
export const NAV_PATH = resolve(PROJECTS_PATH, 'nav.json')
export const INDEX_PATH = resolve(PROJECTS_PATH, 'index.md')
export const TEMPLATES_PATH = resolve(import.meta.dirname, '..', 'templates')
