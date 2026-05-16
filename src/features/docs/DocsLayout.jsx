import { useState, useEffect } from 'react'
import { useTheme } from '../../ThemeContext.jsx'
import { useT } from '../../i18n/translations.js'
import FaqPage from './FaqPage.jsx'
import ReleaseNotesPage from './ReleaseNotesPage.jsx'
import SupportContent from './SupportContent.jsx'

const NAV = [
  { id: 'release-notes', label: 'Release Notes', icon: '📋' },
  { id: 'faq',           label: 'FAQ',           icon: '❓' },
  { id: 'support',       label: 'Support',       icon: '💬' },
]

const PAGES = { faq: FaqPage, 'release-notes': ReleaseNotesPage, support: SupportContent }

export default function DocsLayout({ initialPage = 'faq', onClose, isAdmin = false }) {
  const { theme, toggle, mode } = useTheme()
  const { t } = useT()
  const [page,     setPage]     = useState(initialPage)
  const [editMode, setEditMode] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

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
          <span style={{ color: mutedColor, fontSize: 13 }}>{t('docs_help')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isAdmin && (
            <button onClick={() => setEditMode(e => !e)}
              style={{ background: editMode ? '#f9ca2422' : theme.overlayMd, border: `1px solid ${editMode ? '#f9ca2466' : theme.border}`, borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontSize: 12, color: editMode ? '#f9ca24' : mutedColor, fontFamily: "'Nunito',sans-serif", fontWeight: 800 }}>
              {editMode ? t('docs_edit_active') : t('docs_edit')}
            </button>
          )}
          <button onClick={toggle} style={{ background: theme.overlayMd, border: `1px solid ${theme.border}`, borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontSize: 12, color: textColor, fontFamily: "'Nunito',sans-serif", fontWeight: 700 }}>
            {mode === 'dark' ? t('docs_light_mode') : t('docs_dark_mode')}
          </button>
          {onClose && (
            <button onClick={onClose} style={{ background: theme.overlayMd, border: `1px solid ${theme.border}`, color: mutedColor, width: 32, height: 32, borderRadius: '50%', fontSize: 16, cursor: 'pointer', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          )}
        </div>
      </div>

      {/* ── Onglets mobile (sous le header) ── */}
      {isMobile && (
        <div style={{ display: 'flex', background: topBg, borderBottom: `1px solid ${theme.border}`, padding: '6px 12px', gap: 6, flexShrink: 0 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => navigate(n.id)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              background: page === n.id ? `${theme.gold}22` : theme.overlayMd,
              border: `1px solid ${page === n.id ? theme.gold : theme.border}`,
              color: page === n.id ? (mode === 'light' ? '#c0880a' : theme.gold) : textColor,
              padding: '7px 4px', borderRadius: 8, cursor: 'pointer',
              fontFamily: "'Nunito',sans-serif", fontWeight: page === n.id ? 900 : 600,
              fontSize: 12,
            }}>
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Sidebar desktop uniquement */}
        {!isMobile && (
          <div style={{ width: 200, flexShrink: 0, background: sidebarBg, borderRight: `1px solid ${theme.border}`, padding: '20px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 10, color: mutedColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 10, marginBottom: 8 }}>{t('docs_sidebar_title')}</div>
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
            <div style={{ marginTop: 'auto', paddingTop: 20 }}>
              {onClose && (
                <button onClick={onClose} style={{ width: '100%', background: 'none', border: `1px solid ${theme.border}`, color: mutedColor, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {t('docs_back')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Contenu */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <PageComponent theme={theme} mode={mode} textColor={textColor} mutedColor={mutedColor} isAdmin={isAdmin} editMode={editMode} />
        </div>
      </div>
    </div>
  )
}
