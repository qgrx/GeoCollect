/**
 * Titres et descriptions destinés aux moteurs de recherche, par route et par langue.
 *
 * Volontairement séparé de i18n/translations.js : la copie SEO obéit à des
 * contraintes propres (≈60 caractères pour un titre, ≈155 pour une description,
 * sous peine de troncature dans les résultats) et n'est jamais affichée dans
 * l'interface. Ce module ne dépend que de seo/site.js — il est importé aussi bien
 * par l'application que par vite.config.js et les scripts Node de génération.
 */
import { DEFAULT_LANG } from './site.js'

export const SEO_COPY = {
  home: {
    en: {
      title: 'Geocoins — Collect rare geocoins by playing',
      description: 'Collect rare geocoins by answering geocaching trivia. Real-time duels, a player-driven market and a collection synced across all your devices.',
    },
    fr: {
      title: 'Geocoins — Collectionnez des geocoins rares en jouant',
      description: 'Collectionnez des geocoins rares en répondant à des quiz sur le geocaching. Duels en temps réel, marché entre joueurs et collection synchronisée.',
    },
    de: {
      title: 'Geocoins — Sammle seltene Geocoins beim Spielen',
      description: 'Sammle seltene Geocoins, indem du Geocaching-Fragen beantwortest. Echtzeit-Duelle, Spielermarkt und eine auf allen Geräten synchronisierte Sammlung.',
    },
    es: {
      title: 'Geocoins — Colecciona geocoins raros jugando',
      description: 'Colecciona geocoins raros respondiendo preguntas de geocaching. Duelos en tiempo real, mercado entre jugadores y colección sincronizada.',
    },
  },
}

/** Copie d'une route, avec repli sur la langue par défaut puis sur l'accueil. */
export function seoCopy(route, lang) {
  const entry = SEO_COPY[route] ?? SEO_COPY.home
  return entry[lang] ?? entry[DEFAULT_LANG]
}
