import { useState, useEffect } from 'react'
import { useT, getLang } from '../../i18n/translations.js'
import { useTheme } from '../../ThemeContext.jsx'
import { cardCC, rarityLabel, cardName } from '../../data/cards.js'
import useVisualViewport from '../../hooks/useVisualViewport.js'

/**
 * « Récupération impossible » — le serveur (409 sur POST /api/hold/claim) refuse de
 * sortir un geocoin du dépôt parce qu'un plafond est atteint. Le geocoin RESTE au
 * dépôt : on l'explique, et on affiche le décompte jusqu'à la remise à zéro annoncée
 * par le serveur (`reset_at`), seule source de vérité — minuit et le lundi sont des
 * bornes de PARIS, que l'horloge locale du joueur ne connaît pas forcément.
 */
export default function HoldCapModal({ block, onClose }) {
  const { t } = useT()
  const { theme } = useTheme()
  const vv = useVisualViewport()
  const [remaining, setRemaining] = useState(() => msUntil(block?.reset_at))

  // Décompte à la seconde. Se relance sur un nouveau blocage (reset_at différent).
  useEffect(() => {
    if (!block?.reset_at) return
    setRemaining(msUntil(block.reset_at))
    const id = setInterval(() => setRemaining(msUntil(block.reset_at)), 1000)
    return () => clearInterval(id)
  }, [block?.reset_at])

  if (!block) return null

  const card = block.card || null
  const { c1, c2 } = cardCC(block.rarity || card?.rarity || 'commun')
  const over = remaining <= 0

  const reasonText = block.reason === 'weekly_cap'
    ? t('hold_cap_weekly').replace('{rarity}', rarityLabel(block.rarity, t))
    : block.reason === 'daily_shiny_cap'
      ? t('hold_cap_daily_shiny')
      : t('hold_cap_daily')

  return (
    <div style={{ position: 'fixed', left: 0, right: 0, top: vv ? vv.offsetTop : 0, height: vv ? vv.height : '100%', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000a', padding: 20 }}>
      <div style={{ background: 'linear-gradient(145deg,#0f1923,#1a2736)', border: `1.5px solid ${c1}55`, borderRadius: 20, padding: '24px 22px', maxWidth: 380, width: '100%', maxHeight: vv ? `${Math.max(0, vv.height - 40)}px` : 'calc(100dvh - 40px)', overflowY: 'auto', boxSizing: 'border-box', boxShadow: `0 0 40px ${c1}33, 0 12px 40px #0008`, fontFamily: "'Nunito',sans-serif" }}>

        <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 17, color: '#f9ca24', marginBottom: 10 }}>
          🚫 {t('hold_cap_title')}
        </div>

        {card && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: 10, borderRadius: 12, background: `linear-gradient(135deg,${c1}18,${c2}12)`, border: `1px solid ${c1}44` }}>
            <div style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 8, overflow: 'hidden', border: `2px solid ${c1}`, background: '#1e3045' }}>
              {card.image_url
                ? <img src={card.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff' }}>{card.name?.[0] || '?'}</div>}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {block.is_shiny && '✨'}{cardName(card, getLang())}
              </div>
              <div style={{ fontSize: 11, color: c1, fontWeight: 800 }}>{rarityLabel(block.rarity || card.rarity, t)}</div>
            </div>
          </div>
        )}

        <div style={{ fontSize: 12.5, color: theme.textSecondary, lineHeight: 1.55, marginBottom: 14 }}>
          {reasonText.replace('{count}', block.count ?? 0).replace('{limit}', block.limit ?? 0)}
          {' '}{t('hold_cap_kept')}
        </div>

        <div style={{ textAlign: 'center', padding: '12px 10px', borderRadius: 12, background: '#ffffff0d', border: `1px solid ${c1}33`, marginBottom: 16 }}>
          <div style={{ fontSize: 10.5, color: theme.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            {t('hold_cap_available_in')}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: over ? 14 : 18, fontWeight: 900, color: over ? '#00b894' : theme.gold }}>
            {over ? t('hold_cap_ready') : formatRemaining(remaining, t)}
          </div>
        </div>

        <button
          onClick={onClose}
          style={{ width: '100%', background: `linear-gradient(135deg,${c1},${c2})`, border: 'none', color: '#1e3045', padding: '11px 0', borderRadius: 11, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>
          {t('hold_cap_close')}
        </button>
      </div>
    </div>
  )
}

function msUntil(iso) {
  const target = iso ? Date.parse(iso) : NaN
  return isNaN(target) ? 0 : Math.max(0, target - Date.now())
}

/**
 * « 2 j 05 h 14 min 08 s » — les jours et les heures disparaissent tant qu'ils valent
 * zéro (la dernière minute n'affiche que les secondes), les unités sont traduites.
 */
function formatRemaining(ms, t) {
  const total = Math.floor(ms / 1000)
  const days  = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const mins  = Math.floor((total % 3600) / 60)
  const secs  = total % 60
  const pad = n => String(n).padStart(2, '0')
  const parts = []
  if (days)             parts.push(`${days} ${t('unit_days')}`)
  if (days || hours)    parts.push(`${pad(hours)} ${t('unit_hours')}`)
  if (days || hours || mins) parts.push(`${pad(mins)} ${t('unit_minutes')}`)
  parts.push(`${pad(secs)} ${t('unit_seconds')}`)
  return parts.join(' ')
}
