import { useTheme } from '../ThemeContext.jsx'
import { useT } from '../i18n/translations.js'
import { useVolume, soundMarketSale } from '../utils/sounds.js'

// Réglage du volume global des sons du jeu — affiché dans le menu utilisateur,
// juste à côté du choix de la langue. Le volume est persisté (localStorage) et
// appliqué en direct via le nœud de gain global de sounds.js.
export default function VolumeControl() {
  const { theme } = useTheme()
  const { t } = useT()
  const [volume, setVolume] = useVolume()
  const pct = Math.round(volume * 100)
  const icon = volume <= 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'

  const toggleMute = () => setVolume(volume <= 0 ? 1 : 0)

  return (
    <div style={{ padding: '8px 10px 10px', borderBottom: `1px solid ${theme.borderLight}` }}>
      <div style={{ fontSize: 9, color: theme.textSecondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6, paddingLeft: 4 }}>{t('menu_volume')}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4, paddingRight: 4 }}>
        <button onClick={toggleMute} title={volume <= 0 ? t('volume_unmute') : t('volume_mute')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0 }}>
          {icon}
        </button>
        <input type="range" min={0} max={100} value={pct}
          onChange={e => setVolume(Number(e.target.value) / 100)}
          onMouseUp={() => volume > 0 && soundMarketSale()}
          onTouchEnd={() => volume > 0 && soundMarketSale()}
          style={{ flex: 1, accentColor: '#f9ca24', cursor: 'pointer', height: 4 }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: theme.textSecondary, width: 34, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
      </div>
    </div>
  )
}
