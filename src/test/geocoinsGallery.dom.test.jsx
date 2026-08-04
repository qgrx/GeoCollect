/**
 * Galerie publique des geocoins : ce qu'elle montre, ce qu'elle cherche, et où
 * elle mène. Le reste (habillage, animations) n'a rien à faire dans un test.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import GeocoinsGallery from '../features/geocoins/GeocoinsGallery.jsx'
import { ThemeProvider } from '../ThemeContext.jsx'
import { setLang } from '../i18n/translations.js'

const CARDS = [
  { id: 1, type: 'Hommages', name: 'Die grünen Geister', rarity: 'légendaire',
    name_translations: { fr: 'Les esprits verts' }, gc_code: 'GC469TG', gc_owner: 'die Helden' },
  { id: 2, type: 'Hommages', name: 'Mingo', rarity: 'commun', gc_code: 'GC30', gc_owner: 'The Kansas Stasher' },
  // Ni les geocoins d'un autre type, ni les brouillons cachés n'ont de fiche
  // publique : les montrer mènerait à un lien mort.
  { id: 3, type: 'Pays', name: 'France', rarity: 'rare' },
  { id: 4, type: 'Hommages', name: 'Brouillon', rarity: 'rare', hidden: true },
]

vi.mock('../services/api.js', () => ({
  apiGetCards: () => Promise.resolve({ data: { cards: CARDS } }),
}))

beforeEach(() => { setLang('fr') })
afterEach(cleanup)

const renderGallery = (onNavigate = () => {}) =>
  render(<ThemeProvider><GeocoinsGallery onNavigate={onNavigate} /></ThemeProvider>)

describe('GeocoinsGallery', () => {
  it('n’expose que les geocoins publiés, sous leur nom d’origine et sa traduction', async () => {
    renderGallery()
    await waitFor(() => expect(screen.getByText('Die grünen Geister')).toBeTruthy())
    expect(screen.getByText('Les esprits verts')).toBeTruthy()
    expect(screen.getByText('Mingo')).toBeTruthy()
    expect(screen.queryByText('France')).toBeNull()
    expect(screen.queryByText('Brouillon')).toBeNull()
  })

  it('cherche aussi par code GC et par poseur, pas seulement par titre', async () => {
    renderGallery()
    await waitFor(() => expect(screen.getByText('Mingo')).toBeTruthy())
    const search = screen.getByRole('searchbox')

    fireEvent.change(search, { target: { value: 'GC30' } })
    await waitFor(() => expect(screen.queryByText('Die grünen Geister')).toBeNull())
    expect(screen.getByText('Mingo')).toBeTruthy()

    fireEvent.change(search, { target: { value: 'die helden' } })
    await waitFor(() => expect(screen.getByText('Die grünen Geister')).toBeTruthy())
    expect(screen.queryByText('Mingo')).toBeNull()
  })

  it('mène à la fiche du geocoin, par un vrai lien suivable', async () => {
    const onNavigate = vi.fn()
    renderGallery(onNavigate)
    await waitFor(() => expect(screen.getByText('Mingo')).toBeTruthy())

    const link = screen.getByText('Mingo').closest('a')
    expect(link.getAttribute('href')).toBe('/fr/geocoins/2-mingo')

    fireEvent.click(link, { button: 0 })
    expect(onNavigate).toHaveBeenCalledWith('geocoin', '2-mingo')
  })
})
