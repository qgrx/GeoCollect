import { describe, it, expect } from 'vitest'
import { cardName, cardDescription, cardLongDescription } from '../data/cards.js'

const card = {
  name: 'Original Stash',
  name_translations: { de: 'Ursprüngliches Versteck' },
  description: 'La toute première cache.',
  description_translations: { en: 'The very first cache.' },
  description_long: 'Le 3 mai 2000, Dave Ulmer cache un seau dans l’Oregon.',
  description_long_translations: { en: 'On 3 May 2000, Dave Ulmer hid a bucket in Oregon.' },
}

describe('cardName / cardDescription', () => {
  it('sert la traduction quand elle existe, la source sinon', () => {
    expect(cardName(card, 'de')).toBe('Ursprüngliches Versteck')
    expect(cardName(card, 'es')).toBe('Original Stash')
    expect(cardDescription(card, 'en')).toBe('The very first cache.')
    expect(cardDescription(card, 'es')).toBe('La toute première cache.')
  })
})

describe('cardLongDescription', () => {
  it('sert la description longue traduite, sinon la source française', () => {
    expect(cardLongDescription(card, 'en')).toBe('On 3 May 2000, Dave Ulmer hid a bucket in Oregon.')
    expect(cardLongDescription(card, 'es')).toBe('Le 3 mai 2000, Dave Ulmer cache un seau dans l’Oregon.')
  })

  it('retombe sur la description courte à l’affichage quand la longue manque', () => {
    const bare = { description: 'Courte', description_long: '' }
    expect(cardLongDescription(bare, 'fr')).toBe('Courte')
  })

  it('ne retombe PAS sur la courte quand on demande si une longue existe', () => {
    // C'est ce contrôle qui décide de l'indexation : une description de carte ne
    // fait pas une page publique.
    const bare = { description: 'Courte', description_long: '' }
    expect(cardLongDescription(bare, 'fr', { fallback: false })).toBe('')
  })

  it('tolère l’absence de carte et de colonnes (avant migration)', () => {
    expect(cardLongDescription(null, 'fr')).toBe('')
    expect(cardLongDescription({ description: 'x' }, 'en')).toBe('x')
  })
})
