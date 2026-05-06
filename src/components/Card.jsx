import { RARITY_CONFIG as RC, cardCC } from '../data/cards.js';
import { useT } from '../i18n/translations.js';

export default function Card({ card, count, onClick, selected, small, dimmed }) {
  const { t } = useT();
  const rc = RC[card.rarity] || RC.commun;
  const { c1, c2 } = cardCC(card.rarity);
  const isLeg = card.rarity === 'légendaire';
  const hasImage = !!(card.image || card.image_url);
  const w = small ? 100 : 148;
  const h = small ? 130 : 190;

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        width: w, minWidth: w, height: h,
        borderRadius: 16,
        border: selected
          ? '2.5px solid #f9ca24'
          : isLeg
          ? `2px solid ${c1}`
          : dimmed
          ? '1.5px solid #ffffff18'
          : `1.5px solid ${c1}66`,
        boxShadow: selected
          ? `0 0 0 3px #f9ca2466, 0 8px 28px #0004`
          : isLeg
          ? `0 0 20px ${c1}66, 0 4px 20px #0004`
          : dimmed
          ? 'none'
          : `0 4px 14px #0003`,
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'hidden',
        userSelect: 'none',
        opacity: dimmed ? 0.35 : 1,
        filter: dimmed ? 'grayscale(1)' : 'none',
        transform: selected ? 'translateY(-6px) scale(1.03)' : 'none',
        transition: 'transform .15s, box-shadow .15s',
        background: hasImage
          ? 'transparent'
          : `linear-gradient(145deg,${c1}44,${c2}66)`,
      }}
      onMouseEnter={e => {
        if (onClick && !dimmed) e.currentTarget.style.transform = selected ? 'translateY(-6px) scale(1.03)' : 'translateY(-3px) scale(1.02)';
      }}
      onMouseLeave={e => {
        if (onClick && !dimmed) e.currentTarget.style.transform = selected ? 'translateY(-6px) scale(1.03)' : 'none';
      }}
    >
      {/* Shimmer légendaire */}
      {isLeg && !dimmed && (
        <div style={{ position: 'absolute', inset: 0, borderRadius: 16, zIndex: 2,
          background: 'linear-gradient(135deg,transparent 40%,#ffffff1a 50%,transparent 60%)',
          backgroundSize: '400px 100%', animation: 'shimmer 2.5s linear infinite', pointerEvents: 'none' }}/>
      )}

      {/* Image — légèrement remontée */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: small ? 4 : 6 }}>
        {hasImage ? (
          <img
            src={card.image || card.image_url}
            alt={card.name}
            style={{ width: '100%', height: '88%', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <div style={{ fontSize: small ? 36 : 52, opacity: dimmed ? 0.1 : 0.22 }}>🃏</div>
        )}
      </div>

      {/* Overlay dégradé bas → nom */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 3,
        background: `linear-gradient(to top, ${c1}ee 0%, ${c1}99 50%, transparent 100%)`,
        padding: small ? '18px 6px 5px' : '28px 8px 7px',
        textAlign: 'center' }}>
        <div style={{ fontWeight: 900, fontSize: small ? 10 : 13,
          color: '#fff', textShadow: '0 1px 4px #0008',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          letterSpacing: 0.3, fontFamily: "'Nunito',sans-serif" }}>
          {card.name}
        </div>
      </div>

      {/* Bande rareté tout en bas */}
      {!dimmed && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 4,
          height: small ? 3 : 4,
          background: `linear-gradient(90deg,${c1},${c2})` }}/>
      )}

      {/* Badge doublon */}
      {count > 1 && (
        <div style={{ position: 'absolute', top: 5, right: 5, zIndex: 5,
          background: '#000000bb', color: '#fff', borderRadius: '50%',
          width: small ? 16 : 20, height: small ? 16 : 20,
          fontSize: small ? 8 : 10, fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Nunito',sans-serif" }}>
          ×{count}
        </div>
      )}

      {/* Label "Manquante" */}
      {dimmed && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 10, color: '#555', fontWeight: 700, fontFamily: "'Nunito',sans-serif",
            background: '#000000aa', padding: '3px 8px', borderRadius: 50 }}>
            Manquante
          </div>
        </div>
      )}

      {/* Sélection flash */}
      {selected && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, borderRadius: 14,
          background: '#f9ca2408', pointerEvents: 'none' }}/>
      )}
    </div>
  );
}
