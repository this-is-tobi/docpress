import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const externalRegex = /^node:|^[^./]+(?:\/|$)/

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    lib: {
      entry: './src/cli.ts',
      name: 'docpress',
      formats: ['es'],
    },
    rolldownOptions: {
      output: {
        entryFileNames: 'cli.js',
        chunkFileNames: 'chunk-[hash].js',
      },
      external: id => externalRegex.test(id),
    },
    target: 'esnext',
    minify: true,
    reportCompressedSize: true,
    sourcemap: true,
  },
})
