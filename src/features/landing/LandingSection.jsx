import { useState, useEffect, useRef } from 'react';
import Card from '../../components/Card.jsx';
import { useT } from '../../i18n/translations.js';

const FAKE_COIN        = { id: 0, name: 'FTF', rarity: 'légendaire', type: 'Geocaching', image_url: '/geocoin-ftf.webp' };
const FAKE_LEADERBOARD = [
  { pseudo: 'GeoMaster42', score: 4820, rank: 1 },
  { pseudo: 'CacheHunter', score: 3640, rank: 2 },
  { pseudo: 'TrailFinder', score: 2910, rank: 3 },
  { pseudo: '???',         score: '?',  rank: 4 },
  { pseudo: '???',         score: '?',  rank: 5 },
];
const RANK_COLORS = { 1: '#e65100', 2: '#546e7a', 3: '#6a1b9a' };

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

export default function LandingSection({ onOpenAuth }) {
  const { t } = useT();
  const containerRef = useRef(null);
  const scrollY = useScrollY(containerRef);
  const vh = typeof window !== 'undefined' ? window.innerHeight - 60 : 600;

  const p0 = scrollY * 0.4;
  const coinY = scrollY * 0.25;
  const p1 = (scrollY - vh) * 0.35;
  const p2 = (scrollY - vh * 2) * 0.35;
  const p3 = (scrollY - vh * 3) * 0.35;

  return (
    <div ref={containerRef} style={{
      height: 'calc(100vh - 60px)',
      overflowY: 'scroll',
      scrollSnapType: 'y mandatory',
      fontFamily: "'Nunito',sans-serif",
      scrollbarWidth: 'none',
    }}>
      <style>{`
        @keyframes coinFloat { 0%,100%{transform:translateY(0) rotate(-4deg)} 50%{transform:translateY(-14px) rotate(4deg)} }
        @keyframes glow      { 0%,100%{opacity:.4} 50%{opacity:.8} }
        @keyframes bounce    { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(7px)} }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        ::-webkit-scrollbar  { display:none }
      `}</style>

      {/* ══ SLIDE 0 — HERO ══════════════════════════════════════════════════════ */}
      <section onClick={onOpenAuth} style={{
        scrollSnapAlign: 'start',
        height: 'calc(100vh - 60px)',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#fff8f2,#fef2e4,#f8f4ff)', transform: `translateY(${p0}px)`, willChange: 'transform' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 40%,#e6510018 0%,transparent 70%)', transform: `translateY(${p0 * 0.6}px)`, willChange: 'transform', animation: 'glow 4s ease-in-out infinite' }} />

        {/* Soft decorative circles */}
        {[
          { top: '12%', left: '8%',  size: 80,  color: '#e6510012' },
          { top: '70%', left: '80%', size: 120, color: '#6a1b9a0d' },
          { top: '55%', left: '5%',  size: 60,  color: '#f9ca2418' },
          { top: '20%', left: '85%', size: 90,  color: '#e6510010' },
        ].map((c, i) => (
          <div key={i} style={{ position: 'absolute', width: c.size, height: c.size, borderRadius: '50%', background: c.color, top: c.top, left: c.left, transform: `translateY(${p0 * (0.1 + i * 0.05)}px)`, willChange: 'transform' }} />
        ))}

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#e65100', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 18, animation: 'fadeUp .6s ease both' }}>
            {t('landing_badge')}
          </div>

          <div style={{ transform: `translateY(${coinY * -0.15}px)`, willChange: 'transform', filter: 'drop-shadow(0 8px 24px #e6510044)', animation: 'coinFloat 4s ease-in-out infinite', marginBottom: 24 }}>
            <Card card={FAKE_COIN} />
          </div>

          <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 26, color: '#2d1a00', marginBottom: 10, animation: 'fadeUp .7s .1s ease both' }}>
            {t('landing_hero_title')}
          </div>
          <div style={{ fontSize: 14, color: '#666', lineHeight: 1.7, maxWidth: 300, marginBottom: 28, animation: 'fadeUp .7s .2s ease both' }}>
            {t('landing_hero_sub')}
          </div>
          <button onClick={e => { e.stopPropagation(); onOpenAuth(); }} style={{ background: 'linear-gradient(135deg,#e65100,#ff8f00)', border: 'none', color: '#fff', padding: '14px 36px', borderRadius: 16, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 16, cursor: 'pointer', boxShadow: '0 6px 24px #e6510033', animation: 'fadeUp .7s .3s ease both' }}>
            {t('landing_hero_cta')}
          </button>
        </div>

        <div style={{ position: 'absolute', bottom: 24, left: '50%', fontSize: 12, color: '#bbb', animation: 'bounce 2s ease-in-out infinite' }}>{t('landing_scroll')}</div>
      </section>

      {/* ══ SLIDE 1 — QUIZ ══════════════════════════════════════════════════════ */}
      <section onClick={onOpenAuth} style={{
        scrollSnapAlign: 'start',
        height: 'calc(100vh - 60px)',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#f0f7ff,#e8f3fd,#f5f0ff)', transform: `translateY(${p1}px)`, willChange: 'transform' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 60% at 30% 60%,#f9ca2415 0%,transparent 70%)', transform: `translateY(${p1 * .5}px)`, willChange: 'transform' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg,#e65100,#f9ca24,#e17055)', transform: `translateY(${p1}px)`, willChange: 'transform' }} />

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 24px', width: '100%', maxWidth: 420 }}>
          <div style={{ transform: `translateY(${p1 * -0.1}px)`, willChange: 'transform', marginBottom: 10, pointerEvents: 'none' }}>
            <img src="/geocoin-mystery.webp" alt="Mystery" style={{ width: 100, height: 100, objectFit: 'contain', filter: 'drop-shadow(0 4px 16px #6a1b9a44)' }} />
          </div>
          <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 26, color: '#1a237e', marginBottom: 10 }}>{t('landing_quiz_title')}</div>
          <div style={{ fontSize: 14, color: '#555', marginBottom: 20, lineHeight: 1.6 }}>{t('landing_quiz_sub')}</div>
          <div style={{ background: '#fff', border: '1.5px solid #e8e0f0', borderRadius: 18, padding: '18px 20px', width: '100%', marginBottom: 24, boxShadow: '0 4px 20px #6a1b9a0d', transform: `translateY(${p1 * -0.05}px)`, willChange: 'transform' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ display: 'inline-block', width: 7, height: 7, background: '#e74c3c', borderRadius: '50%', animation: 'glow 1.5s infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: '#e65100' }}>{t('landing_quiz_live')}</span>
            </div>
            <div style={{ fontSize: 13, color: '#333', lineHeight: 1.6, marginBottom: 14, textAlign: 'left' }}>{t('landing_quiz_q')}</div>
            <div style={{ background: '#f5f5f5', border: '1.5px solid #e0e0e0', borderRadius: 10, padding: '10px 14px', color: '#aaa', fontSize: 13, textAlign: 'left' }}>
              {t('landing_quiz_placeholder')}
            </div>
          </div>
          <button onClick={e => { e.stopPropagation(); onOpenAuth(); }} style={{ background: 'linear-gradient(135deg,#5c35c7,#7c4dff)', border: 'none', color: '#fff', padding: '12px 28px', borderRadius: 14, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 16px #5c35c733' }}>
            {t('landing_quiz_cta')}
          </button>
        </div>
      </section>

      {/* ══ SLIDE 2 — MARCHÉ ════════════════════════════════════════════════════ */}
      <section onClick={onOpenAuth} style={{
        scrollSnapAlign: 'start',
        height: 'calc(100vh - 60px)',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
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
          <button onClick={e => { e.stopPropagation(); onOpenAuth(); }} style={{ background: 'linear-gradient(135deg,#00897b,#26a69a)', border: 'none', color: '#fff', padding: '12px 28px', borderRadius: 14, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 16px #00897b33' }}>
            {t('landing_market_cta')}
          </button>
        </div>
      </section>

      {/* ══ SLIDE 3 — CLASSEMENT ════════════════════════════════════════════════ */}
      <section onClick={onOpenAuth} style={{
        scrollSnapAlign: 'start',
        height: 'calc(100vh - 60px)',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#fffcf0,#fef8e1,#fff8f2)', transform: `translateY(${p3}px)`, willChange: 'transform' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 55% at 50% 50%,#f9ca2418 0%,transparent 70%)', transform: `translateY(${p3 * .5}px)`, willChange: 'transform' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg,#f57f17,#fbc02d)', transform: `translateY(${p3}px)`, willChange: 'transform' }} />

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 24px', width: '100%', maxWidth: 380 }}>
          <div style={{ fontSize: 48, marginBottom: 10, transform: `translateY(${p3 * -0.1}px)`, willChange: 'transform' }}>🏆</div>
          <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 26, color: '#4a2f00', marginBottom: 10 }}>{t('landing_lb_title')}</div>
          <div style={{ fontSize: 14, color: '#666', marginBottom: 18, lineHeight: 1.6 }}>{t('landing_lb_sub')}</div>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 24, transform: `translateY(${p3 * -0.06}px)`, willChange: 'transform' }}>
            {FAKE_LEADERBOARD.map((p, i) => {
              const blurred = p.pseudo === '???';
              const c = RANK_COLORS[p.rank] || '#999';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: i === 0 ? '#fff3e0' : '#fff', borderRadius: 11, padding: '9px 14px', border: i === 0 ? '1px solid #ffcc80' : '1px solid #e0e0e0', boxShadow: '0 1px 4px #0000000a' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: blurred ? '#f5f5f5' : c + '22', border: `2px solid ${blurred ? '#e0e0e0' : c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: blurred ? '#bbb' : c, flexShrink: 0 }}>
                    {p.rank}
                  </div>
                  <div style={{ flex: 1, filter: blurred ? 'blur(5px)' : 'none', userSelect: 'none', textAlign: 'left' }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: blurred ? '#ccc' : '#2d2d2d' }}>{p.pseudo}</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: blurred ? '#ddd' : c, filter: blurred ? 'blur(4px)' : 'none' }}>
                    {blurred ? '?????' : `${p.score} G`}
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={e => { e.stopPropagation(); onOpenAuth(); }} style={{ background: 'linear-gradient(135deg,#f57f17,#fbc02d)', border: 'none', color: '#fff', padding: '12px 28px', borderRadius: 14, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 16px #f57f1733' }}>
            {t('landing_lb_cta')}
          </button>
        </div>
      </section>
    </div>
  );
}
