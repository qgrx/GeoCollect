/**
 * Saisons du JEU (`cards.season_id`) — étiquette de reconnaissance.
 *
 * À ne pas confondre avec les COLLECTIONS (`data/collections.js`), qui sont des
 * vagues de publication déduites de `published_at`. Une saison est saisie en
 * admin et pilote la DISPONIBILITÉ d'un geocoin : hors de sa fenêtre, il n'est
 * plus tirable au quiz et bascule au marché « Hors saison ».
 *
 * La table `seasons` ne porte aucune couleur : elle est dérivée ici, donc sans
 * migration ni saisie supplémentaire. Un nom reconnaissable prend sa couleur
 * thématique ; les autres tournent sur une palette indexée par `id`, ce qui
 * garantit qu'une même saison garde sa couleur d'un écran à l'autre et d'une
 * session à l'autre.
 */

/**
 * Nom affiché d'une saison.
 *
 * `seasons.name` est la langue SOURCE (français), `name_translations` porte les
 * autres — même forme et même repli silencieux que `cards.name_translations`.
 * Sans traduction saisie en admin, un joueur anglophone lit donc le nom
 * français : c'est le repli, pas une erreur.
 */
export function seasonName(season, lang) {
  if (!season) return ''
  if (lang && lang !== 'fr' && season.name_translations?.[lang]) return season.name_translations[lang]
  return season.name || ''
}

// Le nom d'une saison est saisi librement en admin, dans la langue du moment :
// on reconnaît les grands classiques dans les quatre langues du jeu.
const THEMES = [
  [/no[eë]l|christmas|weihnacht|navidad/i,        '#c0392b'],
  [/halloween|citrouille|pumpkin|k[üu]rbis/i,     '#d35400'],
  [/p[âa]ques|easter|ostern|pascua/i,             '#8e44ad'],
  [/printemps|spring|fr[üu]hling|primavera/i,     '#00b894'],
  [/[ée]t[ée]|summer|sommer|verano/i,             '#e67e22'],
  [/automne|autumn|herbst|oto[ñn]o/i,             '#a0522d'],
  [/hiver|winter|invierno/i,                      '#0984e3'],
]

// Couleurs assez foncées pour porter du texte blanc — la pastille reste lisible
// sur les fonds clairs comme sombres.
const PALETTE = ['#6c5ce7', '#00838f', '#0984e3', '#c2185b', '#2e7d32', '#8e44ad', '#b7791f', '#5d6d7e']

/**
 * Couleur d'accent d'une saison, stable pour un `id` donné.
 * Le thème se lit sur le nom SOURCE (`name`), jamais sur sa traduction : la
 * couleur d'une saison ne doit pas changer en changeant la langue du jeu.
 */
export function seasonColor(season) {
  if (!season) return PALETTE[0]
  for (const [re, color] of THEMES) if (re.test(season.name || '')) return color
  const n = Number(season.id)
  return PALETTE[(Number.isFinite(n) ? Math.abs(Math.trunc(n)) : 0) % PALETTE.length]
}

/**
 * Couleur de texte lisible sur `hex` — le thème est libre, une pastille claire
 * (or, sable) rendrait le nom illisible en blanc.
 */
export function seasonTextColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return '#fff'
  const v = parseInt(m[1], 16)
  const lum = (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255
  return lum > 0.62 ? '#1e3045' : '#fff'
}

/** Index `id → saison` construit depuis `GET /api/seasons`. */
export function seasonsById(list) {
  const map = {}
  for (const s of (list || [])) if (s?.id != null) map[s.id] = s
  return map
}
