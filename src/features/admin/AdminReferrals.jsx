import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { INP, BTN } from '../../utils/styles.js';
import { apiAdminGetReferrals, apiAdminAssignReferral, apiAdminUnassignReferral, apiAdminSearchPlayers } from '../../services/api.js';

// Vue admin « Parrainage » : qui parraine qui + geocoins (normaux/shiny) de
// chaque filleul. Données fournies par GET /api/admin/referrals.
// L'admin peut aussi assigner / réassigner / détacher un filleul manuellement
// (rattrapage des cas où le claim du lien n'a pas fonctionné).
export default function AdminReferrals({ setMsg }) {
  const [data, setData]       = useState(null);   // { min_geocoins, parrains }
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState('');
  const [open, setOpen]       = useState({});      // parrainId → déplié ?
  const [busy, setBusy]       = useState(false);   // mutation en cours

  // Formulaire d'assignation
  const [showAssign, setShowAssign] = useState(false);
  const [parrainSel, setParrainSel] = useState(null); // { id, pseudo }
  const [filleulSel, setFilleulSel] = useState(null);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    return apiAdminGetReferrals().then(({ data, error }) => {
      setLoading(false);
      if (error) { setMsg?.('❌ ' + error); return; }
      setData(data || { min_geocoins: 0, parrains: [] });
    });
  }, [setMsg]);

  useEffect(() => { load(); }, [load]);

  const parrains = data?.parrains || [];
  const totals = useMemo(() => ({
    parrains:  parrains.length,
    filleuls:  parrains.reduce((s, p) => s + p.filleul_count, 0),
    qualified: parrains.reduce((s, p) => s + p.qualified_count, 0),
  }), [parrains]);

  const q = search.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!q) return parrains;
    return parrains
      .map(p => {
        const parrainHit = p.pseudo.toLowerCase().includes(q);
        const filleuls   = p.filleuls.filter(f => (f.pseudo || '').toLowerCase().includes(q));
        if (parrainHit) return p;                       // tous les filleuls
        if (filleuls.length) return { ...p, filleuls }; // sous-ensemble
        return null;
      })
      .filter(Boolean);
  }, [parrains, q]);

  const assign = async () => {
    if (!parrainSel || !filleulSel || busy) return;
    setBusy(true);
    const { error } = await apiAdminAssignReferral(filleulSel.id, parrainSel.id);
    setBusy(false);
    if (error) { setMsg?.('❌ ' + error); return; }
    setMsg?.(`✅ ${filleulSel.pseudo} est maintenant filleul de ${parrainSel.pseudo}`);
    setFilleulSel(null);
    setOpen(o => ({ ...o, [parrainSel.id]: true }));
    load(true);
  };

  const unassign = async (parrain, filleul) => {
    if (busy) return;
    if (!window.confirm(`Détacher ${filleul.pseudo} de ${parrain.pseudo} ?`)) return;
    setBusy(true);
    const { error } = await apiAdminUnassignReferral(filleul.id);
    setBusy(false);
    if (error) { setMsg?.('❌ ' + error); return; }
    setMsg?.(`✅ ${filleul.pseudo} détaché de ${parrain.pseudo}`);
    load(true);
  };

  return (
    <div style={{ maxWidth: 880 }}>
      <h2 style={{ fontFamily: "'Fredoka One',sans-serif", color: '#e74c3c', fontSize: 20, margin: '0 0 4px' }}>
        🤝 Parrainage
      </h2>
      <p style={{ color: '#8daacc', fontSize: 12, margin: '0 0 16px' }}>
        Qui parraine qui, et combien de geocoins (normaux / brillants) possède chaque filleul.
        Un filleul est <b style={{ color: '#00b894' }}>qualifié</b> dès {data?.min_geocoins ?? '—'} geocoins uniques.
      </p>

      {/* Résumé */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <Stat icon="👤" label="Parrains"  value={totals.parrains}  color="#a29bfe" />
        <Stat icon="🎁" label="Filleuls"  value={totals.filleuls}  color="#74b9ff" />
        <Stat icon="✅" label="Qualifiés" value={totals.qualified} color="#00b894" />
      </div>

      {/* Assignation manuelle */}
      <div style={{ background: '#ffffff08', border: '1px solid #ffffff10', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
        <button
          onClick={() => setShowAssign(s => !s)}
          style={{ background: 'none', border: 'none', color: '#a29bfe', fontWeight: 800, fontSize: 13, cursor: 'pointer', padding: 0 }}
        >
          {showAssign ? '▾' : '▸'} ➕ Assigner un filleul à un parrain
        </button>
        {showAssign && (
          <div style={{ marginTop: 10 }}>
            <p style={{ color: '#8daacc', fontSize: 11, margin: '0 0 8px' }}>
              Aucune règle anti-abus ici (contrairement au lien de parrainage) : à utiliser pour
              rattraper un parrainage qui n'a pas fonctionné. Si le filleul a déjà un parrain, il sera réassigné.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <PlayerPicker label="Parrain" selected={parrainSel} onSelect={setParrainSel} exclude={filleulSel?.id} />
              <PlayerPicker label="Filleul" selected={filleulSel} onSelect={setFilleulSel} exclude={parrainSel?.id} />
              <button
                onClick={assign}
                disabled={!parrainSel || !filleulSel || busy}
                style={{ ...BTN('#a29bfe'), opacity: !parrainSel || !filleulSel || busy ? 0.5 : 1 }}
              >
                Assigner
              </button>
            </div>
          </div>
        )}
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher un parrain ou un filleul…"
        style={{ ...INP, width: '100%', maxWidth: 320, marginBottom: 14 }}
      />

      {loading && <div style={{ color: '#8daacc', fontSize: 13 }}>Chargement…</div>}
      {!loading && !visible.length && (
        <div style={{ color: '#8daacc', fontSize: 13 }}>
          {parrains.length ? 'Aucun résultat.' : 'Aucun parrainage pour le moment.'}
        </div>
      )}

      {!loading && visible.map(p => {
        const isOpen = q ? true : !!open[p.id];
        return (
          <div key={p.id} style={{ background: '#ffffff08', border: '1px solid #ffffff10', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
            {/* Ligne parrain */}
            <button
              onClick={() => setOpen(o => ({ ...o, [p.id]: !o[p.id] }))}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', color: '#d4e8f8', padding: '10px 14px', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ color: '#7a94aa', width: 12 }}>{isOpen ? '▾' : '▸'}</span>
              <span style={{ fontWeight: 800, fontSize: 14, color: p.deleted ? '#7a94aa' : '#d4e8f8' }}>
                {p.pseudo}{p.deleted && ' (supprimé)'}
              </span>
              <span style={{ flex: 1 }} />
              <Pill color="#74b9ff">{p.filleul_count} filleul{p.filleul_count > 1 ? 's' : ''}</Pill>
              <Pill color="#00b894">{p.qualified_count} qualifié{p.qualified_count > 1 ? 's' : ''}</Pill>
            </button>

            {/* Tableau filleuls */}
            {isOpen && (
              <div style={{ padding: '0 14px 12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: '#7a94aa', fontSize: 11, textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px', fontWeight: 700 }}>Filleul</th>
                      <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>Geocoins</th>
                      <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>✨ Shiny</th>
                      <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>Inscrit</th>
                      <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'center' }}>Statut</th>
                      <th style={{ padding: '6px 8px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {p.filleuls.map(f => (
                      <tr key={f.id} style={{ borderTop: '1px solid #ffffff0c', color: f.deleted ? '#7a94aa' : '#c8dcec' }}>
                        <td style={{ padding: '6px 8px' }}>
                          {f.pseudo}
                          {f.is_bot && <span style={{ color: '#7a94aa', fontSize: 10, marginLeft: 5 }}>🤖</span>}
                          {f.deleted && <span style={{ color: '#7a94aa', fontSize: 10, marginLeft: 5 }}>(supprimé)</span>}
                          {f.status && f.status !== 'actif' && <span style={{ color: '#e74c3c', fontSize: 10, marginLeft: 5 }}>({f.status})</span>}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{f.geocoins}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#f9ca24' }}>{f.shinies}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#7a94aa', fontSize: 11 }}>
                          {f.joined_at ? new Date(f.joined_at).toLocaleDateString('fr-FR') : '—'}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          {f.qualified
                            ? <span style={{ color: '#00b894', fontWeight: 800 }}>✅</span>
                            : <span style={{ color: '#7a94aa' }}>—</span>}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                          <button
                            onClick={() => unassign(p, f)}
                            disabled={busy}
                            title={`Détacher ${f.pseudo} de ${p.pseudo}`}
                            style={{ background: '#e74c3c22', border: '1px solid #e74c3c44', color: '#e74c3c', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 800, cursor: 'pointer', opacity: busy ? 0.5 : 1 }}
                          >
                            ✕ Détacher
                          </button>
                        </td>
                      </tr>
                    ))}
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

// Recherche de joueur par pseudo (GET /api/admin/players) avec debounce,
// sélection → { id, pseudo }. `exclude` masque un id des résultats (évite de
// proposer le même joueur comme parrain ET filleul).
function PlayerPicker({ label, selected, onSelect, exclude }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onChange = (value) => {
    setQuery(value);
    onSelect(null);
    clearTimeout(timer.current);
    if (value.trim().length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    timer.current = setTimeout(async () => {
      const { data, error } = await apiAdminSearchPlayers(value.trim());
      setSearching(false);
      if (error) { setResults([]); return; }
      setResults((data?.players || []).filter(pl => !pl.deleted_at && pl.id !== exclude));
    }, 350);
  };

  return (
    <div style={{ position: 'relative', minWidth: 220 }}>
      <div style={{ fontSize: 11, color: '#8daacc', fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {selected ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#a29bfe22', border: '1px solid #a29bfe44', borderRadius: 8, padding: '7px 10px' }}>
          <span style={{ color: '#d4e8f8', fontWeight: 800, fontSize: 13, flex: 1 }}>{selected.pseudo}</span>
          <button
            onClick={() => { onSelect(null); setQuery(''); setResults([]); }}
            style={{ background: 'none', border: 'none', color: '#8daacc', cursor: 'pointer', fontSize: 13, padding: 0 }}
          >
            ✕
          </button>
        </div>
      ) : (
        <>
          <input
            value={query}
            onChange={e => onChange(e.target.value)}
            placeholder="Pseudo…"
            style={{ ...INP, width: '100%' }}
          />
          {(searching || results.length > 0) && query.trim().length >= 2 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#1b2a3a', border: '1px solid #ffffff20', borderRadius: 8, marginTop: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 6px 18px #0008' }}>
              {searching && <div style={{ color: '#8daacc', fontSize: 12, padding: '8px 10px' }}>Recherche…</div>}
              {!searching && results.map(pl => (
                <button
                  key={pl.id}
                  onClick={() => { onSelect({ id: pl.id, pseudo: pl.pseudo }); setResults([]); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'none', border: 'none', color: '#c8dcec', padding: '7px 10px', cursor: 'pointer', textAlign: 'left', fontSize: 13 }}
                >
                  <span style={{ fontWeight: 700 }}>{pl.pseudo}</span>
                  {pl.is_bot && <span style={{ color: '#7a94aa', fontSize: 10 }}>🤖</span>}
                  {pl.status && pl.status !== 'actif' && <span style={{ color: '#e74c3c', fontSize: 10 }}>({pl.status})</span>}
                </button>
              ))}
              {!searching && !results.length && <div style={{ color: '#8daacc', fontSize: 12, padding: '8px 10px' }}>Aucun joueur trouvé.</div>}
            </div>
          )}
        </>
      )}
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
