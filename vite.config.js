import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Plugin pour SPA fallback en dev (toutes les routes → index.html)
function spaFallback() {
  return {
    name: 'spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url.split('?')[0]
        const isAsset  = url.includes('.')          // fichiers avec extension
        const isVite   = url.startsWith('/@')       // modules Vite internes
        const isNode   = url.startsWith('/node_modules')
        const isRoot   = url === '/'
        if (!isAsset && !isVite && !isNode && !isRoot) {
          req.url = '/'
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), spaFallback()],
  server: { port: 5173, open: true },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
})
