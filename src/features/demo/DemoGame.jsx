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
    <div style={{ background: 'linear-gradient(135deg,#6c5ce7,#5a4bd6)', borderRadius: 12, padding: '10px 12px', color: '#fff', fontFamily: "'Nunito',sans-serif", boxShadow: '0 6px 20px #6c5ce744' }}>
      <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 13.5, lineHeight: 1.2 }}>
        🎉 {t('demo_done_title')}
      </div>
      <div style={{ fontSize: 11, color: '#e7e3ff', lineHeight: 1.3, marginBottom: 8 }}>
        {t('demo_done_sub')}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {feats.map((f, i) => (
          <div key={i} title={f.body} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 2, background: '#ffffff14', borderRadius: 9, padding: '7px 5px' }}>
            <div style={{ fontSize: 17, lineHeight: 1 }}>{f.icon}</div>
            <div style={{ fontWeight: 900, fontSize: 10.5, lineHeight: 1.1 }}>{f.title}</div>
          </div>
        ))}
      </div>
      <button onClick={onSignup} style={{ width: '100%', background: '#fff', color: '#4a36c7', border: 'none', borderRadius: 10, padding: '9px', fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>
        ✨ {t('demo_done_cta')}
      </button>
    </div>
  )
}
