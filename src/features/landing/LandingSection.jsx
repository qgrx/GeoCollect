import Card from '../../components/Card.jsx';

const FAKE_COIN = {
  id: 0,
  name: 'Geocoin Légendaire',
  rarity: 'légendaire',
  type: 'Geocaching',
  image_url: null,
};

const FAKE_QUIZ = {
  q: 'Quel terme désigne une cache de très petite taille, souvent dissimulée sous une feuille ou une pierre ?',
  card: FAKE_COIN,
  a: '???',
};

export default function LandingSection({ onOpenAuth }) {
  return (
    <div style={{ margin: '16px 18px', fontFamily: "'Nunito',sans-serif" }}>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg,#1a0a00,#1a1a2e)', border: '1.5px solid #e6510044', borderRadius: 20, padding: '28px 20px 24px', textAlign: 'center', marginBottom: 14, position: 'relative', overflow: 'hidden' }}>
        {/* Glow background */}
        <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,#e6510033 0%,transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ fontSize: 12, fontWeight: 800, color: '#e65100', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>
          ✦ Geocoin du jour ✦
        </div>

        {/* Legendary coin */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ filter: 'drop-shadow(0 0 24px #e6510088)', animation: 'coinFloat 3s ease-in-out infinite' }}>
            <Card card={FAKE_COIN} />
          </div>
        </div>

        <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 22, color: '#ffd54f', marginBottom: 6 }}>
          Collectionnez des Geocoins rares
        </div>
        <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6, maxWidth: 320, margin: '0 auto 20px' }}>
          Répondez à des questions sur le geocaching et remportez des geocoins uniques en temps réel.
        </div>

        <button onClick={onOpenAuth} style={{ background: 'linear-gradient(135deg,#e65100,#ffd54f)', border: 'none', color: '#1a0a00', padding: '13px 32px', borderRadius: 14, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 20px #e6510055' }}>
          Rejoindre la chasse →
        </button>
      </div>

      {/* Fake quiz */}
      <div onClick={onOpenAuth} style={{ background: 'linear-gradient(135deg,#0f2027,#16213e)', border: '2px solid #f9ca2444', borderRadius: 18, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
        onMouseEnter={e => e.currentTarget.style.borderColor = '#f9ca24aa'}
        onMouseLeave={e => e.currentTarget.style.borderColor = '#f9ca2444'}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(90deg,#e65100,#ffd54f)', padding: '7px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 900, fontSize: 12, color: '#1a0a00' }}>🎯 Quiz en cours</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#1a0a00', fontWeight: 800 }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, background: '#1a0a00', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
            Live
          </span>
        </div>

        <div style={{ padding: '14px 16px 16px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ flexShrink: 0, pointerEvents: 'none' }}>
            <Card card={FAKE_COIN} small />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1.55, marginBottom: 12 }}>
              {FAKE_QUIZ.q}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, background: '#ffffff0f', border: '2px solid #f9ca2444', borderRadius: 11, padding: '10px 14px', color: '#555', fontSize: 13, fontFamily: "'Nunito',sans-serif" }}>
                Connectez-vous pour répondre…
              </div>
              <div style={{ background: 'linear-gradient(135deg,#f9ca24,#e17055)', borderRadius: 11, padding: '10px 18px', color: '#1a1a2e', fontWeight: 900, fontSize: 13, display: 'flex', alignItems: 'center' }}>
                →
              </div>
            </div>
          </div>
        </div>

        {/* Overlay "Se connecter" au hover */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000000cc', borderRadius: 18, opacity: 0, transition: 'opacity .2s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = 1}
          onMouseLeave={e => e.currentTarget.style.opacity = 0}>
          <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 18, color: '#f9ca24' }}>
            Se connecter pour jouer →
          </div>
        </div>
      </div>

      <style>{`
        @keyframes coinFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>
    </div>
  );
}
