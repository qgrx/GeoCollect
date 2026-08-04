import { useState, useEffect, useMemo, useDeferredValue } from 'react'
import Logo from '../../components/Logo.jsx'
import PublicFooter from '../../components/PublicFooter.jsx'
import { apiGetCards } from '../../services/api.js'
import { useT } from '../../i18n/translations.js'
import { useTheme } from '../../ThemeContext.jsx'
import { RC, cardCC, cardName, cardNameTranslation, rarityLabel } from '../../data/cards.js'
import { buildPath } from '../../routes.js'
import { publicGeocoins } from './publicGeocoins.js'
import { geocacheType } from '../../data/geocaching.js'

/**
 * Galerie publique des geocoins — la vitrine du site.
 *
 * Toutes les fiches publiées (`publicGeocoins`, donc les seuls geocoins
 * d'hommage) en vignettes, cherchables, chacune menant à sa fiche. C'est aussi
 * le maillage interne qui manquait : sans cette page, chaque fiche n'était
 * atteignable que par le sitemap ou par les six liens « à découvrir » de ses
 * voisines.
 *
 * Page publique autonome : elle ne charge pas le jeu et n'exige pas de compte.
 */

/** Ordre d'affichage des raretés — la plus rare d'abord, c'est ce qu'on vient voir. */
const RARITY_ORDER = ['légendaire', 'épique', 'rare', 'commun']

