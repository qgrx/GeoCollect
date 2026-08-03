/**
 * Identité canonique du site, partagée par tout ce qui fabrique des URLs
 * destinées aux moteurs et aux réseaux sociaux.
 *
 * Le site répond sur geocoins.io ET geocoins.fr, sans redirection (cf.
 * geocards-api/docs/DOMAIN-MIGRATION.md : « aucun lien mort »). Sans URL
 * canonique déclarée, les deux domaines se concurrencent en duplicate content.
 * D'où une constante figée sur .io — surtout PAS window.location.origin, qui
 * ferait dire à chaque page qu'elle est canonique sur le domaine d'arrivée.
 */
export const SITE_URL  = 'https://geocoins.io'
export const SITE_NAME = 'Geocoins'

/**
 * Langues pour lesquelles une version indexable existe. **La première est la
 * langue par défaut** : elle est servie sans préfixe d'URL, porte l'URL canonique
 * et sert de `x-default` aux moteurs.
 *
 * L'anglais est en tête pour viser l'audience geocaching mondiale ; le français
 * est une traduction parmi les autres, sous `/fr/`.
 */
export const SEO_LANGS = ['en', 'fr', 'de', 'es']

/** Langue servie sans préfixe. Tout le reste s'en déduit (routes, hreflang, repli). */
export const DEFAULT_LANG = SEO_LANGS[0]

/**
 * Langue de rédaction historique du contenu : c'est elle qui est la plus complète.
 * Sert de dernier repli quand une clé manque dans la langue demandée ET en anglais.
 */
export const SOURCE_LANG = 'fr'

/** Chemin ou URL relative → URL absolue sur le domaine canonique. */
export const abs = (pathOrUrl) => new URL(pathOrUrl, SITE_URL).toString()
