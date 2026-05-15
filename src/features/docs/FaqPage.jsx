import { useState } from 'react'

function Item({ q, a, mode, textColor, mutedColor, borderCol, cardBg }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ background: cardBg, border: `1px solid ${borderCol}`, borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 14, color: textColor, textAlign: 'left' }}>
        <span>{q}</span>
        <span style={{ flexShrink: 0, fontSize: 18, color: mutedColor, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>⌄</span>
      </button>
      {open && (
        <div style={{ padding: '4px 18px 16px', fontSize: 14, color: mutedColor, lineHeight: 1.7, borderTop: `1px solid ${borderCol}` }}>
          {a}
        </div>
      )}
    </div>
  )
}

const FAQS = [
  { q: 'Comment gagner des geocoins ?', a: "Répondez correctement aux quiz qui apparaissent toutes les 60 secondes. Le premier joueur à donner la bonne réponse remporte le geocoin en jeu. Vous pouvez aussi acheter des packs dans l'onglet Trésors." },
  { q: 'Comment fonctionne le quiz ?', a: "Un décompte s'affiche en bas de l'écran. Quand il atteint zéro, un geocoin est disponible. Cliquez sur « Participer » et soyez le premier à donner la bonne réponse !" },
  { q: 'Les geocoins achetés sont-ils définitifs ?', a: "Oui, tous les geocoins achetés sont immédiatement ajoutés à votre collection et sauvegardés. Ils ne peuvent pas expirer ni être supprimés." },
  { q: 'Comment fonctionne le marché ?', a: "Vous pouvez vendre vos geocoins en double sur le marché et en acheter d'autres. Le prix est fixé librement par le vendeur." },
  { q: "Qu'est-ce qu'un geocoin brillant (shiny) ?", a: "Les geocoins brillants sont des versions rares de geocoins ordinaires, avec un effet visuel spécial. Ils s'obtiennent par forge en dépensant des points de forge." },
  { q: 'Comment obtenir des points de forge ?', a: "Les points de forge sont gagnés en complétant des quêtes quotidiennes. Ils permettent de forger des geocoins brillants dans l'atelier de forge." },
  { q: 'Mon paiement a été débité mais je n\'ai pas reçu mes geocoins', a: "Vérifiez votre collection — les geocoins sont crédités automatiquement après confirmation du paiement. Si le problème persiste au-delà de quelques minutes, contactez-nous à contact@geocoins.fr en précisant la date et le montant." },
  { q: 'Comment supprimer mon compte ?', a: "Vous pouvez supprimer votre compte depuis Mon Compte → Supprimer mon compte. Cette action est irréversible." },
]

export default function FaqPage({ theme, mode, textColor, mutedColor }) {
  const cardBg   = mode === 'light' ? '#ffffff' : '#1a2744'
  const borderCol = mode === 'light' ? '#e0e8f0' : '#ffffff18'

  return (
    <div style={{ padding: '32px 28px', maxWidth: 680, margin: '0 auto', color: textColor }}>
      <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 28, color: theme.gold, marginBottom: 6 }}>❓ FAQ</div>
      <div style={{ color: mutedColor, fontSize: 14, marginBottom: 28 }}>Questions fréquemment posées</div>
      {FAQS.map(({ q, a }) => (
        <Item key={q} q={q} a={a} mode={mode} textColor={textColor} mutedColor={mutedColor} borderCol={borderCol} cardBg={cardBg} />
      ))}
    </div>
  )
}
