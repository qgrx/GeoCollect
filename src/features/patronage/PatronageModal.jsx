import { useState, useEffect, useRef } from 'react';
import { useT, getLang } from '../../i18n/translations.js';
import { RC, cardCC, rarityLabel, cardName } from '../../data/cards.js';
import Avatar from '../../components/Avatar.jsx';
import { ThumbImage } from '../quiz/QuizComponents.jsx';
import { apiPatronageDonate } from '../../services/api.js';

// Critères proposés au mécène (doivent correspondre à PATRONAGE_CRITERIA côté serveur).
const CRITERIA = [
  { key: 'nouveau',           icon: '🌱', label: 'crit_new',   fallback: 'À un nouveau' },
  { key: 'ancien',            icon: '🎖️', label: 'crit_old',   fallback: 'À un ancien' },
  { key: 'rapide',            icon: '⚡', label: 'crit_fast',  fallback: 'À un rapide de la gâchette' },
  { key: 'fidele',            icon: '🔥', label: 'crit_loyal', fallback: 'À un joueur fidèle' },
  { key: 'petite_collection', icon: '🌿', label: 'crit_small', fallback: 'À une petite collection' },
  { key: 'grande_collection', icon: '🏆', label: 'crit_big',   fallback: 'À une collection avancée' },
];

const OVERLAY = {
  position: 'fixed', inset: 0, background: '#000c', display: 'flex', alignItems: 'center',
  justifyContent: 'center', zIndex: 3200, backdropFilter: 'blur(8px)', padding: 16,
  fontFamily: "'Nunito',sans-serif",
};

// Vignette d'un profil (roulette) — surlignée quand active/gagnante.
function ProfileChip({ p, active, won }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 6px',
      borderRadius: 12, minWidth: 78, transition: 'transform .15s, background .15s',
      transform: active ? 'scale(1.08)' : 'scale(1)',
      background: won ? '#00b89433' : active ? '#f9ca2422' : 'transparent',
      border: won ? '2px solid #00b894' : active ? '2px solid #f9ca24' : '2px solid transparent',
    }}>
      <Avatar pseudo={p.pseudo} avatarUrl={p.avatar || null} verified={!!p.avatar} size={44} />
      <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', maxWidth: 74, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.pseudo}</span>
    </div>
  );
}

/**
 * Modale de MÉCÉNAT (plafond hebdo de la rareté atteint) : le mécène choisit un
 * critère de bénéficiaire, une « roulette » désigne le destinataire renvoyé par le
 * serveur, puis confirmation. « Jouer pour la gloire » ferme (la gloire — or + PF —
 * est déjà créditée côté serveur au moment de la réponse).
 */
