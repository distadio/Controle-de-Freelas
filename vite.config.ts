import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente do arquivo .env correspondente ao modo
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    base: '/app/',
    // Garante que o CSS seja processado corretamente
    css: {
      postcss: './postcss.config.js',
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_GOOGLE_API_KEY)
    }
  }
})