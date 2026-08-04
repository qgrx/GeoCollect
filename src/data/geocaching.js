/**
 * La cache réelle derrière un geocoin d'HOMMAGE : type de cache, code GC, poseur.
 *
 * Un geocoin d'hommage honore une cache existante. Ces trois informations sont
 * saisies dans l'admin (onglet Cartes) et stockées en colonnes dédiées
 * (`cards.gc_code`, `gc_owner`, `gc_cache_type`), pas noyées dans la prose de la
 * description longue : structurées, elles restent affichables, vérifiables et
 * traduisibles.
 *
 * ⚠️ La liste des CODES est jumelle de `geocards-api/src/utils/geocacheTypes.js`,
 * qui décide ce que la base accepte. Ajouter un type ici sans l'ajouter là-bas
 * fait échouer silencieusement la sauvegarde (le champ revient vide) : les deux
 * fichiers se modifient ensemble.
 */

/**
 * Types de geocoins concernés — les mêmes que ceux publiés sur une page
 * publique (`PUBLISHED_TYPES`), et pour la même raison : eux seuls parlent d'une
 * cache du monde réel. Un geocoin de pays n'a ni code GC ni poseur.
 */
export const TRIBUTE_TYPES = ['Hommages']

export const isTributeCard = (card) => !!card && TRIBUTE_TYPES.includes(card.type)

/**
 * Types de caches geocaching.com.
 *
 * `code` est la valeur stockée — ne JAMAIS la renommer. Les libellés, eux, sont
 * traduits : la fiche publique d'un geocoin existe en quatre langues, et un
 * « Cache traditionnelle » sur une page anglaise ferait tache. Les noms suivent
 * ceux de geocaching.com ; les types dont le nom est un nom propre (EarthCache,
 * Wherigo, Adventure Lab…) restent identiques partout, volontairement.
 *
 * Les types retirés (Locationless, Project APE…) restent de la partie : les
 * caches qui les portent existent toujours, et ce sont justement celles qui
 * méritent un hommage.
 */
export const GEOCACHE_TYPES = [
  { code: 'traditional',   icon: '🟢', group: 'Caches',
    label: { fr: 'Cache traditionnelle', en: 'Traditional Cache', de: 'Traditioneller Cache', es: 'Caché tradicional' } },
  { code: 'multi',         icon: '🟡', group: 'Caches',
    label: { fr: 'Multi-cache', en: 'Multi-Cache', de: 'Multi-Cache', es: 'Multicaché' } },
  { code: 'mystery',       icon: '🔵', group: 'Caches',
    label: { fr: 'Cache mystère / Puzzle', en: 'Mystery Cache', de: 'Mystery-Cache', es: 'Caché misterio' } },
  { code: 'earthcache',    icon: '🌍', group: 'Caches',
    label: { fr: 'EarthCache', en: 'EarthCache', de: 'EarthCache', es: 'EarthCache' } },
  { code: 'letterbox',     icon: '📮', group: 'Caches',
    label: { fr: 'Letterbox Hybrid', en: 'Letterbox Hybrid', de: 'Letterbox Hybrid', es: 'Letterbox Hybrid' } },
  { code: 'wherigo',       icon: '🎮', group: 'Caches',
    label: { fr: 'Wherigo', en: 'Wherigo Cache', de: 'Wherigo-Cache', es: 'Caché Wherigo' } },
  { code: 'virtual',       icon: '👻', group: 'Caches',
    label: { fr: 'Cache virtuelle', en: 'Virtual Cache', de: 'Virtueller Cache', es: 'Caché virtual' } },
  { code: 'webcam',        icon: '📷', group: 'Caches',
    label: { fr: 'Cache webcam', en: 'Webcam Cache', de: 'Webcam-Cache', es: 'Caché webcam' } },
  { code: 'adventure_lab', icon: '🧪', group: 'Caches',
    label: { fr: 'Adventure Lab', en: 'Adventure Lab', de: 'Adventure Lab', es: 'Adventure Lab' } },

  { code: 'event',         icon: '🎉', group: 'Événements',
    label: { fr: 'Event Cache', en: 'Event Cache', de: 'Event-Cache', es: 'Caché evento' } },
  { code: 'cito',          icon: '♻️', group: 'Événements',
    label: { fr: 'CITO (Cache In Trash Out)', en: 'CITO Event', de: 'CITO-Event', es: 'Evento CITO' } },
  { code: 'mega',          icon: '🎪', group: 'Événements',
    label: { fr: 'Mega / Giga-Event', en: 'Mega / Giga-Event', de: 'Mega- / Giga-Event', es: 'Mega / Giga-Evento' } },

  { code: 'locationless',  icon: '🧭', group: 'Types historiques',
    label: { fr: 'Cache sans coordonnées (Locationless)', en: 'Locationless (Reverse) Cache', de: 'Locationless-Cache', es: 'Caché sin coordenadas' } },
  { code: 'project_ape',   icon: '🦍', group: 'Types historiques',
    label: { fr: 'Project APE', en: 'Project APE Cache', de: 'Project-APE-Cache', es: 'Caché Project APE' } },
  { code: 'event_10years', icon: '🎂', group: 'Types historiques',
    label: { fr: '10 Years! Event', en: '10 Years! Event Cache', de: '10 Years! Event-Cache', es: 'Evento 10 Years!' } },
  { code: 'gps_maze',      icon: '🗺️', group: 'Types historiques',
    label: { fr: 'GPS Adventures Maze Exhibit', en: 'GPS Adventures Maze Exhibit', de: 'GPS Adventures Maze Exhibit', es: 'GPS Adventures Maze Exhibit' } },
  { code: 'hq',            icon: '🏠', group: 'Types historiques',
    label: { fr: 'Geocaching HQ', en: 'Geocaching HQ', de: 'Geocaching HQ', es: 'Geocaching HQ' } },
  { code: 'hq_block_party', icon: '🏢', group: 'Types historiques',
    label: { fr: 'Geocaching HQ Block Party', en: 'Geocaching HQ Block Party', de: 'Geocaching HQ Block Party', es: 'Geocaching HQ Block Party' } },
  { code: 'community_celebration', icon: '🥳', group: 'Types historiques',
    label: { fr: 'Community Celebration Event', en: 'Community Celebration Event', de: 'Community Celebration Event', es: 'Evento Community Celebration' } },
]

