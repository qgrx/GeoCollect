import { useState, useEffect } from 'react';
import { apiAdminGetPlayerSpending } from '../../services/api.js';

// Libellés des raisons du journal spend_log (garder synchronisé avec l'API).
const SPEND_LABELS = {
  market_buy:         'Achat marché',
  market_listing_fee: 'Frais de publication',
  market_tax:         'Taxe de vente',
  offseason_buy:      'Achat hors saison',
  hold_rent:          'Location de dépôt',
  hold_replace:       'Remplacement de dépôt',
  hold_slot_buy:      'Emplacement de dépôt',
  pocket_boost:       'Poche (+geocoins/h)',
  bag_slot:           'Emplacement de sac',
  forge_card:         'Forge de geocoin',
  forge_shiny:        'Forge brillante',
};
const reasonLabel = r => SPEND_LABELS[r] || r;
const fmtDate = d => d ? new Date(d).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }) : '—';
const CUR = { gold: { icon: '💰', unit: 'G', color: '#f9ca24' }, pf: { icon: '🔨', unit: ' PF', color: '#a29bfe' } };

const PAGE_SIZE = 50;

export default function AdminPlayerSpending({ playerId }) {
  const [page, setPage]         = useState(0);
  const [currency, setCurrency] = useState('');
  const [data, setData]         = useState(undefined); // undefined = chargement, null = erreur

  useEffect(() => {
    let mounted = true;
    setData(undefined);
    apiAdminGetPlayerSpending(playerId, page, currency).then(({ data: d, error }) => {
      if (mounted) setData(error ? null : d);
    });
    return () => { mounted = false; };
  }, [playerId, page, currency]);

  const pages = data ? Math.ceil((data.total || 0) / PAGE_SIZE) : 0;

  return (
    <div style={{ marginTop: 12, background: '#ffffff08', borderRadius: 10, padding: '12px 14px', border: '1px solid #ffffff10' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontWeight: 800, color: '#a29bfe', fontSize: 12 }}>💸 Dépenses</span>
        {data && (
          <>
            <span style={{ fontSize: 11, color: '#f9ca24', fontWeight: 800 }}>💰 {data.totals?.gold ?? 0}G</span>
            <span style={{ fontSize: 11, color: '#a29bfe', fontWeight: 800 }}>🔨 {data.totals?.pf ?? 0} PF</span>
            <span style={{ fontSize: 10, color: '#8daacc' }}>au total</span>
          </>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {[['', 'Tout'], ['gold', '💰 Or'], ['pf', '🔨 PF']].map(([v, lbl]) => (
            <button key={v} onClick={() => { setCurrency(v); setPage(0); }}
              style={{ background: currency === v ? '#ffffff22' : 'none', border: '1px solid #ffffff18', color: currency === v ? '#fff' : '#8daacc', padding: '3px 9px', borderRadius: 50, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 10, cursor: 'pointer' }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {data === undefined && <div style={{ color: '#8daacc', fontSize: 11, textAlign: 'center', padding: '10px 0' }}>Chargement…</div>}
      {data === null && <div style={{ color: '#e17055', fontSize: 11 }}>Indisponible (migration spend_log.sql appliquée ?)</div>}

      {data && (
        <>
          {/* Ventilation par raison (tout l'historique) */}
          {(data.by_reason || []).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
              {data.by_reason.map(r => (
                <span key={`${r.reason}-${r.currency}`}
                  style={{ fontSize: 10, background: `${CUR[r.currency].color}18`, color: CUR[r.currency].color, borderRadius: 50, padding: '2px 8px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {reasonLabel(r.reason)} : {r.total}{CUR[r.currency].unit} <span style={{ opacity: 0.7 }}>(×{r.count})</span>
                </span>
              ))}
            </div>
          )}

          {/* Détail paginé */}
          {(data.spending || []).length === 0 ? (
            <div style={{ color: '#8daacc', fontSize: 11, textAlign: 'center', padding: '10px 0' }}>Aucune dépense enregistrée.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
              {data.spending.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 11, padding: '3px 6px', borderRadius: 6, background: '#ffffff05' }}>
                  <span style={{ color: '#8daacc', fontSize: 10, width: 92, flexShrink: 0 }}>{fmtDate(s.created_at)}</span>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{reasonLabel(s.reason)}</span>
                  {s.label && <span style={{ color: '#8daacc', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>}
                  <span style={{ marginLeft: 'auto', color: CUR[s.currency].color, fontWeight: 800, whiteSpace: 'nowrap' }}>−{s.amount}{CUR[s.currency].unit}</span>
                </div>
              ))}
            </div>
          )}

          {pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                style={{ background: page === 0 ? '#ffffff0a' : '#ffffff18', border: 'none', color: page === 0 ? '#444' : '#fff', width: 26, height: 26, borderRadius: 8, cursor: page === 0 ? 'default' : 'pointer', fontWeight: 900, fontSize: 13 }}>‹</button>
              <span style={{ fontSize: 10, color: '#8daacc', fontWeight: 700 }}>Page {page + 1} / {pages}</span>
              <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}
                style={{ background: page >= pages - 1 ? '#ffffff0a' : '#ffffff18', border: 'none', color: page >= pages - 1 ? '#444' : '#fff', width: 26, height: 26, borderRadius: 8, cursor: page >= pages - 1 ? 'default' : 'pointer', fontWeight: 900, fontSize: 13 }}>›</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
