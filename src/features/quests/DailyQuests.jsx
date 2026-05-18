import { useEffect, useState, useCallback } from 'react'
import { apiGetDailyQuests } from '../../services/api.js'
import { useTheme } from '../../ThemeContext.jsx'
import { useT } from '../../i18n/translations.js'

const TRIGGER_LABELS = {
  buy_count:        'Achats marché',
  sell_count:       'Mises en vente',
  quiz_win:         'Quiz gagnés',
  new_card:         'Nouvelles cartes',
  streak:           'Streak',
  collection_size:  'Cartes uniques',
  daily_connection: 'Connexions (3h)',
  forge_card:       'Cartes forgées',
  forge_shiny:      'Cartes rendues brillantes',
}

export default function DailyQuests({ questActivitySignal, initialQuests }) {
  const { theme } = useTheme()
  const { t } = useT()
  // Pré-remplir immédiatement depuis les données chargées au démarrage
  const [quests, setQuests] = useState(initialQuests ?? null)

  const load = useCallback(async () => {
    const { data } = await apiGetDailyQuests()
    if (data?.quests) setQuests(data.quests)
  }, [])

  // Si les données pré-chargées arrivent après le premier rendu, les accepter
  useEffect(() => {
    if (initialQuests) setQuests(initialQuests)
  }, [initialQuests])

  // Premier fetch uniquement si rien de pré-chargé
  useEffect(() => {
    if (!initialQuests) load()
  }, [])

  // Recharger après chaque action de jeu pertinente
  useEffect(() => {
    if (questActivitySignal > 0) load()
  }, [questActivitySignal, load])

  if (!quests) return null
  if (!quests.length) return null

  const allDone = quests.every(q => q.completed_at)

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
              {/* Statut */}
              <span style={{
                fontSize: 12, flexShrink: 0,
                color: done ? '#00b894' : theme.textMuted,
              }}>
                {done ? '✔' : '○'}
              </span>

              {/* Texte */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: 800,
                  color: done ? '#00b894' : theme.textPrimary,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {q.name}
                </div>
                {!done && (
                  <div style={{ fontSize: 9, color: theme.textMuted, marginTop: 1 }}>
                    {q.progress}/{q.threshold} {TRIGGER_LABELS[q.type] || q.type}
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
    </div>
  )
}
