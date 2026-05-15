const RELEASES = [
  {
    version: 'v2.5 — Mai 2026',
    items: [
      { type: '✨', text: 'Packs Geocoins — achetez des geocoins via Google Pay, Apple Pay ou CB' },
      { type: '✨', text: 'Geocoins de saison — des geocoins disponibles uniquement pendant une période définie' },
      { type: '✨', text: 'Nouveau décompte avant chaque quiz avec effet de mèche lumineux' },
      { type: '✨', text: 'Bannière « Félicitations à [joueur] » après chaque victoire' },
      { type: '🔧', text: 'Correction de l\'horloge au rechargement de page pendant un décompte' },
      { type: '🔧', text: 'Correction de la troncature des pseudos dans l\'historique' },
    ],
  },
  {
    version: 'v2.4 — Avril 2026',
    items: [
      { type: '✨', text: 'Page Trésors — offre quotidienne gratuite + boutique packs' },
      { type: '✨', text: 'Système de forge brillante — transformez vos geocoins en version shiny' },
      { type: '✨', text: 'Quêtes quotidiennes — complétez des objectifs pour gagner des points de forge' },
      { type: '🔧', text: 'Amélioration des performances du marché' },
    ],
  },
  {
    version: 'v2.3 — Mars 2026',
    items: [
      { type: '✨', text: 'Marché entre joueurs — vendez et achetez des geocoins en double' },
      { type: '✨', text: 'Système de rangs et de score' },
      { type: '✨', text: 'Achievements permanents et journaliers' },
      { type: '🔧', text: 'Refonte du système de quiz avec planification serveur' },
    ],
  },
  {
    version: 'v2.0 — Janvier 2026',
    items: [
      { type: '✨', text: 'Lancement de Geocoins — collecte des cartes en répondant à des quiz en temps réel' },
      { type: '✨', text: 'Collection personnelle, streaks, progression' },
      { type: '✨', text: 'Classement des joueurs' },
    ],
  },
]

const TYPE_COLOR = { '✨': '#f9ca24', '🔧': '#74b9ff', '🐛': '#e74c3c' }

export default function ReleaseNotesPage({ theme, mode, textColor, mutedColor }) {
  const cardBg    = mode === 'light' ? '#ffffff' : '#1a2744'
  const borderCol = mode === 'light' ? '#e0e8f0' : '#ffffff18'

  return (
    <div style={{ padding: '32px 28px', maxWidth: 680, margin: '0 auto', color: textColor }}>
      <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 28, color: theme.gold, marginBottom: 6 }}>📋 Release Notes</div>
      <div style={{ color: mutedColor, fontSize: 14, marginBottom: 28 }}>Historique des mises à jour</div>

      {RELEASES.map(({ version, items }) => (
        <div key={version} style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: theme.gold, flexShrink: 0 }} />
            {version}
          </div>
          <div style={{ background: cardBg, border: `1px solid ${borderCol}`, borderRadius: 12, padding: '14px 18px' }}>
            {items.map(({ type, text }, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0', borderBottom: i < items.length - 1 ? `1px solid ${borderCol}` : 'none' }}>
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{type}</span>
                <span style={{ fontSize: 13, color: mutedColor, lineHeight: 1.6 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
