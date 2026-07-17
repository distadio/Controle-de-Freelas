import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'politica-privacidade.html', 'termos-servico.html'],
      manifest: {
        name: 'Controle de Freelas',
        short_name: 'Freelas',
        description: 'Sua vida de freelancer, organizada: agenda, pagamentos e MEI.',
        lang: 'pt-BR',
        start_url: '/app/',
        scope: '/app/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#764ba2',
        theme_color: '#7c3aed',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        navigateFallback: '/app/index.html',
        // As APIs do Google precisam de rede; nunca servir do cache.
        navigateFallbackDenylist: [/^\/app\/politica-privacidade/, /^\/app\/termos-servico/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(apis|accounts)\.google\.com\/.*/,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
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
