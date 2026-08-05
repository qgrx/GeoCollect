import { useState, useEffect, useMemo } from 'react'
import EditableText from './EditableText.jsx'
import RichTextEditor from './RichTextEditor.jsx'
import RichContent from './RichContent.jsx'
import { useDocsContent } from './useDocsContent.js'
import { useT } from '../../i18n/translations.js'
import { apiGetPublicConfig } from '../../services/api.js'
import { gameValues, resolveGameValues, VALUE_KEYS } from '../../data/gameValues.js'

/**
 * Page publique « Règles du jeu ».
 *
 * Contenu éditorial en base (docs_pages, page « rules »), rédigé et modifié
 * directement dans la page par un admin en mode édition — comme la FAQ.
 *
 * Particularité : le texte cite des chiffres réglés en admin (plafonds, prix,
 * cadences). Ils ne sont pas recopiés mais écrits sous forme de marqueurs
 * `{{nom}}`, remplacés à l'affichage par la valeur du moment (cf.
 * data/gameValues.js). Une page qui reste juste après un rééquilibrage.
 */

function Section({ item, idx, total, editing, onChange, onRemove, onMoveUp, onMoveDown, colors, values }) {
  const canUp = idx > 0, canDown = idx < total - 1
  const { cardBg, borderCol, textColor, mutedColor, mode } = colors
  // Le remplacement des marqueurs se fait à l'affichage seulement : en édition,
  // l'admin doit voir et pouvoir manipuler le marqueur lui-même.
  const body = useMemo(() => resolveGameValues(item.body, values), [item.body, values])

  return (
    <section style={{ background: cardBg, border: `1px solid ${editing ? '#f9ca2444' : borderCol}`, borderRadius: 12, marginBottom: 12, padding: '18px 20px', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon || '•'}</span>
        <EditableText
          value={item.title}
          editing={editing}
          placeholder="Titre de la section…"
          onChange={title => onChange({ ...item, title })}
          style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 17, color: textColor, flex: 1 }}
        />
        {editing && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <input
              value={item.icon || ''}
              onChange={e => onChange({ ...item, icon: e.target.value })}
              placeholder="🎯"
              aria-label="Emoji de la section"
              style={{ width: 44, textAlign: 'center', background: '#ffffff12', border: `1px solid ${borderCol}`, color: textColor, borderRadius: 6, padding: '4px 0', fontSize: 14 }}
            />
            <button onClick={onMoveUp}   disabled={!canUp}   aria-label="Monter"  style={{ background: canUp   ? '#ffffff15' : 'transparent', border: 'none', color: canUp   ? mutedColor : '#ffffff22', borderRadius: 4, width: 24, height: 24, cursor: canUp   ? 'pointer' : 'default' }}>↑</button>
            <button onClick={onMoveDown} disabled={!canDown} aria-label="Descendre" style={{ background: canDown ? '#ffffff15' : 'transparent', border: 'none', color: canDown ? mutedColor : '#ffffff22', borderRadius: 4, width: 24, height: 24, cursor: canDown ? 'pointer' : 'default' }}>↓</button>
            <button onClick={onRemove} aria-label="Supprimer la section" style={{ background: '#e74c3c22', border: '1px solid #e74c3c44', color: '#e74c3c', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontWeight: 900 }}>×</button>
          </div>
        )}
      </div>
      {editing
        ? <RichTextEditor value={item.body} onChange={body => onChange({ ...item, body })} placeholder="Texte de la section… (les marqueurs {{…}} sont remplacés à l'affichage)" mode={mode} />
        : <RichContent html={body} style={{ fontSize: 14.5, lineHeight: 1.7, color: textColor }} />
      }
    </section>
  )
}

