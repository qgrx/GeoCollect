import Logo from './Logo.jsx'
import { useTheme } from '../ThemeContext.jsx'
import { useT, setLang, LANGS } from '../i18n/translations.js'
import { DOCS_ROUTES, LANG_CODES, buildPath, switchLangPath } from '../routes.js'

/**
 * Pied de page public — présent aussi pour les visiteurs anonymes (mode démo).
 *
 * Sa raison d'être est autant éditoriale que technique : avant lui, les pages
 * /release-notes, /faq et /support n'étaient atteignables que par le menu de
 * l'avatar, donc par aucun robot. Un sitemap seul ne compense pas l'absence de
 * lien : ce sont de VRAIS `<a href>` qui rendent ces pages découvrables, et les
 * liens de langue qui signalent l'existence des traductions.
 *
 * Le clic est intercepté pour naviguer côté client (pas de rechargement), mais le
 * `href` reste complet et suivable — un middle-clic ou un crawler l'utilisent tel quel.
 */
export default function PublicFooter({ onNavigate, hiddenPages = [] }) {
  const { theme, mode } = useTheme()
  const { t, lang } = useT()

  const muted  = mode === 'light' ? '#6b7c8d' : '#7d8fa3'
  const path   = typeof window !== 'undefined' ? window.location.pathname : '/'

  const linkStyle = {
    color: muted, textDecoration: 'none', fontSize: 12, fontWeight: 700,
    fontFamily: "'Nunito',sans-serif", padding: '2px 0', cursor: 'pointer',
  }

  function handleNavigate(e, route) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return  // ouvrir dans un onglet
    e.preventDefault()
    onNavigate?.(route)
  }

  function handleLang(e, code) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    setLang(code)
  }

  return (
    <footer
      style={{
        borderTop: `1px solid ${theme.border}`,
        padding: '22px 18px calc(22px + env(safe-area-inset-bottom))',
        marginTop: 24,
        display: 'flex', flexWrap: 'wrap', gap: 18,
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        fontFamily: "'Nunito',sans-serif",
      }}
    >
      <a
        href={buildPath('home', { lang })}
        onClick={e => handleNavigate(e, 'home')}
        style={{ ...linkStyle, display: 'flex', alignItems: 'center' }}
        aria-label="Geocoins"
      >
        <Logo iconSize={22} textSize={15} />
      </a>

      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
        {/* Une page masquée par un admin n'est plus pré-rendue : la lier enverrait
            le visiteur sur un vrai 404 au rechargement. */}
        {DOCS_ROUTES.filter(r => !hiddenPages.includes(r)).map(route => (
          <a
            key={route}
            href={buildPath(route, { lang })}
            onClick={e => handleNavigate(e, route)}
            style={linkStyle}
          >
            {t(`docs_nav_${route === 'release-notes' ? 'release' : route}`)}
          </a>
        ))}
      </nav>

      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
        {LANG_CODES.map(code => (
          <a
            key={code}
            href={switchLangPath(path, code)}
            hrefLang={code}
            onClick={e => handleLang(e, code)}
            style={{ ...linkStyle, opacity: code === lang ? 1 : 0.6, color: code === lang ? theme.gold : muted }}
          >
            {LANGS[code]}
          </a>
        ))}
      </nav>

      <div style={{ color: muted, fontSize: 11, fontWeight: 600, width: '100%' }}>
        © {new Date().getFullYear()} Geocoins
      </div>
    </footer>
  )
}
