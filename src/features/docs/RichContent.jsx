import { sanitizeHtml, neutralizeDarkText } from '../../utils/sanitize.js'

// Rendu en lecture du HTML produit par l'éditeur. Reproduit fidèlement la mise en
// forme de RichTextEditor (WYSIWYG) : lignes vides préservées, marges, titres,
// listes, images. La couleur de base est fournie par l'appelant pour correspondre
// exactement à ce qui est affiché pendant l'édition.
const STYLE_ID = 'docs-rich-content-styles'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = `
    .docs-rich > *:first-child { margin-top: 0; }
    .docs-rich > *:last-child  { margin-bottom: 0; }
    .docs-rich p { margin: 0 0 6px; }
    .docs-rich p:empty::before { content: "\\00a0"; }   /* préserve les lignes vides */
    .docs-rich h2 { font-size: 1.25em; font-weight: 800; margin: 6px 0; }
    .docs-rich h3 { font-size: 1.1em;  font-weight: 700; margin: 6px 0; }
    .docs-rich ul, .docs-rich ol { padding-left: 20px; margin: 0 0 6px; }
    .docs-rich img { max-width: 100%; height: auto; border-radius: 8px; }
    .docs-rich a { color: #6c5ce7; text-decoration: underline; }
    /* Conteneur à défilement horizontal : une table plus large que l'écran (ex.
       min-width inline) défile à l'intérieur au lieu de déborder et casser la mise
       en page sur mobile. */
    .docs-rich-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; max-width: 100%; margin: 8px 0; }
    .docs-rich table { border-collapse: collapse; width: 100%; margin: 0; font-size: .95em; }
    .docs-rich th, .docs-rich td { border: 1px solid #7f8c9a55; padding: 6px 9px; text-align: left; vertical-align: top; }
    .docs-rich th { background: #7f8c9a1f; font-weight: 800; }
  `
  document.head.appendChild(el)
}

// Enveloppe chaque table dans un conteneur défilable. Fait APRÈS la sanitisation
// (DOMPurify n'autorise pas <div>) : les tables ne pouvant pas être imbriquées ici,
// une simple substitution suffit.
function wrapTables(clean) {
  return clean
    .replace(/<table/gi, '<div class="docs-rich-table-wrap"><table')
    .replace(/<\/table>/gi, '</table></div>')
}

export default function RichContent({ html, style }) {
  const __html = wrapTables(sanitizeHtml(neutralizeDarkText(html)))
  return (
    <div
      className="docs-rich"
      style={{ lineHeight: 1.7, wordBreak: 'break-word', ...style }}
      dangerouslySetInnerHTML={{ __html }}
    />
  )
}
