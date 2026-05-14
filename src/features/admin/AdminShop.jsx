import { useState, useEffect } from 'react';
import { INP, BTN } from '../../utils/styles.js';
import { apiGetAdminShopPacks, apiUpdateAdminShopPacks } from '../../services/api.js';

const PACK_LABELS = {
  petit_soutien: { title: 'Petit soutien',  desc: '2 communs · 2 rares · 1 Rare ou supérieure (50% Épique) · 50 Golds' },
  soutien:       { title: 'Soutien',        desc: '6 communs · 2 rares · 1 Rare ou supérieure (50% Épique) · 1 Épique ou supérieure (50% Légendaire) · 150 Golds' },
  gros_soutien:  { title: 'Gros soutien',   desc: '6 communs · 2 rares · 1 épique garantie · 1 légendaire garantie · 300 Golds' },
}

export default function AdminShop({ setMsg }) {
  const [packs, setPacks]   = useState(null)
  const [edit,  setEdit]    = useState({})

  useEffect(() => {
    apiGetAdminShopPacks().then(({ data, error }) => {
      if (error) { setMsg('❌ ' + error); return }
      const p = data?.packs || {}
      setPacks(p)
      setEdit(JSON.parse(JSON.stringify(p)))
    })
  }, [])

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
      {Object.entries(PACK_LABELS).map(([id, { title, desc }]) => {
        const pk = edit[id] || {}
        return (
          <div key={id} style={{ background: '#1a2744', border: '1px solid #ffffff22', borderRadius: 10, padding: '14px', marginBottom: 12 }}>
            <div style={{ fontWeight: 800, color: '#f9ca24', fontSize: 13, marginBottom: 4 }}>{title}</div>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 10 }}>{desc}</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: 10, color: '#aaa', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase' }}>Nom affiché</div>
                <input value={pk.name || ''} onChange={e => setEdit(s => ({ ...s, [id]: { ...s[id], name: e.target.value } }))}
                  placeholder={title} style={{ ...INP, width: 160 }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#aaa', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase' }}>Prix affiché</div>
                <input value={pk.price || ''} onChange={e => setEdit(s => ({ ...s, [id]: { ...s[id], price: e.target.value } }))}
                  placeholder="ex: 3,00 €" style={{ ...INP, width: 100 }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', paddingBottom: 2 }}>
                <input type="checkbox" checked={pk.enabled !== false}
                  onChange={e => setEdit(s => ({ ...s, [id]: { ...s[id], enabled: e.target.checked } }))}
                  style={{ width: 16, height: 16 }} />
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>Activé</span>
              </label>
            </div>
          </div>
        )
      })}
      <button onClick={save} style={{ ...BTN('linear-gradient(135deg,#e74c3c,#c0392b)'), padding: '11px 24px', borderRadius: 10, fontSize: 13, fontWeight: 900 }}>
        💾 Sauvegarder
      </button>
    </div>
  )
}
