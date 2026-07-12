import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/app/',
  css: {
    postcss: './postcss.config.js',
  },
  define: {
    'process.env.API_KEY': JSON.stringify('AIzaSyCUfUOKQWnFjqsOps7_vmd-TiGOs8jQz5U'),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    cssCodeSplit: true,
    sourcemap: false,
  }
})