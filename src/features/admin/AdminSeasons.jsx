import { useState, useEffect } from 'react';
import { INP, BTN } from '../../utils/styles.js';
import { apiGetAdminSeasons, apiCreateAdminSeason, apiUpdateAdminSeason, apiDeleteAdminSeason, apiAdminGetCards, apiGetAdminConfig, apiSetConfig } from '../../services/api.js';
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

// Marché « Hors saison » : raretés + coûts par défaut {gold, pf}.
const OFF_RARITIES = ['commun', 'rare', 'épique', 'légendaire'];
const EMPTY_OFF_COST = { commun: { gold: '', pf: '' }, rare: { gold: '', pf: '' }, 'épique': { gold: '', pf: '' }, 'légendaire': { gold: '', pf: '' } };

export default function AdminSeasons({ setMsg }) {
  const [seasons, setSeasons] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allCards, setAllCards] = useState(null);   // cache du pool admin (cartes), chargé à la 1re prévisualisation
  const [preview, setPreview] = useState(null);     // { season, cards } — popup d'aperçu admin
  const [offEnabled, setOffEnabled] = useState(true);       // feature_offseason_market
  const [offCost, setOffCost] = useState(EMPTY_OFF_COST);   // offseason_cost_by_rarity

  useEffect(() => {
    apiGetAdminSeasons().then(({ data, error }) => {
      setLoading(false);
      if (error) { setMsg('❌ ' + error); return; }
      setSeasons(data?.seasons || []);
    });
    apiGetAdminConfig().then(({ data }) => {
      const cfg = data?.config || {};
      if (cfg.feature_offseason_market !== undefined) setOffEnabled(cfg.feature_offseason_market !== false);
      const rates = cfg.offseason_cost_by_rarity || {};
      setOffCost(OFF_RARITIES.reduce((acc, r) => {
        acc[r] = { gold: rates[r]?.gold ?? '', pf: rates[r]?.pf ?? '' };
        return acc;
      }, {}));
    });
  }, []);

  // Sauvegarde des réglages « hors saison » : coûts par défaut + interrupteur.
  async function saveOffseasonSettings() {
    const rates = OFF_RARITIES.reduce((acc, r) => {
      const gold = offCost[r]?.gold === '' ? null : Number(offCost[r].gold);
      const pf   = offCost[r]?.pf   === '' ? null : Number(offCost[r].pf);
      if (gold != null && pf != null) acc[r] = { gold, pf };
      return acc;
    }, {});
    const [r1, r2] = await Promise.all([
      apiSetConfig('offseason_cost_by_rarity', rates),
      apiSetConfig('feature_offseason_market', offEnabled),
    ]);
    if (r1.error || r2.error) { setMsg('❌ ' + (r1.error || r2.error)); return; }
    setMsg('✅ Réglages du marché hors saison enregistrés.');
  }
  const setOffField = (rarity, key, value) =>
    setOffCost(prev => ({ ...prev, [rarity]: { ...prev[rarity], [key]: value.replace(/[^0-9]/g, '') } }));

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

      {/* Réglages du marché « Hors saison » */}
      <div style={{ background: '#12203a', border: '1px solid #6c5ce744', borderRadius: 10, padding: 14, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, fontWeight: 800, color: '#a29bfe', fontSize: 12 }}>🗓️ Marché « Hors saison »</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={offEnabled} onChange={e => setOffEnabled(e.target.checked)} style={{ width: 15, height: 15 }} />
            <span style={{ color: offEnabled ? '#2ecc71' : '#888', fontSize: 11, fontWeight: 800 }}>{offEnabled ? 'Activé' : 'Désactivé'}</span>
          </label>
        </div>
        <div style={{ color: '#8daacc', fontSize: 11, marginBottom: 10 }}>
          Coûts par défaut (Or + PF) par rareté pour les geocoins de saisons terminées. Surchargeable carte par carte dans l'onglet Geocoins. Une carte n'est proposée que si Or ET PF sont définis.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {OFF_RARITIES.map(r => (
            <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ minWidth: 90, fontSize: 12, fontWeight: 700, color: '#fff' }}>{r}</span>
              <input type="text" inputMode="numeric" placeholder="Or" value={offCost[r]?.gold ?? ''}
                onChange={e => setOffField(r, 'gold', e.target.value)} style={{ ...INP, width: 80 }} />
              <span style={{ color: '#aaa', fontSize: 12 }}>G</span>
              <input type="text" inputMode="numeric" placeholder="PF" value={offCost[r]?.pf ?? ''}
                onChange={e => setOffField(r, 'pf', e.target.value)} style={{ ...INP, width: 80 }} />
              <span style={{ color: '#aaa', fontSize: 12 }}>pts</span>
            </div>
          ))}
        </div>
        <button onClick={saveOffseasonSettings} style={{ ...BTN('linear-gradient(135deg,#6c5ce7,#a29bfe)'), padding: '8px 16px', borderRadius: 8, fontSize: 12, marginTop: 10 }}>
          💾 Enregistrer les réglages hors saison
        </button>
      </div>

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
