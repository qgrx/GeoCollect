import { useEffect, useRef } from 'react'
import { useT } from '../../i18n/translations.js'

function SellerIdentity() {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.fillStyle = '#1a2d3d'
    ctx.font = '14px Georgia, serif'
    ctx.fillText('M. Grosyeux Quentin, immatriculé au RCS/RNE de Paris sous le numéro', 0, 18)
    ctx.fillText('SIRET 88890332500023, dont le siège social est situé au', 0, 38)
    ctx.fillText('25 rue Duranton, 75015 Paris.', 0, 58)
  }, [])
  return <canvas ref={ref} width={600} height={68} style={{ maxWidth: '100%', display: 'block' }} aria-hidden="true" />
}

const S = {
  page:    { minHeight: '100vh', background: '#f8fafc', fontFamily: "'Georgia', serif", color: '#1a2d3d', lineHeight: 1.7 },
  header:  { background: '#1e2d3d', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 10 },
  back:    { background: 'none', border: '1px solid #ffffff44', color: '#fff', padding: '6px 14px', borderRadius: 8, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 13, cursor: 'pointer' },
  wrap:    { maxWidth: 800, margin: '0 auto', padding: '40px 24px 80px' },
  title:   { fontFamily: "'Fredoka One',sans-serif", fontSize: 26, color: '#1e2d3d', marginBottom: 4 },
  date:    { fontSize: 13, color: '#6b7d92', marginBottom: 36, fontFamily: "'Nunito',sans-serif" },
  h2:      { fontSize: 17, fontWeight: 700, color: '#1e2d3d', marginTop: 32, marginBottom: 10, fontFamily: "'Nunito',sans-serif" },
  p:       { fontSize: 14, marginBottom: 14, color: '#2d4456' },
  ul:      { paddingLeft: 22, marginBottom: 14 },
  li:      { fontSize: 14, marginBottom: 6, color: '#2d4456' },
  box:     { background: '#eef4fb', border: '1px solid #c8d8e8', borderRadius: 10, padding: '16px 20px', marginBottom: 14, fontSize: 14 },
  divider: { border: 'none', borderTop: '1px solid #dce8f0', margin: '32px 0' },
}

