import { useState, useEffect } from 'react';
import { INP, SEL, BTN } from '../../utils/styles.js';
import { apiGetAdminShopPacks, apiUpdateAdminShopPacks } from '../../services/api.js';

const RARITIES = ['commun', 'rare', 'épique', 'légendaire']
const R_LABEL  = { commun: 'Commun', rare: 'Rare', épique: 'Épique', légendaire: 'Légendaire' }

const PACK_META = {
  petit_soutien: { title: 'Petit soutien',  defaultGold: 50 },
  soutien:       { title: 'Soutien',        defaultGold: 150 },
  gros_soutien:  { title: 'Gros soutien',   defaultGold: 300 },
}

const DEFAULT_SLOTS = {
  petit_soutien: [
    { rarity: 'commun', qty: 2 },
    { rarity: 'rare',   qty: 2 },
    { rarity: 'épique', alt: 'rare', chance: 50 },
  ],
  soutien: [
    { rarity: 'commun', qty: 6 },
    { rarity: 'rare',   qty: 2 },
    { rarity: 'épique',     alt: 'rare',   chance: 50 },
    { rarity: 'légendaire', alt: 'épique', chance: 50 },
  ],
  gros_soutien: [
    { rarity: 'commun', qty: 6 },
    { rarity: 'rare',   qty: 2 },
    { rarity: 'épique' },
    { rarity: 'légendaire' },
  ],
}

function SlotRow({ slot, onChange, onRemove }) {
  return (
    <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
      {/* Qty */}
      <div>
        <div style={{ fontSize: 9, color: '#888', marginBottom: 2, textTransform: 'uppercase' }}>Qté</div>
        <input type="number" min="1" max="20" value={slot.qty || 1}
          onChange={e => onChange({ ...slot, qty: Math.max(1, +e.target.value || 1) })}
          style={{ ...INP, width: 52, textAlign: 'center' }} />
      </div>
      {/* Rarity */}
      <div>
        <div style={{ fontSize: 9, color: '#888', marginBottom: 2, textTransform: 'uppercase' }}>Rareté</div>
        <select value={slot.rarity} onChange={e => onChange({ ...slot, rarity: e.target.value })} style={{ ...SEL, width: 110 }}>
          {RARITIES.map(r => <option key={r} value={r}>{R_LABEL[r]}</option>)}
        </select>
      </div>
      {/* Alt rarity */}
      <div>
        <div style={{ fontSize: 9, color: '#888', marginBottom: 2, textTransform: 'uppercase' }}>Si raté</div>
        <select value={slot.alt || ''} onChange={e => {
          const v = e.target.value
          onChange(v ? { ...slot, alt: v, chance: slot.chance ?? 50 } : { rarity: slot.rarity, qty: slot.qty })
        }} style={{ ...SEL, width: 110 }}>
          <option value="">Garanti</option>
          {RARITIES.filter(r => r !== slot.rarity).map(r => <option key={r} value={r}>{R_LABEL[r]}</option>)}
        </select>
      </div>
      {/* Chance */}
      {slot.alt && (
        <div>
          <div style={{ fontSize: 9, color: '#888', marginBottom: 2, textTransform: 'uppercase' }}>Chance %</div>
          <input type="number" min="1" max="99" value={slot.chance ?? 50}
            onChange={e => onChange({ ...slot, chance: Math.min(99, Math.max(1, +e.target.value || 50)) })}
            style={{ ...INP, width: 60 }} />
        </div>
      )}
      <button onClick={onRemove}
        style={{ ...BTN('#e74c3c22'), padding: '6px 10px', borderRadius: 7, fontSize: 12, marginTop: 14, border: '1px solid #e74c3c44' }}>
        ✕
      </button>
    </div>
  )
}

