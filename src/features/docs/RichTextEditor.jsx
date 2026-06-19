import { useEffect, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import ResizableImage from './ResizableImage.jsx'

// Redimensionne/compresse une image côté client en data URI, pour l'intégrer
// directement dans le contenu (pas d'endpoint d'upload requis). Cible ~720px.
// Sérialise le contenu de l'éditeur. Ne renvoie '' QUE pour un document réellement
// vide (un paragraphe vide). NB : on n'utilise pas `editor.isEmpty`, qui considère à
// tort comme « vide » un document ne contenant qu'une image → l'image serait perdue.
function editorHtml(editor) {
  const html = editor.getHTML()
  return html === '' || html === '<p></p>' ? '' : html
}

function fileToResizedDataUri(file, maxPx = 720, targetKb = 220) {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      const ratio = Math.min(maxPx / img.naturalWidth, maxPx / img.naturalHeight, 1)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.naturalWidth  * ratio)
      canvas.height = Math.round(img.naturalHeight * ratio)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      // PNG si petit, sinon WebP en réduisant la qualité jusqu'à la cible.
      let out = canvas.toDataURL('image/png')
      if ((out.length * 3) / 4 / 1024 > targetKb) {
        let q = 0.85
        out = canvas.toDataURL('image/webp', q)
        while ((out.length * 3) / 4 / 1024 > targetKb && q > 0.3) {
          q = Math.max(0.3, q - 0.1)
          out = canvas.toDataURL('image/webp', q)
        }
      }
      URL.revokeObjectURL(img.src)
      resolve(out)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

const COLORS = ['#f9ca24', '#e17055', '#00b894', '#74b9ff', '#a29bfe', '#fd79a8', '#e74c3c', '#636e72', '#2d3436', '#ffffff']

// Le projet n'utilise que des styles inline : on injecte une fois le minimum CSS que
// l'inline ne permet pas (pseudo-élément du placeholder, marges internes de ProseMirror).
const STYLE_ID = 'rte-prosemirror-styles'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = `
    .rte-content .ProseMirror { min-height: 78px; outline: none; }
    .rte-content .ProseMirror > * { margin: 0 0 6px; }
    .rte-content .ProseMirror > *:last-child { margin-bottom: 0; }
    .rte-content .ProseMirror ul { padding-left: 20px; }
    .rte-content .ProseMirror h2 { font-size: 1.25em; font-weight: 800; }
    .rte-content .ProseMirror h3 { font-size: 1.1em; font-weight: 700; }
    .rte-content .ProseMirror p.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      color: #8a96a3; opacity: .65;
      float: left; height: 0; pointer-events: none;
    }
  `
  document.head.appendChild(el)
}

function ToolBtn({ label, title, active, onClick, style = {} }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      style={{
        background: active ? '#f9ca2433' : 'transparent',
        border: `1px solid ${active ? '#f9ca2466' : 'transparent'}`,
        color: active ? '#f9ca24' : '#ccc',
        borderRadius: 5,
        padding: '3px 7px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1.4,
        transition: 'all .1s',
        ...style,
      }}
    >
      {label}
    </button>
  )
}

