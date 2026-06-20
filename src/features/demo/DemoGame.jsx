/**
 * Mode démo « onboarding » — fin de parcours.
 *
 * Après les 5 geocoins, DemoComplete remplace la barre de quiz : message de
 * félicitations + arguments (quiz en direct, 200+ geocoins, fonctionnalités) +
 * bouton « Créer mon compte ». L'inscription réelle (Google/email) passe par le
 * vrai AuthModal en mode conversion (geocoins conservés) — pas de formulaire maison.
 */

export function DemoComplete({ onSignup, t }) {
  const feats = [
    { icon: '⚡', title: t('demo_done_feat1_t'), body: t('demo_done_feat1_b') },
    { icon: '🪙', title: t('demo_done_feat2_t'), body: t('demo_done_feat2_b') },
    { icon: '🎁', title: t('demo_done_feat3_t'), body: t('demo_done_feat3_b') },
  ]
  return (
    <div style={{ background: 'linear-gradient(135deg,#6c5ce7,#5a4bd6)', borderRadius: 16, padding: '16px 16px 18px', color: '#fff', fontFamily: "'Nunito',sans-serif", boxShadow: '0 8px 28px #6c5ce744' }}>
      <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 16, lineHeight: 1.25, marginBottom: 4 }}>
        🎉 {t('demo_done_title')}
      </div>
      <div style={{ fontSize: 12.5, color: '#e7e3ff', lineHeight: 1.45, marginBottom: 12 }}>
        {t('demo_done_sub')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {feats.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#ffffff14', borderRadius: 11, padding: '8px 11px' }}>
            <div style={{ fontSize: 20, flexShrink: 0, width: 26, textAlign: 'center' }}>{f.icon}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 12.5 }}>{f.title}</div>
              <div style={{ fontSize: 11, color: '#d8d2ff', lineHeight: 1.35 }}>{f.body}</div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={onSignup} style={{ width: '100%', background: '#fff', color: '#4a36c7', border: 'none', borderRadius: 12, padding: '12px', fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 15, cursor: 'pointer' }}>
        ✨ {t('demo_done_cta')}
      </button>
    </div>
  )
}
