/**
 * Soldes de la forge — remise temporaire sur le coût en points de forge.
 *
 * ⚠️ Copie conforme de `src/utils/forgeSale.js` du repo `geocards-api`. Le prix
 * affiché ici et le prix débité là-bas doivent découler du MÊME calcul, arrondi
 * compris : un écart d'un seul PF fait cliquer un joueur sur un bouton qui sera
 * refusé par le serveur. Toute modification doit être reportée des deux côtés.
 *
 * Forme de la config `forge_sale` (clé publique, cf. PUBLIC_KEYS côté API) :
 *
 *   {
 *     active:    true,
 *     starts_at: "2026-08-04T16:00:00.000Z",   // ISO UTC, bornes incluses
 *     ends_at:   "2026-08-07T21:59:00.000Z",
 *     shiny:     { commun: 50, rare: 50, épique: 50, légendaire: 50 },  // % de remise
 *     forge:     { commun: 0,  rare: 0,  épique: 0,  légendaire: 0 }
 *   }
 */

export const MAX_SALE_PERCENT = 95

/** Les soldes courent-ils à l'instant `now` ? */
export function isSaleRunning(sale, now = Date.now()) {
  if (!sale || sale.active !== true) return false
  const start = Date.parse(sale.starts_at)
  const end   = Date.parse(sale.ends_at)
  if (isNaN(start) || isNaN(end) || end <= start) return false
  return now >= start && now < end
}

/**
 * Pourcentage de remise applicable (0 si aucune).
 * @param {'shiny'|'forge'} kind  opération concernée
 */
export function saleDiscount(sale, kind, rarity, now = Date.now()) {
  if (!isSaleRunning(sale, now)) return 0
  const pct = Number(sale?.[kind]?.[rarity])
  if (!isFinite(pct) || pct <= 0) return 0
  return Math.min(MAX_SALE_PERCENT, pct)
}

/**
 * Applique la remise à un coût en PF ; `original` sert au prix barré.
 * Un coût absent (null = « non configuré ») ressort INCHANGÉ : le convertir en
 * nombre afficherait « 🔨 0 » et activerait le bouton Forger sur un geocoin
 * dont le prix n'existe pas.
 */
export function applyForgeSale(cost, sale, kind, rarity, now = Date.now()) {
  const original = Number(cost)
  const discount = saleDiscount(sale, kind, rarity, now)
  if (!isFinite(original) || original <= 0 || discount <= 0) {
    return { cost, original: cost, discount: 0 }
  }
  return {
    cost: Math.max(1, Math.round(original * (100 - discount) / 100)),
    original,
    discount,
  }
}

/**
 * Remise la plus forte affichable dans le bandeau, toutes raretés confondues,
 * pour les opérations réellement visibles (`kinds`). L'onglet Brillance fermé,
 * un « Soldes −50 % » annoncé sur du shiny inaccessible serait un mensonge.
 */
export function maxSaleDiscount(sale, kinds = ['shiny', 'forge'], now = Date.now()) {
  if (!isSaleRunning(sale, now)) return 0
  let max = 0
  for (const kind of kinds) {
    for (const rarity of Object.keys(sale?.[kind] || {})) {
      max = Math.max(max, saleDiscount(sale, kind, rarity, now))
    }
  }
  return max
}

/** Millisecondes restantes avant la fin des soldes (0 si aucune en cours). */
export function saleTimeLeft(sale, now = Date.now()) {
  if (!isSaleRunning(sale, now)) return 0
  return Math.max(0, Date.parse(sale.ends_at) - now)
}

/** « 2 j 04:15 » / « 04:15:09 » — compte à rebours lisible d'un coup d'œil. */
export function formatSaleCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = n => String(n).padStart(2, '0')
  return d > 0 ? `${d} j ${pad(h)}:${pad(m)}` : `${pad(h)}:${pad(m)}:${pad(s)}`
}
