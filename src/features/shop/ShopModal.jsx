import { useState } from 'react';
import { useT } from '../../i18n/translations.js';
import { RC, cardCC, rarityLabel } from '../../data/cards.js';
import { drawPackSmall, drawPackMedium, drawPackLarge } from '../../utils/gameUtils.js';

// Définitions statiques des packs — prix/noms surchargés par la config admin
const PACK_DEFS = [
  {
    id:       'petit_soutien',
    emoji:    '🎁',
    gradient: 'linear-gradient(135deg,#74b9ff,#0984e3)',
    draw:     drawPackSmall,
    gold:     0,
    defaultName:  'Petit soutien',
    defaultPrice: '3,00 €',
    contents: [
      { icon: '⚪', label: '2 Communs',             color: '#78909c' },
      { icon: '🔵', label: '2 Rares',               color: '#1565c0' },
      { icon: '🟣', label: '1 Épique ou Rare',       color: '#6a1b9a', note: '(50/50)' },
    ],
  },
  {
    id:       'soutien',
    emoji:    '💎',
    gradient: 'linear-gradient(135deg,#a29bfe,#6c5ce7)',
    draw:     drawPackMedium,
    gold:     120,
    defaultName:  'Soutien',
    defaultPrice: '8,00 €',
    contents: [
      { icon: '⚪', label: '6 Communs',                  color: '#78909c' },
      { icon: '🔵', label: '2 Rares garantis',           color: '#1565c0' },
      { icon: '🟣', label: '1 Épique ou Rare',            color: '#6a1b9a', note: '(50/50)' },
      { icon: '🟠', label: '1 Légendaire ou Épique',     color: '#e65100', note: '(50/50)' },
      { icon: '🪙', label: '120 Golds',                  color: '#f9ca24' },
    ],
  },
  {
    id:       'gros_soutien',
    emoji:    '👑',
    gradient: 'linear-gradient(135deg,#f9ca24,#e17055)',
    draw:     drawPackLarge,
    gold:     200,
    defaultName:  'Gros soutien',
    defaultPrice: '15,00 €',
    contents: [
      { icon: '⚪', label: '6 Communs',            color: '#78909c' },
      { icon: '🔵', label: '2 Rares garantis',     color: '#1565c0' },
      { icon: '🟣', label: '1 Épique garantie',    color: '#6a1b9a' },
      { icon: '🟠', label: '1 Légendaire garantie',color: '#e65100' },
      { icon: '🪙', label: '200 Golds',            color: '#f9ca24' },
    ],
  },
]

