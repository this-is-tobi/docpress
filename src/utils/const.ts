import { resolve } from 'node:path'

/**
 * Main directory for DocPress files
 */
export const DOCPRESS_DIR = resolve(process.cwd(), 'docpress')

/**
 * Path to repositories information JSON file
 */
export const USER_REPOS_INFOS = resolve(process.cwd(), 'docpress/repositories.json')

/**
 * Path to user information JSON file
 */
export const USER_INFOS = resolve(process.cwd(), 'docpress/owner.json')

/**
 * Directory for documentation files
 */
export const DOCS_DIR = resolve(process.cwd(), 'docpress/docs')

/**
 * Path to the main index file
 */
export const INDEX_FILE = resolve(process.cwd(), 'docpress/docs/index.md')

/**
 * Path to the forks documentation file
 */
export const FORKS_FILE = resolve(process.cwd(), 'docpress/docs/forks.md')

/**
 * Path to VitePress configuration file
 */
export const VITEPRESS_CONFIG = resolve(process.cwd(), 'docpress/.vitepress/config.ts')

/**
 * Directory for VitePress theme
 */
export const VITEPRESS_THEME = resolve(process.cwd(), 'docpress/.vitepress/theme')

/**
 * Directory for user custom theme files
 */
export const VITEPRESS_USER_THEME = resolve(process.cwd(), 'docpress/.vitepress/theme/extras')

/**
 * Path to template theme files
 */
// eslint-disable-next-line dot-notation
export const TEMPLATE_THEME = process.env['NODE_ENV'] === 'development'
  ? resolve(import.meta.dirname, '../../public/templates/theme')
  : resolve(import.meta.dirname, './templates/theme')
