import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/app/',
  css: {
    postcss: './postcss.config.js',
  },
  define: {
    'process.env.API_KEY': JSON.stringify('AIzaSyCUfUOKQWnFjqsOps7_vmd-TiGOs8jQz5U')
  },
  build: {
    cssCodeSplit: true,
    sourcemap: false,
  }
})