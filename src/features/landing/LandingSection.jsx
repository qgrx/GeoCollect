import { useState, useEffect, useRef } from 'react';
import Card from '../../components/Card.jsx';
import { useT, getLang } from '../../i18n/translations.js';
import { apiGetJeuQuotidien } from '../../services/api.js';
import { cardName } from '../../data/cards.js';

const FALLBACK_COIN = { id: 0, name: 'FTF', rarity: 'légendaire', type: 'Geocaching', image_url: '/geocoin-ftf.webp' };
const POLL_MS = 30_000  // re-sync serveur toutes les 30 s

const BENEFITS = [
  { icon: '💾', c1: '#6a1b9a', c2: '#ab47bc', border: '#e8d5ff', titleKey: 'landing_benefit1_title', bodyKey: 'landing_benefit1_body' },
  { icon: '🔄', c1: '#e65100', c2: '#ff7043', border: '#ffe0cc', titleKey: 'landing_benefit2_title', bodyKey: 'landing_benefit2_body' },
  { icon: '🏆', c1: '#f57f17', c2: '#fbc02d', border: '#fff0c2', titleKey: 'landing_benefit3_title', bodyKey: 'landing_benefit3_body' },
];

function useScrollY(ref) {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => setScrollY(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [ref]);
  return scrollY;
}

