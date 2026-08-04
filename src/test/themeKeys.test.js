import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { THEMES } from '../theme.js'

/**
 * Une clé de thème inexistante ne casse RIEN de visible au premier regard :
 * `theme.bg` vaut `undefined`, la propriété CSS est ignorée, et l'élément prend
 * le fond de son parent. La fiche geocoin a vécu ainsi avec `background:
 * theme.bg` — fond hérité du <body> (sombre, posé par la feuille du pré-rendu)
 * et texte suivant le thème clair par défaut : du sombre sur du sombre, sur la
 * seule page que voient les visiteurs venus de Google.
 *
 * Ce test relit donc les sources : c'est la faute de frappe qu'on veut attraper,
 * et elle ne se voit pas à l'exécution.
 */
const FILES = [
  'src/features/geocoins/GeocoinPage.jsx',
  'src/features/docs/DocsLayout.jsx',
  'src/components/PublicFooter.jsx',
]

const KNOWN = new Set(Object.keys(THEMES.dark))

describe('clés de thème utilisées par les pages publiques', () => {
  it('les deux thèmes déclarent exactement les mêmes clés', () => {
    expect(Object.keys(THEMES.light).sort()).toEqual(Object.keys(THEMES.dark).sort())
  })

  for (const file of FILES) {
    it(`${file} n’utilise que des clés existantes`, () => {
      const src  = fs.readFileSync(path.resolve(file), 'utf8')
      // Les mentions en commentaire ne comptent pas : elles documentent
      // précisément les clés fautives d'hier.
      const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
      const used = [...new Set([...code.matchAll(/\btheme\.([A-Za-z]+)/g)].map(m => m[1]))]
      expect(used.filter(k => !KNOWN.has(k))).toEqual([])
    })
  }
})
