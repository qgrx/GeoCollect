import { useState, useEffect, Fragment } from 'react'
import Logo from '../../components/Logo.jsx'
import PublicFooter from '../../components/PublicFooter.jsx'
import { apiGetCards, apiGetPublicConfig, apiGetCardOwners } from '../../services/api.js'
import { useT } from '../../i18n/translations.js'
import { useTheme } from '../../ThemeContext.jsx'
import { RC, cardName, cardNameTranslation, cardLongDescription, rarityLabel, typeLabel } from '../../data/cards.js'
import { geocoinIdFromSlug, buildPath } from '../../routes.js'
import { isPublicGeocoin, relatedGeocoins } from './publicGeocoins.js'
import { richTextHtml, richTextLength } from '../../utils/richText.js'
import { geocacheType, geocacheTypeLabel, gcCodeUrl } from '../../data/geocaching.js'
import RichContent from '../docs/RichContent.jsx'

/**
 * Fiche publique d'un geocoin — page d'atterrissage depuis les moteurs.
 *
 * Elle est aussi pré-rendue en HTML statique par scripts/prerender.mjs. Sans ce
 * composant, une URL /geocoins/… pourtant indexée basculerait sur l'écran 404 de
 * l'application dès l'hydratation : le visiteur venu de Google verrait la page
 * correcte disparaître sous ses yeux.
 */
/**
 * Bloc de caractéristiques.
 *
 * La fiche mélange deux sources qu'il ne faut surtout pas confondre : ce que le
 * JEU sait du geocoin (rareté, forge, collectionneurs) et ce que geocaching.com
 * dit de la CACHE à laquelle il rend hommage (type, code GC, poseur). Deux
 * panneaux distincts, deux couleurs d'accent : on voit d'un coup d'œil de qui
 * vient quelle information.
 */
function FactPanel({ icon, title, accent, rows, cardBg, border, textColor, mutedColor }) {
  const visible = rows.filter(r => r && r.value !== null && r.value !== undefined && r.value !== '')
  if (!visible.length) return null
  return (
    <section style={{
      background: cardBg, border: `1px solid ${border}`, borderTop: `3px solid ${accent}`,
      borderRadius: 12, padding: '14px 16px', minWidth: 0,
    }}>
      <h2 style={{
        margin: '0 0 10px', fontSize: 11, fontWeight: 900, letterSpacing: 1,
        textTransform: 'uppercase', color: accent, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span aria-hidden="true">{icon}</span>{title}
      </h2>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '7px 14px', alignItems: 'baseline' }}>
        {visible.map(r => (
          <Fragment key={r.label}>
            <dt style={{ fontSize: 11, fontWeight: 700, color: mutedColor, whiteSpace: 'nowrap' }}>{r.label}</dt>
            <dd style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: textColor, textAlign: 'right', wordBreak: 'break-word' }}>{r.value}</dd>
          </Fragment>
        ))}
      </dl>
    </section>
  )
}

