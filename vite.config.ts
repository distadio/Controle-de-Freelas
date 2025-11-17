import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente do arquivo .env correspondente ao modo (development, production)
  // O terceiro parâmetro '' garante que todas as variáveis sejam carregadas, não apenas as com prefixo VITE_
  // FIX: Replaced `process.cwd()` with `'.'` to avoid TypeScript type error.
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    base: '/app/',
    // Define variáveis globais que serão substituídas no código durante o build.
    // Isso resolve o problema de `process.env` não estar disponível no navegador.
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_GOOGLE_API_KEY)
    }
  }
})
