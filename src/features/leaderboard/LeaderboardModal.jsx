import { useState, useEffect, useRef } from 'react';
import { useT } from '../../i18n/translations.js';
import { useTheme } from '../../ThemeContext.jsx';
import { RC } from '../../data/cards.js';
import { apiGetLeaderboard, apiGetUserCollection } from '../../services/api.js';
import Card from '../../components/Card.jsx';
import { BackToTop } from '../../components/CollectionScroll.jsx';
import PseudoDisplay from '../../components/PseudoDisplay.jsx';
import Avatar from '../../components/Avatar.jsx';
import { getRank, rankCC } from '../../utils/rankUtils.js';
import { countOwnedUnique } from '../../utils/gameUtils.js';
import { DEFAULT_RANKS } from '../../data/constants.js';

// ─── Fiche joueur ─────────────────────────────────────────────────────────────
function ProfileView({ player, cardPool, myScore, myGold, myForgePoints, ranks, scoreRules, shinyScoreRules, onBack }) {
  const { t } = useT();
  const { theme } = useTheme();
  const [col,      setCol]      = useState(null);  // { cardId: qty }
  const [shinyCol, setShinyCol] = useState(null);  // { cardId: qty }
  const [loading, setLoading] = useState(true);
  const [showCol, setShowCol] = useState(false);
  const [showScoreDetail, setShowScoreDetail] = useState(true);

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

  const shinyCards  = shinyCol ? countOwnedUnique(shinyCol) : null;
  // Geocoins = collection normale uniquement (achievements inclus), shinies comptés
  // à part — cohérent avec card_count du classement et le compteur du profil.
  const uniqueCards = col ? countOwnedUnique(col) : null;

  const score       = player.isMe ? (myScore ?? player.score ?? 0) : (player.score ?? 0);
  const gold        = player.isMe ? (myGold  ?? player.gold  ?? 0) : (player.gold  ?? 0);
  const forgePoints = player.isMe ? (myForgePoints ?? 0) : (player.forge_points ?? 0);

  const sortedRanks = [...(ranks || DEFAULT_RANKS)].sort((a, b) => a.min - b.min);
  const rank     = getRank(score, ranks);
  const { c1, c2 } = rankCC(rank);
  const nextRank = sortedRanks.find(r => r.min > score);
  const pct      = nextRank ? Math.min(100, Math.round((score / nextRank.min) * 100)) : 100;

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

  // Détail des points par rareté (même logique que le détail de son propre profil)
  const W  = scoreRules      || { commun: 1, rare: 3, épique: 7, légendaire: 20 };
  const SW = shinyScoreRules || { commun: 2, rare: 6, épique: 14, légendaire: 40 };
  const RARITIES = ['légendaire', 'épique', 'rare', 'commun'];
  const scoreRows = RARITIES.map(r => {
    const normal = Object.entries(col || {}).filter(([id, n]) => n > 0 && cardPool.find(c => c.id === +id)?.rarity === r).length;
    const sh     = Object.entries(shinyCol || {}).filter(([id, n]) => n > 0 && cardPool.find(c => c.id === +id)?.rarity === r).length;
    return { r, normal, shiny: sh, pts: W[r], shinyPts: SW[r] ?? W[r] * 2 };
  }).filter(row => row.normal > 0 || row.shiny > 0);
  const rarityLabels = { commun: t('rarity_commun'), rare: t('rarity_rare'), épique: t('rarity_epique'), légendaire: t('rarity_legendaire') };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000c', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 700, backdropFilter: 'blur(6px)' }}>
      <style>{`@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}`}</style>
      <div style={{ background: `linear-gradient(135deg,${theme.bgSurface},${theme.bgElevated})`, borderRadius: 22, width: showCol ? 'min(96vw,860px)' : 'min(96vw,360px)', maxHeight: 'calc(100dvh - 100px)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px #000a', border: `1.5px solid ${theme.borderLight}`, fontFamily: "'Nunito',sans-serif", transition: 'width .3s', position: 'relative' }}>
        {/* Croix épinglée (revient à la liste du classement), toujours visible au scroll */}
        <button onClick={onBack} style={{ position: 'absolute', top: 14, right: 14, zIndex: 5, background: '#000000aa', border: `1px solid ${theme.border}`, color: '#fff', width: 32, height: 32, borderRadius: '50%', fontSize: 15, cursor: 'pointer', fontWeight: 900 }}>✕</button>
        <div style={{ overflowY: 'auto', minHeight: 0, WebkitOverflowScrolling: 'touch', padding: 22 }}>

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
                <Avatar pseudo={player.pseudo} avatarUrl={player.geocaching_avatar_url}
                  verified={player.geocaching_verified} size={48}
                  gradient={`linear-gradient(135deg,${c1},${c2})`} glow={c1} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 16, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <PseudoDisplay pseudo={player.pseudo + (player.isMe ? ` ${t('lb_you')}` : '')} score={score} ranks={ranks} style={{ color: theme.textPrimary }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: c1 }}>{rank?.label}</span>
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 10 }}>
                <div style={{ background: theme.overlayMd, borderRadius: 8, padding: '6px 2px', textAlign: 'center' }}>
                  <div style={{ fontSize: 12 }}>🃏</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
                    <span style={{ fontWeight: 900, fontSize: 12, color: theme.textPrimary, lineHeight: 1.2 }}>{uniqueCards ?? '—'}</span>
                    {shinyCards > 0 && <span style={{ fontWeight: 800, fontSize: 9, color: '#f9ca24', lineHeight: 1.2 }}>✨{shinyCards}</span>}
                  </div>
                  <div style={{ fontSize: 7, color: theme.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .2 }}>{t('stat_geocoins')}</div>
                </div>
                {[
                  { icon: '💰', value: gold,        label: t('stat_gold') },
                  { icon: '🔨', value: forgePoints, label: t('stat_forge') },
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
                    <span onClick={() => setShowScoreDetail(v => !v)} style={{ fontWeight: 700, cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>{score}/{nextRank.min}</span>
                  </div>
                  <div style={{ background: theme.overlayMd, borderRadius: 50, height: 5, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 50, background: `linear-gradient(90deg,${c1},${c2})`, transition: 'width .5s' }} />
                  </div>
                </>
              ) : (
                <div onClick={() => setShowScoreDetail(v => !v)} style={{ fontSize: 11, fontWeight: 800, color: c1, textAlign: 'center', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>{t('rank_max')} · {score} pts</div>
              )}

              {/* Détail des points par rareté */}
              {showScoreDetail && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${theme.border}` }}>
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, color: theme.textMuted, marginBottom: 8 }}>{t('score_detail_title')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {scoreRows.map(({ r, normal, shiny, pts, shinyPts }) => (
                      <div key={r}>
                        {normal > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: theme.overlayMd, borderRadius: 8 }}>
                            <span style={{ fontSize: 13, color: theme.textPrimary, fontWeight: 700 }}>{normal} × {rarityLabels[r]}</span>
                            <span style={{ fontSize: 13, color: theme.gold, fontWeight: 900 }}>+{normal * pts} pts</span>
                          </div>
                        )}
                        {shiny > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: theme.overlayMd, borderRadius: 8, marginTop: normal > 0 ? 4 : 0 }}>
                            <span style={{ fontSize: 13, color: theme.textPrimary, fontWeight: 700 }}>{shiny} × {rarityLabels[r]} ✨</span>
                            <span style={{ fontSize: 13, color: theme.gold, fontWeight: 900 }}>+{shiny * shinyPts} pts</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: theme.textPrimary }}>{t('score_detail_total')}</span>
                    <span style={{ fontSize: 18, fontWeight: 900, color: c1 }}>{score} pts</span>
                  </div>
                </div>
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
    </div>
  );
}

// ─── Leaderboard Modal ────────────────────────────────────────────────────────
export default function LeaderboardModal({ myCollection, myShinyCollection, myPseudo, myId, myScore, myGold, myForgePoints, cardPool, ranks, scoreRules, shinyScoreRules, onClose, inline = false }) {
  const { t } = useT();
  const { theme } = useTheme();
  const [players, setPlayers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);     // premier chargement / nouvelle recherche
  const [loadingMore, setLoadingMore] = useState(false); // page suivante en cours d'ajout
  const [viewing, setViewing] = useState(null);
  const [search, setSearch] = useState('');
  const sentinelRef = useRef(null);

  // Comptés séparément, comme côté serveur : geocoins normaux d'un côté, shiny de l'autre.
  const myCardCount  = Object.keys(myCollection || {}).filter(k => (myCollection[k] || 0) > 0).length;
  const myShinyCount = Object.keys(myShinyCollection || {}).filter(k => (myShinyCollection[k] || 0) > 0).length;

  // Défilement continu : les pages serveur s'ACCUMULENT au lieu de se remplacer.
  // page 0 (ou nouvelle recherche) → remplace ; pages suivantes → ajoutées à la
  // suite (dédoublonnées par id). L'entrée « moi » hors page reste toujours en fin.
  const playersRef = useRef([]);
  useEffect(() => { playersRef.current = players }, [players]);
  useEffect(() => {
    if (page === 0) setLoading(true); else setLoadingMore(true);
    apiGetLeaderboard(page, search || undefined).then(({ data }) => {
      if (data?.players) {
        const decorate = p => p.id === myId ? { ...p, isMe: true, score: myScore ?? p.score, card_count: myCardCount, shiny_count: myShinyCount, gold: myGold ?? p.gold, forge_points: myForgePoints ?? p.forge_points, col: myCollection, shinyCol: myShinyCollection } : p;
        const incoming = data.players.map(decorate);
        const base = page === 0 ? [] : playersRef.current.filter(p => !p.isMeSeparate);
        const seen = new Set(base.map(p => p.id));
        const fresh = incoming.filter(p => !seen.has(p.id));
        let list = [...base, ...fresh];
        if (myId && !list.find(p => p.isMe)) {
          list = [...list, { id: myId, pseudo: myPseudo || 'Moi', isMe: true, isMeSeparate: true, score: myScore ?? 0, card_count: myCardCount, shiny_count: myShinyCount, gold: myGold ?? 0, forge_points: myForgePoints ?? 0, col: myCollection, shinyCol: myShinyCollection }];
        }
        setPlayers(list);
        const nonSep = list.filter(p => !p.isMeSeparate).length;
        // Garde anti-boucle : une page suivante qui n'apporte AUCUN joueur nouveau
        // (fin réelle de liste, total serveur surestimé) clôt le défilement au lieu
        // de re-déclencher la sentinelle indéfiniment.
        setTotal(page > 0 && fresh.length === 0 ? nonSep : (data.total || nonSep));
      }
      setLoading(false); setLoadingMore(false);
    });
  }, [page, search]);

  const loadedCount = players.filter(p => !p.isMeSeparate).length;
  const hasMore = loadedCount < total;

  // Sentinelle en bas de liste → charge la page suivante avant d'y arriver.
  useEffect(() => {
    if (!hasMore || loading || loadingMore || viewing || !sentinelRef.current) return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) setPage(p => p + 1);
    }, { rootMargin: '500px 0px' });
    io.observe(sentinelRef.current);
    return () => io.disconnect();
  }, [hasMore, loading, loadingMore, viewing, players.length]);

  const medal = ['🥇', '🥈', '🥉'];

  if (viewing) {
    return <ProfileView player={viewing} cardPool={cardPool} myScore={myScore} myGold={myGold} myForgePoints={myForgePoints} ranks={ranks} scoreRules={scoreRules} shinyScoreRules={shinyScoreRules} onBack={() => setViewing(null)} />;
  }

  const content = (
    <>
        {/* Haut figé (inline) : titre + recherche restent visibles pendant le
            défilement de la liste, calés sous le header de l'app. */}
        <div style={inline ? { position: 'sticky', top: 'var(--header-h, 48px)', zIndex: 50, background: theme.bgMain, boxShadow: '0 10px 14px -12px #000a', marginBottom: 18 } : undefined}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ color: theme.gold, fontWeight: 900, fontSize: 20 }}>{t('lb_title')}</div>
            {!inline && <button onClick={onClose} style={{ background: '#ffffff22', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', fontSize: 15, cursor: 'pointer' }}>✕</button>}
          </div>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder={t('lb_search')}
            style={{ width: '100%', boxSizing: 'border-box', background: theme.bgInput, border: `1px solid ${theme.border}`, borderRadius: 10, color: theme.textPrimary, padding: '7px 12px', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 13, outline: 'none', marginBottom: 14 }}/>
        </div>

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
              const isSeparate = p.isMeSeparate;
              // Liste accumulée depuis la page 0 → l'index global EST le rang.
              const rank = p.rank !== undefined ? p.rank : i;
              return (
                <div key={p.id || p.pseudo}>
                  {isSeparate && <div style={{ textAlign: 'center', fontSize: 10, color: theme.textMuted, padding: '4px 0 2px', letterSpacing: .5 }}>· · ·</div>}
                  <div onClick={() => setViewing(p)}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, background: p.isMe ? 'linear-gradient(135deg,#f9ca2415,#e8439315)' : theme.overlay, border: p.isMe ? '1.5px solid #f9ca2444' : `1.5px solid ${theme.border}`, borderRadius: 11, padding: '9px 13px', cursor: 'pointer', transition: 'transform .12s' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(4px)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}>
                    {/* minWidth (et non width fixe) : au-delà de 2 chiffres, « #147 » débordait sur l'avatar */}
                    <div style={{ fontWeight: 900, fontSize: rank >= 99 ? 13 : 16, minWidth: 26, flexShrink: 0, textAlign: 'center' }}>{isSeparate ? '—' : (medal[rank] || `#${rank + 1}`)}</div>
                    <Avatar pseudo={p.pseudo || p.name} avatarUrl={p.geocaching_avatar_url}
                      verified={p.geocaching_verified} size={32}
                      gradient={p.isMe ? 'linear-gradient(135deg,#f9ca24,#e17055)' : 'linear-gradient(135deg,#6c5ce7,#a29bfe)'} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 13 }}>
                        <PseudoDisplay pseudo={(p.pseudo||p.name)+(p.isMe?` ${t('lb_you')}`:'')} score={p.score||0} ranks={ranks} style={{ color: p.isMe ? theme.gold : theme.textPrimary }}/>
                      </div>
                    </div>
                    <div style={{ width: 64, flexShrink: 0, textAlign: 'right' }}>
                      <div style={{ fontWeight: 900, fontSize: 16, color: theme.gold, lineHeight: 1.1 }}>{p.score ?? '—'}</div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: .3 }}>pts</div>
                    </div>
                    <div style={{ width: 64, flexShrink: 0, textAlign: 'right' }}>
                      <div style={{ fontWeight: 900, fontSize: 15, color: theme.textSecondary, lineHeight: 1.1 }}>
                        🃏 {p.card_count ?? '—'}
                      </div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: p.shiny_count > 0 ? '#f9ca24' : theme.textMuted, textTransform: 'uppercase', letterSpacing: .3 }}>
                        {p.shiny_count > 0 ? `✨ ${p.shiny_count}` : 'geocoins'}
                      </div>
                    </div>
                    <div style={{ width: 12, flexShrink: 0, color: '#888', fontSize: 12, textAlign: 'center' }}>→</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sentinelle du défilement continu — la page suivante se charge avant
            d'arriver en bas ; les points servent d'indicateur de chargement. */}
        {hasMore && !loading && (
          <div ref={sentinelRef} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '16px 0' }}>
            {[0, 0.18, 0.36].map(d => (
              <div key={d} style={{ width: 8, height: 8, borderRadius: '50%', background: theme.gold, animation: `dotBounce 0.9s ${d}s ease-in-out infinite` }} />
            ))}
          </div>
        )}

        {!loading && (
          <div style={{ textAlign: 'center', fontSize: 9, color: theme.textMuted, marginTop: 10, opacity: .7 }}>
            {!hasMore && <span style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>({total})</span>}
            🕐 {t('lb_refresh_note')}
          </div>
        )}

        {inline && <BackToTop theme={theme} isMobile={typeof window !== 'undefined' && window.innerWidth < 640} />}
    </>
  );

  if (inline) return <div style={{ fontFamily: "'Nunito',sans-serif" }}>{content}</div>;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000c', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 700, backdropFilter: 'blur(6px)' }}>
      <div style={{ background: `linear-gradient(135deg,${theme.bgSurface},${theme.bgElevated})`, borderRadius: 22, padding: 22, width: 'min(96vw,500px)', maxHeight: 'calc(100dvh - 100px)', overflowY: 'auto', boxShadow: '0 24px 80px #000a', border: `1.5px solid ${theme.borderLight}`, fontFamily: "'Nunito',sans-serif" }}>
        {content}
      </div>
    </div>
  );
}
