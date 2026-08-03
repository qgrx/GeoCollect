/**
 * Comportements de routing qui n'existent que dans un navigateur : réaction au
 * bouton Retour, réécriture de l'URL au changement de langue, liens du pied de page.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, render, screen, cleanup } from '@testing-library/react'
import { useRoute } from '../hooks/useRoute.js'
import { setLang, getLang } from '../i18n/translations.js'
import PublicFooter from '../components/PublicFooter.jsx'
import { ThemeProvider } from '../ThemeContext.jsx'

function goto(path) {
  window.history.replaceState({}, '', path)
}

beforeEach(() => {
  goto('/')
  setLang('en')
})
afterEach(cleanup)

describe('useRoute', () => {
  it('lit la route courante depuis l’URL', () => {
    goto('/faq')
    const { result } = renderHook(() => useRoute())
    expect(result.current.route).toBe('faq')
  })

  it('navigue en empilant une entrée d’historique', () => {
    const { result } = renderHook(() => useRoute())
    act(() => result.current.navigate('release-notes'))
    expect(window.location.pathname).toBe('/release-notes')
    expect(result.current.route).toBe('release-notes')
  })

  it('réagit au bouton Retour — c’est ce qui manquait avant le module de routes', () => {
    const { result } = renderHook(() => useRoute())
    act(() => result.current.navigate('faq'))
    expect(result.current.route).toBe('faq')

    // jsdom n'exécute pas history.back() de façon synchrone : on rejoue ce que le
    // navigateur produit, à savoir un changement d'URL suivi de l'événement popstate.
    act(() => {
      window.history.replaceState({}, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(result.current.route).toBe('home')
  })

  it('ne laisse pas d’entrée d’historique avec replace', () => {
    const { result } = renderHook(() => useRoute())
    const spy = vi.spyOn(window.history, 'pushState')
    act(() => result.current.replace('faq'))
    expect(window.location.pathname).toBe('/faq')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('conserve le préfixe de langue en naviguant', () => {
    goto('/fr/faq')
    const { result } = renderHook(() => useRoute())
    expect(result.current.lang).toBe('fr')
    act(() => result.current.navigate('support'))
    expect(window.location.pathname).toBe('/fr/support')
  })

  it('signale un chemin inconnu par route = null (déclencheur du 404)', () => {
    goto('/nimporte-quoi')
    const { result } = renderHook(() => useRoute())
    expect(result.current.route).toBeNull()
  })
})

describe('setLang', () => {
  it('aligne l’URL sur la langue choisie, sans perdre la page', () => {
    goto('/faq')
    act(() => setLang('de'))
    expect(getLang()).toBe('de')
    expect(window.location.pathname).toBe('/de/faq')
    act(() => setLang('en'))
    expect(window.location.pathname).toBe('/faq')
  })

  it('préserve le hash — le retour OAuth y transporte son jeton', () => {
    window.history.replaceState({}, '', '/#access_token=abc')
    act(() => setLang('es'))
    expect(window.location.pathname).toBe('/es')
    expect(window.location.hash).toBe('#access_token=abc')
  })

  it('met à jour <html lang>, figé à « en » dans index.html', () => {
    act(() => setLang('de'))
    expect(document.documentElement.lang).toBe('de')
  })
})

describe('PublicFooter', () => {
  const renderFooter = (onNavigate = () => {}) =>
    render(<ThemeProvider><PublicFooter onNavigate={onNavigate} /></ThemeProvider>)

  it('expose de vrais href vers les pages indexables', () => {
    renderFooter()
    const hrefs = Array.from(document.querySelectorAll('a')).map(a => a.getAttribute('href'))
    expect(hrefs).toEqual(expect.arrayContaining(['/release-notes', '/faq', '/support']))
  })

  it('déclare les traductions par des liens hreflang suivables', () => {
    goto('/faq')
    renderFooter()
    const alt = Array.from(document.querySelectorAll('a[hreflang]'))
      .map(a => [a.getAttribute('hreflang'), a.getAttribute('href')])
    expect(alt).toEqual([['en', '/faq'], ['fr', '/fr/faq'], ['de', '/de/faq'], ['es', '/es/faq']])
  })

  it('navigue côté client au lieu de recharger la page', () => {
    const onNavigate = vi.fn()
    renderFooter(onNavigate)
    const faq = Array.from(document.querySelectorAll('a')).find(a => a.getAttribute('href') === '/faq')
    faq.click()
    expect(onNavigate).toHaveBeenCalledWith('faq')
  })

  it('affiche le nom du jeu et les quatre langues', () => {
    renderFooter()
    expect(screen.getByText('Français')).toBeInTheDocument()
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('Deutsch')).toBeInTheDocument()
    expect(screen.getByText('Español')).toBeInTheDocument()
  })
})
