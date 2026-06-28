import { useState, useEffect } from 'react';
import { INP, BTN } from '../../utils/styles.js';
import { apiGetAdminSeasons, apiCreateAdminSeason, apiUpdateAdminSeason, apiDeleteAdminSeason, apiAdminGetCards } from '../../services/api.js';
import SeasonPopup from '../../components/SeasonPopup.jsx';

function Fld({ lbl, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: '#aaa', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .8 }}>{lbl}</div>
      {children}
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const EMPTY_FORM = { name: '', start_date: '', end_date: '' };

export default function AdminSeasons({ setMsg }) {
  const [seasons, setSeasons] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allCards, setAllCards] = useState(null);   // cache du pool admin (cartes), chargé à la 1re prévisualisation
  const [preview, setPreview] = useState(null);     // { season, cards } — popup d'aperçu admin

  useEffect(() => {
    apiGetAdminSeasons().then(({ data, error }) => {
      setLoading(false);
      if (error) { setMsg('❌ ' + error); return; }
      setSeasons(data?.seasons || []);
    });
  }, []);

  // Prévisualiser la popup de saison telle qu'elle s'affiche aux utilisateurs.
  async function handlePreview(s) {
    let cards = allCards;
    if (!cards) {
      const { data, error } = await apiAdminGetCards();
      if (error) { setMsg('❌ ' + error); return; }
      cards = data?.cards || [];
      setAllCards(cards);
    }
    const seasonCards = cards
      .filter(c => c.season_id === s.id && c.active !== false)
      .sort((a, b) => String(a.rarity).localeCompare(String(b.rarity)));
    setPreview({ season: s, cards: seasonCards });
  }

  function startEdit(s) {
    setEditId(s.id);
    setForm({ name: s.name, start_date: s.start_date, end_date: s.end_date });
  }

  function cancelEdit() {
    setEditId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.start_date || !form.end_date) {
      setMsg('❌ Nom, date de début et date de fin requis.'); return;
    }
    if (form.start_date > form.end_date) {
      setMsg('❌ La date de début doit être avant la date de fin.'); return;
    }
    if (editId) {
      const { data, error } = await apiUpdateAdminSeason(editId, form);
      if (error) { setMsg('❌ ' + error); return; }
      setSeasons(s => s.map(x => x.id === editId ? data.season : x));
      setMsg(`✅ Saison "${data.season.name}" mise à jour.`);
    } else {
      const { data, error } = await apiCreateAdminSeason(form);
      if (error) { setMsg('❌ ' + error); return; }
      setSeasons(s => [data.season, ...s]);
      setMsg(`✅ Saison "${data.season.name}" créée.`);
    }
    cancelEdit();
  }

  async function handleDelete(s) {
    if (!window.confirm(`Supprimer la saison "${s.name}" ? Les geocoins associés seront détachés.`)) return;
    const { error } = await apiDeleteAdminSeason(s.id);
    if (error) { setMsg('❌ ' + error); return; }
    setSeasons(prev => prev.filter(x => x.id !== s.id));
    if (editId === s.id) cancelEdit();
    setMsg(`✅ Saison "${s.name}" supprimée.`);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div style={{ fontWeight: 900, fontSize: 15, color: '#fff', marginBottom: 16 }}>🌸 Saisons</div>

      {/* Formulaire création / édition */}
      <div style={{ background: '#1a2744', border: '1px solid #ffffff22', borderRadius: 10, padding: 14, marginBottom: 20 }}>
        <div style={{ fontWeight: 800, color: '#aaa', fontSize: 12, marginBottom: 10 }}>
          {editId ? '✏️ Modifier la saison' : '➕ Nouvelle saison'}
        </div>
        <Fld lbl="Nom de la saison">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="ex: Saison Été 2025" style={INP} />
        </Fld>
        <div style={{ display: 'flex', gap: 10 }}>
          <Fld lbl="Date de début">
            <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={INP} />
          </Fld>
          <Fld lbl="Date de fin">
            <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={INP} />
          </Fld>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={handleSave} style={{ flex: 1, ...BTN('linear-gradient(135deg,#e74c3c,#c0392b)'), padding: '10px', borderRadius: 9 }}>
            {editId ? '💾 Enregistrer' : '➕ Créer la saison'}
          </button>
          {editId && (
            <button onClick={cancelEdit} style={{ ...BTN('#ffffff18'), padding: '10px', borderRadius: 9 }}>Annuler</button>
          )}
        </div>
      </div>

      {/* Liste des saisons */}
      {loading ? (
        <div style={{ color: '#888', fontSize: 13 }}>Chargement…</div>
      ) : seasons.length === 0 ? (
        <div style={{ color: '#666', fontSize: 13 }}>Aucune saison créée.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {seasons.map(s => {
            const isActive = s.start_date <= today && s.end_date >= today;
            const isPast   = s.end_date < today;
            const isFuture = s.start_date > today;
            const statusColor = isActive ? '#2ecc71' : isPast ? '#888' : '#f39c12';
            const statusLabel = isActive ? 'EN COURS' : isPast ? 'TERMINÉE' : 'À VENIR';
            return (
              <div key={s.id} style={{ background: editId === s.id ? '#1f3060' : '#1a2744', border: `1px solid ${isActive ? '#2ecc7144' : '#ffffff18'}`, borderRadius: 9, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 800, color: '#fff', fontSize: 13 }}>{s.name}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, color: statusColor, background: statusColor + '22', padding: '2px 6px', borderRadius: 4, letterSpacing: .5 }}>{statusLabel}</span>
                  </div>
                  <div style={{ color: '#aaa', fontSize: 11 }}>{formatDate(s.start_date)} → {formatDate(s.end_date)}</div>
                </div>
                <button onClick={() => handlePreview(s)} title="Prévisualiser la popup de saison (test admin)" style={{ ...BTN('#ffffff18'), padding: '6px 12px', borderRadius: 7, fontSize: 11 }}>👁️</button>
                <button onClick={() => startEdit(s)} style={{ ...BTN('#ffffff18'), padding: '6px 12px', borderRadius: 7, fontSize: 11 }}>✏️</button>
                <button onClick={() => handleDelete(s)} style={{ ...BTN('linear-gradient(135deg,#e74c3c,#c0392b)'), padding: '6px 12px', borderRadius: 7, fontSize: 11 }}>🗑️</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Aperçu admin de la popup de saison (telle qu'affichée aux utilisateurs) */}
      {preview && (
        <SeasonPopup
          season={preview.season}
          cards={preview.cards}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
