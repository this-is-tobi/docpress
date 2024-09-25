import { defineConfig } from 'vitepress'
import sidebar from '../projects/sidebar.json' with { type: 'json' }
import nav from '../projects/nav.json' with { type: 'json' }

export default defineConfig({
  base: '/',
  lang: 'en-US',
  vite: {
    publicDir: '../public',
  },
  head: [
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' }],
    ['link', { rel: 'shortcut icon', href: '/favicon.ico' }],
    ['link', { rel: 'manifest', href: '/site.webmanifest' }],
  ],
  title: 'Home',
  description: 'Tobi\'s documentation',
  srcDir: './projects',
  cleanUrls: true,
  ignoreDeadLinks: 'localhostLinks',
  themeConfig: {
    logo: '/android-chrome-512x512.png',
    outline: [2, 3],
    sidebar,
    nav,
    socialLinks: [
      { icon: 'github', link: 'https://github.com/this-is-tobi' },
    ],
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
})
