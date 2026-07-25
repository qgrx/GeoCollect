import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../../ThemeContext.jsx'
import { useT } from '../../i18n/translations.js'

// Panneau de quêtes unifié : onglets « Jour / Semaine » — on n'affiche que les 3
// quêtes de la période active (moitié de la hauteur vs deux listes empilées),
// chaque quête gardant tout son détail (progression, récompenses, reroll).
//
// Remplace DailyQuests + WeeklyQuests. Chaque période reçoit ses propres données
// et son handler de reroll ; « weekly » peut être null (mode démo) → seul l'onglet
// Jour s'affiche, sans barre d'onglets.

const questText = (txt, threshold) => (txt || '').replace(/\{n\}/g, threshold)

// Type de quête non remplaçable (récompense quasi-automatique) par période.
const NON_REROLLABLE = { daily: 'daily_connection', weekly: 'weekly_connection' }
// Clés i18n du texte de reroll (bouton + corps de confirmation) par période.
const REROLL_KEYS = {
  daily:  { btn: 'quest_reroll_btn',        body: 'quest_reroll_body' },
  weekly: { btn: 'weekly_quest_reroll_btn', body: 'weekly_quest_reroll_body' },
}

export default function QuestsPanel({ daily, weekly }) {
  const { theme } = useTheme()
  const { t, lang } = useT()
  const [active, setActive] = useState('daily')
  const [confirmQuest, setConfirmQuest] = useState(null)
  const [rerollBusy,   setRerollBusy]   = useState(false)
  const [rerollErr,    setRerollErr]    = useState('')

  // Périodes réellement disponibles (weekly absent en démo → onglet unique).
  const periods = [
    daily?.quests?.length ? { key: 'daily',  label: t('quest_tab_day'),  ...daily }  : null,
    weekly?.quests?.length ? { key: 'weekly', label: t('quest_tab_week'), ...weekly } : null,
  ].filter(Boolean)

  if (!periods.length) return null

  // Onglet actif (retombe sur le 1er dispo si l'actif a disparu).
  const cur = periods.find(p => p.key === active) || periods[0]
  const quests   = cur.quests
  const onReroll = cur.onReroll
  const rerollUsed = cur.rerollUsed
  const canReroll  = !!onReroll && !rerollUsed
  const nonReroll  = NON_REROLLABLE[cur.key]
  const rerollKeys = REROLL_KEYS[cur.key]

  const doneCount = quests.filter(q => q.completed_at).length
  const allDone   = doneCount === quests.length

  const switchTo = (key) => { if (key !== active) { setActive(key); setConfirmQuest(null); setRerollErr('') } }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      width: '100%',
      animation: 'fadeUp .4s ease-out both',
    }}>
      {/* En-tête : onglets segmentés seuls (leurs libellés « Quotidiennes / Hebdo »
          suffisent), OU titre + badge « complètes » quand une seule période existe. */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: periods.length > 1 ? 'flex-end' : 'space-between',
        gap: 6, marginBottom: 2,
      }}>
        {periods.length === 1 && (
          <div style={{
            fontSize: 9, color: theme.textMuted, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 1,
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
          }}>
            {t('quest_title_generic')}
            {allDone && (
              <span style={{ color: theme.gold, fontSize: 8 }}>{t('quest_all_done')}</span>
            )}
          </div>
        )}

        {periods.length > 1 && (
          <div style={{
            display: 'flex', gap: 2, padding: 2,
            background: theme.overlay, borderRadius: 999,
            border: `1px solid ${theme.border}`,
          }}>
            {periods.map(p => {
              const on   = p.key === cur.key
              const dc   = p.quests.filter(q => q.completed_at).length
              const done = dc === p.quests.length
              return (
                <button
                  key={p.key}
                  onClick={() => switchTo(p.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    border: 'none', cursor: 'pointer', borderRadius: 999,
                    padding: '3px 9px', fontSize: 9.5, fontWeight: 800,
                    letterSpacing: .3, lineHeight: 1,
                    fontFamily: "'Nunito',sans-serif",
                    background: on ? 'linear-gradient(135deg,#6c5ce7,#a29bfe)' : 'transparent',
                    color: on ? '#fff' : theme.textSecondary,
                    transition: 'all .15s',
                  }}>
                  {p.label}
                  <span style={{
                    fontSize: 8.5, fontWeight: 900,
                    color: done ? (on ? '#ffe9a8' : theme.gold) : (on ? 'rgba(255,255,255,.75)' : theme.textMuted),
                  }}>
                    {done ? '✦' : `${dc}/${p.quests.length}`}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Liste des quêtes de la période active */}
      {quests.map(q => {
        const done = !!q.completed_at
        const pct  = Math.min(100, Math.round((q.progress / q.threshold) * 100))

        return (
          <div key={`${cur.key}-${q.id}`} style={{
            background: done ? '#00b89410' : theme.overlay,
            border: `1px solid ${done ? '#00b89433' : theme.border}`,
            borderRadius: 8, padding: '5px 8px',
            transition: 'all .2s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {/* Statut — remplacé par le bouton reroll tant qu'il est disponible et
                  que la quête n'est pas réussie. La quête « connexion » (jour ou
                  semaine) n'est pas remplaçable (refusée côté API). */}
              {canReroll && !done && q.type !== nonReroll ? (
                <button
                  onClick={() => { setRerollErr(''); setConfirmQuest(q) }}
                  title={t(rerollKeys.btn)} aria-label={t(rerollKeys.btn)}
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

      {/* Écran de confirmation du remplacement — porté sur <body> (portal). */}
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
              {t(rerollKeys.body)}
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
