import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    lib: {
      entry: './src/cli.ts',
      name: 'docpress',
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        entryFileNames: 'cli.js',
        chunkFileNames: 'chunk-[hash].js',
      },
      external: id => /^node:|^[^./]+(?:\/|$)/.test(id),
    },
    target: 'esnext',
    minify: true,
    reportCompressedSize: true,
    sourcemap: true,
  },
})
