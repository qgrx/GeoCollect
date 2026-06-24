import { useState, useEffect, useMemo } from 'react';
import { INP } from '../../utils/styles.js';
import { apiAdminGetReferrals } from '../../services/api.js';

// Vue admin « Parrainage » : qui parraine qui + geocoins (normaux/shiny) de
// chaque filleul. Données fournies par GET /api/admin/referrals.
export default function AdminReferrals({ setMsg }) {
  const [data, setData]       = useState(null);   // { min_geocoins, parrains }
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState('');
  const [open, setOpen]       = useState({});      // parrainId → déplié ?

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    apiAdminGetReferrals().then(({ data, error }) => {
      if (!mounted) return;
      setLoading(false);
      if (error) { setMsg?.('❌ ' + error); return; }
      setData(data || { min_geocoins: 0, parrains: [] });
    });
    return () => { mounted = false; };
  }, [setMsg]);

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
