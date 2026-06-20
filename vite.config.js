import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

function getCommitSha() {
  try { return execSync('git rev-parse --short HEAD').toString().trim() }
  catch { return 'unknown' }
}

const COMMIT_SHA = getCommitSha()

// Émet /version.json (= SHA du build) à la racine du build : la SPA le sonde pour
// détecter qu'un nouveau déploiement est en ligne et inviter à rafraîchir.
function emitVersionJson() {
  return {
    name: 'emit-version-json',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: COMMIT_SHA }) })
    },
  }
}

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
  plugins: [react(), spaFallback(), emitVersionJson()],
  define: { __COMMIT_SHA__: JSON.stringify(COMMIT_SHA) },
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