function ScrollHint({ label }) {
  return (
    <div style={{ position: 'absolute', bottom: 28, left: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, animation: 'scrollBounce 2s ease-in-out infinite' }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: '#e65100', letterSpacing: 2, textTransform: 'uppercase' }}>{label}</span>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M6 9l6 6 6-6" stroke="#e65100" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function fmtRemains(s) {
  if (s === null || s <= 0) return null
  if (s >= 3600) {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    return `${h}h${String(m).padStart(2, '0')}`
  }
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function LandingSection({ onOpenAuth }) {
  const { t } = useT();
  const containerRef = useRef(null);
  const scrollY = useScrollY(containerRef);
  const vh = typeof window !== 'undefined' ? window.innerHeight - 60 : 600;

  const [geocoin,      setGeocoin]      = useState(undefined)
  const [remains,      setRemains]      = useState(null)
  const [isSpecial,    setIsSpecial]    = useState(false)
  const [codeTooltip,  setCodeTooltip]  = useState(false)
  const [codeCopied,   setCodeCopied]   = useState(false)
  const fetchRef = useRef(null)

  fetchRef.current = async () => {
    const { data } = await apiGetJeuQuotidien().catch(() => ({ data: null }))
    if (!data) return
    if (data.geocoin) {
      setGeocoin(data.geocoin)
      setRemains(data.remains_seconds ?? null)
      setIsSpecial(data.special === true)
    }
  }

  // Chargement initial + polling de synchronisation
  useEffect(() => {
    fetchRef.current()
    const id = setInterval(() => fetchRef.current(), POLL_MS)
    return () => clearInterval(id)
  }, [])

  // Décompte local (évite de re-fetch à chaque seconde)
  useEffect(() => {
    if (remains === null || remains <= 0) return
    const id = setInterval(() => setRemains(r => {
      if (r === null || r <= 1) { fetchRef.current(); return null }
      return r - 1
    }), 1000)
    return () => clearInterval(id)
  }, [remains])

  const p0   = scrollY * 0.4;
  const coinY = scrollY * 0.25;
  const p1   = (scrollY - vh) * 0.35;
  const p2   = (scrollY - vh * 2) * 0.35;

  const handleCodeClick = async () => {
    if (!geocoin) return
    try {
      await navigator.clipboard.writeText(geocoin.numero)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      setCodeTooltip(v => !v)
    }
  }

  const isLoading = geocoin === undefined
  const dailyCoin = geocoin?.card
    ? { id: geocoin.card.id, name: cardName(geocoin.card, getLang()), rarity: geocoin.card.rarity, type: geocoin.card.type, image_url: geocoin.card.image_url }
    : FALLBACK_COIN
  const remainsFmt = fmtRemains(remains)
  // Coins spéciaux : pas d'alerte expiration (toute la journée est normale)
  const nearExpiry = !isSpecial && remains !== null && remains < 60

  return (
    <div ref={containerRef} style={{
      height: 'calc(100vh - 60px)',
      overflowY: 'scroll',
      scrollSnapType: 'y mandatory',
      fontFamily: "'Nunito',sans-serif",
      scrollbarWidth: 'none',
    }}>
      <style>{`
        @keyframes coinFloat    { 0%,100%{transform:translateY(0) rotate(-4deg)} 50%{transform:translateY(-14px) rotate(4deg)} }
        @keyframes coinIn       { from{opacity:0;transform:scale(.85) translateY(20px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes glow         { 0%,100%{opacity:.4} 50%{opacity:.8} }
        @keyframes scrollBounce { 0%,100%{transform:translateX(-50%) translateY(0)} 60%{transform:translateX(-50%) translateY(10px)} }
        @keyframes fadeUp       { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse        { 0%,100%{opacity:1} 50%{opacity:.4} }
        ::-webkit-scrollbar     { display:none }
      `}</style>

      {/* ══ SLIDE 0 — GÉOCOIN EN COURS ══════════════════════════════════════════ */}
      <section style={{ scrollSnapAlign: 'start', height: 'calc(100vh - 60px)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#fff8f2,#fef2e4,#f8f4ff)', transform: `translateY(${p0}px)`, willChange: 'transform' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 40%,#e6510018 0%,transparent 70%)', transform: `translateY(${p0 * 0.6}px)`, willChange: 'transform', animation: 'glow 4s ease-in-out infinite' }} />
        {[
          { top: '12%', left: '8%',  size: 80,  color: '#e6510012' },
          { top: '70%', left: '80%', size: 120, color: '#6a1b9a0d' },
          { top: '55%', left: '5%',  size: 60,  color: '#f9ca2418' },
          { top: '20%', left: '85%', size: 90,  color: '#e6510010' },
        ].map((c, i) => (
          <div key={i} style={{ position: 'absolute', width: c.size, height: c.size, borderRadius: '50%', background: c.color, top: c.top, left: c.left, transform: `translateY(${p0 * (0.1 + i * 0.05)}px)`, willChange: 'transform' }} />
        ))}

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 24px' }}>
          {isLoading ? (
            <div style={{ width: 120, height: 160, borderRadius: 16, background: 'linear-gradient(135deg,#f0e8dc,#f8f0e8)', animation: 'glow 1.4s ease-in-out infinite', marginBottom: 14 }} />
          ) : (
            <div key={geocoin?.ordre} style={{ transform: `translateY(${coinY * -0.15}px)`, willChange: 'transform', filter: 'drop-shadow(0 8px 24px #e6510044)', animation: 'coinIn .45s cubic-bezier(.34,1.56,.64,1) both, coinFloat 4s ease-in-out .5s infinite', marginBottom: 14 }}>
              <Card card={dailyCoin} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', animation: 'fadeUp .6s .15s ease both', flexWrap: 'wrap', minHeight: 34 }}>
            {geocoin && (
              <div style={{ position: 'relative' }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleCodeClick}
                  onMouseEnter={() => setCodeTooltip(true)}
                  onMouseLeave={() => setCodeTooltip(false)}
                  style={{ background: codeCopied ? '#00897b14' : '#e6510012', border: `1px solid ${codeCopied ? '#00897b44' : '#e6510028'}`, borderRadius: 20, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none', transition: 'all .2s' }}>
                  <span style={{ fontSize: 11 }}>{codeCopied ? '✓' : '🪙'}</span>
                  <span style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 13, color: codeCopied ? '#00897b' : '#e65100', letterSpacing: .5, transition: 'color .2s' }}>
                    {codeCopied ? t('landing_code_copied') : BigInt(geocoin.numero).toLocaleString('fr-FR')}
                  </span>
                  {!codeCopied && <span style={{ fontSize: 10, color: '#e6510088', marginLeft: 1 }}>ⓘ</span>}
                </div>
                {codeTooltip && (
                  <div style={{ position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)', width: 240, background: '#1a1a2e', border: '1px solid #e6510044', borderRadius: 12, padding: '12px 14px', boxShadow: '0 8px 32px #00000044', zIndex: 100, animation: 'fadeUp .2s ease both', pointerEvents: 'none' }}>
                    <div style={{ fontWeight: 900, fontSize: 12, color: '#e65100', marginBottom: 6 }}>
                      {t('landing_code_tooltip_title')}
                    </div>
                    <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1.6 }}>
                      {t('landing_code_tooltip_body')}
                    </div>
                    {/* Flèche */}
                    <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: 10, height: 10, background: '#1a1a2e', border: '1px solid #e6510044', borderTop: 'none', borderLeft: 'none' }} />
                  </div>
                )}
              </div>
            )}
            {remainsFmt && (
              <div style={{ background: nearExpiry ? '#e6510018' : '#00000008', border: `1px solid ${nearExpiry ? '#e6510044' : '#00000014'}`, borderRadius: 20, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 5, transition: 'all .3s' }}>
                <span style={{ fontSize: 10, animation: nearExpiry ? 'pulse 1s ease-in-out infinite' : 'none' }}>⏱</span>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: nearExpiry ? '#e65100' : '#888', fontWeight: 700 }}>
                  {remainsFmt}
                </span>
              </div>
            )}
          </div>
        </div>
        <ScrollHint label={t('landing_scroll')} />
      </section>

      {/* ══ SLIDE 1 — AVANTAGES ════════════════════════════════════════════════ */}
      <section style={{ scrollSnapAlign: 'start', height: 'calc(100vh - 60px)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#f5f0ff,#ede8ff,#faf0ff)', transform: `translateY(${p1}px)`, willChange: 'transform' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 40%,#6a1b9a14 0%,transparent 70%)', transform: `translateY(${p1 * .5}px)`, willChange: 'transform' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg,#6a1b9a,#ab47bc)', transform: `translateY(${p1}px)`, willChange: 'transform' }} />
        {[
          { top: '8%',  left: '6%',  size: 70,  color: '#6a1b9a0d' },
          { top: '72%', left: '82%', size: 110, color: '#e6510010' },
          { top: '60%', left: '4%',  size: 55,  color: '#ab47bc0d' },
          { top: '18%', left: '84%', size: 80,  color: '#6a1b9a08' },
        ].map((c, i) => (
          <div key={i} style={{ position: 'absolute', width: c.size, height: c.size, borderRadius: '50%', background: c.color, top: c.top, left: c.left, transform: `translateY(${p1 * (0.08 + i * 0.04)}px)`, willChange: 'transform' }} />
        ))}

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 20px', width: '100%', maxWidth: 400 }}>
          <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 25, color: '#2a004a', marginBottom: 20, transform: `translateY(${p1 * -0.08}px)`, willChange: 'transform', animation: 'fadeUp .5s ease both' }}>
            {t('landing_signup_title')}
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 22, transform: `translateY(${p1 * -0.06}px)`, willChange: 'transform' }}>
            {BENEFITS.map(({ icon, c1, c2, border, titleKey, bodyKey }, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 16, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 12px #00000008', border: `1px solid ${border}`, animation: `fadeUp .5s ${0.08 + i * 0.08}s ease both` }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: `linear-gradient(135deg,${c1},${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>
                  {icon}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 900, fontSize: 13, color: '#2a004a', marginBottom: 2 }}>{t(titleKey)}</div>
                  <div style={{ fontSize: 12, color: '#888', lineHeight: 1.45 }}>{t(bodyKey)}</div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={onOpenAuth} style={{ background: 'linear-gradient(135deg,#6a1b9a,#ab47bc)', border: 'none', color: '#fff', padding: '13px 0', borderRadius: 14, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 20px #6a1b9a33', width: '100%', maxWidth: 300, animation: 'fadeUp .5s .32s ease both' }}>
            {t('landing_signup_cta')}
          </button>
        </div>
        <ScrollHint label={t('landing_scroll')} />
      </section>

      {/* ══ SLIDE 2 — MARCHÉ ════════════════════════════════════════════════════ */}
      <section style={{ scrollSnapAlign: 'start', height: 'calc(100vh - 60px)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#f0fdf7,#e6faf4,#f0fff8)', transform: `translateY(${p2}px)`, willChange: 'transform' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 50% at 70% 40%,#00b89418 0%,transparent 70%)', transform: `translateY(${p2 * .5}px)`, willChange: 'transform' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg,#00897b,#26a69a)', transform: `translateY(${p2}px)`, willChange: 'transform' }} />

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 24px', width: '100%', maxWidth: 420 }}>
          <div style={{ transform: `translateY(${p2 * -0.1}px)`, willChange: 'transform', marginBottom: 10, pointerEvents: 'none' }}>
            <img src="/geocoin-market.webp" alt="Geocoin Market" style={{ width: 100, height: 100, objectFit: 'contain', filter: 'drop-shadow(0 4px 16px #00897b44)' }} />
          </div>
          <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 26, color: '#004d40', marginBottom: 10 }}>{t('landing_market_title')}</div>
          <div style={{ fontSize: 14, color: '#555', marginBottom: 22, lineHeight: 1.6 }}>{t('landing_market_sub')}</div>
          <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginBottom: 26, transform: `translateY(${p2 * -0.08}px)`, willChange: 'transform' }}>
            {[
              { src: '/geocoin-ape.webp',     price: '2 400 G', c: '#e65100', label: 'Légendaire' },
              { src: '/geocoin-ammobox.webp', price: '850 G',   c: '#6a1b9a', label: 'Épique' },
              { src: '/geocoin-gps.webp',     price: '320 G',   c: '#1565c0', label: 'Rare' },
            ].map(({ src, price, c, label }, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <img src={src} alt={label} style={{ width: 80, height: 80, objectFit: 'contain', filter: `drop-shadow(0 4px 12px ${c}44)`, pointerEvents: 'none' }} />
                <div style={{ fontSize: 11, fontWeight: 900, color: c, background: c + '18', border: `1px solid ${c}33`, padding: '3px 10px', borderRadius: 20 }}>{price}</div>
              </div>
            ))}
          </div>
          <button onClick={onOpenAuth} style={{ background: 'linear-gradient(135deg,#00897b,#26a69a)', border: 'none', color: '#fff', padding: '12px 28px', borderRadius: 14, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 16px #00897b33' }}>
            {t('landing_market_cta')}
          </button>
        </div>
      </section>

    </div>
  );
}