export default function AdminShop({ setMsg }) {
  const [packs, setPacks] = useState(null)
  const [edit,  setEdit]  = useState({})

  useEffect(() => {
    apiGetAdminShopPacks().then(({ data, error }) => {
      if (error) { setMsg('❌ ' + error); return }
      const p = data?.packs || {}
      // Injecter les slots par défaut si absents
      const merged = {}
      for (const id of Object.keys(PACK_META)) {
        merged[id] = { ...p[id], slots: p[id]?.slots || DEFAULT_SLOTS[id] }
      }
      setPacks(merged)
      setEdit(JSON.parse(JSON.stringify(merged)))
    })
  }, [])

  function updatePack(id, key, val) {
    setEdit(s => ({ ...s, [id]: { ...s[id], [key]: val } }))
  }

  function updateSlot(id, idx, slot) {
    setEdit(s => {
      const slots = [...(s[id]?.slots || [])]
      slots[idx] = slot
      return { ...s, [id]: { ...s[id], slots } }
    })
  }

  function addSlot(id) {
    setEdit(s => {
      const slots = [...(s[id]?.slots || []), { rarity: 'rare', qty: 1 }]
      return { ...s, [id]: { ...s[id], slots } }
    })
  }

  function removeSlot(id, idx) {
    setEdit(s => {
      const slots = (s[id]?.slots || []).filter((_, i) => i !== idx)
      return { ...s, [id]: { ...s[id], slots } }
    })
  }

  async function save() {
    const { error } = await apiUpdateAdminShopPacks(edit)
    if (error) { setMsg('❌ ' + error); return }
    setPacks(JSON.parse(JSON.stringify(edit)))
    setMsg('✅ Packs sauvegardés.')
  }

  if (!packs) return <div style={{ color: '#888', fontSize: 13 }}>Chargement…</div>

  return (
    <div>
      <div style={{ fontWeight: 900, fontSize: 15, color: '#fff', marginBottom: 16 }}>🛍️ Packs Boutique</div>
      {Object.entries(PACK_META).map(([id, { title }]) => {
        const pk = edit[id] || {}
        const slots = pk.slots || DEFAULT_SLOTS[id]
        return (
          <div key={id} style={{ background: '#1a2744', border: '1px solid #ffffff22', borderRadius: 12, padding: '16px', marginBottom: 14 }}>
            {/* Titre + actif */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, color: '#f9ca24', fontSize: 14 }}>{title}</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={pk.enabled !== false}
                  onChange={e => updatePack(id, 'enabled', e.target.checked)}
                  style={{ width: 15, height: 15 }} />
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>Activé</span>
              </label>
            </div>

            {/* Nom + Prix + Gold */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 9, color: '#aaa', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase' }}>Nom</div>
                <input value={pk.name || ''} onChange={e => updatePack(id, 'name', e.target.value)}
                  placeholder={title} style={{ ...INP, width: 150 }} />
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#aaa', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase' }}>Prix</div>
                <input value={pk.price || ''} onChange={e => updatePack(id, 'price', e.target.value)}
                  placeholder="ex: 3,00 €" style={{ ...INP, width: 90 }} />
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#aaa', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase' }}>Golds</div>
                <input type="number" min="0" value={pk.gold ?? PACK_META[id].defaultGold}
                  onChange={e => updatePack(id, 'gold', +e.target.value || 0)}
                  style={{ ...INP, width: 70 }} />
              </div>
            </div>

            {/* Slots */}
            <div style={{ fontSize: 10, color: '#aaa', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>
              Contenu du pack
            </div>
            {slots.map((slot, i) => (
              <SlotRow key={i} slot={slot}
                onChange={s => updateSlot(id, i, s)}
                onRemove={() => removeSlot(id, i)} />
            ))}
            <button onClick={() => addSlot(id)}
              style={{ ...BTN('#ffffff15'), padding: '6px 14px', borderRadius: 8, fontSize: 11, marginTop: 4, border: '1px solid #ffffff22' }}>
              + Ajouter une carte
            </button>
          </div>
        )
      })}
      <button onClick={save}
        style={{ ...BTN('linear-gradient(135deg,#e74c3c,#c0392b)'), padding: '11px 24px', borderRadius: 10, fontSize: 13, fontWeight: 900 }}>
        💾 Sauvegarder
      </button>
    </div>
  )
}