export default function ShopModal({ onClose, cardPool, onPurchase, shopPacksConfig = {} }) {
  const { t } = useT()
  const [step,        setStep]        = useState('shop')    // shop | confirm | processing | reveal | done
  const [selected,    setSelected]    = useState(null)      // PACK_DEFS entry
  const [drawnCards,  setDrawnCards]  = useState([])
  const [revealedIdx, setRevealedIdx] = useState(-1)
  const [payMethod,   setPayMethod]   = useState(null)

  // Fusionner config admin (prix, noms) avec les définitions statiques
  const packs = PACK_DEFS.map(p => ({
    ...p,
    name:  shopPacksConfig[p.id]?.name  || p.defaultName,
    price: shopPacksConfig[p.id]?.price || p.defaultPrice,
    enabled: shopPacksConfig[p.id]?.enabled !== false,
  })).filter(p => p.enabled)

  function selectPack(pack) { setSelected(pack); setStep('confirm') }

  function handleBuy(method) { setPayMethod(method); setStep('processing'); doProcess(method) }

  function doProcess(method) {
    setTimeout(() => {
      const cards = selected.draw(cardPool)
      setDrawnCards(cards)
      setStep('reveal')
      cards.forEach((_, i) => setTimeout(() => setRevealedIdx(i), i * 320 + 400))
      setTimeout(() => setStep('done'), cards.length * 320 + 800)
    }, 1800)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000d', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(10px)' }}>
      <div style={{ background: 'linear-gradient(145deg,#1e3045,#1a2d42)', borderRadius: 24, width: 'min(96vw,640px)', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 32px 80px #000c', border: '2px solid #f9ca2444', fontFamily: "'Nunito',sans-serif" }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(90deg,#e84393,#f9ca24,#e17055)', backgroundSize: '200% 100%', animation: 'shimmer 3s linear infinite', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 22, color: '#fff', textShadow: '0 2px 8px #0005' }}>{t('shop_title')}</div>
            <div style={{ fontSize: 11, color: '#ffffff99', marginTop: 2 }}>{t('shop_subtitle')}</div>
          </div>
          {step !== 'processing' && <button onClick={onClose} style={{ background: '#00000033', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', fontSize: 16, cursor: 'pointer', fontWeight: 900 }}>✕</button>}
        </div>

        {/* ── SÉLECTION DE PACK ── */}
        {step === 'shop' && (
          <div style={{ padding: '20px 18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {packs.map(pack => (
                <button key={pack.id} onClick={() => selectPack(pack)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', borderRadius: 16, transition: 'transform .15s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.01)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                  <div style={{ background: 'linear-gradient(145deg,#1e1e3a,#2d1b4e)', borderRadius: 16, padding: '14px 16px', border: '1.5px solid #ffffff18', position: 'relative', overflow: 'hidden' }}>
                    {/* Bande colorée gauche */}
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 5, background: pack.gradient, borderRadius: '16px 0 0 16px' }} />
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center', paddingLeft: 10 }}>
                      {/* Emoji + prix */}
                      <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 64 }}>
                        <div style={{ fontSize: 34, filter: 'drop-shadow(0 3px 8px #0006)' }}>{pack.emoji}</div>
                        <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 18, color: '#f9ca24', marginTop: 2, lineHeight: 1 }}>{pack.price}</div>
                        <div style={{ fontSize: 9, color: '#666', marginTop: 1 }}>unique</div>
                      </div>
                      {/* Contenu */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 900, fontSize: 15, color: '#fff', marginBottom: 7 }}>{pack.name}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {pack.contents.map(({ icon, label, color, note }) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 12 }}>{icon}</span>
                              <span style={{ fontSize: 12, color: '#ddd', fontWeight: 700 }}>{label}</span>
                              {note && <span style={{ fontSize: 10, color: '#888', fontStyle: 'italic' }}>{note}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Flèche */}
                      <div style={{ color: '#555', fontSize: 20, flexShrink: 0 }}>›</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div style={{ background: '#00b89412', border: '1px solid #00b89433', borderRadius: 12, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>💚</span>
              <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.5 }}>{t('shop_donation_note')}</div>
            </div>
            <div style={{ fontSize: 10, color: '#444', textAlign: 'center', lineHeight: 1.5 }}>
              Paiement sécurisé via Stripe · Aucun abonnement · Aucune donnée bancaire stockée
            </div>
          </div>
        )}

        {/* ── CONFIRMATION ── */}
        {step === 'confirm' && selected && (
          <div style={{ padding: '24px 22px' }}>
            {/* Récap pack */}
            <div style={{ background: 'linear-gradient(145deg,#1e1e3a,#2d1b4e)', borderRadius: 16, padding: '16px', border: '1.5px solid #f9ca2433', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 32 }}>{selected.emoji}</span>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 17, color: '#fff' }}>{selected.name}</div>
                  <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 24, color: '#f9ca24' }}>{selected.price}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {selected.contents.map(({ icon, label, note }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 13 }}>{icon}</span>
                    <span style={{ fontSize: 12, color: '#ccc', fontWeight: 700 }}>{label}</span>
                    {note && <span style={{ fontSize: 10, color: '#888', fontStyle: 'italic' }}>{note}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Boutons paiement */}
            <div style={{ fontSize: 12, color: '#888', marginBottom: 10, textAlign: 'center' }}>{t('shop_payment_label')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 14 }}>
              <button onClick={() => handleBuy('card')}
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: 'none', padding: '13px 18px', borderRadius: 12, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 14, color: '#1e3045' }}>
                <span style={{ fontSize: 22 }}>💳</span>
                <span style={{ flex: 1, textAlign: 'left' }}>{t('shop_card')}</span>
                <span style={{ color: '#888', fontSize: 12 }}>Visa / Mastercard</span>
              </button>
              <button onClick={() => handleBuy('paypal')}
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#003087', border: 'none', padding: '13px 18px', borderRadius: 12, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 14, color: '#fff' }}>
                <span style={{ fontSize: 22 }}>🅿️</span>
                <span style={{ flex: 1, textAlign: 'left' }}>{t('shop_paypal')}</span>
                <span style={{ color: '#ffffff66', fontSize: 12 }}>paypal.com</span>
              </button>
            </div>
            <button onClick={() => setStep('shop')} style={{ width: '100%', background: '#ffffff10', border: '1px solid #ffffff18', color: '#aaa', padding: '10px', borderRadius: 10, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
              ← Choisir un autre pack
            </button>
            <div style={{ marginTop: 10, fontSize: 10, color: '#444', textAlign: 'center' }}>
              {t('shop_redirect').replace('{method}', 'Stripe / PayPal')}
            </div>
          </div>
        )}

        {/* ── TRAITEMENT ── */}
        {step === 'processing' && (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 52, animation: 'float 1s ease-in-out infinite', display: 'inline-block' }}>⏳</div>
            <div style={{ fontWeight: 900, fontSize: 18, color: '#fff', marginTop: 16, marginBottom: 8 }}>{t('shop_processing_title')}</div>
            <div style={{ color: '#888', fontSize: 13 }}>{t('shop_processing_desc')} {payMethod === 'paypal' ? t('shop_paypal') : 'Stripe'}</div>
            <div style={{ marginTop: 20, background: '#ffffff18', borderRadius: 50, height: 6, overflow: 'hidden', width: 200, margin: '20px auto 0' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg,#f9ca24,#e17055)', borderRadius: 50, animation: 'shimmer 1.5s linear infinite', backgroundSize: '200% 100%' }} />
            </div>
          </div>
        )}

        {/* ── RÉVÉLATION ── */}
        {(step === 'reveal' || step === 'done') && (
          <div style={{ padding: '22px' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 22, color: '#f9ca24' }}>
                {step === 'done' ? t('shop_done_title') : t('shop_reveal_title')}
              </div>
              {step === 'done' && <div style={{ fontSize: 12, color: '#aaa', marginTop: 3 }}>{t('shop_thanks')}</div>}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
              {drawnCards.map((card, i) => {
                const revealed = i <= revealedIdx
                const rc = RC[card.rarity] || RC.commun
                const { c1, c2 } = cardCC(card.rarity)
                return (
                  <div key={i} style={{ width: 90, borderRadius: 14, overflow: 'hidden', background: revealed ? `linear-gradient(145deg,${c1}33,${c2}55)` : 'linear-gradient(145deg,#2a1a4e,#1a0f3a)', border: revealed ? `2px solid ${c1}` : '2px solid #6c5ce744', transition: 'all .3s', transform: revealed ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(8px)', opacity: revealed ? 1 : 0.3, boxShadow: revealed && card.rarity === 'légendaire' ? `0 4px 20px ${c1}99` : 'none' }}>
                    {revealed ? (
                      <>
                        <div style={{ background: `linear-gradient(90deg,${c1},${c2})`, padding: '4px 7px', fontSize: 9, fontWeight: 900, color: '#fff' }}>{card.type.toUpperCase()}</div>
                        <div style={{ height: 50, background: `linear-gradient(135deg,${c1}22,${c2}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 800 }}>{card.name[0]}</div>
                        <div style={{ textAlign: 'center', fontWeight: 900, fontSize: 10, color: '#1e3045', padding: '2px 4px', background: '#ffffff88' }}>{card.name}</div>
                        <div style={{ background: rc.bg, color: rc.color, fontSize: 7, fontWeight: 800, textAlign: 'center', padding: '2px 0', letterSpacing: .5 }}>{rarityLabel(card.rarity, t).toUpperCase()}</div>
                      </>
                    ) : (
                      <div style={{ height: 98, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>❓</div>
                    )}
                  </div>
                )
              })}
            </div>

            {step === 'done' && (
              <div>
                <div style={{ background: '#ffffff08', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 8, fontWeight: 700 }}>{t('shop_summary')}</div>
                  {['légendaire', 'épique', 'rare', 'commun'].map(r => {
                    const cnt = drawnCards.filter(c => c.rarity === r).length
                    if (!cnt) return null
                    const rc = RC[r]; const { c1 } = cardCC(r)
                    return (
                      <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: c1, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: rc.color, fontWeight: 800 }}>{rarityLabel(r, t)}</span>
                        <span style={{ fontSize: 12, color: '#aaa' }}>× {cnt}</span>
                      </div>
                    )
                  })}
                  {selected?.gold > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f9ca24', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#f9ca24', fontWeight: 800 }}>Gold</span>
                      <span style={{ fontSize: 12, color: '#aaa' }}>+ {selected.gold}</span>
                    </div>
                  )}
                </div>
                <button onClick={() => { onPurchase(drawnCards, selected?.gold || 0); onClose() }}
                  style={{ width: '100%', background: 'linear-gradient(135deg,#00b894,#00cec9)', border: 'none', color: '#fff', padding: '13px', borderRadius: 12, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 16px #00b89444' }}>
                  Ajouter à ma collection !
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
