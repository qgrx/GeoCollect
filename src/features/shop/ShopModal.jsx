import { useState, useEffect, useRef } from 'react';
import { useT } from '../../i18n/translations.js';
import { RC, cardCC, rarityLabel } from '../../data/cards.js';
import { drawPackFromConfig, slotsToContents } from '../../utils/gameUtils.js';
import { apiCreateCheckout, apiGetPurchase } from '../../services/api.js';
import Card from '../../components/Card.jsx';

// Définitions statiques des packs — prix/noms surchargés par la config admin
const DEFAULT_SLOTS = {
  petit_soutien: [
    { rarity: 'commun', qty: 2 },
    { rarity: 'rare',   qty: 2 },
    { rarity: 'épique', alt: 'rare', chance: 50 },
  ],
  soutien: [
    { rarity: 'commun', qty: 6 },
    { rarity: 'rare',   qty: 2 },
    { rarity: 'épique',     alt: 'rare',   chance: 50 },
    { rarity: 'légendaire', alt: 'épique', chance: 50 },
  ],
  gros_soutien: [
    { rarity: 'commun', qty: 6 },
    { rarity: 'rare',   qty: 2 },
    { rarity: 'épique' },
    { rarity: 'légendaire' },
  ],
}

const PACK_DEFS = [
  { id: 'petit_soutien', emoji: '🎁', gradient: 'linear-gradient(135deg,#74b9ff,#0984e3)', defaultName: 'Petit soutien',  defaultPrice: '3,00 €',  defaultGold: 50  },
  { id: 'soutien',       emoji: '💎', gradient: 'linear-gradient(135deg,#a29bfe,#6c5ce7)', defaultName: 'Soutien',        defaultPrice: '8,00 €',  defaultGold: 150 },
  { id: 'gros_soutien',  emoji: '👑', gradient: 'linear-gradient(135deg,#f9ca24,#e17055)', defaultName: 'Gros soutien',   defaultPrice: '15,00 €', defaultGold: 300 },
]

