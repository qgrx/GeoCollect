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
  geocoins: {
    en: {
      title: 'All geocoins — the Geocoins collection',
      description: 'Browse every geocoin in the collection: each one pays tribute to a real geocache, with its GC code, its type and the cacher who hid it.',
    },
    fr: {
      title: 'Tous les geocoins — la collection Geocoins',
      description: 'Parcourez toute la collection : chaque geocoin rend hommage à une géocache réelle, avec son code GC, son type de cache et son poseur.',
    },
    de: {
      title: 'Alle Geocoins — die Geocoins-Sammlung',
      description: 'Entdecke die ganze Sammlung: Jeder Geocoin ehrt einen echten Geocache, mit GC-Code, Cache-Typ und dem Owner, der ihn versteckt hat.',
    },
    es: {
      title: 'Todos los geocoins — la colección Geocoins',
      description: 'Recorre toda la colección: cada geocoin rinde homenaje a un geocaché real, con su código GC, su tipo de caché y su dueño.',
    },
  },
}

/** Copie d'une route, avec repli sur la langue par défaut puis sur l'accueil. */
export function seoCopy(route, lang) {
  const entry = SEO_COPY[route] ?? SEO_COPY.home
  return entry[lang] ?? entry[DEFAULT_LANG]
}