/** Aide au rédacteur : la liste des marqueurs disponibles et leur valeur actuelle. */
function MarkerHelp({ values, colors }) {
  const [open, setOpen] = useState(false)
  const { cardBg, borderCol, mutedColor, textColor } = colors
  return (
    <div style={{ background: cardBg, border: `1px dashed ${borderCol}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, padding: 0 }}>
        {open ? '▾' : '▸'} Valeurs disponibles ({VALUE_KEYS.length}) — écrire {'{{nom}}'} dans le texte
      </button>
      {open && (
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '4px 16px' }}>
          {VALUE_KEYS.map(k => (
            <div key={k} style={{ fontSize: 11.5, color: mutedColor, display: 'flex', gap: 6, alignItems: 'baseline' }}>
              <code style={{ color: textColor, fontFamily: 'ui-monospace,monospace' }}>{`{{${k}}}`}</code>
              <span style={{ opacity: .75 }}>→ {values[k]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function RulesPage({ theme, mode, textColor, mutedColor, editMode }) {
  const { content: items, update, save, reset, saving, dirty, loading, error, saveError, uid } = useDocsContent('rules')
  const { t, lang } = useT()
  const [config, setConfig] = useState(null)

  // Config publique : sert à résoudre les marqueurs. Une config indisponible
  // laisse les valeurs par défaut de gameValues() — le texte reste lisible.
  useEffect(() => {
    let alive = true
    apiGetPublicConfig()
      .then(({ data }) => { if (alive) setConfig(data?.config ?? {}) })
      .catch(() => { if (alive) setConfig({}) })
    return () => { alive = false }
  }, [])

  // Les valeurs suivent la langue de la page : séparateurs, durées et
  // énumérations par rareté sont localisés (cf. data/gameValues.js).
  const values = useMemo(() => gameValues(config ?? {}, lang), [config, lang])

  const cardBg    = mode === 'light' ? '#ffffff' : '#1a2744'
  const borderCol = mode === 'light' ? '#e0e8f0' : '#ffffff18'
  const colors    = { cardBg, borderCol, textColor, mutedColor, mode }

  function changeItem(idx, updated) { update(items.map((it, i) => i === idx ? updated : it)) }
  function removeItem(idx) { update(items.filter((_, i) => i !== idx)) }
  function addItem() { update([...items, { id: uid(), icon: '•', title: '', body: '' }]) }

  return (
    <div style={{ padding: '32px 28px', maxWidth: 760, margin: '0 auto', color: textColor }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 12 }}>
        <h1 style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 28, color: theme.gold, margin: 0 }}>
          📖 {t('docs_rules_title')}
        </h1>
        {editMode && !loading && !error && (
          <button onClick={addItem} style={{ background: '#ffffff15', border: '1px dashed #ffffff44', color: mutedColor, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
            + Section
          </button>
        )}
      </div>
      <p style={{ color: mutedColor, fontSize: 14, marginTop: 0, marginBottom: 28 }}>{t('docs_rules_subtitle')}</p>

      {loading && <div style={{ color: mutedColor, fontSize: 13, padding: '20px 0' }}>Chargement…</div>}

      {!loading && error && (
        <div style={{ color: mutedColor, fontSize: 13, padding: '16px 18px', background: cardBg, border: `1px solid ${borderCol}`, borderRadius: 12 }}>
          {t('docs_unavailable')}
        </div>
      )}

      {!loading && !error && editMode && <MarkerHelp values={values} colors={colors} />}

      {!loading && !error && items.map((item, i) => (
        <Section key={item.id} item={item} idx={i} total={items.length} editing={editMode} values={values}
          onChange={u => changeItem(i, u)}
          onRemove={() => removeItem(i)}
          onMoveUp={() => { const a = [...items]; [a[i-1],a[i]]=[a[i],a[i-1]]; update(a) }}
          onMoveDown={() => { const a = [...items]; [a[i],a[i+1]]=[a[i+1],a[i]]; update(a) }}
          colors={colors} />
      ))}

      {editMode && !loading && !error && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={() => { if (window.confirm('Restaurer le contenu par défaut ?')) reset() }} style={{ background: '#ffffff10', border: '1px solid #ffffff22', color: mutedColor, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 11 }}>↺ Défauts</button>
          <button onClick={() => save()} disabled={!dirty || saving}
            style={{ background: dirty ? 'linear-gradient(135deg,#f9ca24,#e17055)' : '#ffffff18', border: 'none', color: dirty ? '#1e3045' : '#666', padding: '8px 18px', borderRadius: 8, cursor: dirty ? 'pointer' : 'default', fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 12 }}>
            {saving ? 'Enregistrement…' : dirty ? '💾 Enregistrer' : '✓ Enregistré'}
          </button>
          {saveError && <span style={{ color: '#e74c3c', fontSize: 12, fontWeight: 700, alignSelf: 'center' }}>⚠️ Échec — réessaie.</span>}
        </div>
      )}
    </div>
  )
}