/** Texte comparable : minuscules, sans accents — « Québec » se trouve en tapant « quebec ». */
const foldText = (s) => String(s || '')
  .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function GeocoinsGallery({ onNavigate }) {
  const { t, lang } = useT()
  const { theme, mode } = useTheme()
  const [pool, setPool] = useState(null)          // null = chargement
  const [query, setQuery] = useState('')
  const [rarity, setRarity] = useState('')        // '' = toutes

  // La frappe reste fluide même quand le filtre repasse sur des centaines de
  // vignettes : React garde l'ancienne grille le temps de calculer la nouvelle.
  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    let alive = true
    apiGetCards()
      .then(({ data }) => { if (alive) setPool(data?.cards ?? []) })
      .catch(() => { if (alive) setPool([]) })
    return () => { alive = false }
  }, [])

  const all = useMemo(() => {
    const list = publicGeocoins(pool ?? [])
    const rank = r => { const i = RARITY_ORDER.indexOf(r); return i < 0 ? RARITY_ORDER.length : i }
    return [...list].sort((a, b) => rank(a.rarity) - rank(b.rarity) || a.name.localeCompare(b.name))
  }, [pool])

  // Recherche sur tout ce qui identifie un geocoin : son nom, sa traduction, le
  // code GC de la cache et son poseur. Quelqu'un qui cherche « GC13Y2Y » ou le
  // pseudo d'un poseur doit tomber dessus aussi sûrement qu'avec le titre.
  const shown = useMemo(() => {
    const q = foldText(deferredQuery).trim()
    return all.filter(c => {
      if (rarity && c.rarity !== rarity) return false
      if (!q) return true
      const hay = foldText([c.name, cardNameTranslation(c, lang), c.gc_code, c.gc_owner].join(' '))
      return q.split(/\s+/).every(word => hay.includes(word))
    })
  }, [all, deferredQuery, rarity, lang])

  // Mêmes couleurs que la fiche et que DocsLayout : les pages publiques forment
  // un tout. `pageBg` explicite, jamais `theme.bg` — cette clé n'existe pas.
  const pageBg     = mode === 'light' ? '#f5f7fa' : '#0f1923'
  const textColor  = mode === 'light' ? '#1e2d3d' : '#d4e8f8'
  const mutedColor = mode === 'light' ? '#6b7c8d' : '#7d8fa3'
  const cardBg     = mode === 'light' ? '#ffffff' : '#16213a'

  const go = (route, param) => onNavigate?.(route, param)
  const rarities = useMemo(() => RARITY_ORDER.filter(r => all.some(c => c.rarity === r)), [all])
  const filtering = Boolean(query.trim() || rarity)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: pageBg, fontFamily: "'Nunito',sans-serif", color: textColor }}>
      {/* Animations de la grille. Les vignettes n'apparaissent qu'une fois, en
          cascade : passé le premier rendu, filtrer ne doit pas tout faire
          clignoter. `prefers-reduced-motion` coupe tout — cette page est
          contemplative, pas un prétexte à donner le tournis. */}
      <style>{`
        @keyframes gcTileIn { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
        @keyframes gcAuraDrift { 0%,100% { transform: translate(-8%,-6%) scale(1) } 50% { transform: translate(8%,6%) scale(1.15) } }
        .gc-tile { animation: gcTileIn .5s cubic-bezier(.2,.7,.3,1) both; }
        .gc-tile:hover, .gc-tile:focus-visible { transform: translateY(-6px); }
        .gc-tile:hover .gc-thumb, .gc-tile:focus-visible .gc-thumb { transform: scale(1.07) rotate(-1.5deg); }
        .gc-tile:hover .gc-glow, .gc-tile:focus-visible .gc-glow { opacity: .55; }
        .gc-tile:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
        .gc-hero-aura { animation: gcAuraDrift 18s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .gc-tile, .gc-hero-aura { animation: none !important; }
          .gc-tile:hover, .gc-tile:hover .gc-thumb { transform: none !important; }
        }
      `}</style>

      <header style={{ padding: '12px 18px', borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href={buildPath('home', { lang })} onClick={e => { e.preventDefault(); go('home') }} style={{ textDecoration: 'none' }}>
          <Logo iconSize={30} textSize={19} />
        </a>
        <a
          href={buildPath('home', { lang })}
          onClick={e => { e.preventDefault(); go('home') }}
          style={{ background: 'linear-gradient(135deg,#6c5ce7,#a29bfe)', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 900, textDecoration: 'none' }}
        >
          {t('landing_hero_cta')}
        </a>
      </header>

      {/* Bandeau d'accroche : deux halos colorés très diffus derrière le titre.
          Rien d'autre — la vedette, ce sont les geocoins juste en dessous. */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: '46px 20px 30px', textAlign: 'center' }}>
        <div className="gc-hero-aura" aria-hidden="true" style={{
          position: 'absolute', inset: '-40% -10% auto -10%', height: '160%', pointerEvents: 'none',
          background: 'radial-gradient(38% 52% at 22% 34%, #6c5ce755, transparent 70%),'
                    + 'radial-gradient(34% 46% at 78% 58%, #00b89444, transparent 70%)',
          filter: 'blur(14px)',
        }} />
        <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}>
          <h1 style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 'clamp(28px,6vw,42px)', color: theme.gold, margin: '0 0 10px', lineHeight: 1.15 }}>
            {t('gallery_title')}
          </h1>
          <p style={{ margin: '0 auto', maxWidth: 560, fontSize: 15, lineHeight: 1.6, color: mutedColor }}>
            {t('gallery_sub')}
          </p>
        </div>
      </section>

      <main style={{ flex: 1, width: '100%', maxWidth: 1080, margin: '0 auto', padding: '0 20px 56px' }}>
        {/* Barre de recherche + filtres de rareté. `type="search"` : le clavier
            mobile propose « Rechercher » et le champ gagne sa croix d'effacement. */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 2, padding: '12px 0 14px',
          background: `linear-gradient(${pageBg} 72%, transparent)`,
        }}>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('gallery_search')}
            aria-label={t('gallery_search')}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '13px 16px', fontSize: 15,
              fontFamily: 'inherit', color: textColor, background: cardBg,
              border: `1px solid ${theme.border}`, borderRadius: 12, outline: 'none',
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 10 }}>
            <Chip active={!rarity} onClick={() => setRarity('')} color={theme.gold} cardBg={cardBg} border={theme.border} muted={mutedColor}>
              {t('gallery_all')}
            </Chip>
            {rarities.map(r => (
              <Chip key={r} active={rarity === r} onClick={() => setRarity(rarity === r ? '' : r)}
                color={RC[r].color} cardBg={cardBg} border={theme.border} muted={mutedColor}>
                {rarityLabel(r, t)}
              </Chip>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, color: mutedColor }}>
              {filtering
                ? t('gallery_count_filtered').replace('{n}', shown.length).replace('{total}', all.length)
                : t('gallery_count').replace('{n}', all.length)}
            </span>
          </div>
        </div>

        {pool === null && <p style={{ color: mutedColor }}>{t('gallery_loading')}</p>}

        {pool !== null && !shown.length && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: mutedColor }}>
            <div style={{ fontSize: 40, marginBottom: 10 }} aria-hidden="true">🔍</div>
            <p style={{ margin: '0 0 14px' }}>{t('gallery_empty')}</p>
            {filtering && (
              <button
                onClick={() => { setQuery(''); setRarity('') }}
                style={{ background: 'transparent', border: `1px solid ${theme.border}`, borderRadius: 999, padding: '8px 18px', color: textColor, fontFamily: 'inherit', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
              >
                {t('gallery_reset')}
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(148px,1fr))', gap: 16 }}>
          {shown.map((card, i) => (
            <Tile
              key={card.id} card={card} lang={lang} t={t} index={i}
              cardBg={cardBg} border={theme.border} textColor={textColor} mutedColor={mutedColor}
              onOpen={() => go('geocoin', card.slug)}
            />
          ))}
        </div>
      </main>

      <PublicFooter onNavigate={(r, param) => go(r, param)} />
    </div>
  )
}

function Chip({ active, onClick, color, cardBg, border, muted, children }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        background: active ? `${color}22` : cardBg,
        border: `1px solid ${active ? color : border}`,
        color: active ? color : muted,
        borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 900,
        fontFamily: 'inherit', cursor: 'pointer', transition: 'background .15s, color .15s, border-color .15s',
      }}
    >
      {children}
    </button>
  )
}