export default function CgvPage({ onClose }) {
  return (
    <div style={S.page}>
      <div style={S.header}>
        <button onClick={onClose} style={S.back}>← Retour</button>
        <span style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 16, color: '#f9ca24' }}>🗺️ Geocoins</span>
      </div>

      <div style={S.wrap}>
        <div style={S.title}>Conditions Générales de Vente</div>
        <div style={S.date}>En vigueur au 23/05/2026 — geocoins.fr</div>

        <h2 style={S.h2}>Article 1 – Objet et Champ d'Application</h2>
        <p style={S.p}>
          Les présentes Conditions Générales de Vente (ci-après "CGV") s'appliquent, sans restriction ni réserve,
          à l'ensemble des ventes d'objets virtuels, monnaies numériques, licences d'utilisation et contenus
          numériques (ci-après "les Produits Virtuels") conclus via le site internet geocoins.fr
          (ci-après "le Site") entre :
        </p>
        <div style={S.box}>
          <strong>Le Vendeur :</strong><br />
          <SellerIdentity />
        </div>
        <p style={S.p}>
          <strong>L'Acheteur :</strong> Toute personne physique ou morale procédant à un achat sur le Site.
        </p>
        <p style={S.p}>
          L'achat d'un Produit Virtuel sur le Site implique l'acceptation pleine et entière des présentes CGV
          par l'Acheteur, qui reconnaît en avoir pris connaissance avant de valider sa commande.
        </p>

        <hr style={S.divider} />

        <h2 style={S.h2}>Article 2 – Caractéristiques des Produits Virtuels</h2>
        <p style={S.p}>
          Le Site geocoins.fr propose à la vente des biens exclusivement immatériels et numériques
          (monnaies virtuelles, jetons, droits d'accès ou objets applicatifs).
        </p>
        <p style={S.p}>
          L'achat de ces Produits Virtuels ne confère à l'Acheteur aucun droit de propriété physique ou
          intellectuelle sur les éléments du Site ou des plateformes tierces associées. L'Acheteur acquiert
          uniquement une licence d'utilisation limitée, personnelle, non transférable et révocable d'utiliser
          lesdits Produits Virtuels dans le cadre strict prévu par le Site. La revente, l'échange ou le
          transfert de Produits Virtuels en dehors des systèmes officiels du Site est strictement interdit.
        </p>

        <hr style={S.divider} />

        <h2 style={S.h2}>Article 3 – Processus de Commande</h2>
        <p style={S.p}>Pour passer commande, l'Acheteur doit obligatoirement suivre le processus suivant :</p>
        <ul style={S.ul}>
          <li style={S.li}>Sélection des Produits Virtuels et ajout au panier.</li>
          <li style={S.li}>Validation du panier : accès à un écran récapitulatif détaillant la nature des Produits, la quantité et le prix total TTC (Premier Clic).</li>
          <li style={S.li}>Acceptation des CGV et renonciation expresse au droit de rétractation (via des cases à cocher obligatoires).</li>
          <li style={S.li}>Validation définitive avec obligation de paiement en cliquant sur le bouton "Acheter" ou "Commande avec obligation de paiement" (Second Clic).</li>
        </ul>
        <p style={S.p}>
          Un e-mail de confirmation reprenant le détail de la transaction est envoyé sans délai à l'Acheteur
          sur un support durable.
        </p>

        <hr style={S.divider} />

        <h2 style={S.h2}>Article 4 – Tarifs et Modalités de Paiement</h2>
        <p style={S.p}>
          Les prix des Produits Virtuels sont indiqués en Euros (€) et sont fermes au moment de la validation
          de la commande. Les prix sont indiqués Hors Taxes (HT), la TVA étant non applicable en vertu de
          l'article 293 B du Code Général des Impôts.
        </p>
        <p style={S.p}>
          Le paiement est exigible immédiatement au moment de la commande. Le Site utilise un système de
          paiement sécurisé tiers (SumUp). Le Vendeur ne conserve aucune donnée bancaire confidentielle
          sur ses serveurs.
        </p>

        <hr style={S.divider} />

        <h2 style={S.h2}>Article 5 – Livraison</h2>
        <p style={S.p}>
          Les Produits Virtuels étant par nature dématérialisés, aucune livraison physique n'est effectuée.
          La livraison s'effectue par injection directe, mise à disposition sur le compte de l'Acheteur,
          de manière immédiate (ou dans un délai maximal de 24 heures en cas de vérification anti-fraude)
          après la validation du paiement.
        </p>
        <p style={S.p}>
          Si la livraison technique n'a pas pu être effectuée dans un délai de 7 jours après le paiement pour
          des raisons non imputables à l'Acheteur, ce dernier pourra demander l'annulation de la vente et le
          remboursement intégral des sommes versées.
        </p>
        <p style={S.p}>
          Le Vendeur se réserve le droit de modifier, suspendre ou arrêter définitivement le Site geocoins.fr
          ou l'accès aux Produits Virtuels hébergés sur ses infrastructures, sous réserve d'un préavis de
          30 jours notifié par e-mail ou par un affichage clair sur le Site. Passé ce délai, aucun
          remboursement ni indemnité ne pourra être réclamé par l'Acheteur pour les Produits Virtuels
          restants sur son compte.
        </p>

        <hr style={S.divider} />

        <h2 style={S.h2}>Article 6 – Absence de Droit de Rétractation</h2>
        <div style={{ ...S.box, background: '#fff8f0', border: '1px solid #f9ca2466' }}>
          <p style={{ ...S.p, marginBottom: 0 }}>
            Conformément à l'article L. 221-28 13° du Code de la consommation, le droit de rétractation
            ne peut être exercé pour les contrats de fourniture de contenu numérique non fourni sur un
            support matériel dont l'exécution a commencé après accord préalable exprès du consommateur
            et renonciation expresse à son droit de rétractation.
          </p>
        </div>
        <p style={S.p}>
          En validant sa commande et en cochant la case dédiée, l'Acheteur accepte expressément que la
          livraison du contenu numérique commence immédiatement après son paiement et renonce expressément
          à son droit de rétractation de quatorze (14) jours. <strong>Aucun remboursement ne sera accordé
          une fois le produit virtuel délivré.</strong>
        </p>

        <hr style={S.divider} />

        <h2 style={S.h2}>Article 7 – Garanties Légales</h2>
        <p style={S.p}>
          Le Vendeur est tenu des défauts de conformité du contenu numérique dans les conditions de
          l'article L. 224-25-12 et suivants du Code de la consommation. En cas de défaut technique majeur
          rendant le Produit Virtuel inutilisable ou non conforme à sa description sur le Site, le Vendeur
          s'engage à y remédier sans frais dans les plus brefs délais, ou à défaut, à procéder au
          remboursement de la commande.
        </p>

        <hr style={S.divider} />

        <h2 style={S.h2}>Article 8 – Données Personnelles (RGPD)</h2>
        <p style={S.p}>
          Le Vendeur collecte les données strictement nécessaires au traitement des commandes et à la
          facturation (Nom, prénom, adresse e-mail, adresse IP). Ces données ne sont jamais cédées à des
          tiers à des fins publicitaires.
        </p>
        <p style={S.p}>
          Conformément au RGPD, l'Acheteur dispose d'un droit d'accès, de rectification et de suppression
          de ses données personnelles, qu'il peut exercer en envoyant un e-mail à :{' '}
          <a href="mailto:contact@geocoins.fr" style={{ color: '#1e7fca' }}>contact@geocoins.fr</a>.
        </p>

        <hr style={S.divider} />

        <h2 style={S.h2}>Article 9 – Responsabilité et Disponibilité Technique</h2>
        <p style={{ ...S.p, fontWeight: 700 }}>9.1 – Obligation de moyens et Interruptions de service</p>
        <p style={S.p}>
          Le Vendeur s'efforce d'assurer l'accès au Site geocoins.fr et la délivrance des Produits Virtuels
          24h/24 et 7j/7. Toutefois, l'activité du Site est soumise à une simple obligation de moyens. La
          responsabilité du Vendeur ne saurait être engagée pour tout dommage direct ou indirect découlant
          de l'indisponibilité temporaire du Site ou de l'impossibilité d'accéder momentanément aux
          Produits Virtuels.
        </p>
        <p style={{ ...S.p, fontWeight: 700 }}>9.2 – Force Majeure et Défaillances Tiers</p>
        <p style={S.p}>
          La responsabilité du Vendeur ne pourra être recherchée si l'exécution du contrat est retardée,
          perturbée ou empêchée par un cas de force majeure au sens de l'article 1218 du Code civil,
          notamment : attaques DDoS, piratage, incendies, dégâts des eaux, coupures d'électricité,
          défaillances des hébergeurs tiers (OVH, Cloudflare, Vercel).
        </p>
        <p style={{ ...S.p, fontWeight: 700 }}>9.3 – Erreurs Manifestes, Bugs et Exploits de Failles</p>
        <p style={S.p}>
          En cas de bug, d'erreur manifeste d'affichage des prix ou d'exploitation frauduleuse d'une faille
          du système permettant d'obtenir des Produits Virtuels sans contrepartie financière réelle,
          la transaction sera considérée comme nulle. Le Vendeur se réserve le droit d'annuler la commande
          et de retirer les Produits Virtuels indûment acquis.
        </p>

        <hr style={S.divider} />

        <h2 style={S.h2}>Article 11 – Litiges et Médiation</h2>
        <p style={S.p}>
          Les présentes CGV sont soumises au droit français. En cas de litige, l'Acheteur s'engage à
          contacter en priorité le Vendeur à l'adresse{' '}
          <a href="mailto:contact@geocoins.fr" style={{ color: '#1e7fca' }}>contact@geocoins.fr</a>.
        </p>
        <p style={S.p}>
          Si aucune solution amiable n'est trouvée, et conformément à l'article L. 612-1 du Code de la
          consommation, l'Acheteur consommateur a le droit de recourir gratuitement à un médiateur de la
          consommation : <a href="https://www.mediateur-consommation-smp.fr/" target="_blank" rel="noreferrer" style={{ color: '#1e7fca' }}>Société de la Médiation Professionnelle</a> — 5 rue Salvaing, 12000 Rodez.
        </p>
        <p style={S.p}>À défaut d'accord, le litige sera porté devant les tribunaux français compétents.</p>

        <hr style={S.divider} />

        <h2 style={S.h2}>Article 12 – Dispositions Générales</h2>
        <p style={S.p}>
          <strong>12.1 – Langue du contrat :</strong> Les présentes CGV sont rédigées en langue française.
          Seul le texte français ferait foi en cas de litige.
        </p>
        <p style={S.p}>
          <strong>12.2 – Nullité partielle :</strong> Si une ou plusieurs stipulations sont tenues pour
          non valides, les autres stipulations garderont toute leur force et leur portée.
        </p>

        <div style={{ marginTop: 40, padding: '16px 20px', background: '#eef4fb', borderRadius: 10, fontSize: 12, color: '#6b7d92', fontFamily: "'Nunito',sans-serif" }}>
          Contact : <a href="mailto:contact@geocoins.fr" style={{ color: '#1e7fca' }}>contact@geocoins.fr</a> — geocoins.fr
        </div>
      </div>
    </div>
  )
}
