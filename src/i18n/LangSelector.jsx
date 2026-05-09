import { useState, useRef, useEffect } from 'react'
import { useT, setLang, LANGS } from './translations.js'

export default function LangSelector() {
  const { lang } = useT()
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, right: 0 })
  const btnRef = useRef()
  const containerRef = useRef()

  useEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
  }, [open])

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div style={{ position: 'relative' }} ref={containerRef}>
      <button ref={btnRef}
        onClick={() => setOpen(o => !o)}
        style={{
          background: '#ffffff18', border: '1px solid #ffffff22', color: '#fff',
          padding: '6px 11px', borderRadius: 50, fontFamily: "'Nunito',sans-serif",
          fontWeight: 800, fontSize: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
        }}
      >
        {LANGS[lang]} <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
      </button>

      {open && (
        <div style={{
            position: 'fixed', top: pos.top, right: pos.right,
            background: '#1e3045', border: '1px solid #ffffff22',
            borderRadius: 12, overflow: 'hidden',
            boxShadow: '0 8px 32px #000a', zIndex: 9999, minWidth: 140,
          }}>
            {Object.entries(LANGS).map(([code, label]) => (
              <button key={code}
                onClick={() => { setLang(code); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', textAlign: 'left',
                  background: lang === code ? '#f9ca2422' : 'transparent',
                  border: 'none',
                  color: lang === code ? '#f9ca24' : '#fff',
                  padding: '10px 16px',
                  fontFamily: "'Nunito',sans-serif",
                  fontWeight: lang === code ? 800 : 600,
                  fontSize: 13, cursor: 'pointer',
                }}
                onMouseEnter={e => e.currentTarget.style.background = lang===code?'#f9ca2422':'#ffffff12'}
                onMouseLeave={e => e.currentTarget.style.background = lang===code?'#f9ca2422':'transparent'}
              >
                {label}
                {lang === code && <span style={{ marginLeft: 'auto', fontSize: 10 }}>✓</span>}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
