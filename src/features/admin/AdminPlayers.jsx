import { useState, useEffect, useMemo } from 'react';
import { INP, BTN } from '../../utils/styles.js';
import { useT } from '../../i18n/translations.js';
import { getRankLabel } from '../../utils/rankUtils.js';
import { cardCC } from '../../data/cards.js';
import { supabase } from '../../lib/supabase.js';
import {
  apiAdminSetCanSell, apiAdminReactivate, apiAdminSetGold, apiAdminSetForgePoints, apiAdminSetPlayerLimits, apiAdminSetWeeklyMax,
  apiAdminGetPlayerCollection, apiAdminGiveCard, apiAdminTakeCard, apiAdminSetPseudo,
  apiAdminUndoForgeShiny,
} from '../../services/api.js';
import AdminCheatReport from './AdminCheatReport.jsx';
import AdminPlayerSpending from './AdminPlayerSpending.jsx';

// Code pays ISO (FR) → emoji drapeau (🇫🇷) via les indicateurs régionaux Unicode.
const flagEmoji = cc => cc ? cc.toUpperCase().replace(/./g, ch => String.fromCodePoint(ch.charCodeAt(0) + 127397)) : '';

export default function AdminPlayers({ cardPool, limEdit, onBanIP, setTab, setMsg }) {
  const { t, lang } = useT();
  const [page, setPage]               = useState(0);
  const [search, setSearch]           = useState('');
  const [playerView, setPlayerView]   = useState(null);
  const [canSellOverrides, setCanSellOverrides] = useState({});
  const [playerGoldEdit, setPlayerGoldEdit]     = useState('');
  const [playerForgeEdit, setPlayerForgeEdit]   = useState('');
  const [playerPseudoEdit, setPlayerPseudoEdit] = useState('');
  const [playerLimitsEdit, setPlayerLimitsEdit] = useState({});
  const [playerCollection, setPlayerCollection] = useState(null);
  const [playerShinyCollection, setPlayerShinyCollection] = useState(null);
  const [playerAchievements, setPlayerAchievements] = useState(null);  // array of achievement defs + progress
  const [playerScore, setPlayerScore]           = useState(null);
  const [cardSearch, setCardSearch]             = useState('');
  const [shinyMode, setShinyMode]               = useState(false);
  const [cardQty, setCardQty]                   = useState(1);
  const [playersData, setPlayersData] = useState({ players: [], total: 0, loading: false });

  // ── Chargement liste joueurs ────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    setPlayersData(prev => ({ ...prev, loading: true }));
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      fetch(`${import.meta.env.VITE_API_URL}/api/admin/players?page=${page}&q=${encodeURIComponent(search)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(d => {
          if (!mounted) return;
          if (d.players) {
            const mapped = d.players.map(p => ({
              ...p,
              name: p.pseudo || p.name || '?',
              joined: p.joined_at ? new Date(p.joined_at).toLocaleDateString('fr-FR') : '?',
              lastSeen: p.last_seen_at ? new Date(p.last_seen_at).toLocaleDateString('fr-FR') : '?',
              ip: p.ip || 'Inconnue',
              geo: p.geo ? `${flagEmoji(p.geo_cc)} ${p.geo}`.trim() : null,
              ua: p.ua || 'Inconnu',
            }));
            setPlayersData({ players: mapped, total: d.total || 0, loading: false });
          } else {
            setPlayersData(prev => ({ ...prev, loading: false }));
          }
        })
        .catch(() => { if (mounted) setPlayersData(prev => ({ ...prev, loading: false })); });
    });
    return () => { mounted = false; };
  }, [page, search]);

  // ── Auto-chargement collection quand on ouvre un joueur ────────────────────
  useEffect(() => {
    if (!playerView) { setPlayerCollection(null); setPlayerShinyCollection(null); setPlayerAchievements(null); setPlayerScore(null); return; }
    setPlayerScore(playerView.score ?? null);
    setPlayerCollection(null);
    setPlayerShinyCollection(null);
    setPlayerAchievements(null);
    apiAdminGetPlayerCollection(playerView.id).then(({ data }) => {
      setPlayerCollection(data?.collection || []);
      setPlayerShinyCollection(data?.shiny_collection || []);
      setPlayerAchievements(data?.achievements || []);
    });
  }, [playerView?.id]);

  const pages = Math.ceil(playersData.total / 10);
  const pagPl = playersData.players;

  // ── Cartes filtrées pour la grille inventaire ───────────────────────────────
  const inventoryCards = useMemo(() => {
    const base = cardPool.filter(c => !c.type?.toLowerCase().includes('achievement'));
    if (!cardSearch.trim()) return base;
    const q = cardSearch.toLowerCase();
    return base.filter(c => c.name.toLowerCase().includes(q));
  }, [cardPool, cardSearch]);

  const TIER_LABELS = ['', 'Commun', 'Rare', 'Épique', 'Légendaire'];
  const TIER_COLORS = ['', '#a8bfcf', '#3498db', '#9b59b6', '#f39c12'];

  // Ajoute (sign > 0) ou retire (sign < 0) `cardQty` exemplaires d'une carte (normale ou shiny selon shinyMode)
  async function handleAdjustCard(card, sign) {
    const collection = shinyMode ? playerShinyCollection : playerCollection;
    const setCollection = shinyMode ? setPlayerShinyCollection : setPlayerCollection;
    if (!collection) return;
    const owned = collection.find(x => x.card_id === card.id);
    const qty = Math.max(1, parseInt(cardQty) || 1);

    if (sign > 0) {
      setCollection(prev => {
        const ex = prev.find(x => x.card_id === card.id);
        return ex ? prev.map(x => x.card_id === card.id ? { ...x, quantity: x.quantity + qty } : x)
                  : [...prev, { card_id: card.id, quantity: qty, cards: card }];
      });
      const { data, error } = await apiAdminGiveCard(playerView.id, card.id, qty, shinyMode);
      if (error) {
        setCollection(prev => {
          const ex = prev.find(x => x.card_id === card.id);
          if (!ex) return prev;
          return ex.quantity <= qty ? prev.filter(x => x.card_id !== card.id)
                                     : prev.map(x => x.card_id === card.id ? { ...x, quantity: x.quantity - qty } : x);
        });
        setMsg('❌ ' + error); return;
      }
      if (data?.score != null) setPlayerScore(data.score);
    } else {
      if (!owned) return;
      const removeQty = Math.min(qty, owned.quantity);
      setCollection(prev => owned.quantity <= removeQty
        ? prev.filter(x => x.card_id !== card.id)
        : prev.map(x => x.card_id === card.id ? { ...x, quantity: x.quantity - removeQty } : x));
      const { data, error } = await apiAdminTakeCard(playerView.id, card.id, removeQty, shinyMode);
      if (error) {
        setCollection(prev => {
          const ex = prev.find(x => x.card_id === card.id);
          return ex ? prev.map(x => x.card_id === card.id ? { ...x, quantity: x.quantity + removeQty } : x)
                    : [...prev, { card_id: card.id, quantity: removeQty, cards: card }];
        });
        setMsg('❌ ' + error); return;
      }
      if (data?.score != null) setPlayerScore(data.score);
    }
  }

  function closeView() {
    setPlayerView(null); setPlayerGoldEdit(''); setPlayerForgeEdit(''); setCardSearch('');
    setShinyMode(false); setCardQty(1);
  }

  // ── Vue détail joueur ───────────────────────────────────────────────────────
  if (playerView) return (
    <div>
      <button onClick={closeView} style={{ background: 'none', border: 'none', color: '#a8bfcf', fontSize: 12, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", marginBottom: 12 }}>← Retour</button>
      <div style={{ fontWeight: 900, color: '#e74c3c', fontSize: 15, marginBottom: 14 }}>Fiche de {playerView.name}</div>

      {/* Infos */}
      {[['Email', playerView.email], ['IP', playerView.ip], ['Localisation', playerView.geo || 'Inconnue'], ['UA', playerView.ua], ['Inscrit', playerView.joined], ['Dernière co.', playerView.lastSeen], ['Statut', playerView.status]].map(([lbl, val]) => (
        <div key={lbl} style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: '#a8bfcf', width: 100, flexShrink: 0 }}>{lbl}</div>
          <div style={{ fontSize: 12, color: '#fff', fontWeight: 700, fontFamily: lbl === 'IP' || lbl === 'UA' ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{val}</div>
        </div>
      ))}

      {/* Anti-triche — stats de triche du joueur */}
      <AdminCheatReport playerId={playerView.id} />

      {/* Actions */}
      <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={async () => {
          const current = canSellOverrides[playerView.id] ?? playerView.can_sell; const next = current === false;
          setCanSellOverrides(prev => ({ ...prev, [playerView.id]: next }));
          setPlayerView({ ...playerView, can_sell: next });
          setPlayersData(prev => ({ ...prev, players: prev.players.map(x => x.id === playerView.id ? { ...x, can_sell: next } : x) }));
          const { data, error } = await apiAdminSetCanSell(playerView.id, next);
          if (error) { setCanSellOverrides(prev => ({ ...prev, [playerView.id]: current })); setPlayerView({ ...playerView, can_sell: current }); setMsg('❌ ' + error); return; }
          const actual = data?.can_sell ?? next;
          setCanSellOverrides(prev => ({ ...prev, [playerView.id]: actual }));
          setPlayerView({ ...playerView, can_sell: actual });
          setMsg(actual ? '✅ Vente autorisée.' : '⛔ Vente interdite.');
        }} style={{ ...BTN((canSellOverrides[playerView.id] ?? playerView.can_sell) === false ? 'linear-gradient(135deg,#00b894,#00cec9)' : 'linear-gradient(135deg,#e17055,#d63031)'), padding: '8px 14px', borderRadius: 9, fontSize: 12 }}>
          {(canSellOverrides[playerView.id] ?? playerView.can_sell) === false ? '✅ Autoriser la vente' : '⛔ Interdire la vente'}
        </button>
        {(playerView.status === 'supprimé' || playerView.deleted_at) && (
          <button onClick={async () => {
            let { data, error, status } = await apiAdminReactivate(playerView.id);
            // 409 = pseudo repris par un compte actif depuis la suppression → en saisir un nouveau
            if (status === 409) {
              const np = window.prompt(`${error}\n\nNouveau pseudo pour ce compte :`);
              if (np === null || !np.trim()) return;
              ({ data, error, status } = await apiAdminReactivate(playerView.id, np.trim()));
            }
            if (error) { setMsg('❌ ' + error); return; }
            setPlayerView({ ...playerView, status: data?.status ?? 'actif', deleted_at: data?.deleted_at ?? null, ...(data?.pseudo ? { name: data.pseudo } : {}) });
            setMsg('✅ Compte réactivé.');
          }} style={{ ...BTN('linear-gradient(135deg,#00b894,#00cec9)'), padding: '8px 14px', borderRadius: 9, fontSize: 12 }}>🔄 Réactiver le compte</button>
        )}
        <button onClick={async () => {
          if (!window.confirm(`Supprimer DÉFINITIVEMENT le joueur ${playerView.name} ?`)) return;
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/players/${playerView.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } });
          const d = await res.json();
          if (d.error) { setMsg('❌ ' + d.error); return; }
          setPlayersData(prev => ({ ...prev, players: prev.players.filter(x => x.id !== playerView.id), total: prev.total - 1 }));
          closeView();
          setMsg(`✅ Compte ${playerView.name} supprimé définitivement.`);
        }} style={{ ...BTN('linear-gradient(135deg,#e74c3c,#c0392b)'), padding: '8px 14px', borderRadius: 9, fontSize: 12 }}>🗑️ Supprimer définitivement</button>
      </div>

      {/* Or + Forge + Score */}
      <div style={{ marginTop: 16, background: '#ffffff08', borderRadius: 10, padding: '12px 14px', border: '1px solid #ffffff10' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, color: '#f9ca24', fontSize: 12 }}>💰 Or : {playerView.gold ?? '—'}G</span>
          <span style={{ fontWeight: 800, color: '#a29bfe', fontSize: 12 }}>🔨 Forge : {playerView.forge_points ?? '—'} pts</span>
          {playerScore != null && <span style={{ fontWeight: 800, color: '#00b894', fontSize: 12 }}>⭐ Score : {playerScore}</span>}
        </div>
        {/* Renommer le pseudo */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <input type="text" placeholder="Nouveau pseudo" value={playerPseudoEdit}
            onChange={e => setPlayerPseudoEdit(e.target.value)}
            style={{ ...INP, width: 160, fontSize: 11 }} />
          <button onClick={async () => {
            const p = playerPseudoEdit.trim();
            if (p.length < 2 || p.length > 20) { setMsg('❌ Pseudo : 2 à 20 caractères.'); return; }
            const { error } = await apiAdminSetPseudo(playerView.id, p);
            if (error) { setMsg('❌ ' + error); return; }
            setPlayerView(v => ({ ...v, name: p, pseudo: p }));
            setPlayersData(prev => ({ ...prev, players: prev.players.map(x => x.id === playerView.id ? { ...x, pseudo: p, name: p } : x) }));
            setPlayerPseudoEdit('');
            setMsg('✅ Pseudo renommé.');
          }} style={{ ...BTN('linear-gradient(135deg,#6c5ce7,#a29bfe)'), padding: '7px 14px', borderRadius: 8, fontSize: 12 }}>Renommer</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="text" inputMode="numeric" placeholder="Or" value={playerGoldEdit}
            onChange={e => setPlayerGoldEdit(e.target.value.replace(/[^0-9]/g, ''))}
            style={{ ...INP, width: 90, fontSize: 11 }} />
          <span style={{ color: '#f9ca24', fontSize: 11, fontWeight: 700 }}>G</span>
          <input type="text" inputMode="numeric" placeholder="Forge" value={playerForgeEdit}
            onChange={e => setPlayerForgeEdit(e.target.value.replace(/[^0-9]/g, ''))}
            style={{ ...INP, width: 90, fontSize: 11 }} />
          <span style={{ color: '#a29bfe', fontSize: 11, fontWeight: 700 }}>pts</span>
          <button onClick={async () => {
            const promises = [];
            if (playerGoldEdit !== '') {
              const g = +playerGoldEdit;
              if (isNaN(g) || g < 0) { setMsg('❌ Or invalide.'); return; }
              promises.push(apiAdminSetGold(playerView.id, g).then(({ error }) => {
                if (error) throw new Error(error);
                setPlayerView(v => ({ ...v, gold: g }));
                setPlayersData(prev => ({ ...prev, players: prev.players.map(x => x.id === playerView.id ? { ...x, gold: g } : x) }));
              }));
            }
            if (playerForgeEdit !== '') {
              const f = +playerForgeEdit;
              if (isNaN(f) || f < 0) { setMsg('❌ Forge invalide.'); return; }
              promises.push(apiAdminSetForgePoints(playerView.id, f).then(({ error }) => {
                if (error) throw new Error(error);
                setPlayerView(v => ({ ...v, forge_points: f }));
              }));
            }
            if (!promises.length) return;
            try {
              await Promise.all(promises);
              setPlayerGoldEdit(''); setPlayerForgeEdit('');
              setMsg('✅ Ressources mises à jour.');
            } catch (e) { setMsg('❌ ' + e.message); }
          }} style={{ ...BTN('linear-gradient(135deg,#f9ca24,#e17055)', '#1e3045'), padding: '7px 14px', borderRadius: 8, fontSize: 12 }}>Appliquer</button>
        </div>
        {/* Limites du jour (outil de test) — vide = inchangé. Les compteurs sont ancrés sur aujourd'hui. */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, paddingTop: 8, borderTop: '1px solid #ffffff10' }}>
          <span style={{ color: '#8daacc', fontSize: 10, fontWeight: 800, width: '100%' }}>⏱️ Limites du jour (vide = inchangé)</span>
          {[['daily_cards', 'geocoins/j'], ['hourly_cards', 'geocoins/h'], ['daily_gold', 'or/j'], ['daily_forge_consolation', 'PF conso/j'], ['daily_shiny', 'shiny/j']].map(([k, lbl]) => (
            <input key={k} type="text" inputMode="numeric" title={lbl} placeholder={lbl} value={playerLimitsEdit[k] ?? ''}
              onChange={e => setPlayerLimitsEdit(v => ({ ...v, [k]: e.target.value.replace(/[^0-9]/g, '') }))}
              style={{ ...INP, width: 84, fontSize: 11 }} />
          ))}
          <button onClick={async () => {
            const body = {};
            for (const [k, v] of Object.entries(playerLimitsEdit)) if (v !== '' && v != null) body[k] = +v;
            if (!Object.keys(body).length) { setMsg('❌ Aucune limite saisie.'); return; }
            const { error } = await apiAdminSetPlayerLimits(playerView.id, body);
            if (error) { setMsg('❌ ' + error); return; }
            setPlayerView(v => ({ ...v, ...body }));
            setPlayerLimitsEdit({});
            setMsg('✅ Limites du joueur mises à jour.');
          }} style={{ ...BTN('linear-gradient(135deg,#00b894,#0984e3)'), padding: '7px 14px', borderRadius: 8, fontSize: 12 }}>Appliquer les limites</button>
        </div>
        {/* Mécénat (outil de test) : forcer les plafonds hebdo d'acquisition au max → toute
            bonne réponse sur un précieux non-shiny déclenche « don ou gloire ». */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, paddingTop: 8, borderTop: '1px solid #ffffff10' }}>
          <span style={{ color: '#8daacc', fontSize: 10, fontWeight: 800, width: '100%' }}>🎁 Test mécénat — plafonds hebdo d'acquisition</span>
          <button onClick={async () => {
            const { error } = await apiAdminSetWeeklyMax(playerView.id, false);
            setMsg(error ? '❌ ' + error : '✅ Plafonds hebdo au max — le prochain précieux déclenchera le mécénat.');
          }} style={{ ...BTN('linear-gradient(135deg,#f9ca24,#e17055)', '#1e3045'), padding: '7px 14px', borderRadius: 8, fontSize: 12 }}>Mettre aux plafonds max</button>
          <button onClick={async () => {
            const { error } = await apiAdminSetWeeklyMax(playerView.id, true);
            setMsg(error ? '❌ ' + error : '✅ Compteurs hebdo remis à zéro.');
          }} style={{ ...BTN('linear-gradient(135deg,#636e72,#2d3436)'), padding: '7px 14px', borderRadius: 8, fontSize: 12 }}>Remettre à zéro</button>
        </div>
      </div>

      {/* Journal des dépenses (or + PF) */}
      <AdminPlayerSpending playerId={playerView.id} />

      {/* Inventaire complet */}
      <div style={{ marginTop: 12, background: '#ffffff08', borderRadius: 10, padding: '12px 14px', border: '1px solid #ffffff10' }}>
        {(() => {
          const collection = shinyMode ? playerShinyCollection : playerCollection;
          return (
            <>
              <div style={{ fontWeight: 800, color: '#a29bfe', fontSize: 12, marginBottom: 8 }}>
                🃏 Inventaire
                {collection && <span style={{ color: '#8daacc', fontWeight: 600, marginLeft: 8, fontSize: 11 }}>
                  {collection.length} carte{collection.length !== 1 ? 's' : ''} {shinyMode ? 'shiny ' : ''}uniques · clic = ajouter, clic droit = retirer
                </span>}
              </div>

              {!collection ? (
                <div style={{ color: '#8daacc', fontSize: 11, textAlign: 'center', padding: '14px 0' }}>Chargement…</div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    <input value={cardSearch} onChange={e => setCardSearch(e.target.value)}
                      placeholder="Filtrer les cartes…"
                      style={{ ...INP, fontSize: 11, flex: 1, minWidth: 140 }} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#8daacc', fontWeight: 700 }}>
                      Quantité
                      <input type="number" min={1} value={cardQty}
                        onChange={e => setCardQty(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ ...INP, fontSize: 11, width: 56, padding: '5px 6px' }} />
                    </label>
                    <button onClick={() => setShinyMode(s => !s)}
                      title="Basculer entre cartes normales et cartes shiny"
                      style={{
                        ...BTN(shinyMode ? 'linear-gradient(135deg,#f9ca24,#e17055)' : 'linear-gradient(135deg,#3a4a5e,#2a3648)', shinyMode ? '#1e3045' : '#a8bfcf'),
                        padding: '6px 12px', borderRadius: 8, fontSize: 11,
                      }}>
                      ✨ {shinyMode ? 'Shiny' : 'Normal'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
                    {inventoryCards.map(card => {
                      const owned = collection.find(x => x.card_id === card.id);
                      const { c1 } = cardCC(card.rarity);
                      const thumb = card.image_url_thumb || card.thumbnail || card.image_url || card.image;
                      const borderColor = owned ? (shinyMode ? '#f9ca24' : c1) : '#333';
                      return (
                        <div key={card.id}
                          onClick={() => handleAdjustCard(card, +1)}
                          onContextMenu={e => { e.preventDefault(); handleAdjustCard(card, -1); }}
                          title={`${card.name}${owned ? ` (×${owned.quantity})` : ' — non possédée'} — clic: +${cardQty}, clic droit: -${cardQty}`}
                          style={{
                            position: 'relative', width: 52, cursor: 'pointer',
                            opacity: owned ? 1 : 0.28,
                            filter: owned ? 'none' : 'grayscale(1)',
                            transition: 'opacity .15s, transform .1s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.filter = 'none'; e.currentTarget.style.zIndex = '10'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = owned ? '1' : '0.28'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.filter = owned ? 'none' : 'grayscale(1)'; e.currentTarget.style.zIndex = '1'; }}
                        >
                          <div style={{
                            width: 52, height: 68, borderRadius: 7, overflow: 'hidden',
                            border: `2px solid ${borderColor}`,
                            boxShadow: owned && shinyMode ? '0 0 8px #f9ca2466' : 'none',
                            background: thumb ? 'transparent' : `linear-gradient(135deg,${c1}44,${c1}22)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {thumb
                              ? <img src={thumb} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              : <span style={{ fontSize: 16, fontWeight: 900, color: c1 }}>{card.name[0]}</span>
                            }
                          </div>
                          {owned && owned.quantity > 1 && (
                            <div style={{ position: 'absolute', top: 2, right: 2, background: '#0009', color: '#fff', fontSize: 8, fontWeight: 900, borderRadius: 4, padding: '1px 3px', lineHeight: 1 }}>
                              ×{owned.quantity}
                            </div>
                          )}
                          <div style={{ fontSize: 7, color: owned ? '#ccc' : '#555', textAlign: 'center', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>
                            {card.name}
                          </div>
                        </div>
                      );
                    })}
                    {inventoryCards.length === 0 && <div style={{ fontSize: 11, color: '#a8bfcf' }}>Aucune carte trouvée.</div>}
                  </div>
                </>
              )}
            </>
          );
        })()}
      </div>

      {/* Annuler forge shiny */}
      {playerShinyCollection && playerShinyCollection.length > 0 && (
        <div style={{ marginTop: 12, background: '#ffffff08', borderRadius: 10, padding: '12px 14px', border: '1px solid #f9ca2433' }}>
          <div style={{ fontWeight: 800, color: '#f9ca24', fontSize: 12, marginBottom: 8 }}>
            ✨ Annuler une forge shiny
            <span style={{ color: '#8daacc', fontWeight: 600, marginLeft: 8, fontSize: 11 }}>
              Retire le shiny et rembourse les PF
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {playerShinyCollection.map(sc => {
              const card = cardPool.find(c => c.id === sc.card_id);
              if (!card) return null;
              return (
                <button key={sc.card_id}
                  onClick={async () => {
                    if (!window.confirm(`Annuler la forge shiny de « ${card.name} » pour ${playerView.name} ? Le shiny sera retiré et les PF remboursés.`)) return;
                    const { data, error } = await apiAdminUndoForgeShiny(playerView.id, sc.card_id);
                    if (error) { setMsg('❌ ' + error); return; }
                    setPlayerShinyCollection(prev => {
                      if (sc.quantity <= 1) return prev.filter(x => x.card_id !== sc.card_id);
                      return prev.map(x => x.card_id === sc.card_id ? { ...x, quantity: x.quantity - 1 } : x);
                    });
                    if (data?.forge_points != null) setPlayerView(v => ({ ...v, forge_points: data.forge_points }));
                    if (data?.score != null) setPlayerScore(data.score);
                    setMsg(`✅ Shiny « ${card.name} » retiré, +${data?.refunded ?? '?'} PF remboursés.`);
                  }}
                  style={{
                    ...BTN('linear-gradient(135deg,#f9ca24,#e17055)', '#1e3045'),
                    padding: '5px 10px', borderRadius: 8, fontSize: 11,
                  }}>
                  ✨ {card.name} {sc.quantity > 1 ? `(×${sc.quantity})` : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Achievements */}
      <div style={{ marginTop: 12, background: '#ffffff08', borderRadius: 10, padding: '12px 14px', border: '1px solid #ffffff10' }}>
        <div style={{ fontWeight: 800, color: '#a29bfe', fontSize: 12, marginBottom: 8 }}>
          🏆 Achievements
        </div>
        {!playerAchievements ? (
          <div style={{ color: '#8daacc', fontSize: 11, textAlign: 'center', padding: '14px 0' }}>Chargement…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {playerAchievements.map(ach => {
              const card = cardPool.find(c => c.id === ach.card_id);
              const isEvolutive = ach.threshold_rare != null;
              const maxThreshold = isEvolutive
                ? (ach.threshold_legendary || ach.threshold_epic || ach.threshold_rare || ach.threshold)
                : ach.threshold;
              const progress = ach.progress || 0;
              const done = isEvolutive ? ach.tier >= 4 : !!ach.completed_at;
              const pct = maxThreshold > 0 ? Math.round(Math.min(progress / maxThreshold, 1) * 100) : 0;
              const { c1 } = card ? cardCC(card.rarity) : { c1: '#888' };
              return (
                <div key={ach.def_id} style={{ padding: '8px 10px', borderRadius: 8, background: '#ffffff05', border: `1px solid ${done ? '#00b89466' : '#ffffff10'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: done ? '#00b894' : '#fff' }}>
                      {done && '✅ '}{ach.name || card?.name || '?'}
                      {isEvolutive && ach.tier > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: TIER_COLORS[ach.tier], marginLeft: 6 }}>
                          ({TIER_LABELS[ach.tier]})
                        </span>
                      )}
                    </span>
                    {maxThreshold > 0 && <span style={{ fontSize: 11, color: '#f9ca24', fontWeight: 700, whiteSpace: 'nowrap' }}>{progress} / {maxThreshold}</span>}
                  </div>
                  {ach.description && <div style={{ fontSize: 11, color: '#8daacc', fontStyle: 'italic', marginBottom: maxThreshold > 0 ? 6 : 0 }}>{ach.description}</div>}
                  {maxThreshold > 0 && (
                    <div style={{ background: '#ffffff14', borderRadius: 50, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 50, background: done ? 'linear-gradient(90deg,#00b894,#00cec9)' : `linear-gradient(90deg,${c1},#f9ca24)`, transition: 'width .5s' }} />
                    </div>
                  )}
                  {isEvolutive && maxThreshold > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
                      {[
                        { t: ach.threshold, tier: 1 },
                        { t: ach.threshold_rare, tier: 2 },
                        { t: ach.threshold_epic, tier: 3 },
                        { t: ach.threshold_legendary, tier: 4 },
                      ].filter(s => s.t != null).map(s => (
                        <span key={s.tier} style={{
                          fontSize: 9, fontWeight: 800, borderRadius: 50, padding: '1px 6px',
                          background: progress >= s.t ? TIER_COLORS[s.tier] + '33' : '#ffffff0a',
                          color: progress >= s.t ? TIER_COLORS[s.tier] : '#555',
                        }}>{s.t}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {playerAchievements.length === 0 && <div style={{ fontSize: 11, color: '#a8bfcf' }}>Aucun achievement.</div>}
          </div>
        )}
      </div>
    </div>
  );

  // ── Liste des joueurs ───────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontWeight: 900, color: '#e74c3c', fontSize: 14 }}>👤 Joueurs ({playersData.total})</div>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Nom ou IP…" style={{ ...INP, width: 200 }} />
      </div>
      {playersData.loading ? (
        <div style={{ textAlign: 'center', color: '#a8bfcf', padding: '16px 0' }}>Chargement…</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {pagPl.map(p => {
              const banned = p.status === 'banni';
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 7, background: banned ? '#e74c3c0a' : '#ffffff07', border: banned ? '1px solid #e74c3c33' : '1px solid #ffffff0e', borderRadius: 9, padding: '8px 12px', flexWrap: 'wrap' }}>
                  <button onClick={() => setPlayerView(p)} style={{ width: 30, height: 30, borderRadius: '50%', background: banned ? '#444' : 'linear-gradient(135deg,#6c5ce7,#a29bfe)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 900, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{p.name[0]}</button>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <button onClick={() => setPlayerView(p)} style={{ background: 'none', border: 'none', color: banned ? '#666' : '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", textDecoration: banned ? 'line-through' : 'none', padding: 0 }}>{p.name}</button>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 1, flexWrap: 'wrap' }}>
                      {p.score != null && (() => { const ranks = limEdit.playerRanks || []; const rank = [...ranks].sort((a, b) => b.min - a.min).find(r => p.score >= r.min) || ranks[0]; return rank ? <span style={{ fontSize: 9, color: rank.color, fontWeight: 800 }}>{getRankLabel(rank, lang)} · {p.score}pts</span> : null; })()}
                      {p.gold != null && <span style={{ fontSize: 9, color: '#f9ca24', fontWeight: 700 }}>{p.gold}G</span>}
                      {p.bot_score > 0 && (() => { const c = p.bot_score >= 70 ? '#e74c3c' : p.bot_score >= 40 ? '#e17055' : '#f9ca24'; return <span title="Score bot (anti-triche)" style={{ fontSize: 9, background: c + '22', color: c, borderRadius: 50, padding: '1px 6px', fontWeight: 800 }}>🤖 {p.bot_score}</span>; })()}
                      {p.can_sell === false && <span style={{ fontSize: 9, background: '#e74c3c22', color: '#e74c3c', borderRadius: 50, padding: '1px 6px', fontWeight: 700 }}>vente interdite</span>}
                      {p.email_confirmed === false && <span style={{ fontSize: 9, background: '#e17055aa', color: '#fff', borderRadius: 50, padding: '1px 6px', fontWeight: 700 }}>✉️ non vérifié</span>}
                    </div>
                    <div style={{ fontSize: 9, color: '#fff', fontFamily: 'monospace', marginTop: 1 }}>{p.ip}{p.geo ? ` · ${p.geo}` : ''} · {p.lastSeen}</div>
                  </div>
                  <div style={{ fontSize: 10, color: banned ? '#e74c3c' : '#00b894', fontWeight: 700 }}>{banned ? '🔴' : '🟢'}</div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button onClick={async () => {
                      const newStatus = banned ? 'actif' : 'banni';
                      setPlayersData(prev => ({ ...prev, players: prev.players.map(x => x.id === p.id ? { ...x, status: newStatus } : x) }));
                      const { data: { session } } = await supabase.auth.getSession();
                      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/players/${p.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ status: newStatus }) });
                      const d = await res.json();
                      if (d.error) { setPlayersData(prev => ({ ...prev, players: prev.players.map(x => x.id === p.id ? { ...x, status: p.status } : x) })); setMsg('❌ ' + d.error); }
                      else setMsg(banned ? '✅ Compte réactivé.' : '⛔ Compte banni.');
                    }} style={{ background: banned ? '#00b89422' : '#e74c3c22', border: `1px solid ${banned ? '#00b89444' : '#e74c3c44'}`, color: banned ? '#00b894' : '#e74c3c', padding: '4px 10px', borderRadius: 50, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 10, cursor: 'pointer' }}>{banned ? 'Réactiver' : 'Désactiver'}</button>
                    {!banned && <button onClick={() => { onBanIP(p.ip); setMsg(`IP ${p.ip} bannie.`); setTab('ips'); }} style={{ background: '#e74c3c22', border: '1px solid #e74c3c44', color: '#e74c3c', padding: '4px 10px', borderRadius: 50, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 10, cursor: 'pointer' }}>🌐 IP</button>}
                    <button onClick={async () => {
                      if (!window.confirm(`Supprimer DÉFINITIVEMENT le joueur ${p.name} ?`)) return;
                      const { data: { session } } = await supabase.auth.getSession();
                      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/players/${p.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } });
                      const d = await res.json();
                      if (d.error) { setMsg('❌ ' + d.error); return; }
                      setPlayersData(prev => ({ ...prev, players: prev.players.filter(x => x.id !== p.id), total: prev.total - 1 }));
                      setMsg(`✅ Compte ${p.name} supprimé définitivement.`);
                    }} style={{ background: '#e74c3c22', border: '1px solid #e74c3c44', color: '#e74c3c', padding: '4px 10px', borderRadius: 50, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 10, cursor: 'pointer' }} title="Supprimer définitivement">🗑️</button>
                  </div>
                </div>
              );
            })}
            {pagPl.length === 0 && <div style={{ color: '#a8bfcf', textAlign: 'center', padding: '16px 0' }}>{t('admin_no_player')}</div>}
          </div>
          {pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 11 }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ background: page === 0 ? '#222' : '#ffffff22', border: 'none', color: page === 0 ? '#444' : '#fff', padding: '5px 12px', borderRadius: 50, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 11, cursor: page === 0 ? 'default' : 'pointer' }}>{t('lb_prev')}</button>
              <span style={{ fontSize: 11, color: '#a8bfcf' }}>Page {page + 1}/{pages}</span>
              <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page === pages - 1} style={{ background: page === pages - 1 ? '#222' : '#ffffff22', border: 'none', color: page === pages - 1 ? '#444' : '#fff', padding: '5px 12px', borderRadius: 50, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 11, cursor: page === pages - 1 ? 'default' : 'pointer' }}>{t('lb_next')}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
