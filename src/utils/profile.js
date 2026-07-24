import { weekStartParis } from './gameUtils.js'

/**
 * normalizeProfile — SOURCE DE VÉRITÉ de la forme du profil côté client.
 *
 * Le profil peut être chargé par deux chemins (dette connue) : Supabase en direct
 * (bootstrap d'auth, colonnes plates) OU GET /api/profile (déjà mis en forme par le
 * serveur). Cette fonction reconstruit les objets dérivés à partir des colonnes
 * PLATES pour que la forme soit identique quel que soit le chemin — notamment
 * `weekly` / `patronage`, consommés par SettingsModal.
 *
 * Fonction PURE (aucun effet, entrée→sortie déterministe) → testée unitairement
 * dans src/test/profile.test.js. C'est ici qu'on épingle le contrat de forme.
 *
 * Les compteurs hebdomadaires sont ramenés à 0 dès que leur `*_reset_at` est
 * antérieur au lundi courant (Paris), en miroir du reset paresseux côté serveur.
 */
export function normalizeProfile(p) {
  if (!p) return p
  const weekStart = weekStartParis()
  const wNew = !p.weekly_reset_at || p.weekly_reset_at < weekStart
  const pNew = !p.patronage_reset_at || p.patronage_reset_at < weekStart
  return {
    ...p,
    geocaching_verified: p.geocaching_verified ?? Boolean(p.geocaching_verified_at),
    weekly: {
      rare:       wNew ? 0 : (p.weekly_rare || 0),
      epique:     wNew ? 0 : (p.weekly_epique || 0),
      legendaire: wNew ? 0 : (p.weekly_legendaire || 0),
    },
    patronage: {
      count:            Number(p.patronage_count || 0),
      given_rare:       pNew ? 0 : (p.patronage_given_rare || 0),
      given_epique:     pNew ? 0 : (p.patronage_given_epique || 0),
      given_legendaire: pNew ? 0 : (p.patronage_given_legendaire || 0),
    },
  }
}
