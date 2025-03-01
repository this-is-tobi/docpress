/// <reference types="vitest" />
import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  optimizeDeps: {
    force: true,
    include: ['vitepress'],
  },
  test: {
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
    },
    onConsoleLog: () => false,
    include: ['src/**/*.spec.ts'],
    exclude: [...configDefaults.exclude],
    root: fileURLToPath(new URL('./', import.meta.url)),
  },
})
