import type { defineConfig } from 'vitepress'
import { deepMerge } from '../utils/functions.js'
import type { Page, SidebarProject } from './prepare.js'

const defaultVitepressConfig: ReturnType<typeof defineConfig> = {
  base: '/',
  lang: 'en-US',
  vite: {
    publicDir: '../public',
  },
  title: 'Home',
  description: 'Docpress',
  srcDir: './docs',
  cleanUrls: true,
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

export function getVitepressConfig(sidebar: SidebarProject[], nav: Page[], vitepressConfig?: ReturnType<typeof defineConfig>): Partial<ReturnType<typeof defineConfig>> {
  const mergedConfig = deepMerge(defaultVitepressConfig, vitepressConfig ?? {})

  return {
    ...mergedConfig,
    themeConfig: {
      ...mergedConfig.themeConfig,
      sidebar,
      nav,
    },
  }
}