export function PatronageModal({ offer, onClose, showToast, checkAchievements, checkAchievementUpgrades, onForgePointsEarned, rewardPf = { rare: 1, epique: 5, legendaire: 100 } }) {
  const { t } = useT();
  const [phase, setPhase] = useState('choose');   // 'choose' | 'roulette' | 'done'
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);     // { recipient, decoys, reward_pf }
  const [profiles, setProfiles] = useState([]);   // [recipient + decoys] mélangés (roulette)
  const [activeIdx, setActiveIdx] = useState(0);
  const [wonIdx, setWonIdx] = useState(-1);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  if (!offer) return null;
  const card = offer.card || {};
  const rc = RC[card.rarity];
  const { c1, c2 } = cardCC(card.rarity);

  async function donate(criterion) {
    if (busy) return;
    setBusy(true);
    // Mode PREVIEW (bouton test admin) : aucun appel API ni crédit — données factices
    // juste pour visualiser l'animation de roulette de bout en bout.
    const { data, error } = offer.preview
      ? { data: {
            recipient: { id: 'test-1', pseudo: 'Alizée', avatar: null },
            decoys: [{ id: 'test-2', pseudo: 'Bastien', avatar: null }, { id: 'test-3', pseudo: 'Chloé', avatar: null }],
            reward_pf: offer.rarity === 'légendaire' ? 100 : offer.rarity === 'épique' ? 5 : 1,
            achievements: [], achievement_upgrades: [],
          }, error: null }
      : await apiPatronageDonate(offer.quiz_id, criterion);
    setBusy(false);
    if (error || !data?.recipient) {
      // Aucun bénéficiaire / plafond : on retombe sur la gloire (déjà créditée).
      showToast?.(t('patronage_no_recipient') || '🏆 Personne à qui offrir — victoire pour la gloire !', 'info');
      onClose?.();
      return;
    }
    if (!offer.preview) {
      if (data.achievements?.length) checkAchievements?.(data.achievements);
      if (data.achievement_upgrades?.length) checkAchievementUpgrades?.(data.achievement_upgrades);
      if (data.reward_pf > 0) onForgePointsEarned?.(data.reward_pf);
    }
    setResult(data);
    // Roulette : recipient + jusqu'à 2 leurres, mélangés.
    const pool = [data.recipient, ...(data.decoys || [])].slice(0, 3);
    const shuffled = pool.map(v => ({ v, r: Math.random() })).sort((a, b) => a.r - b.r).map(o => o.v);
    const winIdx = shuffled.findIndex(p => p.id === data.recipient.id);
    setProfiles(shuffled);
    setPhase('roulette');
    // Séquence décélérante s'arrêtant sur le bénéficiaire.
    const n = shuffled.length;
    let step = 0;
    const totalSteps = 14 + winIdx;     // termine sur winIdx
    const tick = () => {
      setActiveIdx(step % n);
      step++;
      if (step <= totalSteps) {
        const delay = 70 + Math.pow(step, 2) * 1.4;   // accélère puis ralentit
        timers.current.push(setTimeout(tick, delay));
      } else {
        setActiveIdx(winIdx);
        setWonIdx(winIdx);
        timers.current.push(setTimeout(() => setPhase('done'), 700));
      }
    };
    tick();
  }

  return (
    <div style={OVERLAY} onClick={phase === 'done' ? onClose : undefined}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'linear-gradient(145deg,#1e3045,#1a2d42)', borderRadius: 22, width: 'min(94vw,460px)',
        maxHeight: 'calc(100dvh - 80px)', overflowY: 'auto', border: `2px solid ${rc?.color || '#f9ca24'}66`,
        boxShadow: '0 28px 70px #000c', padding: '20px 18px',
      }}>
        {/* En-tête : le geocoin concerné */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 9, overflow: 'hidden', border: `2px solid ${c1}`, background: '#1e3045', flexShrink: 0 }}>
            {(card.image_url_thumb || card.image_url)
              ? <ThumbImage src={card.image_url_thumb || card.image_url} alt={cardName(card, getLang())} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: '#fff', background: `linear-gradient(135deg,${c1},${c2})` }}>{cardName(card, getLang())[0]}</div>}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>{cardName(card, getLang())}</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: rc?.color }}>{rarityLabel(card.rarity, t)}</div>
          </div>
        </div>

        {phase === 'choose' && (
          <>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#f9ca24', marginBottom: 4 }}>
              🎁 {t('patronage_title') || 'Mécénat (plafond hebdomadaire atteint)'}
            </div>
            <div style={{ fontSize: 12, color: '#cfd8e3', lineHeight: 1.5, marginBottom: 14 }}>
              {(t('patronage_body') || "Tu ne peux plus gagner de geocoin de cette rareté cette semaine. Offre-le à un autre joueur — tu gagnes {rare} PF pour un rare, {epique} PF pour un épique et {legendaire} PF pour un légendaire.")
                .replace('{rare}', rewardPf.rare).replace('{epique}', rewardPf.epique).replace('{legendaire}', rewardPf.legendaire)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 7, marginBottom: 12 }}>
              {CRITERIA.filter(c => !Array.isArray(offer.criteria) || offer.criteria.includes(c.key)).map(c => (
                <button key={c.key} disabled={busy} onClick={() => donate(c.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%',
                  background: '#ffffff0f', border: '1.5px solid #ffffff22', color: '#fff', borderRadius: 11,
                  padding: '10px 12px', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12.5,
                  cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                }}>
                  <span style={{ fontSize: 18 }}>{c.icon}</span>
                  <span>{t(c.label) || c.fallback}</span>
                </button>
              ))}
            </div>
            <button disabled={busy} onClick={onClose} style={{
              width: '100%', background: '#ffffff12', border: '1.5px solid #ffffff22', color: '#cfd8e3',
              borderRadius: 11, padding: '10px 0', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12.5,
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
            }}>
              {t('patronage_glory') || 'Ne rien offrir'}
            </button>
          </>
        )}

        {phase === 'roulette' && (
          <div style={{ textAlign: 'center', padding: '6px 0' }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#f9ca24', marginBottom: 12 }}>
              🎰 {t('patronage_rolling') || 'Le sort désigne le bénéficiaire…'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              {profiles.map((p, i) => (
                <ProfileChip key={p.id} p={p} active={i === activeIdx} won={i === wonIdx} />
              ))}
            </div>
          </div>
        )}

        {phase === 'done' && result && (
          <div style={{ textAlign: 'center', padding: '6px 0' }}>
            <div style={{ fontSize: 34, marginBottom: 4 }}>🎁</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#00b894', marginBottom: 6 }}>
              {(t('patronage_done') || 'Tu as offert ce geocoin à {pseudo} !').replace('{pseudo}', result.recipient.pseudo)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <ProfileChip p={result.recipient} active={false} won />
            </div>
            {result.reward_pf > 0 && (
              <div style={{ fontSize: 13, fontWeight: 800, color: '#f9ca24', marginBottom: 12 }}>
                +{result.reward_pf} 🔨
              </div>
            )}
            <button onClick={onClose} style={{
              width: '100%', background: 'linear-gradient(135deg,#00b894,#0e9f6e)', border: 'none', color: '#fff',
              borderRadius: 11, padding: '11px 0', fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 13, cursor: 'pointer',
            }}>
              {t('close') || 'Fermer'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Popup côté BÉNÉFICIAIRE : « {mécène} vous a offert ce geocoin ».
 * Alimentée par l'événement socket 'patronage:gift' (temps réel) ou GET /pending
 * (à la connexion). `gift` = { donor_pseudo, rarity, card }.
 */
export function PatronageGiftPopup({ gift, onClose }) {
  const { t } = useT();
  if (!gift) return null;
  const card = gift.card || {};
  const rc = RC[card.rarity || gift.rarity];
  const { c1, c2 } = cardCC(card.rarity || gift.rarity);
  return (
    <div style={OVERLAY} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'linear-gradient(145deg,#1e3045,#1a2d42)', borderRadius: 22, width: 'min(92vw,380px)',
        border: `2px solid ${rc?.color || '#f9ca24'}66`, boxShadow: '0 28px 70px #000c', padding: '24px 20px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 34, marginBottom: 6 }}>🎁</div>
        <div style={{ fontSize: 15, fontWeight: 900, color: '#f9ca24', marginBottom: 12 }}>
          {(t('patronage_received') || '{pseudo} vous a offert ce geocoin !').replace('{pseudo}', gift.donor_pseudo || '?')}
        </div>
        <div style={{ width: 96, height: 96, margin: '0 auto 10px', borderRadius: 12, overflow: 'hidden', border: `2px solid ${c1}`, background: '#1e3045' }}>
          {(card.image_url_thumb || card.image_url)
            ? <ThumbImage src={card.image_url_thumb || card.image_url} alt={cardName(card, getLang())} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 900, color: '#fff', background: `linear-gradient(135deg,${c1},${c2})` }}>{(cardName(card, getLang()) || '?')[0]}</div>}
        </div>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{cardName(card, getLang())}</div>
        <div style={{ fontSize: 11, fontWeight: 800, color: rc?.color, marginBottom: 16 }}>{rarityLabel(card.rarity || gift.rarity, t)}</div>
        <button onClick={onClose} style={{
          width: '100%', background: 'linear-gradient(135deg,#f9ca24,#e17055)', border: 'none', color: '#1e3045',
          borderRadius: 11, padding: '11px 0', fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 13, cursor: 'pointer',
        }}>
          {t('patronage_thanks') || 'Merci !'}
        </button>
      </div>
    </div>
  );
}
