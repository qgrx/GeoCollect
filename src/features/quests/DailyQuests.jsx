import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../../ThemeContext.jsx'
import { useT } from '../../i18n/translations.js'


// Les textes de quête (nom/description, toutes langues) stockent le seuil sous
// forme de placeholder {n} : changer le seuil dans l'admin adapte le texte
// partout, sans retraduire. Substitution à l'affichage uniquement.
const questText = (txt, threshold) => (txt || '').replace(/\{n\}/g, threshold)

// Affichage pur : le chargement et les rechargements des quêtes vivent dans
// useGameState (refreshQuests), qui garantit qu'une réponse périmée n'écrase
// jamais une progression plus fraîche.
// rerollUsed/onReroll : remplacement d'UNE quête du jour (1×/jour, définitif,
// impossible sur une quête déjà réussie) — écran de confirmation intégré,
// règles de tirage côté serveur. onReroll absent (démo) → pas de bouton.
export default function DailyQuests({ quests, rerollUsed, onReroll }) {
  const { theme } = useTheme()
  const { t, lang } = useT()
  const [confirmQuest, setConfirmQuest] = useState(null)  // quête en attente de confirmation
  const [rerollBusy,   setRerollBusy]   = useState(false)
  const [rerollErr,    setRerollErr]    = useState('')

  if (!quests) return null
  if (!quests.length) return null

  const allDone = quests.every(q => q.completed_at)
  const canReroll = !!onReroll && !rerollUsed

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      width: '100%',
      animation: 'fadeUp .4s ease-out both',
    }}>
      <div style={{
        fontSize: 9, color: theme.textMuted, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {t('quest_title')}
        {allDone && <span style={{ color: theme.gold, fontSize: 8 }}>{t('quest_all_done')}</span>}
      </div>

      {quests.map(q => {
        const done = !!q.completed_at
        const pct  = Math.min(100, Math.round((q.progress / q.threshold) * 100))

        return (
          <div key={q.id} style={{
            background: done ? '#00b89410' : theme.overlay,
            border: `1px solid ${done ? '#00b89433' : theme.border}`,
            borderRadius: 8, padding: '5px 8px',
            transition: 'all .2s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {/* Statut — remplacé par le bouton reroll (1×/jour) tant qu'il est
                  disponible et que la quête n'est pas réussie. La quête
                  « connexion du jour » n'est pas remplaçable (refusée côté API). */}
              {canReroll && !done && q.type !== 'daily_connection' ? (
                <button
                  onClick={() => { setRerollErr(''); setConfirmQuest(q) }}
                  title={t('quest_reroll_btn')} aria-label={t('quest_reroll_btn')}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, padding: 0, flexShrink: 0, opacity: .7, lineHeight: 1,
                  }}>
                  🔄
                </button>
              ) : (
                <span style={{
                  fontSize: 12, flexShrink: 0,
                  color: done ? '#00b894' : theme.textMuted,
                }}>
                  {done ? '✔' : '○'}
                </span>
              )}

              {/* Texte */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: 800,
                  color: done ? '#00b894' : theme.textPrimary,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {questText(q.translations?.[lang]?.name || q.name, q.threshold)}
                </div>
                {!done && (
                  <div style={{ fontSize: 9, color: theme.textSecondary, marginTop: 1 }}>
                    {q.progress}/{q.threshold} {t(`trigger_${q.type}`) || q.type}
                  </div>
                )}
              </div>

              {/* Récompenses */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, flexShrink: 0 }}>
                {q.forge_points > 0 && (
                  <div style={{ fontSize: 10, fontWeight: 900, color: done ? '#a29bfe' : theme.textMuted }}>
                    🔨 {q.forge_points}
                  </div>
                )}
                {(q.gold_reward || 0) > 0 && (
                  <div style={{ fontSize: 10, fontWeight: 900, color: done ? '#f9ca24' : theme.textMuted }}>
                    💰 {q.gold_reward}G
                  </div>
                )}
              </div>
            </div>

            {/* Barre de progression */}
            {!done && q.progress > 0 && (
              <div style={{
                marginTop: 4, height: 2, borderRadius: 1,
                background: theme.overlay, overflow: 'hidden',
              }}>
                <div style={{
                  width: `${pct}%`, height: '100%',
                  background: 'linear-gradient(90deg,#6c5ce7,#a29bfe)',
                  transition: 'width .3s',
                }} />
              </div>
            )}
          </div>
        )
      })}

      {/* Écran de confirmation du remplacement — porté sur <body> (portal) :
          le conteneur des quêtes est animé (stacking context), un position:fixed
          local pourrait rester piégé sous d'autres éléments. z-index au-dessus
          de tout le reste de l'app. */}
      {confirmQuest && createPortal(
        <div
          onClick={() => !rerollBusy && setConfirmQuest(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100001,
            background: 'rgba(0,0,0,.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: theme.bgSurface, border: `1px solid ${theme.border}`,
              borderRadius: 14, padding: '18px 20px', maxWidth: 340, width: '100%',
              boxShadow: '0 12px 40px rgba(0,0,0,.35)',
              fontFamily: "'Nunito',sans-serif",
            }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: theme.textPrimary, marginBottom: 8 }}>
              🔄 {t('quest_reroll_title')}
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: theme.textPrimary, marginBottom: 6 }}>
              {questText(confirmQuest.translations?.[lang]?.name || confirmQuest.name, confirmQuest.threshold)}
            </div>
            <div style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 1.5, marginBottom: 12 }}>
              {t('quest_reroll_body')}
            </div>
            {rerollErr && (
              <div style={{ fontSize: 11, color: '#e74c3c', fontWeight: 800, marginBottom: 10 }}>
                ⚠️ {rerollErr}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                disabled={rerollBusy}
                onClick={() => setConfirmQuest(null)}
                style={{
                  background: theme.overlayMd, border: 'none', color: theme.textPrimary,
                  padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: 800,
                  cursor: 'pointer', fontFamily: "'Nunito',sans-serif",
                }}>
                {t('quest_reroll_cancel')}
              </button>
              <button
                disabled={rerollBusy}
                onClick={async () => {
                  setRerollBusy(true); setRerollErr('')
                  const { error } = await onReroll(confirmQuest.id)
                  setRerollBusy(false)
                  if (error) setRerollErr(typeof error === 'string' ? error : (t('quest_reroll_error') || 'Remplacement impossible'))
                  else setConfirmQuest(null)
                }}
                style={{
                  background: 'linear-gradient(135deg,#6c5ce7,#a29bfe)', border: 'none', color: '#fff',
                  padding: '7px 16px', borderRadius: 8, fontSize: 11, fontWeight: 800,
                  cursor: rerollBusy ? 'wait' : 'pointer', opacity: rerollBusy ? .7 : 1,
                  fontFamily: "'Nunito',sans-serif",
                }}>
                {rerollBusy ? '…' : `🔄 ${t('quest_reroll_confirm')}`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
