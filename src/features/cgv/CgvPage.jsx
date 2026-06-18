import { useEffect, useRef, useState } from 'react'
import { getLang } from '../../i18n/translations.js'

// Identité vendeur rendue en Canvas — illisible par les robots
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
  page:    { position: 'fixed', inset: 0, zIndex: 2500, overflowY: 'auto', background: '#f8fafc', fontFamily: "'Georgia', serif", color: '#1a2d3d', lineHeight: 1.7 },
  header:  { background: '#1e2d3d', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, position: 'sticky', top: 0, zIndex: 10 },
  back:    { background: 'none', border: '1px solid #ffffff44', color: '#fff', padding: '6px 14px', borderRadius: 8, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 13, cursor: 'pointer' },
  close:   { background: '#ffffff18', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', fontSize: 15, fontWeight: 900, cursor: 'pointer', flexShrink: 0 },
  wrap:    { maxWidth: 800, margin: '0 auto', padding: '40px 24px 80px' },
  title:   { fontFamily: "'Fredoka One',sans-serif", fontSize: 26, color: '#1e2d3d', marginBottom: 4 },
  date:    { fontSize: 13, color: '#6b7d92', marginBottom: 36, fontFamily: "'Nunito',sans-serif" },
  h2:      { fontSize: 17, fontWeight: 700, color: '#1e2d3d', marginTop: 32, marginBottom: 10, fontFamily: "'Nunito',sans-serif" },
  h3:      { fontSize: 15, fontWeight: 700, color: '#2d4456', marginTop: 20, marginBottom: 8, fontFamily: "'Nunito',sans-serif" },
  p:       { fontSize: 14, marginBottom: 14, color: '#2d4456' },
  ul:      { paddingLeft: 22, marginBottom: 14 },
  li:      { fontSize: 14, marginBottom: 6, color: '#2d4456' },
  box:     { background: '#eef4fb', border: '1px solid #c8d8e8', borderRadius: 10, padding: '16px 20px', marginBottom: 14, fontSize: 14 },
  warn:    { background: '#fff8f0', border: '1px solid #f9ca2466', borderRadius: 10, padding: '16px 20px', marginBottom: 14, fontSize: 14 },
  divider: { border: 'none', borderTop: '1px solid #dce8f0', margin: '32px 0' },
  footer:  { marginTop: 40, padding: '16px 20px', background: '#eef4fb', borderRadius: 10, fontSize: 12, color: '#6b7d92', fontFamily: "'Nunito',sans-serif" },
}