export default function RichTextEditor({ value, onChange, placeholder = '', mode = 'dark' }) {
  const fileInput = useRef(null)
  const editorRef = useRef(null)
  const bg     = mode === 'light' ? '#f8f9fa' : '#0f1923'
  const border = mode === 'light' ? '#d0d7de' : '#ffffff22'
  const text   = mode === 'light' ? '#1e2d3d' : '#d4e8f8'

  // Compresse puis insère des images (bouton, collage, glisser-déposer). La
  // compression évite des contenus énormes qui font échouer l'enregistrement.
  const insertImages = useCallback(async (files) => {
    const ed = editorRef.current
    if (!ed) return
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      try {
        const dataUri = await fileToResizedDataUri(file)
        ed.chain().focus().setImage({ src: dataUri }).run()
      } catch { /* image illisible — ignorée */ }
    }
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, underline: false }),
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      // allowBase64 indispensable : sinon les images intégrées (data URI) sont
      // bien insérées mais SUPPRIMÉES à la relecture/ouverture de l'éditeur.
      ResizableImage.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editorProps: {
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files || []).filter(f => f.type.startsWith('image/'))
        if (!files.length) return false
        event.preventDefault()
        insertImages(files)
        return true
      },
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'))
        if (!files.length) return false
        event.preventDefault()
        insertImages(files)
        return true
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editorHtml(editor))
    },
  })
  editorRef.current = editor

  // Re-synchronise l'éditeur quand `value` change DE L'EXTÉRIEUR (réorganisation ↑/↓,
  // insertion en tête…). On compare au HTML courant pour ne jamais perturber la frappe.
  useEffect(() => {
    if (!editor) return
    const current = editorHtml(editor)
    const next = value || ''
    if (next !== current) {
      editor.commands.setContent(next, false)
    }
  }, [value, editor])

  return (
    <div style={{ borderRadius: 10, border: `1.5px solid #f9ca2466`, overflow: 'visible' }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, padding: '5px 8px', background: mode === 'light' ? '#f0f0f0' : '#1a2435', borderBottom: `1px solid ${border}`, borderRadius: '8px 8px 0 0' }}>

        {/* Format de bloc */}
        <select
          value={editor?.isActive('heading', { level: 2 }) ? 'h2' : editor?.isActive('heading', { level: 3 }) ? 'h3' : 'p'}
          onMouseDown={e => e.stopPropagation()}
          onChange={e => {
            const v = e.target.value
            if (v === 'p') editor?.chain().focus().setParagraph().run()
            else editor?.chain().focus().toggleHeading({ level: v === 'h2' ? 2 : 3 }).run()
          }}
          style={{ background: mode === 'light' ? '#fff' : '#0f1923', border: `1px solid ${border}`, color: text, borderRadius: 5, padding: '3px 6px', fontSize: 12, cursor: 'pointer', marginRight: 4 }}
        >
          <option value="p">Normal</option>
          <option value="h2">Titre</option>
          <option value="h3">Sous-titre</option>
        </select>

        <div style={{ width: 1, height: 18, background: border, margin: '0 4px' }} />

        <ToolBtn label={<b>G</b>}  title="Gras (Ctrl+B)"     onClick={() => editor?.chain().focus().toggleBold().run()}          active={editor?.isActive('bold')} />
        <ToolBtn label={<i>I</i>}  title="Italique (Ctrl+I)" onClick={() => editor?.chain().focus().toggleItalic().run()}        active={editor?.isActive('italic')} />
        <ToolBtn label={<u>S</u>}  title="Souligné (Ctrl+U)" onClick={() => editor?.chain().focus().toggleUnderline().run()}     active={editor?.isActive('underline')} style={{ textDecoration: 'underline' }} />
        <ToolBtn label={<s>B</s>}  title="Barré"             onClick={() => editor?.chain().focus().toggleStrike().run()}        active={editor?.isActive('strike')} />

        <div style={{ width: 1, height: 18, background: border, margin: '0 4px' }} />

        <ToolBtn label="≡" title="Aligner à gauche" onClick={() => editor?.chain().focus().setTextAlign('left').run()}   active={editor?.isActive({ textAlign: 'left' })} />
        <ToolBtn label="≡" title="Centrer"          onClick={() => editor?.chain().focus().setTextAlign('center').run()} active={editor?.isActive({ textAlign: 'center' })} style={{ letterSpacing: 1 }} />

        <div style={{ width: 1, height: 18, background: border, margin: '0 4px' }} />

        {/* Liste à puces */}
        <ToolBtn label="•" title="Liste à puces" onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} />

        <div style={{ width: 1, height: 18, background: border, margin: '0 4px' }} />

        {/* Palette de couleurs */}
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {COLORS.map(c => (
            <button
              key={c}
              type="button"
              onMouseDown={e => { e.preventDefault(); editor?.chain().focus().setColor(c).run() }}
              title={c}
              style={{ width: 16, height: 16, borderRadius: '50%', background: c, border: '1.5px solid #ffffff33', cursor: 'pointer', padding: 0, flexShrink: 0 }}
            />
          ))}
        </div>

        <div style={{ width: 1, height: 18, background: border, margin: '0 4px' }} />

        <ToolBtn label="🖼️" title="Insérer une image" onClick={() => fileInput.current?.click()} />

        <div style={{ width: 1, height: 18, background: border, margin: '0 4px' }} />

        <ToolBtn label="✕" title="Effacer la mise en forme" onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()} style={{ color: '#e74c3c88' }} />

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => { insertImages(Array.from(e.target.files || [])); e.target.value = '' }}
        />
      </div>

      {/* ── Zone de texte ── */}
      <EditorContent
        editor={editor}
        className="rte-content"
        style={{
          padding: '10px 14px',
          background: bg,
          color: text,
          fontSize: 14,
          lineHeight: 1.7,
          borderRadius: '0 0 8px 8px',
          wordBreak: 'break-word',
        }}
      />
    </div>
  )
}