/**
 * Vignette d'un geocoin.
 *
 * C'est un VRAI lien (`<a href>`) et non une carte cliquable : ouvrir dans un
 * nouvel onglet, copier l'adresse et surtout se faire suivre par un robot
 * doivent marcher — cette galerie est le maillage interne des fiches.
 * `onClick` ne fait que court-circuiter la navigation pour rester en SPA.
 */
function Tile({ card, lang, t, index, cardBg, border, textColor, mutedColor, onOpen }) {
  const rc = RC[card.rarity]
  const { c1, c2 } = cardCC(card.rarity)
  const subtitle = cardNameTranslation(card, lang)
  const type = card.gc_cache_type ? geocacheType(card.gc_cache_type) : null
  const image = card.image_url_thumb || card.image_url

  return (
    <a
      className="gc-tile"
      href={buildPath('geocoin', { lang, param: card.slug })}
      onClick={e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); onOpen() }}
      title={card.name}
      style={{
        // La cascade s'arrête vite : au-delà, une vignette apparaîtrait après
        // que le visiteur a commencé à lire.
        animationDelay: `${Math.min(index, 16) * 35}ms`,
        position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0,
        background: cardBg, border: `1px solid ${border}`, borderRadius: 16,
        padding: 10, textDecoration: 'none', color: textColor,
        transition: 'transform .22s cubic-bezier(.2,.7,.3,1), box-shadow .22s',
        boxShadow: '0 1px 2px #0000000f',
      }}
    >
      {/* Halo de rareté, révélé au survol : la couleur dit la valeur du geocoin
          sans qu'aucun badge ne vienne encombrer la vignette. */}
      <span className="gc-glow" aria-hidden="true" style={{
        position: 'absolute', inset: -1, borderRadius: 17, opacity: 0,
        background: `radial-gradient(120% 80% at 50% 0%, ${rc?.color ?? '#888'}66, transparent 70%)`,
        transition: 'opacity .22s', pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative', aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `linear-gradient(135deg,${c1},${c2})`,
      }}>
        {image
          ? <img
              className="gc-thumb" src={image} alt="" loading="lazy" decoding="async" width="240" height="240"
              style={{ width: '100%', height: '100%', objectFit: 'contain', transition: 'transform .3s cubic-bezier(.2,.7,.3,1)' }}
            />
          : <span className="gc-thumb" aria-hidden="true" style={{ fontSize: 34, fontWeight: 900, color: '#ffffffcc', transition: 'transform .3s' }}>
              {card.name.slice(0, 1)}
            </span>}

        {/* Type de cache honorée, en pastille — l'icône seule, le libellé est
            porté par title/aria pour ne pas manger la vignette. */}
        {type && (
          <span title={`${card.gc_code ? card.gc_code + ' — ' : ''}${t('geocoin_label_cache_type')}`}
            style={{ position: 'absolute', top: 6, left: 6, fontSize: 13, lineHeight: 1, padding: '4px 5px', borderRadius: 8, background: '#0009', backdropFilter: 'blur(2px)' }}>
            <span aria-hidden="true">{type.icon}</span>
          </span>
        )}
      </div>

      <div style={{ padding: '9px 3px 2px', minWidth: 0 }}>
        <div style={{
          fontFamily: "'Fredoka One',sans-serif", fontSize: 13.5, lineHeight: 1.25,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {cardName(card, lang)}
        </div>
        {subtitle && (
          <div lang={lang} style={{ fontSize: 10.5, fontStyle: 'italic', color: mutedColor, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subtitle}
          </div>
        )}
        <div style={{ marginTop: 6, fontSize: 10, fontWeight: 900, letterSpacing: .4, color: rc?.color ?? mutedColor }}>
          {'★'.repeat(rc?.stars ?? 0)}<span style={{ color: mutedColor, opacity: .45 }}>{'★'.repeat(4 - (rc?.stars ?? 0))}</span>
        </div>
      </div>
    </a>
  )
}
