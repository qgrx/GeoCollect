import { useState, useEffect } from 'react';
import { useT } from '../../i18n/translations.js';
import { useTheme } from '../../ThemeContext.jsx';
import { RC } from '../../data/cards.js';
import { collScore } from '../../utils/gameUtils.js';
import { apiGetLeaderboard, apiGetUserCollection } from '../../services/api.js';
import Card from '../../components/Card.jsx';
import PseudoDisplay from '../../components/PseudoDisplay.jsx';

const SCORES = { légendaire: 20, épique: 7, rare: 3, commun: 1 };

function scoreFromCollection(col, cardPool) {
  return Object.entries(col || {}).reduce((s, [id, n]) => {
    if (!n) return s;
    const card = cardPool.find(c => c.id === +id);
    return s + (card ? (SCORES[card.rarity] || 1) : 1);
  }, 0);
}

// ─── Vue collection d'un joueur ───────────────────────────────────────────────
function ProfileView({ player, cardPool, myPseudo, onBack }) {
  const { t } = useT();
  const { theme } = useTheme();
  const [col, setCol] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (player.isMe) { setCol(player.col); setLoading(false); return; }
    apiGetUserCollection(player.id).then(({ data }) => {
      setCol(data?.collection || {});
      setLoading(false);
    });
  }, [player.id]);

  const cards = col ? Object.entries(col).filter(([, v]) => v > 0)
    .map(([id, cnt]) => {
      const card = cardPool.find(c => c.id === +id) || { id: +id, name: `#${id}`, type: '?', rarity: 'commun', image: null }
      return { card, cnt }
    })
    .sort((a, b) => (RC[b.card.rarity]?.order ?? 9) - (RC[a.card.rarity]?.order ?? 9))
    : [];

  const score = col ? scoreFromCollection(col, cardPool) : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000c', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 700, backdropFilter: 'blur(6px)' }}>
      <div style={{ background: `linear-gradient(135deg,${theme.bgSurface},${theme.bgElevated})`, borderRadius: 22, padding: 22, width: 'min(96vw,860px)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px #000a', border: `1.5px solid ${theme.borderLight}`, fontFamily: "'Nunito',sans-serif" }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
          <button onClick={onBack} style={{ background: '#ffffff22', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', fontSize: 15, cursor: 'pointer' }}>←</button>
          <div style={{ color: theme.gold, fontWeight: 900, fontSize: 18 }}>
            Collection de {player.pseudo || player.name}{player.isMe && ' (toi)'}
          </div>
          {!loading && (
            <div style={{ marginLeft: 'auto', background: theme.bgElevated, borderRadius: 50, padding: '2px 11px', fontSize: 12, fontWeight: 800, color: theme.textSecondary }}>
              Score : <span style={{ color: theme.gold }}>{score}</span>
            </div>
          )}
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#888', padding: '32px 0', fontSize: 13 }}>{t('lb_loading')}</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
              {cards.map(({ card, cnt }) => <Card key={card.id} card={card} count={cnt} small />)}
            </div>
            {cards.length === 0 && <div style={{ color: '#888', textAlign: 'center', padding: '18px 0' }}>{t('lb_empty')}</div>}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Leaderboard Modal ────────────────────────────────────────────────────────
export default function LeaderboardModal({ myCollection, myPseudo, myId, cardPool, ranks, onClose, inline = false }) {
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
        let list = data.players.map(p => ({ ...p, isMe: p.id === myId }));
        if (page === 0 && myId && !list.find(p => p.isMe)) {
          const me = { id: myId, pseudo: myPseudo || 'Moi', isMe: true, col: myCollection };
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
    return <ProfileView player={viewing} cardPool={cardPool} myPseudo={myPseudo} onBack={() => setViewing(null)} />;
  }

  return (
    <PanelWrapper>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ color: theme.gold, fontWeight: 900, fontSize: 20 }}>{t('lb_title')}</div>
          {!inline && <button onClick={onClose} style={{ background: '#ffffff22', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', fontSize: 15, cursor: 'pointer' }}>✕</button>}
        </div>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder={t('lb_search')}
          style={{ width: '100%', boxSizing: 'border-box', background: theme.bgInput, border: `1px solid ${theme.border}`, borderRadius: 10, color: theme.textPrimary, padding: '7px 12px', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 13, outline: 'none', marginBottom: 14 }}/>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#888', padding: '32px 0', fontSize: 13 }}>{t('lb_loading')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {players.map((p, i) => {
              const rank = page * PG + i;
              return (
                <div key={p.id || p.pseudo} onClick={() => setViewing(p.isMe ? { ...p, col: myCollection } : p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, background: p.isMe ? 'linear-gradient(135deg,#f9ca2415,#e8439315)' : theme.overlay, border: p.isMe ? '1.5px solid #f9ca2444' : `1.5px solid ${theme.border}`, borderRadius: 11, padding: '9px 13px', cursor: 'pointer', transition: 'transform .12s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                  <div style={{ fontWeight: 900, fontSize: 16, width: 26, textAlign: 'center' }}>{medal[rank] || `#${rank + 1}`}</div>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: p.isMe ? 'linear-gradient(135deg,#f9ca24,#e17055)' : 'linear-gradient(135deg,#6c5ce7,#a29bfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                    {(p.pseudo || p.name || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: 13 }}>
                      <PseudoDisplay pseudo={(p.pseudo||p.name)+(p.isMe?` ${t('lb_you')}`:'')} score={p.score||0} ranks={ranks} style={{ color: p.isMe ? theme.gold : theme.textPrimary }}/>
                    </div>
                    <div style={{ fontSize: 10, color: theme.textMuted }}>{p.gold ?? '—'} G · {p.streak ?? 0} 🔥</div>
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 14, color: theme.gold }}>{p.score ?? '—'} pts</div>
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