export default function ShopModal({ onClose, cardPool, onPurchase, shopPacksConfig = {}, initialPackId = null, initialCards = null, initialGold = 0 }) {
  const { t } = useT()

  // Calcul des packs AVANT les hooks pour pouvoir initialiser l'état directement
  const packs = PACK_DEFS.map(p => {
    const cfg   = shopPacksConfig[p.id] || {}
    const slots = cfg.slots || DEFAULT_SLOTS[p.id]
    const gold  = cfg.gold  ?? p.defaultGold
    return {
      ...p,
      name:     cfg.name  || p.defaultName,
      price:    cfg.price || p.defaultPrice,
      gold, slots,
      contents: [...slotsToContents(slots), ...(gold > 0 ? [{ icon: '🪙', label: `${gold} Golds` }] : [])],
      enabled:  cfg.enabled !== false,
    }
  }).filter(p => p.enabled)

  const initPack = initialPackId ? (packs.find(p => p.id === initialPackId) || null) : null

  const [step,        setStep]        = useState(initialCards ? 'reveal' : initPack ? 'confirm' : 'shop')
  const [selected,    setSelected]    = useState(initPack || { gold: initialGold })
  const [drawnCards,  setDrawnCards]  = useState(initialCards || [])
  const [revealedIdx, setRevealedIdx] = useState(-1)
  const [errorMsg,    setErrorMsg]    = useState('')
  const pollRef     = useRef(null)
  const checkoutRef = useRef(null)

  // Sauvegarder immédiatement dans la collection + animer le reveal
  useEffect(() => {
    if (initialCards?.length) {
      // Auto-save : plus besoin de cliquer "Ajouter à ma collection"
      onPurchase?.(initialCards, initialGold)
      initialCards.forEach((_, i) => setTimeout(() => setRevealedIdx(i), i * 320 + 400))
      setTimeout(() => setStep('done'), initialCards.length * 320 + 800)
    }
  }, [])

  // Nettoyage du polling au démontage
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  function selectPack(pack) { setSelected(pack); setStep('confirm') }

  async function handlePay() {
    setStep('processing')
    const { data, error } = await apiCreateCheckout(selected.id)
    if (error || !data) {
      setErrorMsg(error || 'Erreur lors de la création du paiement.')
      setStep('error')
      return
    }

    checkoutRef.current = data.checkout_id

    // Mode test sans API key → simuler paiement directement
    if (data.test_mode && !data.pay_url) {
      return pollPayment(data.checkout_id)
    }

    // Ouvrir SumUp dans un nouvel onglet
    window.open(data.pay_url, '_blank', 'noopener')
    setStep('awaiting_payment')
    pollPayment(data.checkout_id)
  }

  function pollPayment(checkoutId) {
    setStep('awaiting_payment')
    pollRef.current = setInterval(async () => {
      const { data } = await apiGetPurchase(checkoutId)
      if (!data) return
      if (data.status === 'paid') {
        clearInterval(pollRef.current)
        revealCards()
      } else if (data.status === 'failed' || data.status === 'expired') {
        clearInterval(pollRef.current)
        setErrorMsg('Paiement échoué ou expiré.')
        setStep('error')
      }
    }, 3000)
  }

  function revealCards() {
    const cards = drawPackFromConfig(cardPool, selected.slots)
    setDrawnCards(cards)
    setStep('reveal')
    cards.forEach((_, i) => setTimeout(() => setRevealedIdx(i), i * 320 + 400))
    setTimeout(() => setStep('done'), cards.length * 320 + 800)
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

            {/* Bouton SumUp */}
            <button onClick={handlePay}
              style={{ width: '100%', background: 'linear-gradient(135deg,#00b4d8,#0077b6)', border: 'none', color: '#fff', padding: '14px', borderRadius: 12, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 20px #0077b644', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 22 }}>💳</span>
              Payer {selected.price} avec SumUp
            </button>
            <button onClick={() => setStep('shop')} style={{ width: '100%', background: '#ffffff10', border: '1px solid #ffffff18', color: '#aaa', padding: '10px', borderRadius: 10, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
              ← Choisir un autre pack
            </button>
            <div style={{ marginTop: 10, fontSize: 10, color: '#444', textAlign: 'center' }}>
              🔒 Paiement sécurisé via SumUp · CB, Apple Pay, Google Pay · Aucune donnée bancaire stockée
            </div>
          </div>
        )}

        {/* ── TRAITEMENT ── */}
        {step === 'processing' && (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 52, animation: 'float 1s ease-in-out infinite', display: 'inline-block' }}>⏳</div>
            <div style={{ fontWeight: 900, fontSize: 18, color: '#fff', marginTop: 16, marginBottom: 8 }}>Création du paiement…</div>
            <div style={{ color: '#888', fontSize: 13 }}>Connexion à SumUp en cours</div>
            <div style={{ marginTop: 20, background: '#ffffff18', borderRadius: 50, height: 6, overflow: 'hidden', width: 200, margin: '20px auto 0' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg,#00b4d8,#0077b6)', borderRadius: 50, animation: 'shimmer 1.5s linear infinite', backgroundSize: '200% 100%' }} />
            </div>
          </div>
        )}

        {/* ── ATTENTE PAIEMENT ── */}
        {step === 'awaiting_payment' && (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>💳</div>
            <div style={{ fontWeight: 900, fontSize: 18, color: '#fff', marginBottom: 8 }}>En attente du paiement</div>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
              La page SumUp s'est ouverte dans un nouvel onglet.<br />
              Cette fenêtre se mettra à jour automatiquement après paiement.
            </div>
            <div style={{ background: '#ffffff18', borderRadius: 50, height: 6, overflow: 'hidden', width: 200, margin: '0 auto 20px' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg,#00b4d8,#0077b6)', borderRadius: 50, animation: 'shimmer 2s linear infinite', backgroundSize: '200% 100%' }} />
            </div>
            <button onClick={() => { if (checkoutRef.current) pollPayment(checkoutRef.current) }}
              style={{ background: '#ffffff18', border: '1px solid #ffffff22', color: '#aaa', padding: '8px 18px', borderRadius: 10, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
              Vérifier manuellement
            </button>
          </div>
        )}

        {/* ── ERREUR ── */}
        {step === 'error' && (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
            <div style={{ fontWeight: 900, fontSize: 16, color: '#e74c3c', marginBottom: 8 }}>Paiement non abouti</div>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>{errorMsg}</div>
            <button onClick={() => setStep('confirm')}
              style={{ background: 'linear-gradient(135deg,#e74c3c,#c0392b)', border: 'none', color: '#fff', padding: '11px 22px', borderRadius: 10, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>
              Réessayer
            </button>
          </div>
        )}

        {/* ── RÉVÉLATION ── */}
        {(step === 'reveal' || step === 'done') && (
          <div style={{ padding: '20px 18px' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 20, color: '#f9ca24' }}>
                {step === 'done' ? '🎉 Geocoins ajoutés à votre collection !' : t('shop_reveal_title')}
              </div>
              {step === 'done' && selected?.gold > 0 && (
                <div style={{ fontSize: 12, color: '#f9ca24', marginTop: 4, fontWeight: 800 }}>+ {selected.gold} Golds crédités</div>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 18 }}>
              {drawnCards.map((card, i) => {
                const revealed = i <= revealedIdx
                const { c1 } = cardCC(card.rarity)
                return (
                  <div key={i} style={{
                    transition: 'all .35s cubic-bezier(.34,1.56,.64,1)',
                    transform: revealed ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(12px)',
                    opacity: revealed ? 1 : 0,
                    boxShadow: revealed && card.rarity === 'légendaire' ? `0 0 20px ${c1}99` : 'none',
                  }}>
                    {revealed
                      ? <Card card={card} small />
                      : <div style={{ width: 65, height: 91, borderRadius: 10, background: 'linear-gradient(145deg,#2a1a4e,#1a0f3a)', border: '2px solid #6c5ce744', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>❓</div>
                    }
                  </div>
                )
              })}
            </div>

            {step === 'done' && (
              <button onClick={onClose}
                style={{ width: '100%', background: 'linear-gradient(135deg,#00b894,#00cec9)', border: 'none', color: '#fff', padding: '13px', borderRadius: 12, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 16px #00b89444' }}>
                Fermer
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