export default function GeocoinPage({ slug, onNavigate }) {
  const { t, lang } = useT()
  const { theme, mode } = useTheme()
  const [pool, setPool] = useState(null)   // null = chargement
  // Les libellés de types vivent dans la config publique, pas sur la carte : sans
  // eux, une page anglaise afficherait le type en français.
  const [typeTranslations, setTypeTranslations] = useState({})
  // Nombre de collectionneurs par geocoin. `null` tant qu'on ne sait pas : c'est
  // une information sociale, une fiche ne doit jamais afficher « 0 joueur » à
  // cause d'un appel qui n'a pas encore répondu ou qui a échoué.
  const [owners, setOwners] = useState(null)
  const id = geocoinIdFromSlug(slug)

  useEffect(() => {
    let alive = true
    apiGetCards()
      .then(({ data }) => { if (alive) setPool(data?.cards ?? []) })
      .catch(() => { if (alive) setPool([]) })
    apiGetPublicConfig()
      .then(({ data }) => { if (alive && data?.config?.type_translations) setTypeTranslations(data.config.type_translations) })
      .catch(() => {})
    apiGetCardOwners()
      .then(({ data }) => { if (alive && data?.owners) setOwners(data.owners) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const card    = pool?.find(c => c.id === id && isPublicGeocoin(c)) ?? null
  const related = card && pool ? relatedGeocoins(pool, card, 6) : []

  // Mêmes couleurs que DocsLayout : les pages publiques doivent se ressembler.
  // ⚠️ `pageBg` est explicite et NON tiré de `theme` : la page a longtemps posé
  // `background: theme.bg`, une clé qui n'existe pas dans THEMES. Le fond était
  // donc vide, laissant apparaître celui du <body> — que la feuille de style du
  // pré-rendu fixe à #0f0f1e — pendant que le texte suivait le thème CLAIR par
  // défaut. Résultat : texte sombre sur fond sombre, illisible.
  const pageBg     = mode === 'light' ? '#f5f7fa' : '#0f1923'
  const textColor  = mode === 'light' ? '#1e2d3d' : '#d4e8f8'
  const mutedColor = mode === 'light' ? '#6b7c8d' : '#7d8fa3'
  const cardBg     = mode === 'light' ? '#ffffff' : '#16213a'
  const rc         = card ? RC[card.rarity] : null

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: pageBg, fontFamily: "'Nunito',sans-serif", color: textColor }}>
      <header style={{ padding: '12px 18px', borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href={buildPath('home', { lang })} onClick={e => { e.preventDefault(); onNavigate?.('home') }} style={{ textDecoration: 'none' }}>
          <Logo iconSize={30} textSize={19} />
        </a>
        <a
          href={buildPath('home', { lang })}
          onClick={e => { e.preventDefault(); onNavigate?.('home') }}
          style={{ background: 'linear-gradient(135deg,#6c5ce7,#a29bfe)', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 900, textDecoration: 'none' }}
        >
          {t('landing_hero_cta')}
        </a>
      </header>

      <main style={{ flex: 1, width: '100%', maxWidth: 680, margin: '0 auto', padding: '28px 20px 48px' }}>
        {pool === null && <p style={{ color: mutedColor }}>…</p>}

        {pool !== null && !card && (
          <>
            <h1 style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 28, color: theme.gold }}>404</h1>
            <p style={{ color: mutedColor }}>{t('geocoin_not_found')}</p>
          </>
        )}

        {card && (
          <>
            {card.image_url && (
              <img
                src={card.image_url}
                alt={cardName(card, lang)}
                width="320" height="320"
                style={{ display: 'block', width: '100%', maxWidth: 320, height: 'auto', margin: '0 auto 24px', borderRadius: 16 }}
              />
            )}

            <h1 style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 30, color: theme.gold, margin: '0 0 4px' }}>
              {cardName(card, lang)}
            </h1>

            {/* Le titre reste celui de la cache, dans SA langue — c'est sous ce
                nom qu'elle existe sur geocaching.com. Sa traduction se glisse
                dessous, en petit, pour qui ne lit pas l'allemand ou le tchèque.
                `lang` sur l'élément : sans lui, un lecteur d'écran prononcerait
                cette ligne avec la phonétique de la page. */}
            {cardNameTranslation(card, lang) && (
              <p lang={lang} style={{ margin: '0 0 10px', fontSize: 13, fontStyle: 'italic', color: mutedColor }}>
                {cardNameTranslation(card, lang)}
              </p>
            )}

            {/* En-tête : ce que dit le jeu / ce que dit geocaching.com */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12, margin: '0 0 24px' }}>
              <FactPanel
                icon="🪙" title={t('geocoin_facts_game')} accent={rc?.color || theme.gold}
                cardBg={cardBg} border={theme.border} textColor={textColor} mutedColor={mutedColor}
                rows={[
                  { label: t('geocoin_label_category'), value: card.type ? typeLabel(card.type, typeTranslations, lang) : null },
                  { label: t('geocoin_label_rarity'), value: rc
                    ? <span style={{ color: rc.color, background: `${rc.color}1f`, padding: '2px 10px', borderRadius: 999 }}>{rarityLabel(card.rarity, t)}</span>
                    : rarityLabel(card.rarity, t) },
                  { label: t('geocoin_label_forge'), value: card.forgeable
                    ? `🔨 ${t('geocoin_forge_yes')}`
                    : t('geocoin_forge_no') },
                  // Ligne absente tant que le compte n'est pas connu : afficher
                  // « 0 joueur » sur un appel en cours serait un mensonge.
                  { label: t('geocoin_label_owners'), value: owners === null ? null
                    : (owners[card.id] > 0 ? t('geocoin_owners_count', { n: owners[card.id] }) : t('geocoin_owners_none')) },
                ]}
              />
              <FactPanel
                icon="🧭" title={t('geocoin_facts_gc')} accent="#00b894"
                cardBg={cardBg} border={theme.border} textColor={textColor} mutedColor={mutedColor}
                rows={[
                  { label: t('geocoin_label_cache_type'), value: card.gc_cache_type
                    ? `${geocacheType(card.gc_cache_type)?.icon ?? ''} ${geocacheTypeLabel(card.gc_cache_type, lang)}`.trim()
                    : null },
                  { label: t('geocoin_label_gc_code'), value: card.gc_code
                    ? <a href={gcCodeUrl(card.gc_code)} target="_blank" rel="noopener noreferrer nofollow"
                        style={{ color: '#00b894', textDecoration: 'none', borderBottom: '1px dotted #00b894' }}>{card.gc_code} ↗</a>
                    : null },
                  { label: t('geocoin_label_gc_owner'), value: card.gc_owner || null },
                ]}
              />
            </div>

            {/* Contenu riche saisi dans l'admin (titres, listes, liens…).
                `richTextHtml` couvre aussi les fiches rédigées avant l'éditeur,
                restées en texte brut : leurs sauts de ligne deviennent des
                paragraphes au lieu de fondre en un seul pavé.
                La couleur est passée EXPLICITEMENT : le contenu vient d'un
                éditeur, donc peut porter ses propres couleurs, et hériter en
                silence a déjà donné du texte sombre sur fond sombre. */}
            {richTextLength(cardLongDescription(card, lang)) > 0 && (
              <RichContent
                html={richTextHtml(cardLongDescription(card, lang))}
                style={{ fontSize: 15, lineHeight: 1.7, margin: '0 0 28px', color: textColor }}
              />
            )}

            <a
              href={buildPath('home', { lang })}
              onClick={e => { e.preventDefault(); onNavigate?.('home') }}
              style={{ display: 'inline-block', background: 'linear-gradient(135deg,#f9ca24,#e17055)', color: '#1e3045', padding: '12px 26px', borderRadius: 12, fontWeight: 900, textDecoration: 'none' }}
            >
              {t('landing_hero_cta')}
            </a>

            {related.length > 0 && (
              <section style={{ marginTop: 40 }}>
                <h2 style={{ fontSize: 16, marginBottom: 12 }}>{t('geocoin_related')}</h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
                  {related.map(c => (
                    <li key={c.id}>
                      <a
                        href={buildPath('geocoin', { lang, param: c.slug })}
                        onClick={e => { e.preventDefault(); onNavigate?.('geocoin', c.slug) }}
                        style={{ display: 'block', padding: '10px 12px', background: cardBg, border: `1px solid ${theme.border}`, borderRadius: 10, color: textColor, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}
                      >
                        {cardName(c, lang)}
                      </a>
                    </li>
                  ))}
                </ul>
                {/* Six voisines ne font pas le tour de la collection : la galerie
                    complète, elle, mène à toutes les fiches. */}
                <a
                  href={buildPath('geocoins', { lang })}
                  onClick={e => { e.preventDefault(); onNavigate?.('geocoins') }}
                  style={{ display: 'inline-block', marginTop: 14, fontSize: 13, fontWeight: 800, color: theme.gold, textDecoration: 'none', borderBottom: `1px dotted ${theme.gold}` }}
                >
                  {t('gallery_cta')} →
                </a>
              </section>
            )}
          </>
        )}
      </main>

      <PublicFooter onNavigate={onNavigate} />
    </div>
  )
}
