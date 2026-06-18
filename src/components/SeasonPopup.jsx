import { cardCC } from '../data/cards.js';
import { useT } from '../i18n/translations.js'

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const months = ['jan.','fév.','mar.','avr.','mai','juin','juil.','août','sep.','oct.','nov.','déc.'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

export default function SeasonPopup({ season, cards, onClose }) {
  const { t } = useT()
  if (!season) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: '#000c',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, backdropFilter: 'blur(12px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(92vw,440px)',
          background: 'linear-gradient(145deg,#1a2744,#12203a)',
          border: '1.5px solid #4a9eff44',
          borderRadius: 22,
          boxShadow: '0 20px 60px #0008',
          fontFamily: "'Nunito',sans-serif",
          overflow: 'hidden',
          position: 'relative',
          maxHeight: 'calc(100dvh - 100px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Bouton fermer — épinglé hors du contenu scrollable */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 14,
            background: '#e74c3c', border: 'none', color: '#fff',
            width: 28, height: 28, borderRadius: '50%',
            fontSize: 16, fontWeight: 900, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, zIndex: 5,
          }}
          aria-label="Fermer"
        >×</button>
        <div style={{ overflowY: 'auto', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>

        {/* En-tête */}
        <div style={{
          background: 'linear-gradient(135deg,#1a3a6a,#2a5298)',
          padding: '22px 20px 18px',
          textAlign: 'center',
          borderBottom: '1px solid #4a9eff33',
        }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🌸</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 4 }}>
            {t('season_new')}
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#4a9eff', marginBottom: 8 }}>
            {season.name}
          </div>
          <div style={{
            display: 'inline-block',
            background: '#ffffff15',
            border: '1px solid #4a9eff44',
            borderRadius: 10,
            padding: '5px 14px',
            fontSize: 12,
            color: '#b0c8ff',
            fontWeight: 700,
          }}>
            {formatDate(season.start_date)} → {formatDate(season.end_date)}
          </div>
        </div>

        {/* Corps */}
        <div style={{ padding: '18px 20px 22px' }}>
          {cards.length > 0 ? (
            <>
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#8899bb',
                textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
              }}>
                {cards.length > 1 ? t('season_geocoins_many').replace('{n}', cards.length) : t('season_geocoins_one').replace('{n}', cards.length)}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(72px,1fr))',
                gap: 10,
              }}>
                {cards.map(card => {
                  const { c1, c2 } = cardCC(card.rarity || 'commun');
                  return (
                    <div key={card.id} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                    }}>
                      <div style={{
                        width: 64, height: 64,
                        borderRadius: 10,
                        border: `2px solid ${c1}`,
                        overflow: 'hidden',
                        background: `linear-gradient(135deg,${c1}33,${c2}33)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: card.rarity === 'légendaire' ? `0 0 12px ${c1}88` : 'none',
                      }}>
                        {(card.image_url_thumb || card.image_url)
                          ? <img src={card.image_url_thumb || card.image_url} alt={card.name}
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          : <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{card.name[0]}</div>
                        }
                      </div>
                      <div style={{
                        fontSize: 9, fontWeight: 700, color: c1,
                        textAlign: 'center', width: '100%',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {card.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ color: '#8899bb', fontSize: 13, textAlign: 'center' }}>
              {t('season_coming_soon')}
            </div>
          )}

          <button
            onClick={onClose}
            style={{
              marginTop: 18, width: '100%',
              background: 'linear-gradient(135deg,#2a5298,#1a3a6a)',
              border: '1px solid #4a9eff44',
              color: '#fff', fontFamily: "'Nunito',sans-serif",
              fontWeight: 800, fontSize: 14,
              padding: '11px', borderRadius: 11, cursor: 'pointer',
            }}
          >
            {t('season_start')}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
