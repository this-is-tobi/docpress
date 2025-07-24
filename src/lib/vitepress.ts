import type { defineConfig } from 'vitepress'
import { deepMerge } from '../utils/functions.js'
import type { Page, SidebarProject } from './prepare.js'

/**
 * Default VitePress configuration
 */
const defaultVitepressConfig: ReturnType<typeof defineConfig> = {
  base: '/',
  lang: 'en-US',
  vite: {
    publicDir: '../public',
  },
  title: 'Home',
  description: 'Docpress',
  srcDir: './docs',
  cleanUrls: false,
  ignoreDeadLinks: 'localhostLinks',
  themeConfig: {
    outline: [2, 3],
    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: 'Search...',
            buttonAriaLabel: 'Search',
          },
          modal: {
            backButtonTitle: 'erase search',
            displayDetails: 'show details',
            noResultsText: 'No results for : ',
            resetButtonTitle: 'cancel search',
            footer: {
              selectText: 'go to',
              navigateText: 'navigate in results',
              closeText: 'close',
            },
          },
        },
      },
    },
  },
}

/**
 * Generates VitePress configuration by merging default and custom configs
 *
 * @param sidebar - Sidebar configuration
 * @param nav - Navigation configuration
 * @param vitepressConfig - Optional custom VitePress configuration
 * @returns Merged VitePress configuration
 */
export function getVitepressConfig(sidebar: SidebarProject[], nav: Page[], vitepressConfig?: ReturnType<typeof defineConfig>): Partial<ReturnType<typeof defineConfig>> {
  return vitepressConfig
    ? deepMerge(defaultVitepressConfig, vitepressConfig, { themeConfig: { sidebar, nav } })
    : deepMerge(defaultVitepressConfig, { themeConfig: { sidebar, nav } })
}
