import { useTheme } from '../../ThemeContext.jsx'
import { useT } from '../../i18n/translations.js'


// Affichage pur : le chargement et les rechargements des quêtes vivent dans
// useGameState (refreshQuests), qui garantit qu'une réponse périmée n'écrase
// jamais une progression plus fraîche.
export default function DailyQuests({ quests }) {
  const { theme } = useTheme()
  const { t, lang } = useT()

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
                  {q.translations?.[lang]?.name || q.name}
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
    </div>
  )
}
