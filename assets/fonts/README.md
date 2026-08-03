# Polices de génération d'icônes

`FredokaOne-Regular.ttf` — police de marque du wordmark « geocoins ».

- Source : Google Fonts (<https://fonts.google.com/specimen/Fredoka+One>), v15.
- Licence : SIL Open Font License 1.1 — redistribution autorisée.

Elle n'est **pas** servie aux navigateurs (le site charge Fredoka One depuis
Google Fonts, cf. `index.html`). Elle sert uniquement à
[`scripts/gen-icons.mjs`](../../scripts/gen-icons.mjs) pour rasteriser le
wordmark de l'image de partage, afin que l'og-image porte la vraie police de
marque plutôt qu'un repli système.
