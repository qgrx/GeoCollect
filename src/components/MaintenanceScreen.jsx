import { useT } from '../i18n/translations.js'
import { apiSetConfig } from '../services/api.js'

export default function MaintenanceScreen({ text, isAdmin, onDisable }) {
  const { t } = useT()
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg,#0f0c29,#302b63)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Nunito',sans-serif",
    }}>
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>🛠️</div>
        <div style={{
          fontFamily: "'Fredoka One',sans-serif",
          fontSize: 32, color: '#f9ca24', marginBottom: 12,
        }}>
          {t('maint_title')}
        </div>
        <div style={{ color: '#aaa', fontSize: 16, maxWidth: 500, lineHeight: 1.6, marginBottom: 28 }}>
          {text || t('maint_default')}
        </div>
        {isAdmin && (
          <button onClick={onDisable}
            style={{ background: 'linear-gradient(135deg,#00b894,#00cec9)', border: 'none', color: '#fff',
              padding: '12px 28px', borderRadius: 12, fontFamily: "'Nunito',sans-serif",
              fontWeight: 900, fontSize: 15, cursor: 'pointer',
              boxShadow: '0 4px 20px #00b89444' }}>
            🟢 Remettre le site en ligne
          </button>
        )}
      </div>
    </div>
  )
}
