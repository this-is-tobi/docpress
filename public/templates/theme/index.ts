import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import ForkPage from './layouts/ForkPage.vue'

import.meta.glob('./**/*.css', { eager: true })

const userFiles = import.meta.glob('./extras/**/*', { eager: true })
const processedFiles = new Set<string>()

export default {
  enhanceApp({ app }) {
    Object.entries(userFiles).forEach(([path, file]) => {
      if (!processedFiles.has(path)) {
        processedFiles.add(path)
        if (path.endsWith('.vue')) {
          const componentName = path.replace(/^.*[\\/]/, '').replace('.vue', '')
          app.component(componentName, (file as { default: any }).default)
        }
      }
    })
    app.component('fork-page', ForkPage)
  },
  extends: DefaultTheme,
} satisfies Theme
