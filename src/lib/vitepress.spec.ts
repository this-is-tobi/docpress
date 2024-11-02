import { describe, expect, it } from 'vitest'
import type { defineConfig } from 'vitepress'
import { getVitepressConfig } from './vitepress.js'

describe('getVitepressConfig', () => {
  // const defaultSidebar = [{ title: 'Project 1', link: '/project1' }]
  const defaultSidebar = [{ text: 'Project 1', collapsed: true, items: [] }]
  const defaultNav = [{ text: 'Home', link: '/' }]
  const defaultConfig = {
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
  } as ReturnType<typeof defineConfig>

  it('should return the default configuration if no vitepressConfig is provided', () => {
    const result = getVitepressConfig(defaultSidebar, defaultNav)
    expect(result.base).toBe('/')
    expect(result.lang).toBe('en-US')
    expect(result.vite?.publicDir).toBe('../public')
    expect(result.title).toBe('Home')
    expect(result.description).toBe('Docpress')
    expect(result.themeConfig).toMatchObject(defaultConfig.themeConfig as object)
  })

  it('should merge the provided vitepressConfig with the default configuration', () => {
    const customConfig = {
      title: 'Custom Title',
      themeConfig: {
        outline: [1, 2],
      },
    } as ReturnType<typeof defineConfig>

    const result = getVitepressConfig(defaultSidebar, defaultNav, customConfig)

    expect(result.title).toBe('Custom Title')
    expect(result.themeConfig?.outline).toEqual([1, 2]) // doit utiliser la nouvelle valeur
  })

  it('should include the sidebar and nav in the returned configuration', () => {
    const result = getVitepressConfig(defaultSidebar, defaultNav)
    expect(result.themeConfig?.sidebar).toEqual(defaultSidebar)
    expect(result.themeConfig?.nav).toEqual(defaultNav)
  })

  it('should retain default configuration for properties not in the vitepressConfig parameter', () => {
    const partialConfig = { lang: 'fr' }
    const result = getVitepressConfig(defaultSidebar, defaultNav, partialConfig)

    expect(result.lang).toBe('fr')
    expect(result.base).toBe('/') // valeur par défaut
    expect(result.themeConfig).toMatchObject(defaultConfig.themeConfig as object)
  })

  it('should not overwrite default themeConfig if not provided in vitepressConfig', () => {
    const customConfig = { title: 'Another Title' }
    const result = getVitepressConfig(defaultSidebar, defaultNav, customConfig)

    expect(result.title).toBe('Another Title')
    expect(result.themeConfig?.search).toBeDefined()
    expect(result.themeConfig?.outline).toEqual([2, 3])
  })
})
