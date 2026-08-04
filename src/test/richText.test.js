import { describe, it, expect } from 'vitest'
import { isHtmlContent, richTextHtml, richTextPlain, richTextLength } from '../utils/richText.js'
import { sanitizeHtml } from '../utils/sanitize.js'

describe('isHtmlContent', () => {
  it('reconnaît le HTML de l’éditeur', () => {
    expect(isHtmlContent('<p>Bonjour</p>')).toBe(true)
    expect(isHtmlContent('un <strong>indice</strong>')).toBe(true)
  })

  it('ne prend pas un chevron de texte pour du balisage', () => {
    // Sinon « à 3 < 5 km du parking » perdrait tous ses paragraphes.
    expect(isHtmlContent('la cache est à 3 < 5 km du parking')).toBe(false)
    expect(isHtmlContent('')).toBe(false)
    expect(isHtmlContent(null)).toBe(false)
  })
})

describe('richTextHtml', () => {
  it('laisse passer le HTML tel quel', () => {
    const html = '<h2>Titre</h2><p>Texte avec <a href="https://coord.info/GC1234">un lien</a></p>'
    expect(richTextHtml(html)).toBe(html)
  })

  it('convertit les fiches d’avant l’éditeur, restées en texte brut', () => {
    // Ligne vide = paragraphe, saut simple = <br /> : ce que l'auteur voyait.
    expect(richTextHtml('Un\ndeux\n\nTrois')).toBe('<p>Un<br />deux</p>\n<p>Trois</p>')
  })

  it('échappe le texte brut qu’il convertit', () => {
    expect(richTextHtml('5 < 6 & "vrai"')).toBe('<p>5 &lt; 6 &amp; &quot;vrai&quot;</p>')
  })

  it('rend une chaîne vide pour un contenu absent', () => {
    expect(richTextHtml('')).toBe('')
    expect(richTextHtml(null)).toBe('')
  })
})

describe('richTextLength', () => {
  it('compte le texte, pas le balisage', () => {
    // 12 caractères de texte, quel que soit l'habillage.
    expect(richTextLength('Bonjour tout')).toBe(12)
    expect(richTextLength('<p><strong>Bonjour</strong> tout</p>')).toBe(12)
  })

  it('ne laisse pas un lien gonfler le compte', () => {
    const href = '<p><a href="https://www.geocaching.com/geocache/GC1234_une-cache-au-nom-tres-long">ici</a></p>'
    expect(richTextLength(href)).toBe(3)
  })
})

describe('richTextPlain', () => {
  it('sépare les blocs par une espace au lieu de coller les mots', () => {
    expect(richTextPlain('<p>Un</p><p>Deux</p>')).toBe('Un Deux')
  })
})

describe('chaîne complète (conversion puis sanitisation)', () => {
  it('conserve les liens de l’éditeur', () => {
    const out = sanitizeHtml(richTextHtml('<p>Voir <a href="https://coord.info/GC1234" target="_blank" rel="noopener noreferrer">la cache</a></p>'))
    expect(out).toContain('href="https://coord.info/GC1234"')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('ne laisse pas passer un script niché dans du texte brut', () => {
    const out = sanitizeHtml(richTextHtml('Coucou <script>alert(1)</script>'))
    expect(out).not.toContain('<script')
    expect(out).toContain('&lt;script&gt;')
  })
})
