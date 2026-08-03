import { describe, it, expect } from 'vitest'
import { organizationLd, websiteLd, videoGameLd, faqPageLd, geocoinLd, ldScript, stripHtml } from '../seo/jsonld.js'
import { seoHead, esc } from '../seo/head.js'
import { seoCopy, SEO_COPY } from '../seo/copy.js'
import { SITE_URL, SEO_LANGS, DEFAULT_LANG, abs } from '../seo/site.js'

describe('seo/site', () => {
  it('rend les chemins absolus sur le domaine canonique', () => {
    expect(abs('/og-image.png')).toBe('https://geocoins.io/og-image.png')
    expect(abs('/')).toBe('https://geocoins.io/')
  })

  it('laisse une URL déjà absolue intacte (image de geocoin hébergée ailleurs)', () => {
    expect(abs('https://cdn.example.com/a.webp')).toBe('https://cdn.example.com/a.webp')
  })
})

describe('seo/copy', () => {
  it('couvre les quatre langues indexables', () => {
    for (const lang of SEO_LANGS) expect(SEO_COPY.home[lang]).toBeTruthy()
  })

  it('respecte les longueurs exploitables par Google', () => {
    for (const lang of SEO_LANGS) {
      const { title, description } = seoCopy('home', lang)
      expect(title.length).toBeLessThanOrEqual(60)
      expect(description.length).toBeLessThanOrEqual(160)
    }
  })

  it('retombe sur la langue par défaut pour une langue inconnue', () => {
    expect(DEFAULT_LANG).toBe('en')
    expect(seoCopy('home', 'it')).toEqual(SEO_COPY.home.en)
  })
})

describe('seo/jsonld', () => {
  it('déclare le logo en URL absolue — c’est ce qui permet à Google de l’associer à la marque', () => {
    const org = organizationLd()
    expect(org['@type']).toBe('Organization')
    expect(org.logo.url).toBe(`${SITE_URL}/icon-512.png`)
    expect(org.logo.url.startsWith('http')).toBe(true)
  })

  it('relie le site à l’organisation par @id', () => {
    expect(websiteLd().publisher['@id']).toBe(organizationLd()['@id'])
    expect(videoGameLd({ description: 'x' }).publisher['@id']).toBe(organizationLd()['@id'])
  })

  it('construit un FAQPage à partir des entrées de GET /api/docs/faq', () => {
    const ld = faqPageLd([{ q: 'Question ?', a: '<p>Une <b>réponse</b>.</p>' }])
    expect(ld['@type']).toBe('FAQPage')
    expect(ld.mainEntity).toHaveLength(1)
    expect(ld.mainEntity[0].acceptedAnswer.text).toBe('Une réponse.')
  })

  it('renvoie null plutôt qu’un FAQPage vide (invalide pour Google)', () => {
    expect(faqPageLd([])).toBeNull()
    expect(faqPageLd([{ q: '', a: 'orpheline' }])).toBeNull()
    expect(faqPageLd(undefined)).toBeNull()
    // Réponse ne contenant que du balisage : plus rien après nettoyage → écartée.
    expect(faqPageLd([{ q: 'Q ?', a: '<img src=x onerror=alert(1)>' }])).toBeNull()
  })

  it('décrit un geocoin avec son image et sa rareté', () => {
    const card = { id: 12, name: 'FTF', type: 'Geocaching', image_url: 'https://cdn/x.webp' }
    const ld = geocoinLd(card, { name: 'FTF', description: 'Premier à trouver', rarityLabel: 'Légendaire', url: abs('/geocoins/12-ftf') })
    expect(ld.name).toBe('FTF')
    expect(ld.image).toBe('https://cdn/x.webp')
    expect(ld.additionalProperty[0].value).toBe('Légendaire')
  })
})

describe('seo/jsonld — ldScript', () => {
  it('ignore les blocs nuls', () => {
    expect(ldScript(null, undefined)).toBe('')
  })

  it('échappe « < » pour qu’un contenu ne puisse pas refermer la balise', () => {
    const out = ldScript({ '@type': 'Thing', name: 'a </script><img src=x onerror=alert(1)> b' })
    expect(out).toContain('\\u003c')
    // Une seule balise fermante : celle que nous écrivons nous-mêmes.
    expect(out.match(/<\/script>/g)).toHaveLength(1)
  })
})

describe('seo/jsonld — stripHtml', () => {
  it('réduit le HTML riche à du texte lisible', () => {
    expect(stripHtml('<p>Un</p><p>deux</p>')).toBe('Un deux')
    expect(stripHtml('a<br>b')).toBe('a b')
    expect(stripHtml('Tom &amp; Jerry')).toBe('Tom & Jerry')
    expect(stripHtml(null)).toBe('')
  })
})

describe('seo/head', () => {
  const head = seoHead({
    lang: 'fr',
    path: '/faq',
    title: 'FAQ — Geocoins',
    description: 'Questions fréquentes',
    jsonLd: [organizationLd()],
  })

  it('pose une URL canonique absolue sur .io', () => {
    expect(head).toContain('<link rel="canonical" href="https://geocoins.io/faq" />')
  })

  it('expose une og:image absolue et non SVG — condition d’affichage du logo au partage', () => {
    expect(head).toContain('property="og:image" content="https://geocoins.io/og-image.png"')
    expect(head).not.toContain('.svg')
  })

  it('utilise summary_large_image plutôt que la vignette carrée', () => {
    expect(head).toContain('name="twitter:card" content="summary_large_image"')
  })

  it('annonce les dimensions de l’image par défaut, et les tait pour une image sur mesure', () => {
    expect(head).toContain('property="og:image:width" content="1200"')
    const custom = seoHead({ title: 'T', description: 'D', image: 'https://cdn/x.webp', imageAlt: 'Un geocoin' })
    expect(custom).not.toContain('og:image:width')
    expect(custom).toContain('property="og:image:alt" content="Un geocoin"')
  })

  it('émet les hreflang réciproques et un x-default vers la langue par défaut', () => {
    const multi = seoHead({
      path: '/faq',
      title: 'T', description: 'D',
      alternates: { en: '/faq', fr: '/fr/faq', de: '/de/faq', es: '/es/faq' },
    })
    expect(multi).toContain('hreflang="fr" href="https://geocoins.io/fr/faq"')
    expect(multi).toContain('hreflang="x-default" href="https://geocoins.io/faq"')
  })

  it('permet de désindexer une page', () => {
    expect(seoHead({ title: 'T', description: 'D', noindex: true })).toContain('name="robots" content="noindex, follow"')
    expect(head).not.toContain('noindex')
  })

  it('échappe les guillemets d’un titre pour ne pas casser l’attribut', () => {
    expect(esc('a "b" <c>')).toBe('a &quot;b&quot; &lt;c&gt;')
    expect(seoHead({ title: 'Le "top" 10', description: 'D' })).toContain('content="Le &quot;top&quot; 10"')
  })
})
