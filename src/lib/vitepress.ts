import type { DefaultTheme, defineConfig } from 'vitepress'
import { deepMerge } from '../utils/functions.js'
import type { Page } from './prepare.js'

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
            noResultsText: 'No results for',
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
 * Generates VitePress configuration by merging default and custom configs. Navigation
 * entries set in the custom config are kept, ahead of the generated ones
 *
 * @param sidebar - Sidebar configuration, either one flat list or one sidebar per route
 * @param nav - Navigation configuration
 * @param vitepressConfig - Optional custom VitePress configuration
 * @returns Merged VitePress configuration
 */
export function getVitepressConfig(sidebar: DefaultTheme.Sidebar, nav: Page[], vitepressConfig?: ReturnType<typeof defineConfig>): Partial<ReturnType<typeof defineConfig>> {
  const generated = { themeConfig: { sidebar, nav: [...(vitepressConfig?.themeConfig?.nav ?? []), ...nav] } }
  return vitepressConfig
    ? deepMerge(defaultVitepressConfig, vitepressConfig, generated)
    : deepMerge(defaultVitepressConfig, generated)
}
