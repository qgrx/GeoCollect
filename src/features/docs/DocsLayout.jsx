import { useState } from 'react'
import { useTheme } from '../../ThemeContext.jsx'
import FaqPage from './FaqPage.jsx'
import ReleaseNotesPage from './ReleaseNotesPage.jsx'
import SupportContent from './SupportContent.jsx'

const NAV = [
  { id: 'faq',           label: 'FAQ',           icon: '❓' },
  { id: 'release-notes', label: 'Release Notes', icon: '📋' },
  { id: 'support',       label: 'Support',       icon: '💬' },
]

const PAGES = { faq: FaqPage, 'release-notes': ReleaseNotesPage, support: SupportContent }

export default function DocsLayout({ initialPage = 'faq', onClose }) {
  const { theme, toggle, mode } = useTheme()
  const [page, setPage] = useState(initialPage)

  const PageComponent = PAGES[page] || FaqPage

  const sidebarBg  = mode === 'light' ? '#ffffff' : '#131e2b'
  const topBg      = mode === 'light' ? '#ffffff' : '#1a2435'
  const bodyBg     = mode === 'light' ? '#f5f7fa' : '#0f1923'
  const textColor  = mode === 'light' ? '#1e2d3d' : '#d4e8f8'
  const mutedColor = mode === 'light' ? '#6b7c8d' : '#4a6070'

  function navigate(id) {
    setPage(id)
    window.history.replaceState({}, '', `/${id === 'faq' ? 'faq' : id === 'release-notes' ? 'release-notes' : 'support'}`)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2500, background: bodyBg, display: 'flex', flexDirection: 'column', fontFamily: "'Nunito',sans-serif" }}>

      {/* ── Top bar ── */}
      <div style={{ height: 54, flexShrink: 0, background: topBg, borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 18, color: theme.gold }}>🗺️ Geocoins</span>
          <span style={{ color: mutedColor, fontSize: 13 }}>— Aide</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={toggle} style={{ background: theme.overlayMd, border: `1px solid ${theme.border}`, borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontSize: 12, color: textColor, fontFamily: "'Nunito',sans-serif", fontWeight: 700 }}>
            {mode === 'dark' ? '☀️ Mode clair' : '🌙 Mode sombre'}
          </button>
          {onClose && (
            <button onClick={onClose} style={{ background: theme.overlayMd, border: `1px solid ${theme.border}`, color: mutedColor, width: 32, height: 32, borderRadius: '50%', fontSize: 16, cursor: 'pointer', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Sidebar */}
        <div style={{ width: 200, flexShrink: 0, background: sidebarBg, borderRight: `1px solid ${theme.border}`, padding: '20px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 10, color: mutedColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 10, marginBottom: 8 }}>Documentation</div>
          {NAV.map(n => (
            <button key={n.id} onClick={() => navigate(n.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              background: page === n.id ? `${theme.gold}20` : 'none',
              border: 'none',
              borderLeft: `3px solid ${page === n.id ? theme.gold : 'transparent'}`,
              color: page === n.id ? (mode === 'light' ? '#c0880a' : theme.gold) : textColor,
              padding: '10px 12px', borderRadius: '0 8px 8px 0', cursor: 'pointer',
              fontFamily: "'Nunito',sans-serif", fontWeight: page === n.id ? 900 : 600,
              fontSize: 14, textAlign: 'left', transition: 'all .15s',
            }}>
              <span style={{ fontSize: 16 }}>{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}

          {/* Retour à l'appli */}
          <div style={{ marginTop: 'auto', paddingTop: 20 }}>
            {onClose && (
              <button onClick={onClose} style={{ width: '100%', background: 'none', border: `1px solid ${theme.border}`, color: mutedColor, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                ← Retour à Geocoins
              </button>
            )}
          </div>
        </div>

        {/* Contenu */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <PageComponent theme={theme} mode={mode} textColor={textColor} mutedColor={mutedColor} />
        </div>
      </div>
    </div>
  )
}