/** Groupes dans l'ordre d'affichage, pour les `<optgroup>` du sélecteur. */
export const GEOCACHE_TYPE_GROUPS = [...new Set(GEOCACHE_TYPES.map(t => t.group))]

export const geocacheType = (code) => GEOCACHE_TYPES.find(t => t.code === code) || null

/**
 * Libellé traduit, avec repli sur le français (langue de rédaction) puis sur le
 * code brut : un type inconnu s'affiche tel quel plutôt que de laisser un vide.
 */
export function geocacheTypeLabel(code, lang = 'fr') {
  const t = geocacheType(code)
  if (!t) return code || ''
  return t.label[lang] || t.label.fr
}

/**
 * Contrôle de saisie du code GC, côté formulaire uniquement.
 *
 * L'API renormalise et a le dernier mot ; ici on ne cherche qu'à prévenir tout
 * de suite la faute de frappe, pendant que l'admin a la cache sous les yeux.
 * `null` = rien à signaler.
 */
export function gcCodeIssue(value) {
  const v = (value || '').trim()
  if (!v) return null
  if (/^https?:\/\//i.test(v) || v.includes('/')) return null   // lien : l'API en extrait le code
  return /^GC[0-9A-Za-z]{1,8}$/.test(v) ? null : 'Format attendu : GC suivi de 1 à 8 caractères (ex : GC1A2B3), ou collez le lien de la cache.'
}

/**
 * Même normalisation que l'API (`normalizeGcCode`), appliquée avant l'envoi.
 *
 * L'API reste la seule autorité, mais elle renvoie sa valeur nettoyée : sans ce
 * miroir, le pool local garderait le lien collé alors que la base contient le
 * code, et rouvrir la fiche montrerait autre chose que ce qui est enregistré.
 */
export function gcCodeFromInput(value) {
  if (value === null || value === undefined) return null
  const compact = String(value).trim().toUpperCase().replace(/\s+/g, '')
  if (!compact) return null
  if (/^GC[0-9A-Z]{1,8}$/.test(compact)) return compact
  const found = compact.match(/GC[0-9A-Z]{1,8}/)
  return found ? found[0] : null
}

/** URL publique de la cache — le raccourci officiel, valable pour tout code GC. */
export const gcCodeUrl = (code) => (code ? `https://coord.info/${String(code).trim().toUpperCase()}` : null)
