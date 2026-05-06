import { useState, useEffect, useRef } from 'react'
import { useT } from '../i18n/translations.js'

const PAD = 12

export default function OnboardingTour({ onDone }) {
  const { t } = useT()
  const STEPS = [
    { target: '[data-tour="gold"]',           title: t('tour_gold_title'),        text: t('tour_gold_text'),        pos: 'bottom' },
    { target: '[data-tour="collection"]',     title: t('tour_collection_title'),  text: t('tour_collection_text'),  pos: 'top'    },
    { target: '[data-tour="countdown"]',      title: t('tour_quiz_title'),        text: t('tour_quiz_text'),        pos: 'bottom' },
    { target: '[data-tour="market-btn"]',     title: t('tour_market_title'),      text: t('tour_market_text'),      pos: 'bottom' },
    { target: '[data-tour="leaderboard-btn"]',title: t('tour_leaderboard_title'), text: t('tour_leaderboard_text'), pos: 'bottom' },
  ]
  const [step, setStep]       = useState(0)
  const [rect, setRect]       = useState(null)
  const [visible, setVisible] = useState(false)
  const boxRef = useRef()

  useEffect(() => {
    const s = STEPS[step]

    // Sur mobile, certains éléments sont dans le menu hamburger — l'ouvrir d'abord
    const menuBtn = document.querySelector('.menu-hamburger')
    const menuButtons = document.querySelector('.menu-buttons')
    const targetInMenu = s.target.includes('market-btn') || s.target.includes('leaderboard-btn')
    const isMobile = window.innerWidth < 640
    const menuIsHidden = menuButtons && getComputedStyle(menuButtons).display === 'none'

    if (targetInMenu && isMobile && menuIsHidden && menuBtn) {
      menuBtn.click()
      setTimeout(findAndHighlight, 400)
    } else {
      findAndHighlight()
    }

    function findAndHighlight() {
      const el = document.querySelector(s.target)
      if (!el) { setRect(null); setVisible(true); return }
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      setTimeout(() => {
        const r = el.getBoundingClientRect()
        setRect(r.width > 0 ? r : null)
        setVisible(true)
      }, 350)
    }
  }, [step])

  const next = () => {
    setVisible(false)
    setTimeout(() => {
      if (step < STEPS.length - 1) setStep(s => s + 1)
      else finish()
    }, 200)
  }
  const prev = () => {
    setVisible(false)
    setTimeout(() => setStep(s => Math.max(0, s - 1)), 200)
  }
  const finish = () => {
    onDone()
  }

  const s = STEPS[step]

  // Position du tooltip
  const tooltipStyle = () => {
    if (!rect) return { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
    const tw = 300, th = 160
    const vw = window.innerWidth, vh = window.innerHeight
    let top, left

    if (s.pos === 'bottom' || rect.bottom + PAD + th + 16 < vh) {
      top  = rect.bottom + PAD + 8
    } else {
      top  = rect.top - PAD - th - 8
    }
    left = Math.max(12, Math.min(vw - tw - 12, rect.left + rect.width / 2 - tw / 2))
    top  = Math.max(12, Math.min(vh - th - 12, top))
    return { position: 'fixed', top, left, width: tw }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 8000, pointerEvents: 'none' }}>
      {/* Overlay sombre avec trou */}
      {rect && (
        <>
          {/* Haut */}
          <div style={{ position:'fixed', top:0, left:0, right:0, height: rect.top - PAD, background:'#000000cc', pointerEvents:'auto' }}/>
          {/* Bas */}
          <div style={{ position:'fixed', top: rect.bottom + PAD, left:0, right:0, bottom:0, background:'#000000cc', pointerEvents:'auto' }}/>
          {/* Gauche */}
          <div style={{ position:'fixed', top: rect.top - PAD, left:0, width: rect.left - PAD, height: rect.height + PAD * 2, background:'#000000cc', pointerEvents:'auto' }}/>
          {/* Droite */}
          <div style={{ position:'fixed', top: rect.top - PAD, left: rect.right + PAD, right:0, height: rect.height + PAD * 2, background:'#000000cc', pointerEvents:'auto' }}/>
          {/* Bordure lumineuse autour de l'élément */}
          <div style={{ position:'fixed', top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, border:'2.5px solid #f9ca24', borderRadius:12, boxShadow:'0 0 0 4px #f9ca2444', pointerEvents:'none' }}/>
        </>
      )}
      {/* Overlay sans cible */}
      {!rect && (
        <div style={{ position:'fixed', inset:0, background:'#000000cc', pointerEvents:'auto' }}/>
      )}

      {/* Tooltip */}
      <div ref={boxRef} style={{
        ...tooltipStyle(),
        background: 'linear-gradient(145deg,#1a1a2e,#16213e)',
        border: '1.5px solid #f9ca2466',
        borderRadius: 16,
        padding: '18px 20px',
        boxShadow: '0 16px 48px #000c',
        fontFamily: "'Nunito',sans-serif",
        pointerEvents: 'auto',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity .2s, transform .2s',
      }}>
        {/* Indicateurs étapes */}
        <div style={{ display:'flex', gap:5, marginBottom:12, justifyContent:'center' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ width: i === step ? 18 : 6, height:6, borderRadius:3, background: i === step ? '#f9ca24' : '#ffffff33', transition:'all .2s' }}/>
          ))}
        </div>
        <div style={{ fontFamily:"'Fredoka One',sans-serif", fontSize:17, color:'#f9ca24', marginBottom:8 }}>{s.title}</div>
        <div style={{ fontSize:13, color:'#ccc', lineHeight:1.6, marginBottom:16 }}>{s.text}</div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <button onClick={prev} disabled={step === 0}
            style={{ background:'#ffffff18', border:'none', color: step === 0 ? '#444' : '#fff', padding:'7px 14px', borderRadius:9, fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:12, cursor: step === 0 ? 'default' : 'pointer' }}>
            {t('tour_prev')}
          </button>
          <span style={{ fontSize:11, color:'#666' }}>{step + 1}/{STEPS.length}</span>
          <button onClick={step === STEPS.length - 1 ? finish : next}
            style={{ background:'linear-gradient(135deg,#f9ca24,#e17055)', border:'none', color:'#1a1a2e', padding:'7px 16px', borderRadius:9, fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:12, cursor:'pointer' }}>
            {step === STEPS.length - 1 ? t('tour_finish') : t('tour_next')}
          </button>
        </div>
        <button onClick={finish} style={{ display:'block', width:'100%', marginTop:10, background:'none', border:'none', color:'#444', fontSize:10, cursor:'pointer', fontFamily:"'Nunito',sans-serif", textAlign:'center' }}>
          {t('tour_skip')}
        </button>
      </div>
    </div>
  )
}
