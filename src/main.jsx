import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './ThemeContext.jsx'
import UpdateBanner from './components/UpdateBanner.jsx'

// ─── Parrainage : capter ?ref=<code> et le mémoriser jusqu'à la connexion ─────
// Réclamé après authentification (useGameState). On nettoie l'URL pour éviter
// de re-capter au rechargement et garder un lien propre.
try {
  const params = new URLSearchParams(window.location.search)
  const ref = params.get('ref')
  if (ref) {
    localStorage.setItem('geocoins_ref', ref.trim().toUpperCase().slice(0, 16))
    params.delete('ref')
    const qs = params.toString()
    window.history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash)
  }
} catch { /* ignore */ }

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <App />
    <UpdateBanner />
  </ThemeProvider>
)