// ─── Version française ────────────────────────────────────────────────────────
function CgvFR() {
  return <>
    <h2 style={S.h2}>Article 1 – Objet et Champ d'Application</h2>
    <h3 style={S.h3}>Article 1.1 – Identification des Parties</h3>
    <p style={S.p}>Les présentes Conditions Générales de Vente (ci-après "CGV") s'appliquent, sans restriction ni réserve, à l'ensemble des ventes d'objets virtuels, monnaies numériques, licences d'utilisation et contenus numériques (ci-après "les Produits Virtuels") conclus via le site internet geocoins.fr (ci-après "le Site") entre :</p>
    <div style={S.box}><strong>Le Vendeur :</strong><br /><SellerIdentity /></div>
    <p style={S.p}><strong>L'Acheteur :</strong> Toute personne physique ou morale procédant à un achat sur le Site.</p>
    <p style={S.p}>L'achat d'un Produit Virtuel sur le Site implique l'acceptation pleine et entière des présentes CGV par l'Acheteur, qui reconnaît en avoir pris connaissance avant de valider sa commande.</p>
    <h3 style={S.h3}>Article 1.2 – Capacité juridique et Minorité</h3>
    <p style={S.p}>Le Site geocoins.fr est accessible aux personnes physiques majeures ou mineures. L'Acheteur déclare être âgé d'au moins 18 ans et disposer de la pleine capacité juridique pour s'engager au titre des présentes CGV.</p>
    <p style={S.p}>Si l'Acheteur est un mineur, il déclare et garantit avoir obtenu l'autorisation expresse de ses parents (ou titulaires de l'autorité parentale) avant de passer commande et d'effectuer un paiement sur le Site. Le Vendeur décline toute responsabilité en cas de déclaration frauduleuse de l'Acheteur ou d'achat effectué par un mineur sans l'accord de ses représentants légaux.</p>
    <hr style={S.divider} />
    <h2 style={S.h2}>Article 2 – Caractéristiques des Produits Virtuels</h2>
    <p style={S.p}>Le Site geocoins.fr propose à la vente des biens exclusivement immatériels et numériques (monnaies virtuelles, jetons, droits d'accès ou objets applicatifs).</p>
    <p style={S.p}>L'achat de ces Produits Virtuels ne confère à l'Acheteur aucun droit de propriété physique ou intellectuelle sur les éléments du Site. L'Acheteur acquiert uniquement une licence d'utilisation limitée, personnelle, non transférable et révocable. La revente, l'échange ou le transfert de Produits Virtuels en dehors des systèmes officiels du Site est strictement interdit.</p>
    <hr style={S.divider} />
    <h2 style={S.h2}>Article 3 – Processus de Commande</h2>
    <p style={S.p}>Pour passer commande, l'Acheteur doit obligatoirement suivre le processus suivant :</p>
    <ul style={S.ul}>
      <li style={S.li}>Sélection des Produits Virtuels et ajout au panier.</li>
      <li style={S.li}>Validation du panier : accès à un écran récapitulatif détaillant la nature des Produits, la quantité et le prix total TTC (Premier Clic).</li>
      <li style={S.li}>Acceptation des CGV et renonciation expresse au droit de rétractation (via des cases à cocher obligatoires).</li>
      <li style={S.li}>Validation définitive avec obligation de paiement en cliquant sur le bouton "Acheter" (Second Clic).</li>
    </ul>
    <p style={S.p}>Un e-mail de confirmation reprenant le détail de la transaction est envoyé sans délai à l'Acheteur sur un support durable.</p>
    <hr style={S.divider} />
    <h2 style={S.h2}>Article 4 – Tarifs et Modalités de Paiement</h2>
    <p style={S.p}>Les prix des Produits Virtuels sont indiqués en Euros (€) et sont fermes au moment de la validation de la commande. Les prix sont indiqués Hors Taxes (HT), la TVA étant non applicable en vertu de l'article 293 B du Code Général des Impôts.</p>
    <p style={S.p}>Le paiement est exigible immédiatement au moment de la commande. Le Site utilise un système de paiement sécurisé tiers (SumUp). Le Vendeur ne conserve aucune donnée bancaire confidentielle sur ses serveurs.</p>
    <hr style={S.divider} />
    <h2 style={S.h2}>Article 5 – Livraison</h2>
    <p style={S.p}>Les Produits Virtuels étant par nature dématérialisés, aucune livraison physique n'est effectuée. La livraison s'effectue par injection directe sur le compte de l'Acheteur, de manière immédiate (ou dans un délai maximal de 24 heures en cas de vérification anti-fraude) après la validation du paiement.</p>
    <p style={S.p}>Si la livraison technique n'a pas pu être effectuée dans un délai de 7 jours après le paiement pour des raisons non imputables à l'Acheteur, ce dernier pourra demander l'annulation de la vente et le remboursement intégral des sommes versées.</p>
    <hr style={S.divider} />
    <h2 style={S.h2}>Article 6 – Absence de Droit de Rétractation</h2>
    <div style={S.warn}><p style={{ ...S.p, marginBottom: 0 }}>Conformément à l'article L. 221-28 13° du Code de la consommation, le droit de rétractation ne peut être exercé pour les contrats de fourniture de contenu numérique non fourni sur un support matériel dont l'exécution a commencé après accord préalable exprès du consommateur et renonciation expresse à son droit de rétractation.</p></div>
    <p style={S.p}>En validant sa commande et en cochant la case dédiée, l'Acheteur accepte expressément que la livraison du contenu numérique commence immédiatement après son paiement et renonce expressément à son droit de rétractation de quatorze (14) jours. <strong>Aucun remboursement ne sera accordé une fois le produit virtuel délivré.</strong></p>
    <hr style={S.divider} />
    <h2 style={S.h2}>Article 7 – Garanties Légales</h2>
    <p style={S.p}>Le Vendeur est tenu des défauts de conformité du contenu numérique dans les conditions de l'article L. 224-25-12 et suivants du Code de la consommation. En cas de défaut technique majeur, le Vendeur s'engage à y remédier sans frais dans les plus brefs délais, ou à défaut, à procéder au remboursement de la commande.</p>
    <hr style={S.divider} />
    <h2 style={S.h2}>Article 8 – Données Personnelles (RGPD)</h2>
    <p style={S.p}>Le Vendeur collecte les données strictement nécessaires au traitement des commandes (Nom, prénom, adresse e-mail, adresse IP). Ces données ne sont jamais cédées à des tiers à des fins publicitaires.</p>
    <p style={S.p}>Conformément au RGPD, l'Acheteur dispose d'un droit d'accès, de rectification et de suppression de ses données personnelles à l'adresse : <a href="mailto:contact@geocoins.fr" style={{ color: '#1e7fca' }}>contact@geocoins.fr</a>.</p>
    <hr style={S.divider} />
    <h2 style={S.h2}>Article 9 – Erreurs Manifestes, Bugs et Exploits de Failles</h2>
    <p style={S.p}>En cas de bug ou d'exploitation frauduleuse d'une faille du système permettant d'obtenir des Produits Virtuels sans contrepartie financière réelle, la transaction sera considérée comme nulle. Le Vendeur se réserve le droit d'annuler la commande et de retirer les Produits Virtuels indûment acquis.</p>
    <hr style={S.divider} />
    <h2 style={S.h2}>Article 10 – Dispositions Générales</h2>
    <p style={S.p}><strong>10.1 – Langue du contrat :</strong> Les présentes CGV sont rédigées en langue française, traduites automatiquement en anglais. Seul le texte français ferait foi en cas de litige.</p>
    <p style={S.p}><strong>10.2 – Nullité partielle :</strong> Si une ou plusieurs stipulations sont tenues pour non valides, les autres stipulations garderont toute leur force et leur portée.</p>
    <hr style={S.divider} />
    <h2 style={S.h2}>Article 11 – Litiges et Médiation</h2>
    <p style={S.p}>Les présentes CGV sont soumises au droit français. En cas de litige, l'Acheteur s'engage à contacter en priorité le Vendeur à l'adresse <a href="mailto:contact@geocoins.fr" style={{ color: '#1e7fca' }}>contact@geocoins.fr</a>.</p>
    <p style={S.p}>Si aucune solution amiable n'est trouvée, l'Acheteur consommateur a le droit de recourir gratuitement à la <a href="https://www.mediateur-consommation-smp.fr/" target="_blank" rel="noreferrer" style={{ color: '#1e7fca' }}>Société de la Médiation Professionnelle</a> — 5 rue Salvaing, 12000 Rodez.</p>
    <p style={S.p}>À défaut d'accord, le litige sera porté devant les tribunaux français compétents.</p>
  </>
}

// ─── English version (automatic translation) ─────────────────────────────────
function CgvEN() {
  return <>
    <div style={S.warn}><strong>⚠ Automatic translation notice:</strong> This is an automatically translated version provided for informational purposes only. In the event of any dispute, only the original French text ("Conditions Générales de Vente") shall be legally binding.</div>
    <h2 style={S.h2}>Article 1 – Subject and Scope</h2>
    <h3 style={S.h3}>Article 1.1 – Identification of Parties</h3>
    <p style={S.p}>These Terms of Sale (hereinafter "Terms") apply, without restriction or reservation, to all sales of virtual items, digital currencies, licences and digital content (hereinafter "Virtual Products") made via the website geocoins.fr (hereinafter "the Site") between:</p>
    <div style={S.box}><strong>The Seller:</strong><br /><SellerIdentity /></div>
    <p style={S.p}><strong>The Buyer:</strong> Any individual or legal entity making a purchase on the Site.</p>
    <p style={S.p}>The purchase of any Virtual Product implies full acceptance of these Terms by the Buyer, who acknowledges having read them prior to validating their order.</p>
    <h3 style={S.h3}>Article 1.2 – Legal Capacity and Minors</h3>
    <p style={S.p}>The Site geocoins.fr is accessible to both adults and minors. The Buyer declares to be at least 18 years of age and to have full legal capacity to enter into these Terms.</p>
    <p style={S.p}>If the Buyer is a minor, they declare and warrant having obtained the express authorisation of their parents (or legal guardians) before placing an order and making a payment. The Seller accepts no liability in the event of a fraudulent declaration or a purchase made by a minor without parental consent.</p>
    <hr style={S.divider} />
    <h2 style={S.h2}>Article 2 – Characteristics of Virtual Products</h2>
    <p style={S.p}>The Site geocoins.fr offers exclusively intangible and digital goods for sale (virtual currencies, tokens, access rights or in-app items).</p>
    <p style={S.p}>The purchase of Virtual Products does not grant the Buyer any physical or intellectual property rights. The Buyer acquires only a limited, personal, non-transferable and revocable licence. Reselling, exchanging or transferring Virtual Products outside the official Site systems is strictly prohibited.</p>
    <hr style={S.divider} />
    <h2 style={S.h2}>Article 3 – Order Process</h2>
    <p style={S.p}>To place an order, the Buyer must follow the steps below:</p>
    <ul style={S.ul}>
      <li style={S.li}>Selection of Virtual Products.</li>
      <li style={S.li}>Cart validation: summary screen showing products, quantity and total price (First Click).</li>
      <li style={S.li}>Acceptance of the Terms and express waiver of the right of withdrawal (mandatory checkboxes).</li>
      <li style={S.li}>Final validation with payment obligation by clicking the "Buy" button (Second Click).</li>
    </ul>
    <p style={S.p}>A confirmation email including transaction details is sent to the Buyer immediately on a durable medium.</p>
    <hr style={S.divider} />
    <h2 style={S.h2}>Article 4 – Prices and Payment</h2>
    <p style={S.p}>Prices are stated in Euros (€) and are firm at the time of order validation. Prices are exclusive of VAT, which does not apply pursuant to Article 293 B of the French General Tax Code.</p>
    <p style={S.p}>Payment is due immediately upon ordering. The Site uses a third-party secure payment system (SumUp). The Seller does not store any confidential banking data.</p>
    <hr style={S.divider} />
    <h2 style={S.h2}>Article 5 – Delivery</h2>
    <p style={S.p}>As Virtual Products are digital by nature, no physical delivery is made. Delivery is made by direct injection into the Buyer's account immediately (or within 24 hours for anti-fraud verification) after payment confirmation.</p>
    <p style={S.p}>If delivery has not been completed within 7 days of payment for reasons not attributable to the Buyer, the Buyer may request cancellation and a full refund.</p>
    <hr style={S.divider} />
    <h2 style={S.h2}>Article 6 – No Right of Withdrawal</h2>
    <div style={S.warn}><p style={{ ...S.p, marginBottom: 0 }}>In accordance with Article L. 221-28 13° of the French Consumer Code, the right of withdrawal cannot be exercised for the supply of digital content where performance has begun after the consumer's prior express consent and express waiver of their right of withdrawal.</p></div>
    <p style={S.p}>By validating their order and ticking the relevant box, the Buyer expressly agrees that delivery begins immediately after payment and expressly waives their fourteen (14) day right of withdrawal. <strong>No refund will be granted once the virtual product has been delivered.</strong></p>
    <hr style={S.divider} />
    <h2 style={S.h2}>Article 7 – Legal Warranties</h2>
    <p style={S.p}>The Seller is liable for any lack of conformity of the digital content under Articles L. 224-25-12 et seq. of the French Consumer Code. In the event of a major technical defect, the Seller will remedy the situation free of charge or refund the order.</p>
    <hr style={S.divider} />
    <h2 style={S.h2}>Article 8 – Personal Data (GDPR)</h2>
    <p style={S.p}>The Seller collects only the data strictly necessary for order processing (name, email address, IP address). This data is never sold to third parties for advertising purposes.</p>
    <p style={S.p}>In accordance with the GDPR, the Buyer has the right to access, rectify and delete their personal data by contacting: <a href="mailto:contact@geocoins.fr" style={{ color: '#1e7fca' }}>contact@geocoins.fr</a>.</p>
    <hr style={S.divider} />
    <h2 style={S.h2}>Article 9 – Obvious Errors, Bugs and Exploits</h2>
    <p style={S.p}>In the event of a bug or fraudulent exploitation of a system vulnerability allowing Virtual Products to be obtained without real financial consideration, the transaction shall be deemed void. The Seller reserves the right to cancel the order and remove the improperly acquired Virtual Products.</p>
    <hr style={S.divider} />
    <h2 style={S.h2}>Article 10 – General Provisions</h2>
    <p style={S.p}><strong>10.1 – Language of contract:</strong> These Terms are written in French and automatically translated into English. Only the French text shall be legally binding in the event of a dispute.</p>
    <p style={S.p}><strong>10.2 – Partial invalidity:</strong> If any provision of these Terms is found to be invalid, the remaining provisions shall retain their full force and effect.</p>
    <hr style={S.divider} />
    <h2 style={S.h2}>Article 11 – Disputes and Mediation</h2>
    <p style={S.p}>These Terms are governed by French law. In the event of a dispute, the Buyer agrees to contact the Seller first at <a href="mailto:contact@geocoins.fr" style={{ color: '#1e7fca' }}>contact@geocoins.fr</a>.</p>
    <p style={S.p}>If no amicable solution is reached, the consumer Buyer has the right to refer the matter free of charge to the <a href="https://www.mediateur-consommation-smp.fr/" target="_blank" rel="noreferrer" style={{ color: '#1e7fca' }}>Société de la Médiation Professionnelle</a> — 5 rue Salvaing, 12000 Rodez, France.</p>
    <p style={S.p}>Failing agreement, the dispute will be referred to the competent French courts.</p>
  </>
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function CgvPage({ onClose }) {
  const [verified, setVerified] = useState(!import.meta.env.VITE_TURNSTILE_SITE_KEY)
  const [isEN, setIsEN]        = useState(getLang() !== 'fr')
  const tsRef    = useRef(null)
  const tsWidget = useRef(null)

  // noindex dynamique
  useEffect(() => {
    const m = document.createElement('meta')
    m.name = 'robots'; m.content = 'noindex, nofollow, noarchive'
    document.head.appendChild(m)
    return () => document.head.removeChild(m)
  }, [])

  // Turnstile
  useEffect(() => {
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY
    if (!siteKey || verified) return
    function init() {
      if (!tsRef.current || !window.turnstile || tsWidget.current) return
      tsWidget.current = window.turnstile.render(tsRef.current, {
        sitekey: siteKey,
        appearance: 'always',
        callback: () => setVerified(true),
        'error-callback': () => {},
        'expired-callback': () => setVerified(false),
      })
    }
    if (window.turnstile) { init(); return }
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    s.async = true; s.onload = init
    document.head.appendChild(s)
    return () => {
      if (tsWidget.current && window.turnstile) { window.turnstile.remove(tsWidget.current); tsWidget.current = null }
    }
  }, [verified])

  if (!verified) {
    return (
      <div style={{ ...S.page, display: 'flex', flexDirection: 'column' }}>
        <div style={S.header}>
          <span style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 16, color: '#f9ca24' }}>🗺️ Geocoins</span>
          <button onClick={onClose} style={S.close} aria-label={isEN ? 'Close' : 'Fermer'}>✕</button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontSize: 40 }}>🔒</div>
          <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 16, color: '#1a2d3d' }}>
            {isEN ? 'Verification required' : 'Vérification requise'}
          </div>
          <div style={{ fontSize: 13, color: '#6b7d92', textAlign: 'center', maxWidth: 340 }}>
            {isEN ? 'Please confirm you are not a robot to access the Terms of Sale.' : 'Veuillez confirmer que vous n\'êtes pas un robot pour accéder aux CGV.'}
          </div>
          <div ref={tsRef} />
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <span style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 16, color: '#f9ca24' }}>🗺️ Geocoins</span>
        <button onClick={onClose} style={S.close} aria-label={isEN ? 'Close' : 'Fermer'}>✕</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {['fr','en'].map(l => (
            <button key={l} onClick={() => setIsEN(l === 'en')}
              style={{ background: (l === 'en') === isEN ? '#f9ca24' : 'none', border: '1px solid #f9ca2444', color: (l === 'en') === isEN ? '#1e2d3d' : '#f9ca24', padding: '4px 10px', borderRadius: 6, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: 'pointer', textTransform: 'uppercase' }}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div style={S.wrap}>
        <div style={S.title}>{isEN ? 'Terms of Sale (CGV)' : 'Conditions Générales de Vente'}</div>
        <div style={S.date}>{isEN ? 'In force as of 23/05/2026 — geocoins.fr' : 'En vigueur au 23/05/2026 — geocoins.fr'}</div>
        {isEN ? <CgvEN /> : <CgvFR />}
        <div style={S.footer}>
          Contact : <a href="mailto:contact@geocoins.fr" style={{ color: '#1e7fca' }}>contact@geocoins.fr</a> — geocoins.fr
        </div>
      </div>
    </div>
  )
}
