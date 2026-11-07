import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import ForkPage from './layouts/ForkPage.vue'
import './styles.js'

// Stylesheets are left to ./styles: hoisted along with this glob, they would load before
// the default theme and lose to it
const userFiles = import.meta.glob(['./extras/**/*', '!./extras/**/*.css'], { eager: true })
const processedFiles = new Set<string>()
const vuePathPrefixRegex = /^.*[\\/]/

export default {
  enhanceApp({ app }) {
    Object.entries(userFiles).forEach(([path, file]) => {
      if (!processedFiles.has(path)) {
        processedFiles.add(path)
        if (path.endsWith('.vue')) {
          const componentName = path.replace(vuePathPrefixRegex, '').replace('.vue', '')
          app.component(componentName, (file as { default: any }).default)
        }
      }
    })
    app.component('fork-page', ForkPage)
  },
  extends: DefaultTheme,
} satisfies Theme
