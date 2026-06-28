import { useState, useEffect } from 'react';
import { apiAdminGetCheatReport } from '../../services/api.js';

// Couleur du score : vert (sain) → jaune → orange → rouge (suspect).
const scoreColor = s => s >= 70 ? '#e74c3c' : s >= 40 ? '#e17055' : s >= 20 ? '#f9ca24' : '#00b894';
const fmtDate = d => d ? new Date(d).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : '—';
const rarColor = r => ({ commun: '#9aa7b4', rare: '#3498db', 'épique': '#9b59b6', 'légendaire': '#f1c40f' }[r] || '#9aa7b4');

const Card = ({ title, children }) => (
  <div style={{ marginTop: 12, background: '#ffffff08', borderRadius: 10, padding: '12px 14px', border: '1px solid #ffffff10' }}>
    <div style={{ fontWeight: 800, color: '#a29bfe', fontSize: 12, marginBottom: 8 }}>{title}</div>
    {children}
  </div>
);

const Chip = ({ label, color }) => (
  <span style={{ fontSize: 9, background: `${color}22`, color, borderRadius: 50, padding: '1px 6px', fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</span>
);

// Pastilles de signaux « client direct » suspects sur une tentative.
function attemptChips(a) {
  const chips = [];
  if (a.has_origin === false) chips.push(['no-origin', '#e74c3c']);
  if (a.via_socket === false) chips.push(['no-socket', '#e17055']);
  if (a.sec_fetch == null)    chips.push(['no-secfetch', '#e67e22']);
  if (a.accept_lang === false) chips.push(['no-lang', '#d35400']);
  if (a.nonce_ok === false)   chips.push(['no-nonce', '#c0392b']);
  return chips;
}

export default function AdminCheatReport({ playerId }) {
  const [report, setReport] = useState(undefined); // undefined = loading, null = erreur

  useEffect(() => {
    let mounted = true;
    setReport(undefined);
    apiAdminGetCheatReport(playerId).then(({ data, error }) => {
      if (mounted) setReport(error ? null : data);
    });
    return () => { mounted = false; };
  }, [playerId]);

  if (report === undefined) return <Card title="🤖 Stats de triche"><div style={{ color: '#8daacc', fontSize: 11, textAlign: 'center', padding: '10px 0' }}>Chargement…</div></Card>;
  if (report === null)      return <Card title="🤖 Stats de triche"><div style={{ color: '#e17055', fontSize: 11 }}>Indisponible (migration anti_cheat.sql appliquée ?)</div></Card>;

  const { profile = {}, ips = [], linked_accounts = {}, attempts = [], actions = [], history = {} } = report;
  const score = profile.bot_score ?? 0;
  const bd = profile.bot_score_breakdown?.breakdown || {};
  const ft = profile.bot_score_breakdown?.features || {};
  const breakdownRows = Object.entries(bd).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const hist = history?.stats;
  const impossible = history?.impossible || [];

  return (
    <Card title="🤖 Stats de triche">
      {/* Score + features */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 30, fontWeight: 900, color: scoreColor(score) }}>{score}</span>
          <span style={{ fontSize: 12, color: '#8daacc' }}>/100</span>
        </div>
        <div style={{ fontSize: 10, color: '#8daacc' }}>
          calculé&nbsp;: {fmtDate(profile.bot_score_at)}<br />
          {ft.n != null && <>tentatives&nbsp;: <b style={{ color: '#fff' }}>{ft.n}</b> · impossibles&nbsp;: <b style={{ color: impossible.length || ft.impossible_fast ? '#e74c3c' : '#fff' }}>{ft.impossible_fast ?? 0}</b> (corroborées&nbsp;: {ft.impossible_corroborated ?? 0}) · CV&nbsp;: {ft.response_cv ?? '—'}</>}
        </div>
      </div>

      {/* Barres de breakdown */}
      {breakdownRows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 }}>
          {breakdownRows.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: '#a8bfcf', width: 110, flexShrink: 0 }}>{k}</span>
              <div style={{ flex: 1, background: '#ffffff10', borderRadius: 50, height: 6, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, v)}%`, height: '100%', background: scoreColor(v * 2), borderRadius: 50 }} />
              </div>
              <span style={{ fontSize: 10, color: '#fff', fontWeight: 700, width: 28, textAlign: 'right' }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Vitesse historique — preuve directe (manches gagnées sous le plancher humain) */}
      <div style={{ borderTop: '1px solid #ffffff10', marginTop: 10, paddingTop: 10 }}>
        <div style={{ fontSize: 11, color: '#8daacc', marginBottom: 6 }}>
          ⏱️ Vitesse (victoires PVP) — {hist ? <>min <b style={{ color: hist.min < 2.2 ? '#e74c3c' : '#fff' }}>{hist.min}s</b> · moy {hist.avg}s · {hist.n} manches</> : 'aucune donnée'}
        </div>
        {impossible.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 10, color: '#e74c3c', fontWeight: 800 }}>⚠️ {impossible.length} réponse(s) physiquement impossible(s) :</div>
            {impossible.map((w, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, padding: '2px 6px', background: '#e74c3c0d', borderRadius: 6 }}>
                <b style={{ color: '#e74c3c', width: 48 }}>{Number(w.secs).toFixed(2)}s</b>
                <Chip label={w.rarity || '?'} color={rarColor(w.rarity)} />
                {w.is_shiny && <span title="shiny">✨</span>}
                <span style={{ color: '#cfd8e3', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</span>
                <span style={{ color: '#7d8da0', fontSize: 10 }}>{fmtDate(w.solved_at)}</span>
              </div>
            ))}
          </div>
        ) : hist && <div style={{ fontSize: 10, color: '#00b894' }}>✓ aucune réponse sous le plancher humain</div>}
      </div>

      {/* Adresses IP + comptes liés */}
      <div style={{ borderTop: '1px solid #ffffff10', marginTop: 10, paddingTop: 10 }}>
        <div style={{ fontSize: 11, color: '#8daacc', marginBottom: 6 }}>🌐 Adresses IP ({ips.length})</div>
        {ips.length === 0 ? <div style={{ fontSize: 10, color: '#7d8da0' }}>aucune encore (collecte via /ping)</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
            {ips.map((r, i) => {
              const linked = linked_accounts[r.ip] || [];
              return (
                <div key={i} style={{ fontSize: 10, fontFamily: 'monospace', color: '#cfd8e3', background: '#ffffff05', borderRadius: 6, padding: '4px 8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 700, color: linked.length ? '#e74c3c' : '#fff' }}>{r.ip}</span>
                    <span style={{ color: '#7d8da0' }}>{r.hits}× · {fmtDate(r.last_seen)}</span>
                  </div>
                  <div style={{ color: '#7d8da0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.ua || '—'}</div>
                  {linked.length > 0 && (
                    <div style={{ marginTop: 3, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ color: '#e74c3c', fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>↪ partagée avec&nbsp;:</span>
                      {linked.map(p => <Chip key={p.id} label={`${p.pseudo}${p.status === 'banni' ? ' ⛔' : ''}`} color="#e74c3c" />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tentatives récentes */}
      {attempts.length > 0 && (
        <div style={{ borderTop: '1px solid #ffffff10', marginTop: 10, paddingTop: 10 }}>
          <div style={{ fontSize: 11, color: '#8daacc', marginBottom: 6 }}>📋 Tentatives récentes ({attempts.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 220, overflowY: 'auto' }}>
            {attempts.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 10, padding: '2px 6px', background: a.outcome === 'win' ? '#00b8940a' : '#ffffff05', borderRadius: 5 }}>
                <b style={{ color: a.response_ms < 2200 && a.correct ? '#e74c3c' : '#cfd8e3', width: 52, textAlign: 'right' }}>{a.response_ms}ms</b>
                <span style={{ color: '#7d8da0', width: 70 }}>{a.outcome}</span>
                <Chip label={a.rarity || '?'} color={rarColor(a.rarity)} />
                <div style={{ flex: 1, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {attemptChips(a).map(([l, c]) => <Chip key={l} label={l} color={c} />)}
                </div>
                <span style={{ color: '#7d8da0' }}>{fmtDate(a.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions auto (flags / bans) */}
      {actions.length > 0 && (
        <div style={{ borderTop: '1px solid #ffffff10', marginTop: 10, paddingTop: 10 }}>
          <div style={{ fontSize: 11, color: '#8daacc', marginBottom: 6 }}>🛡️ Actions automatiques</div>
          {actions.map((a, i) => (
            <div key={i} style={{ fontSize: 10, color: '#cfd8e3', display: 'flex', gap: 8 }}>
              <Chip label={a.action} color={a.action.includes('ban') ? '#e74c3c' : a.action === 'vetoed' ? '#00b894' : '#f9ca24'} />
              <span>score {a.bot_score ?? '—'}</span>
              <span style={{ color: '#7d8da0' }}>{fmtDate(a.created_at)}</span>
              {a.resolved && <span style={{ color: '#7d8da0' }}>· résolu</span>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
