import { useState, useEffect, useMemo, useCallback } from 'react';
import { INP } from '../../utils/styles.js';
import { apiAdminGetPatronageStats } from '../../services/api.js';

// Vue admin « Mécénat » : qui a offert un geocoin à qui, combien par rareté et par
// critère. Données fournies par GET /api/admin/patronage-stats (journal complet
// dé-normalisé). Tout est agrégé côté client → période, sens (mécène/bénéficiaire),
// rareté et critère se recalculent sans re-requête.

// Couleurs = miroir de PATRONAGE_HALO (rare/épique/légendaire).
const RARITY_COLOR = { rare: '#3aa0ff', 'épique': '#a970ff', 'légendaire': '#ff8c42' };
const RARITY_ORDER = ['légendaire', 'épique', 'rare'];
const CRITERION_LABEL = {
  nouveau: 'Nouveau', ancien: 'Ancien', rapide: 'Rapide', fidele: 'Fidèle',
  petite_collection: 'Petite collection', grande_collection: 'Grande collection',
};
const PERIODS = [['7', '7 jours'], ['30', '30 jours'], ['all', 'Tout']];

export default function AdminPatronage({ setMsg }) {
  const [gifts, setGifts]     = useState(null);   // journal brut (tous les dons)
  const [loading, setLoading] = useState(false);
  const [period, setPeriod]   = useState('all');
  const [mode, setMode]       = useState('donor'); // 'donor' (mécène) | 'recipient'
  const [search, setSearch]   = useState('');
  const [open, setOpen]       = useState({});

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    return apiAdminGetPatronageStats().then(({ data, error }) => {
      setLoading(false);
      if (error) { setMsg?.('❌ ' + error); return; }
      setGifts(data?.gifts || []);
    });
  }, [setMsg]);

  useEffect(() => { load(); }, [load]);

  // Filtrage période (created_at). 'all' = tout l'historique.
  const filtered = useMemo(() => {
    const all = gifts || [];
    if (period === 'all') return all;
    const cutoff = Date.now() - Number(period) * 864e5;
    return all.filter(g => new Date(g.created_at).getTime() >= cutoff);
  }, [gifts, period]);

  // Totaux globaux sur la période.
  const totals = useMemo(() => {
    const byRarity = { rare: 0, 'épique': 0, 'légendaire': 0 };
    const byCriterion = {};
    const donors = new Set(), recips = new Set();
    for (const g of filtered) {
      byRarity[g.rarity] = (byRarity[g.rarity] || 0) + 1;
      byCriterion[g.criterion] = (byCriterion[g.criterion] || 0) + 1;
      donors.add(g.donor_id); recips.add(g.recipient_id);
    }
    return { count: filtered.length, byRarity, byCriterion, donors: donors.size, recips: recips.size };
  }, [filtered]);

  // Regroupement par mécène ou par bénéficiaire.
  const rows = useMemo(() => {
    const groups = new Map();
    for (const g of filtered) {
      const key      = mode === 'donor' ? g.donor_id : g.recipient_id;
      const pseudo   = mode === 'donor' ? g.donor : g.recipient;
      const deleted  = mode === 'donor' ? g.donor_deleted : g.recipient_deleted;
      let grp = groups.get(key);
      if (!grp) {
        grp = { id: key, pseudo, deleted, total: 0, byRarity: { rare: 0, 'épique': 0, 'légendaire': 0 }, gifts: [] };
        groups.set(key, grp);
      }
      grp.total += 1;
      grp.byRarity[g.rarity] = (grp.byRarity[g.rarity] || 0) + 1;
      grp.gifts.push(g);
    }
    return [...groups.values()].sort((a, b) => b.total - a.total);
  }, [filtered, mode]);

  const q = search.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!q) return rows;
    return rows
      .map(r => {
        if (r.pseudo.toLowerCase().includes(q)) return r; // tous ses dons
        // sinon on garde les dons dont la contrepartie correspond
        const kept = r.gifts.filter(g => {
          const other = mode === 'donor' ? g.recipient : g.donor;
          return (other || '').toLowerCase().includes(q);
        });
        return kept.length ? { ...r, gifts: kept } : null;
      })
      .filter(Boolean);
  }, [rows, q, mode]);

  const criteriaSorted = Object.entries(totals.byCriterion).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ maxWidth: 880 }}>
      <h2 style={{ fontFamily: "'Fredoka One',sans-serif", color: '#e74c3c', fontSize: 20, margin: '0 0 4px' }}>
        🎁 Mécénat
      </h2>
      <p style={{ color: '#8daacc', fontSize: 12, margin: '0 0 16px' }}>
        Qui a offert un geocoin à qui, combien par rareté et par critère de sélection.
        Un don a lieu quand un joueur au plafond hebdo d'une rareté choisit d'offrir son gain.
      </p>

      {/* Filtres période */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {PERIODS.map(([v, l]) => (
          <button key={v} onClick={() => setPeriod(v)}
            style={{ background: period === v ? '#e74c3c' : '#ffffff14', border: 'none', color: '#fff', padding: '5px 12px', borderRadius: 7, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 11, cursor: 'pointer' }}>
            {l}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button onClick={() => { setGifts(null); load(); }}
          style={{ background: '#ffffff14', border: 'none', color: '#8daacc', padding: '5px 12px', borderRadius: 7, fontWeight: 800, fontSize: 11, cursor: 'pointer' }}>
          ↻ Rafraîchir
        </button>
      </div>

      {/* Résumé */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <Stat icon="🎁" label="Dons"         value={totals.count}  color="#00b894" />
        <Stat icon="🤝" label="Mécènes"      value={totals.donors} color="#a29bfe" />
        <Stat icon="🎯" label="Bénéficiaires" value={totals.recips} color="#74b9ff" />
      </div>

      {/* Répartition par rareté */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        {RARITY_ORDER.map(r => (
          <Stat key={r} icon="◆" label={r} value={totals.byRarity[r] || 0} color={RARITY_COLOR[r]} />
        ))}
      </div>

      {/* Répartition par critère */}
      {criteriaSorted.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: '#7a94aa', fontSize: 11, fontWeight: 700 }}>Critères&nbsp;:</span>
          {criteriaSorted.map(([c, n]) => (
            <Pill key={c} color="#8daacc">{CRITERION_LABEL[c] || c || '?'} · {n}</Pill>
          ))}
        </div>
      )}

      {/* Sens de lecture + recherche */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: '#ffffff0c', borderRadius: 8, padding: 3 }}>
          {[['donor', '🤝 Par mécène'], ['recipient', '🎯 Par bénéficiaire']].map(([v, l]) => (
            <button key={v} onClick={() => setMode(v)}
              style={{ background: mode === v ? '#e74c3c' : 'transparent', border: 'none', color: mode === v ? '#fff' : '#8daacc', padding: '5px 12px', borderRadius: 6, fontWeight: 800, fontSize: 11, cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un joueur…"
          style={{ ...INP, flex: 1, minWidth: 200, maxWidth: 320 }} />
      </div>

      {loading && <div style={{ color: '#8daacc', fontSize: 13 }}>Chargement…</div>}
      {!loading && !visible.length && (
        <div style={{ color: '#8daacc', fontSize: 13 }}>
          {gifts?.length ? 'Aucun résultat sur cette période.' : 'Aucun don de mécénat pour le moment.'}
        </div>
      )}

      {!loading && visible.map(r => {
        const isOpen = q ? true : !!open[r.id];
        return (
          <div key={r.id} style={{ background: '#ffffff08', border: '1px solid #ffffff10', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
            <button onClick={() => setOpen(o => ({ ...o, [r.id]: !o[r.id] }))}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', color: '#d4e8f8', padding: '10px 14px', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ color: '#7a94aa', width: 12 }}>{isOpen ? '▾' : '▸'}</span>
              <span style={{ fontWeight: 800, fontSize: 14, color: r.deleted ? '#7a94aa' : '#d4e8f8' }}>
                {r.pseudo}{r.deleted && ' (supprimé)'}
              </span>
              <span style={{ flex: 1 }} />
              {RARITY_ORDER.filter(rr => r.byRarity[rr] > 0).map(rr => (
                <Pill key={rr} color={RARITY_COLOR[rr]}>{r.byRarity[rr]} {rr}</Pill>
              ))}
              <Pill color="#00b894">{r.total} don{r.total > 1 ? 's' : ''}</Pill>
            </button>

            {isOpen && (
              <div style={{ padding: '0 14px 12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: '#7a94aa', fontSize: 11, textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px', fontWeight: 700 }}>{mode === 'donor' ? 'A offert à' : 'Reçu de'}</th>
                      <th style={{ padding: '6px 8px', fontWeight: 700 }}>Rareté</th>
                      <th style={{ padding: '6px 8px', fontWeight: 700 }}>Critère</th>
                      <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.gifts.map(g => {
                      const other        = mode === 'donor' ? g.recipient : g.donor;
                      const otherDeleted = mode === 'donor' ? g.recipient_deleted : g.donor_deleted;
                      const otherBot     = mode === 'donor' ? g.recipient_bot : false;
                      return (
                        <tr key={g.id} style={{ borderTop: '1px solid #ffffff0c', color: '#c8dcec' }}>
                          <td style={{ padding: '6px 8px', color: otherDeleted ? '#7a94aa' : '#c8dcec' }}>
                            <span style={{ color: '#7a94aa' }}>{mode === 'donor' ? '→ ' : '← '}</span>
                            {other}
                            {otherBot && <span style={{ color: '#7a94aa', fontSize: 10, marginLeft: 5 }}>🤖</span>}
                            {otherDeleted && <span style={{ color: '#7a94aa', fontSize: 10, marginLeft: 5 }}>(supprimé)</span>}
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <span style={{ color: RARITY_COLOR[g.rarity] || '#c8dcec', fontWeight: 800 }}>◆ {g.rarity}</span>
                          </td>
                          <td style={{ padding: '6px 8px', color: '#8daacc' }}>{CRITERION_LABEL[g.criterion] || g.criterion || '—'}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: '#7a94aa', fontSize: 11 }}>
                            {new Date(g.created_at).toLocaleDateString('fr-FR')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ icon, label, value, color }) {
  return (
    <div style={{ background: '#ffffff08', border: `1px solid ${color}33`, borderRadius: 10, padding: '8px 14px', minWidth: 96 }}>
      <div style={{ fontSize: 11, color: '#8daacc', fontWeight: 700 }}>{icon} {label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function Pill({ children, color }) {
  return (
    <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}
