import { useState, useEffect } from 'react'
import Logo from '../../components/Logo.jsx'
import PublicFooter from '../../components/PublicFooter.jsx'
import { apiGetCards, apiGetPublicConfig } from '../../services/api.js'
import { useT } from '../../i18n/translations.js'
import { useTheme } from '../../ThemeContext.jsx'
import { RC, cardName, cardLongDescription, rarityLabel, typeLabel } from '../../data/cards.js'
import { geocoinIdFromSlug, buildPath } from '../../routes.js'
import { isPublicGeocoin, relatedGeocoins } from './publicGeocoins.js'

/**
 * Fiche publique d'un geocoin — page d'atterrissage depuis les moteurs.
 *
 * Elle est aussi pré-rendue en HTML statique par scripts/prerender.mjs. Sans ce
 * composant, une URL /geocoins/… pourtant indexée basculerait sur l'écran 404 de
 * l'application dès l'hydratation : le visiteur venu de Google verrait la page
 * correcte disparaître sous ses yeux.
 */
export default function GeocoinPage({ slug, onNavigate }) {
  const { t, lang } = useT()
  const { theme, mode } = useTheme()
  const [pool, setPool] = useState(null)   // null = chargement
  // Les libellés de types vivent dans la config publique, pas sur la carte : sans
  // eux, une page anglaise afficherait le type en français.
  const [typeTranslations, setTypeTranslations] = useState({})
  const id = geocoinIdFromSlug(slug)

  useEffect(() => {
    let alive = true
    apiGetCards()
      .then(({ data }) => { if (alive) setPool(data?.cards ?? []) })
      .catch(() => { if (alive) setPool([]) })
    apiGetPublicConfig()
      .then(({ data }) => { if (alive && data?.config?.type_translations) setTypeTranslations(data.config.type_translations) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const card    = pool?.find(c => c.id === id && isPublicGeocoin(c)) ?? null
  const related = card && pool ? relatedGeocoins(pool, card, 6) : []

  const textColor  = mode === 'light' ? '#1e2d3d' : '#d4e8f8'
  const mutedColor = mode === 'light' ? '#6b7c8d' : '#7d8fa3'
  const cardBg     = mode === 'light' ? '#ffffff' : '#16213a'
  const rc         = card ? RC[card.rarity] : null

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: theme.bg, fontFamily: "'Nunito',sans-serif", color: textColor }}>
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

            <h1 style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 30, color: theme.gold, margin: '0 0 10px' }}>
              {cardName(card, lang)}
            </h1>

            <p style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '0 0 20px', fontSize: 13, fontWeight: 800 }}>
              {rc && <span style={{ color: rc.color, background: `${rc.color}1f`, padding: '3px 10px', borderRadius: 999 }}>{rarityLabel(card.rarity, t)}</span>}
              {card.type && <span style={{ color: mutedColor }}>{typeLabel(card.type, typeTranslations, lang)}</span>}
            </p>

            {cardLongDescription(card, lang) && (
              <p style={{ fontSize: 15, lineHeight: 1.6, margin: '0 0 28px', whiteSpace: 'pre-line' }}>{cardLongDescription(card, lang)}</p>
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
              </section>
            )}
          </>
        )}
      </main>

      <PublicFooter onNavigate={onNavigate} />
    </div>
  )
}
