/// <reference types="vitest" />
import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

export default defineConfig({
  ...viteConfig,
  test: {
    ...viteConfig.test,
    environment: 'node',
    testTimeout: 2000,
    watch: false,
    globals: true,
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*'],
      exclude: [
        ...configDefaults.exclude,
        '**/*.spec.ts',
        '**/*.d.ts',
        '**/types.ts',
        'src/templates/**/*',
      ],
      // Guard against silent coverage regressions; set below current levels to
      // leave headroom for minor fluctuations without being brittle
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 85,
        lines: 90,
      },
    },
    onConsoleLog: () => false,
    include: ['src/**/*.spec.ts'],
    exclude: [...configDefaults.exclude],
    root: fileURLToPath(new URL('./', import.meta.url)),
  },
})
