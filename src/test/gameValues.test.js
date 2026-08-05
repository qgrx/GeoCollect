import { describe, it, expect } from 'vitest'
import { gameValues, resolveGameValues, VALUE_KEYS } from '../data/gameValues.js'

/** Toutes les espaces (insécables comprises) ramenées à l'espace ordinaire. */
const spaces = (s) => String(s).replace(/\s/g, ' ')

// Config publique réduite, dans la forme exacte servie par GET /api/config.
const CONFIG = {
  quiz_daily_card_cap: 25,
  quiz_hourly_card_cap: 12,
  quiz_daily_shiny_cap: 3,
  limits_connected: { dailyGold: 250, dailyCards: 20 },
  shiny_rate: 0.1,
  quiz_rarity_rates: { commun: 69.9, rare: 25, 'épique': 5, 'légendaire': 0.1 },
  market_sale_tax: 0.12,
  beginner_quiz_duration: 60,
  quiz_extra_prize_grace: 20,
  bag_slot_prices: [500, 1000, 1000],
  shiny_forge_cost_by_rarity: { commun: 60, rare: 180, 'épique': 600, 'légendaire': 1800 },
  quiz_prize_tiers: [{ players: 20, prizes: 3 }, { players: 10, prizes: 2 }],
}

describe('gameValues', () => {
  it('formate les nombres, taux et durées à la française', () => {
    const v = gameValues(CONFIG)
    expect(v.geocoins_par_jour).toBe('25')
    expect(v.or_par_jour).toBe('250')
    expect(v.chance_brillant).toBe('10 %')
    expect(v.chance_commun).toBe('69,9 %')
    expect(v.taxe_de_vente).toBe('12 %')
    expect(v.duree_manche_entrainement).toBe('1 minute')
    expect(v.fenetre_geocoins_suivants).toBe('20 secondes')
  })

  it('énumère les barèmes par rareté et les prix croissants', () => {
    const v = gameValues(CONFIG)
    // Intl sépare les milliers par une espace insécable, dont la nature exacte
    // varie selon la version d'ICU : on compare donc à espaces normalisées.
    expect(spaces(v.prix_brillance)).toBe('60 pour un commun, 180 pour un rare, 600 pour un épique, 1 800 pour un légendaire')
    expect(spaces(v.prix_emplacements_sac)).toBe('500, puis 1 000, puis 1 000')
  })

  it('cite le PREMIER palier de geocoins multiples, quel que soit l’ordre en config', () => {
    const v = gameValues(CONFIG)
    expect(v.joueurs_pour_plusieurs_geocoins).toBe('10')
    expect(v.geocoins_multiples_a_ce_palier).toBe('2')
  })

  it('retombe sur les défauts de l’API quand une clé manque', () => {
    // Une page de règles doit rester lisible même si /api/config est injoignable.
    const v = gameValues({})
    expect(v.geocoins_par_jour).toBe('25')
    expect(v.chance_brillant).toBe('10 %')
    expect(Object.values(v).every(x => typeof x === 'string' && x.length)).toBe(true)
  })

  it('localise nombres, durées et énumérations par rareté', () => {
    // Sans ça, une page anglaise afficherait « 60 pour un commun » au milieu
    // d'une phrase en anglais.
    expect(spaces(gameValues(CONFIG, 'en').prix_brillance))
      .toBe('60 for a common, 180 for a rare, 600 for an epic, 1,800 for a legendary')
    expect(spaces(gameValues(CONFIG, 'de').prix_brillance))
      .toBe('60 für einen gewöhnlichen, 180 für einen seltenen, 600 für einen epischen, 1.800 für einen legendären')
    expect(gameValues(CONFIG, 'es').prix_brillance).toContain('para un común')

    expect(gameValues(CONFIG, 'en').duree_manche_entrainement).toBe('1 minute')
    expect(gameValues(CONFIG, 'de').duree_manche_entrainement).toBe('1 Minute')
    expect(gameValues(CONFIG, 'es').fenetre_geocoins_suivants).toBe('20 segundos')
    expect(spaces(gameValues(CONFIG, 'en').prix_emplacements_sac)).toBe('500, then 1,000, then 1,000')
  })

  it('expose les MÊMES marqueurs dans toutes les langues', () => {
    // Le contenu est rédigé une fois avec ses marqueurs : une clé qui manquerait
    // dans une langue laisserait un « {{…}} » brut sur la page traduite.
    const ref = Object.keys(gameValues(CONFIG, 'fr')).sort()
    for (const lang of ['en', 'de', 'es']) {
      expect(Object.keys(gameValues(CONFIG, lang)).sort()).toEqual(ref)
    }
  })

  it('retombe sur le français pour une langue inconnue', () => {
    expect(gameValues(CONFIG, 'it').prix_brillance).toContain('pour un commun')
  })

  it('tolère une config nulle ou malformée', () => {
    for (const bad of [null, undefined, 'nope', 42, { limits_connected: 'cassé', quiz_rarity_rates: null }]) {
      expect(() => gameValues(bad)).not.toThrow()
    }
  })
})

describe('resolveGameValues', () => {
  const values = gameValues(CONFIG)

  it('remplace les marqueurs dans un fragment HTML', () => {
    const html = '<p>Vous gagnez <strong>{{geocoins_par_jour}} geocoins</strong> par jour.</p>'
    expect(resolveGameValues(html, values)).toBe('<p>Vous gagnez <strong>25 geocoins</strong> par jour.</p>')
  })

  it('accepte les espaces et la casse dans le marqueur', () => {
    expect(resolveGameValues('{{ GEOCOINS_PAR_JOUR }}', values)).toBe('25')
  })

  it('laisse VISIBLE un marqueur inconnu plutôt que de le vider', () => {
    // Une coquille du rédacteur doit se voir en page, pas produire un trou muet.
    expect(resolveGameValues('a {{coquille}} b', values)).toBe('a {{coquille}} b')
  })

  it('échappe la valeur injectée : un marqueur ne peut pas ouvrir de balise', () => {
    const piege = { mechant: '<img src=x onerror=alert(1)>' }
    expect(resolveGameValues('{{mechant}}', piege)).toBe('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('renvoie l’entrée telle quelle si elle est vide', () => {
    expect(resolveGameValues('', values)).toBe('')
    expect(resolveGameValues(null, values)).toBe(null)
  })

  it('expose la liste des marqueurs pour l’aide à la rédaction', () => {
    expect(VALUE_KEYS).toContain('geocoins_par_jour')
    expect(VALUE_KEYS.length).toBeGreaterThan(20)
  })
})
