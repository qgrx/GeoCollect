import { useState, useEffect } from 'react';
import { useT } from '../../i18n/translations.js';
import { useTheme } from '../../ThemeContext.jsx';
import { RC } from '../../data/cards.js';
import { apiGetLeaderboard, apiGetUserCollection } from '../../services/api.js';
import Card from '../../components/Card.jsx';
import PseudoDisplay from '../../components/PseudoDisplay.jsx';
import { getRank, rankCC } from '../../utils/rankUtils.js';
import { DEFAULT_RANKS } from '../../data/constants.js';

// ─── Fiche joueur ─────────────────────────────────────────────────────────────
function ProfileView({ player, cardPool, myScore, myGold, myForgePoints, ranks, onBack }) {
  const { t } = useT();
  const { theme } = useTheme();
  const [col,      setCol]      = useState(null);  // { cardId: qty }
  const [shinyCol, setShinyCol] = useState(null);  // { cardId: qty }
  const [loading, setLoading] = useState(true);
  const [showCol, setShowCol] = useState(false);

  useEffect(() => {
    if (player.isMe) {
      setCol(player.col || {});
      setShinyCol(player.shinyCol || {});
      setLoading(false);
      return;
    }
    apiGetUserCollection(player.id).then(({ data }) => {
      const raw = data?.collection || [];
      if (Array.isArray(raw)) {
        const obj = {};
        raw.forEach(r => { obj[r.card_id] = r.quantity });
        setCol(obj);
      } else {
        setCol(raw);
      }
      setShinyCol(data?.shiny_collection || {});
      setLoading(false);
    });
  }, [player.id]);

  const uniqueCards = col
    ? new Set([
        ...Object.keys(col).filter(k => (col[k] || 0) > 0),
        ...Object.keys(shinyCol || {}).filter(k => ((shinyCol || {})[k] || 0) > 0),
      ]).size
    : null;

  const score       = player.isMe ? (myScore ?? player.score ?? 0) : (player.score ?? 0);
  const gold        = player.isMe ? (myGold  ?? player.gold  ?? 0) : (player.gold  ?? 0);
  const forgePoints = player.isMe ? (myForgePoints ?? 0) : (player.forge_points ?? 0);

  const sortedRanks = [...(ranks || DEFAULT_RANKS)].sort((a, b) => a.min - b.min);
  const rank     = getRank(score, ranks);
  const { c1, c2 } = rankCC(rank);
  const nextRank = sortedRanks.find(r => r.min > score);
  const prevMin  = [...sortedRanks].reverse().find(r => r.min <= score)?.min || 0;
  const pct      = nextRank ? Math.round(((score - prevMin) / (nextRank.min - prevMin)) * 100) : 100;

  const cards = [];
  if (col) {
    Object.entries(col).filter(([, n]) => n > 0).forEach(([id, cnt]) => {
      cards.push({ card: cardPool.find(c => c.id === +id) || { id: +id, name: `#${id}`, type: '?', rarity: 'commun' }, cnt, isShiny: false });
    });
  }
  if (shinyCol) {
    Object.entries(shinyCol).filter(([, n]) => n > 0).forEach(([id, cnt]) => {
      cards.push({ card: cardPool.find(c => c.id === +id) || { id: +id, name: `#${id}`, type: '?', rarity: 'commun' }, cnt, isShiny: true });
    });
  }
  cards.sort((a, b) => {
    const rDiff = (RC[b.card.rarity]?.order ?? 9) - (RC[a.card.rarity]?.order ?? 9);
    if (rDiff !== 0) return rDiff;
    const idDiff = a.card.id - b.card.id;   // même rareté → regrouper par carte
    if (idDiff !== 0) return idDiff;
    return a.isShiny ? 1 : -1;             // normal avant shiny
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000c', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 700, backdropFilter: 'blur(6px)' }}>
      <style>{`@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}`}</style>
      <div style={{ background: `linear-gradient(135deg,${theme.bgSurface},${theme.bgElevated})`, borderRadius: 22, padding: 22, width: showCol ? 'min(96vw,860px)' : 'min(96vw,360px)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px #000a', border: `1.5px solid ${theme.borderLight}`, fontFamily: "'Nunito',sans-serif", transition: 'width .3s' }}>
        <button onClick={onBack} style={{ background: theme.overlay, border: `1px solid ${theme.border}`, color: theme.textPrimary, width: 32, height: 32, borderRadius: '50%', fontSize: 15, cursor: 'pointer', marginBottom: 16 }}>←</button>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: theme.overlay }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(90deg,#ffffff08,#ffffff16,#ffffff08)', backgroundSize: '400px 100%', animation: `shimmer 1.4s ${i * 0.08}s infinite`, flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ height: 12, width: `${55 + (i % 3) * 15}%`, borderRadius: 6, background: 'linear-gradient(90deg,#ffffff08,#ffffff16,#ffffff08)', backgroundSize: '400px 100%', animation: `shimmer 1.4s ${i * 0.08}s infinite` }} />
                  <div style={{ height: 9, width: '30%', borderRadius: 6, background: 'linear-gradient(90deg,#ffffff05,#ffffff0e,#ffffff05)', backgroundSize: '400px 100%', animation: `shimmer 1.4s ${i * 0.08 + 0.1}s infinite` }} />
                </div>
                <div style={{ width: 40, height: 12, borderRadius: 6, background: 'linear-gradient(90deg,#ffffff05,#ffffff0e,#ffffff05)', backgroundSize: '400px 100%', animation: `shimmer 1.4s ${i * 0.08}s infinite` }} />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div style={{ background: theme.overlay, borderRadius: 14, padding: '14px 16px', border: `1px solid ${c1}66`, position: 'relative', overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `${c1}14`, pointerEvents: 'none' }} />

              {/* Avatar + pseudo + rang */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: `linear-gradient(135deg,${c1},${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#fff', flexShrink: 0, boxShadow: `0 0 14px ${c1}44`, border: `2px solid ${c1}44` }}>
                  {(player.pseudo || '?')[0].toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 16, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <PseudoDisplay pseudo={player.pseudo + (player.isMe ? ` ${t('lb_you')}` : '')} score={score} ranks={ranks} style={{ color: theme.textPrimary }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: c1 }}>{rank?.label}</span>
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 10 }}>
                {[
                  { icon: '🃏', value: uniqueCards ?? '—', label: t('stat_geocoins') },
                  { icon: '💰', value: gold,               label: t('stat_gold') },
                  { icon: '🔨', value: forgePoints,         label: t('stat_forge') },
                ].map(({ icon, value, label }) => (
                  <div key={label} style={{ background: theme.overlayMd, borderRadius: 8, padding: '6px 2px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12 }}>{icon}</div>
                    <div style={{ fontWeight: 900, fontSize: 12, color: theme.textPrimary, lineHeight: 1.2 }}>{value}</div>
                    <div style={{ fontSize: 7, color: theme.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .2 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Progression de rang */}
              {nextRank ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 10, color: theme.textMuted }}>
                    <span>{t('rank_next')} <span style={{ background: nextRank.color, color: '#fff', fontWeight: 800, padding: '1px 6px', borderRadius: 4, fontSize: 9, textShadow: '0 1px 2px #0004' }}>{nextRank.label}</span></span>
                    <span style={{ fontWeight: 700 }}>{score}/{nextRank.min}</span>
                  </div>
                  <div style={{ background: theme.overlayMd, borderRadius: 50, height: 5, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 50, background: `linear-gradient(90deg,${c1},${c2})`, transition: 'width .5s' }} />
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 11, fontWeight: 800, color: c1, textAlign: 'center' }}>{t('rank_max')}</div>
              )}
            </div>

            {/* Bouton voir collection */}
            <button onClick={() => setShowCol(v => !v)}
              style={{ width: '100%', background: showCol ? theme.overlay : 'linear-gradient(135deg,#f9ca24,#e17055)', border: `1px solid ${theme.border}`, color: showCol ? theme.textPrimary : '#1e3045', padding: '9px', borderRadius: 10, fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 13, cursor: 'pointer', transition: 'all .2s' }}>
              {showCol ? t('lb_hide_collection') : t('lb_show_collection').replace('{n}', uniqueCards ?? 0)}
            </button>

            {/* Grille de cartes */}
            {showCol && (
              <div style={{ marginTop: 14 }}>
                {cards.length === 0
                  ? <div style={{ color: theme.textMuted, textAlign: 'center', padding: '18px 0', fontSize: 13 }}>{t('lb_empty')}</div>
                  : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                      {cards.map(({ card, cnt, isShiny }) => <Card key={`${card.id}${isShiny?'_s':''}`} card={card} count={cnt} small isShiny={isShiny} />)}
                    </div>
                }
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Leaderboard Modal ────────────────────────────────────────────────────────
export default function LeaderboardModal({ myCollection, myShinyCollection, myPseudo, myId, myScore, myGold, myForgePoints, cardPool, ranks, onClose, inline = false }) {
  const { t } = useT();
  const { theme } = useTheme();
  const [players, setPlayers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [search, setSearch] = useState('');
  const PG = 15;

  useEffect(() => {
    setLoading(true);
    apiGetLeaderboard(page, search || undefined).then(({ data }) => {
      if (data?.players) {
        // Injecter le joueur courant s'il n'est pas dans la page
        let list = data.players.map(p => p.id === myId ? { ...p, isMe: true, score: myScore ?? p.score } : p);
        if (page === 0 && myId && !list.find(p => p.isMe)) {
          const me = { id: myId, pseudo: myPseudo || 'Moi', isMe: true, score: myScore ?? 0, col: myCollection, shinyCol: myShinyCollection };
          list = [me, ...list];
        }
        setPlayers(list);
        setTotal(data.total || list.length);
      }
      setLoading(false);
    });
  }, [page, search]);

  const pages = Math.ceil(total / PG);
  const medal = ['🥇', '🥈', '🥉'];

  const PanelWrapper = ({ children }) => inline ? (
    <div style={{ fontFamily: "'Nunito',sans-serif" }}>{children}</div>
  ) : (
    <div style={{ position: 'fixed', inset: 0, background: '#000c', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 700, backdropFilter: 'blur(6px)' }}>
      <div style={{ background: `linear-gradient(135deg,${theme.bgSurface},${theme.bgElevated})`, borderRadius: 22, padding: 22, width: 'min(96vw,500px)', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 80px #000a', border: `1.5px solid ${theme.borderLight}`, fontFamily: "'Nunito',sans-serif" }}>
        {children}
      </div>
    </div>
  )

  if (viewing) {
    return <ProfileView player={viewing} cardPool={cardPool} myScore={myScore} myGold={myGold} myForgePoints={myForgePoints} ranks={ranks} onBack={() => setViewing(null)} />;
  }

  return (
    <PanelWrapper>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ color: theme.gold, fontWeight: 900, fontSize: 20 }}>{t('lb_title')}</div>
          {!inline && <button onClick={onClose} style={{ background: '#ffffff22', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', fontSize: 15, cursor: 'pointer' }}>✕</button>}
        </div>
        <div style={{ fontSize: 10, color: '#666', marginBottom: 12, fontStyle: 'italic' }}>🔄 {t('lb_score_refresh')}</div>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder={t('lb_search')}
          style={{ width: '100%', boxSizing: 'border-box', background: theme.bgInput, border: `1px solid ${theme.border}`, borderRadius: 10, color: theme.textPrimary, padding: '7px 12px', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 13, outline: 'none', marginBottom: 14 }}/>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: theme.overlay }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(90deg,#ffffff08,#ffffff16,#ffffff08)', backgroundSize: '400px 100%', animation: `shimmer 1.4s ${i * 0.06}s infinite`, flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ height: 12, width: `${50 + (i % 4) * 12}%`, borderRadius: 6, background: 'linear-gradient(90deg,#ffffff08,#ffffff16,#ffffff08)', backgroundSize: '400px 100%', animation: `shimmer 1.4s ${i * 0.06}s infinite` }} />
                  <div style={{ height: 9, width: '28%', borderRadius: 6, background: 'linear-gradient(90deg,#ffffff05,#ffffff0e,#ffffff05)', backgroundSize: '400px 100%', animation: `shimmer 1.4s ${i * 0.06 + 0.1}s infinite` }} />
                </div>
                <div style={{ width: 38, height: 12, borderRadius: 6, background: 'linear-gradient(90deg,#ffffff05,#ffffff0e,#ffffff05)', backgroundSize: '400px 100%', animation: `shimmer 1.4s ${i * 0.06}s infinite` }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {players.map((p, i) => {
              const rank = page * PG + i;
              return (
                <div key={p.id || p.pseudo} onClick={p.isMe ? undefined : () => setViewing(p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, background: p.isMe ? 'linear-gradient(135deg,#f9ca2415,#e8439315)' : theme.overlay, border: p.isMe ? '1.5px solid #f9ca2444' : `1.5px solid ${theme.border}`, borderRadius: 11, padding: '9px 13px', cursor: p.isMe ? 'default' : 'pointer', transition: 'transform .12s' }}
                  onMouseEnter={e => { if (!p.isMe) e.currentTarget.style.transform = 'translateX(4px)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}>
                  <div style={{ fontWeight: 900, fontSize: 16, width: 26, textAlign: 'center' }}>{medal[rank] || `#${rank + 1}`}</div>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: p.isMe ? 'linear-gradient(135deg,#f9ca24,#e17055)' : 'linear-gradient(135deg,#6c5ce7,#a29bfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                    {(p.pseudo || p.name || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: 13 }}>
                      <PseudoDisplay pseudo={(p.pseudo||p.name)+(p.isMe?` ${t('lb_you')}`:'')} score={p.score||0} ranks={ranks} style={{ color: p.isMe ? theme.gold : theme.textPrimary }}/>
                    </div>
                    <div style={{ fontSize: 10, color: theme.textMuted }}>{p.score ?? '—'} pts · 🃏 {p.card_count ?? '—'} · 💰 {p.gold ?? '—'} G</div>
                  </div>
                  <div style={{ color: '#888', fontSize: 12 }}>→</div>
                </div>
              );
            })}
          </div>
        )}

        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ background: page === 0 ? '#222' : '#ffffff22', border: 'none', color: page === 0 ? '#444' : '#fff', padding: '5px 13px', borderRadius: 50, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 11, cursor: page === 0 ? 'default' : 'pointer' }}>{t('lb_prev')}</button>
            <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700 }}>Page {page + 1}/{pages}</span>
            <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page === pages - 1} style={{ background: page === pages - 1 ? '#222' : '#ffffff22', border: 'none', color: page === pages - 1 ? '#444' : '#fff', padding: '5px 13px', borderRadius: 50, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 11, cursor: page === pages - 1 ? 'default' : 'pointer' }}>{t('lb_next')}</button>
          </div>
        )}
    </PanelWrapper>
  );
}
