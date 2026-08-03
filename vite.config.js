import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import { seoHead } from './src/seo/head.js'
import { seoCopy } from './src/seo/copy.js'
import { organizationLd, websiteLd, videoGameLd } from './src/seo/jsonld.js'
import { DEFAULT_LANG } from './src/seo/site.js'

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

// Remplace le marqueur <!--seo--> d'index.html par le bloc <head> SEO complet.
// Le passer par src/seo/ plutôt que de le figer dans index.html garantit que la
// coquille de l'application et les pages publiques partagent la même source.
function injectSeo() {
  return {
    name: 'inject-seo',
    transformIndexHtml(html) {
      const { title, description } = seoCopy('home', DEFAULT_LANG)
      const head = seoHead({
        lang: DEFAULT_LANG,
        path: '/',
        title,
        description,
        jsonLd: [organizationLd(), websiteLd(), videoGameLd({ description, lang: DEFAULT_LANG })],
      })
      // Bornes conservées dans le HTML : scripts/prerender.mjs remplace ce bloc
      // par les métadonnées propres à chaque page publique.
      return html.replace('<!--seo-->', `<!--seo:start-->\n    ${head}\n    <!--seo:end-->`)
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
  plugins: [react(), injectSeo(), spaFallback(), emitVersionJson()],
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
