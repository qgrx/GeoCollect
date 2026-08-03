/**
 * Sérialisation du contenu docs en HTML statique (scripts/lib/renderDocs.mjs).
 * C'est ce HTML que lisent les moteurs : sa structure sémantique et l'échappement
 * du texte brut sont donc du domaine du test, pas du détail cosmétique.
 */
import { describe, it, expect } from 'vitest'
import { renderDocsPage, escapeText, excerpt } from '../../scripts/lib/renderDocs.mjs'

const heading = 'Nouveautés'

describe('renderDocsPage — release-notes', () => {
  const content = [
    { version: 'v1.42', items: [{ text: '<p>Marché <b>plus rapide</b></p>' }, { text: '<p>Correctif iOS</p>' }] },
    { version: 'v1.41', items: [{ text: '<p>Forge</p>' }] },
  ]

  it('produit un article par version, avec ses entrées en liste', () => {
    const { html } = renderDocsPage({ page: 'release-notes', content, heading })
    expect(html).toContain('<h1>Nouveautés</h1>')
    expect(html.match(/<article>/g)).toHaveLength(2)
    expect(html).toContain('<h2>v1.42</h2>')
    expect(html.match(/<li>/g)).toHaveLength(3)
  })

  it('applique la sanitisation fournie au HTML éditorial', () => {
    const { html } = renderDocsPage({
      page: 'release-notes', content, heading,
      sanitize: h => h.replace(/<b>|<\/b>/g, ''),
    })
    expect(html).toContain('plus rapide')
    expect(html).not.toContain('<b>')
  })

  it('écarte une version vide plutôt que de produire un article creux', () => {
    const { html } = renderDocsPage({ page: 'release-notes', content: [{ version: '', items: [] }], heading })
    expect(html).toBe('')
  })
})

describe('renderDocsPage — faq', () => {
  const content = [{ q: 'Comment jouer ?', a: '<p>Répondez au quiz.</p>' }]

  it('associe chaque question à sa réponse', () => {
    const { html } = renderDocsPage({ page: 'faq', content, heading: 'FAQ' })
    expect(html).toContain('<h2>Comment jouer ?</h2>')
    expect(html).toContain('Répondez au quiz.')
  })

  it('échappe le texte brut d’une question — il n’est jamais du HTML', () => {
    const { html } = renderDocsPage({
      page: 'faq',
      content: [{ q: '<script>alert(1)</script>', a: 'x' }],
      heading: 'FAQ',
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('renderDocsPage — support', () => {
  it('préfixe le titre de section par son icône', () => {
    const { html } = renderDocsPage({
      page: 'support',
      content: [{ icon: '💳', title: 'Paiement', desc: '<p>Écrivez-nous.</p>' }],
      heading: 'Support',
    })
    expect(html).toContain('<h2>💳 Paiement</h2>')
  })
})

describe('renderDocsPage — cas dégradés', () => {
  it('renvoie du vide sans contenu, pour publier des métadonnées seules', () => {
    expect(renderDocsPage({ page: 'faq', content: [], heading: 'FAQ' }).html).toBe('')
    expect(renderDocsPage({ page: 'faq', content: null, heading: 'FAQ' }).html).toBe('')
    expect(renderDocsPage({ page: 'inconnue', content: [{ q: 'a', a: 'b' }], heading: 'x' }).html).toBe('')
  })

  it('expose un extrait textuel exploitable comme meta description', () => {
    const { text } = renderDocsPage({
      page: 'faq',
      content: [{ q: 'Q ?', a: '<p>Une réponse claire.</p>' }],
      heading: 'FAQ',
    })
    expect(text).toContain('Une réponse claire.')
    expect(text).not.toContain('<')
  })
})

describe('excerpt', () => {
  it('coupe sur un mot entier et signale la troncature', () => {
    const out = excerpt('<p>' + 'mot '.repeat(80) + '</p>', 40)
    expect(out.length).toBeLessThanOrEqual(40)
    expect(out.endsWith('…')).toBe(true)
    expect(out).not.toContain('<')
  })

  it('laisse un texte court intact', () => {
    expect(excerpt('<b>court</b>', 40)).toBe('court')
  })
})

describe('escapeText', () => {
  it('neutralise les caractères actifs du HTML', () => {
    expect(escapeText('a & "b" <c>')).toBe('a &amp; &quot;b&quot; &lt;c&gt;')
    expect(escapeText(null)).toBe('')
  })
})
