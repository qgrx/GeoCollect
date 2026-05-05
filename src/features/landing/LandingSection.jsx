import { useState, useEffect, useRef } from 'react';
import Card from '../../components/Card.jsx';
import { useT } from '../../i18n/translations.js';

const FAKE_COIN    = { id: 0, name: 'Geocoin Légendaire', rarity: 'légendaire', type: 'Geocaching', image_url: null };
const FAKE_COIN_EP = { id: 1, name: 'Geocoin Épique',     rarity: 'épique',     type: 'Geocaching', image_url: null };
const FAKE_COIN_R  = { id: 2, name: 'Geocoin Rare',       rarity: 'rare',       type: 'Geocaching', image_url: null };

const FAKE_LEADERBOARD = [
  { pseudo: 'GeoMaster42', score: 4820, rank: 1 },
  { pseudo: 'CacheHunter', score: 3640, rank: 2 },
  { pseudo: 'TrailFinder', score: 2910, rank: 3 },
  { pseudo: '???',         score: '?',  rank: 4 },
  { pseudo: '???',         score: '?',  rank: 5 },
];
const RANK_COLORS = { 1: '#ffd54f', 2: '#b0bec5', 3: '#ce93d8' };

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

  // Parallax offsets par section (vitesse différente pour chaque couche)
  const p0 = scrollY * 0.4;         // hero bg
  const coinY = scrollY * 0.25;     // geocoin flotte plus lentement
  const p1 = (scrollY - vh) * 0.35; // quiz bg
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
        @keyframes coinFloat  { 0%,100%{transform:translateY(0) rotate(-4deg)} 50%{transform:translateY(-14px) rotate(4deg)} }
        @keyframes glow       { 0%,100%{opacity:.5} 50%{opacity:1} }
        @keyframes bounce     { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(7px)} }
        @keyframes fadeUp     { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        ::-webkit-scrollbar   { display:none }
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
        {/* Parallax bg layers */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#1a0500,#0f0520,#0f0f1e)', transform: `translateY(${p0}px)`, willChange: 'transform' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 40%,#e6510022 0%,transparent 70%)', transform: `translateY(${p0 * 0.6}px)`, willChange: 'transform', animation: 'glow 4s ease-in-out infinite' }} />

        {/* Stars layer (déco) */}
        {[...Array(18)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2,
            borderRadius: '50%',
            background: '#ffffff',
            opacity: 0.2 + (i % 5) * 0.1,
            top: `${10 + (i * 17) % 75}%`,
            left: `${5 + (i * 23) % 90}%`,
            transform: `translateY(${p0 * (0.1 + (i % 4) * 0.08)}px)`,
            willChange: 'transform',
          }} />
        ))}

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#e65100', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 18, animation: 'fadeUp .6s ease both' }}>
            {t('landing_badge')}
          </div>

          {/* Coin with independent parallax */}
          <div style={{ transform: `translateY(${coinY * -0.15}px)`, willChange: 'transform', filter: 'drop-shadow(0 0 40px #e6510099)', animation: 'coinFloat 4s ease-in-out infinite', marginBottom: 24 }}>
            <Card card={FAKE_COIN} />
          </div>

          <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 26, color: '#ffd54f', marginBottom: 10, animation: 'fadeUp .7s .1s ease both' }}>
            {t('landing_hero_title')}
          </div>
          <div style={{ fontSize: 14, color: '#aaa', lineHeight: 1.7, maxWidth: 300, marginBottom: 28, animation: 'fadeUp .7s .2s ease both' }}>
            {t('landing_hero_sub')}
          </div>
          <button onClick={e => { e.stopPropagation(); onOpenAuth(); }} style={{ background: 'linear-gradient(135deg,#e65100,#ffd54f)', border: 'none', color: '#1a0a00', padding: '14px 36px', borderRadius: 16, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 16, cursor: 'pointer', boxShadow: '0 6px 28px #e6510077', animation: 'fadeUp .7s .3s ease both' }}>
            {t('landing_hero_cta')}
          </button>
        </div>

        <div style={{ position: 'absolute', bottom: 24, left: '50%', fontSize: 12, color: '#ffffff44', animation: 'bounce 2s ease-in-out infinite' }}>{t('landing_scroll')}</div>
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
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#0a1520,#0d1f35,#0f0f1e)', transform: `translateY(${p1}px)`, willChange: 'transform' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 60% at 30% 60%,#f9ca2415 0%,transparent 70%)', transform: `translateY(${p1 * .5}px)`, willChange: 'transform' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg,#e65100,#f9ca24,#e17055)', transform: `translateY(${p1}px)`, willChange: 'transform' }} />

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 24px', width: '100%', maxWidth: 420 }}>
          <div style={{ fontSize: 48, marginBottom: 10, transform: `translateY(${p1 * -0.1}px)`, willChange: 'transform' }}>🎯</div>
          <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 26, color: '#f9ca24', marginBottom: 10 }}>{t('landing_quiz_title')}</div>
          <div style={{ fontSize: 14, color: '#888', marginBottom: 20, lineHeight: 1.6 }}>{t('landing_quiz_sub')}</div>
          <div style={{ background: '#ffffff08', border: '1.5px solid #f9ca2433', borderRadius: 18, padding: '18px 20px', width: '100%', marginBottom: 24, transform: `translateY(${p1 * -0.05}px)`, willChange: 'transform' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ display: 'inline-block', width: 7, height: 7, background: '#e74c3c', borderRadius: '50%', animation: 'glow 1.5s infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: '#f9ca24' }}>{t('landing_quiz_live')}</span>
            </div>
            <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.6, marginBottom: 14, textAlign: 'left' }}>{t('landing_quiz_q')}</div>
            <div style={{ background: '#ffffff06', border: '1.5px solid #f9ca2422', borderRadius: 10, padding: '10px 14px', color: '#444', fontSize: 13, textAlign: 'left' }}>
              {t('landing_quiz_placeholder')}
            </div>
          </div>
          <button onClick={e => { e.stopPropagation(); onOpenAuth(); }} style={{ background: 'linear-gradient(135deg,#f9ca24,#e17055)', border: 'none', color: '#1a0a00', padding: '12px 28px', borderRadius: 14, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 20px #f9ca2444' }}>
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
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#071510,#0d2018,#0f0f1e)', transform: `translateY(${p2}px)`, willChange: 'transform' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 50% at 70% 40%,#00b89420 0%,transparent 70%)', transform: `translateY(${p2 * .5}px)`, willChange: 'transform' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg,#00b894,#55efc4)', transform: `translateY(${p2}px)`, willChange: 'transform' }} />

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 24px', width: '100%', maxWidth: 420 }}>
          <div style={{ fontSize: 48, marginBottom: 10, transform: `translateY(${p2 * -0.1}px)`, willChange: 'transform' }}>🏪</div>
          <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 26, color: '#00b894', marginBottom: 10 }}>{t('landing_market_title')}</div>
          <div style={{ fontSize: 14, color: '#888', marginBottom: 22, lineHeight: 1.6 }}>{t('landing_market_sub')}</div>
          <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginBottom: 26, transform: `translateY(${p2 * -0.08}px)`, willChange: 'transform' }}>
            {[
              { coin: FAKE_COIN,    price: '2 400 G', c: '#e65100' },
              { coin: FAKE_COIN_EP, price: '850 G',   c: '#6a1b9a' },
              { coin: FAKE_COIN_R,  price: '320 G',   c: '#1565c0' },
            ].map(({ coin, price, c }, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ pointerEvents: 'none', filter: `drop-shadow(0 0 12px ${c}66)` }}><Card card={coin} small /></div>
                <div style={{ fontSize: 11, fontWeight: 900, color: c, background: c + '22', padding: '3px 10px', borderRadius: 20 }}>{price}</div>
              </div>
            ))}
          </div>
          <button onClick={e => { e.stopPropagation(); onOpenAuth(); }} style={{ background: 'linear-gradient(135deg,#00b894,#55efc4)', border: 'none', color: '#071510', padding: '12px 28px', borderRadius: 14, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 20px #00b89444' }}>
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
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#1a1500,#161208,#0f0f1e)', transform: `translateY(${p3}px)`, willChange: 'transform' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 55% at 50% 50%,#f9ca2415 0%,transparent 70%)', transform: `translateY(${p3 * .5}px)`, willChange: 'transform' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg,#f9ca24,#e17055)', transform: `translateY(${p3}px)`, willChange: 'transform' }} />

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 24px', width: '100%', maxWidth: 380 }}>
          <div style={{ fontSize: 48, marginBottom: 10, transform: `translateY(${p3 * -0.1}px)`, willChange: 'transform' }}>🏆</div>
          <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 26, color: '#f9ca24', marginBottom: 10 }}>{t('landing_lb_title')}</div>
          <div style={{ fontSize: 14, color: '#888', marginBottom: 18, lineHeight: 1.6 }}>{t('landing_lb_sub')}</div>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 24, transform: `translateY(${p3 * -0.06}px)`, willChange: 'transform' }}>
            {FAKE_LEADERBOARD.map((p, i) => {
              const blurred = p.pseudo === '???';
              const c = RANK_COLORS[p.rank] || '#444';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: i === 0 ? '#f9ca2412' : '#ffffff06', borderRadius: 11, padding: '9px 14px', border: i === 0 ? '1px solid #f9ca2433' : '1px solid #ffffff08' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: blurred ? '#ffffff08' : c + '22', border: `2px solid ${blurred ? '#2a2a2a' : c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: blurred ? '#333' : c, flexShrink: 0 }}>
                    {p.rank}
                  </div>
                  <div style={{ flex: 1, filter: blurred ? 'blur(5px)' : 'none', userSelect: 'none', textAlign: 'left' }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: blurred ? '#444' : '#fff' }}>{p.pseudo}</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: blurred ? '#2a2a2a' : c, filter: blurred ? 'blur(4px)' : 'none' }}>
                    {blurred ? '?????' : `${p.score} G`}
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={e => { e.stopPropagation(); onOpenAuth(); }} style={{ background: 'linear-gradient(135deg,#f9ca24,#e17055)', border: 'none', color: '#1a0a00', padding: '12px 28px', borderRadius: 14, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 20px #f9ca2444' }}>
            {t('landing_lb_cta')}
          </button>
        </div>
      </section>
    </div>
  );
}
