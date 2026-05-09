import { useState, useEffect, useRef } from 'react'
import { useT } from '../i18n/translations.js'
import { useTheme } from '../ThemeContext.jsx'

const PAD = 10

export default function OnboardingTour({ onDone, setActiveTab, isMobile }) {
  const { t } = useT()
  const { theme } = useTheme()

  const STEPS = [
    { target: '[data-tour="countdown"]',      title: t('tour_quiz_title'),        text: t('tour_quiz_text'),        mobileTab: 'home'       },
    { target: '[data-tour="profile"]',        title: t('tour_profile_title'),     text: t('tour_profile_text'),     mobileTab: 'home'       },
    { target: '[data-tour="quests"]',         title: t('tour_quests_title'),      text: t('tour_quests_text'),      mobileTab: 'home'       },
    { target: '[data-tour="nav-collection"]', title: t('tour_collection_title'),  text: t('tour_collection_text'),  mobileTab: 'collection' },
    { target: '[data-tour="nav-market"]',     title: t('tour_market_title'),      text: t('tour_market_text'),      mobileTab: 'market'     },
    { target: '[data-tour="nav-forge"]',      title: t('tour_forge_title'),       text: t('tour_forge_text'),       mobileTab: 'forge'      },
    { target: '[data-tour="nav-top"]',        title: t('tour_leaderboard_title'), text: t('tour_leaderboard_text'), mobileTab: 'top'        },
  ]

  const [step, setStep]       = useState(0)
  const [rect, setRect]       = useState(null)
  const [visible, setVisible] = useState(false)
  const boxRef = useRef()

  useEffect(() => {
    setVisible(false)
    const s = STEPS[step]

    // Sur mobile, basculer sur le bon onglet avant de chercher l'élément
    if (isMobile && s.mobileTab && setActiveTab) {
      setActiveTab(s.mobileTab)
    }

    const timer = setTimeout(() => {
      const el = document.querySelector(s.target)
      if (!el) { setRect(null); setVisible(true); return }
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
      setTimeout(() => {
        const r = el.getBoundingClientRect()
        setRect(r.width > 0 && r.height > 0 ? r : null)
        setVisible(true)
      }, 350)
    }, isMobile ? 400 : 100)
    return () => clearTimeout(timer)
  }, [step])

  const next   = () => { setVisible(false); setTimeout(() => setStep(s => s + 1), 180) }
  const prev   = () => { setVisible(false); setTimeout(() => setStep(s => Math.max(0, s - 1)), 180) }
  const finish = () => onDone()

  const s = STEPS[step]

  const tooltipStyle = () => {
    const tw = Math.min(300, window.innerWidth - 24)
    const th = 200
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (!rect) return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: tw }
    let top, left
    const spaceBelow = vh - rect.bottom - PAD
    const spaceAbove = rect.top - PAD
    if (spaceBelow >= th || spaceBelow >= spaceAbove) {
      top = rect.bottom + PAD + 8
    } else {
      top = rect.top - PAD - th - 8
    }
    left = Math.max(12, Math.min(vw - tw - 12, rect.left + rect.width / 2 - tw / 2))
    top  = Math.max(12, Math.min(vh - th - 12, top))
    return { position: 'fixed', top, left, width: tw }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 8000, pointerEvents: 'none' }}>

      {/* Overlay avec trou */}
      {rect ? (
        <>
          <div style={{ position:'fixed', top:0, left:0, right:0, height: Math.max(0, rect.top - PAD), background:'rgba(0,0,0,0.7)', pointerEvents:'auto' }}/>
          <div style={{ position:'fixed', top: rect.bottom + PAD, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.7)', pointerEvents:'auto' }}/>
          <div style={{ position:'fixed', top: rect.top - PAD, left:0, width: Math.max(0, rect.left - PAD), height: rect.height + PAD * 2, background:'rgba(0,0,0,0.7)', pointerEvents:'auto' }}/>
          <div style={{ position:'fixed', top: rect.top - PAD, left: rect.right + PAD, right:0, height: rect.height + PAD * 2, background:'rgba(0,0,0,0.7)', pointerEvents:'auto' }}/>
          <div style={{ position:'fixed', top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, border:'2.5px solid #f9ca24', borderRadius:10, boxShadow:'0 0 0 3px #f9ca2433', pointerEvents:'none' }}/>
        </>
      ) : (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', pointerEvents:'auto' }}/>
      )}

      {/* Tooltip */}
      <div ref={boxRef} style={{
        ...tooltipStyle(),
        background: theme.bgSurface,
        border: `1.5px solid ${theme.border}`,
        borderRadius: 16,
        padding: '18px 20px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
        fontFamily: "'Nunito',sans-serif",
        pointerEvents: 'auto',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) translate(var(--tx,0),var(--ty,0))' : 'translateY(8px) translate(var(--tx,0),var(--ty,0))',
        transition: 'opacity .2s, transform .2s',
      }}>
        {/* Indicateurs d'étapes */}
        <div style={{ display:'flex', gap:4, marginBottom:12, justifyContent:'center' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ width: i === step ? 20 : 6, height:5, borderRadius:3, background: i === step ? '#f9ca24' : theme.border, transition:'all .2s' }}/>
          ))}
        </div>

        <div style={{ fontFamily:"'Fredoka One',sans-serif", fontSize:17, color: theme.gold, marginBottom:8 }}>{s.title}</div>
        <div style={{ fontSize:13, color: theme.textSecondary, lineHeight:1.6, marginBottom:16 }}>{s.text}</div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <button onClick={prev} disabled={step === 0}
            style={{ background: step === 0 ? theme.overlay : theme.bgElevated, border:`1px solid ${theme.border}`, color: step === 0 ? theme.textMuted : theme.textPrimary, padding:'7px 14px', borderRadius:9, fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:12, cursor: step === 0 ? 'default' : 'pointer' }}>
            {t('tour_prev')}
          </button>
          <span style={{ fontSize:11, color: theme.textMuted }}>{step + 1}/{STEPS.length}</span>
          <button onClick={step === STEPS.length - 1 ? finish : next}
            style={{ background:'linear-gradient(135deg,#f9ca24,#e17055)', border:'none', color:'#1e3045', padding:'7px 16px', borderRadius:9, fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:12, cursor:'pointer' }}>
            {step === STEPS.length - 1 ? t('tour_finish') : t('tour_next')}
          </button>
        </div>

        <button onClick={finish} style={{ display:'block', width:'100%', marginTop:10, background:'none', border:'none', color: theme.textMuted, fontSize:10, cursor:'pointer', fontFamily:"'Nunito',sans-serif", textAlign:'center' }}>
          {t('tour_skip')}
        </button>
      </div>
    </div>
  )
}
