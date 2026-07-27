import { useState, useEffect, useRef } from 'react';
import { useT, getLang } from '../../i18n/translations.js';
import { RC, cardCC, rarityLabel, cardName } from '../../data/cards.js';
import Avatar from '../../components/Avatar.jsx';
import { ThumbImage } from '../quiz/QuizComponents.jsx';
import { apiPatronageDonate, apiPatronageDonateDuplicate } from '../../services/api.js';

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
 * Modale de MÉCÉNAT (plafond hebdo de la rareté atteint). Le geocoin est DÉJÀ compté
 * comme gagné (le prix a été consommé à la réponse) : le mécène ne fait plus que choisir
 * le CRITÈRE de bénéficiaire — une « roulette » désigne le destinataire renvoyé par le
 * serveur, puis confirmation. Plus de « jouer pour la gloire » : « Laisser le sort
 * choisir » offre à un bénéficiaire d'un critère au hasard. S'il ferme sans choisir, le
 * serveur attribue un bénéficiaire d'office à la clôture du round (le geocoin est déjà
 * consommé et n'est jamais perdu).
 */
export function PatronageModal({ offer, onClose, showToast, checkAchievements, checkAchievementUpgrades, onForgePointsEarned, onDonated, rewardPf = { rare: 1, epique: 5, legendaire: 100 } }) {
  const { t } = useT();
  const [phase, setPhase] = useState('choose');   // 'choose' | 'roulette' | 'done'
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);     // { recipient, decoys, reward_pf }
  const [profiles, setProfiles] = useState([]);   // [recipient + decoys] mélangés (roulette)
  const [activeIdx, setActiveIdx] = useState(0);
  const [wonIdx, setWonIdx] = useState(-1);
  const [secsLeft, setSecsLeft] = useState(null);   // décompte « encore X s pour choisir »
  const timers = useRef([]);
  const deadlineRef = useRef(null);
  const autoRef = useRef(null);                      // callback d'auto-roulette (fixé à chaque render)

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Décompte de choix : le mécène a `choice_seconds` pour choisir un critère, sinon
  // l'auto-roulette (critère au hasard) part toute seule — miroir client du délai après
  // lequel le serveur attribue d'office un bénéficiaire (patronage_choice_seconds).
  useEffect(() => {
    // Aucun décompte en mode doublon (pas de fenêtre de grâce serveur ni d'auto-roulette).
    if (!offer || offer.preview || offer.duplicate) { setSecsLeft(null); return; }
    deadlineRef.current = Date.now() + (Number(offer.choice_seconds) || 20) * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setSecsLeft(left);
      if (left <= 0) { clearInterval(iv); autoRef.current?.(); }
    };
    const iv = setInterval(tick, 250);
    tick();
    return () => clearInterval(iv);
  }, [offer]);

  if (!offer) return null;
  const card = offer.card || {};
  const rc = RC[card.rarity];
  const { c1, c2 } = cardCC(card.rarity);
  // Critères activés (filtrés par l'admin via offer.criteria) + tirage au hasard parmi eux.
  const enabledCriteria = CRITERIA.filter(c => !Array.isArray(offer.criteria) || offer.criteria.includes(c.key));
  const randomCriterion = () => (enabledCriteria[Math.floor(Math.random() * enabledCriteria.length)]?.key) || 'nouveau';

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
      : offer.duplicate
        ? await apiPatronageDonateDuplicate(offer.card.id, criterion)
        : await apiPatronageDonate(offer.quiz_id, criterion);
    setBusy(false);
    if (error || !data?.recipient) {
      if (offer.duplicate) {
        // Doublon : rien n'est « déjà consommé » (le serveur rend le doublon en cas
        // d'échec) → afficher la vraie erreur, pas de bénéficiaire d'office.
        showToast?.(error || t('patronage_error') || 'Le don a échoué.', 'error');
      } else {
        // En jeu : le prix est déjà consommé ; en cas d'erreur réseau, le serveur
        // désignera un bénéficiaire d'office à la clôture du round (jamais perdu).
        showToast?.(t('patronage_auto_recipient') || '🎁 Un bénéficiaire sera désigné automatiquement.', 'info');
      }
      onClose?.();
      return;
    }
    setResult(data);
    // Roulette : recipient + jusqu'à 2 leurres, mélangés.
    const pool = [data.recipient, ...(data.decoys || [])].slice(0, 3);
    // Pas assez de profils pour une vraie roulette (bénéficiaire déjà attribué par le
    // filet serveur, ou toute petite communauté) → afficher directement le résultat au
    // lieu d'une « roulette » à un seul profil.
    if (pool.length < 2 || data.already_delivered) {
      setPhase('done');
      if (!offer.preview) {
        if (data.reward_pf > 0) onForgePointsEarned?.(data.reward_pf);
        if (data.achievements?.length) checkAchievements?.(data.achievements);
        if (data.achievement_upgrades?.length) checkAchievementUpgrades?.(data.achievement_upgrades);
        onDonated?.();
      }
      return;
    }
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
        timers.current.push(setTimeout(() => {
          setPhase('done');
          // Révéler récompense + achievement APRÈS l'animation : sinon la notification
          // « achievement débloqué » s'affiche par-dessus la roulette encore en cours.
          if (!offer.preview) {
            if (data.reward_pf > 0) onForgePointsEarned?.(data.reward_pf);
            if (data.achievements?.length) checkAchievements?.(data.achievements);
            if (data.achievement_upgrades?.length) checkAchievementUpgrades?.(data.achievement_upgrades);
            // Resynchro collection depuis la DB : garantit l'apparition du geocoin
            // d'achievement (« Mecenat ») dans l'inventaire sans rechargement manuel.
            onDonated?.();
          }
        }, 700));
      }
    };
    tick();
  }

  // Callback d'auto-roulette (délai écoulé) : critère au hasard, seulement si le mécène
  // n'a pas déjà choisi / lancé. Réassigné à chaque render pour capter phase/busy à jour.
  autoRef.current = () => { if (phase === 'choose' && !busy) donate(randomCriterion()); };

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
              🎁 {offer.duplicate ? (t('patronage_title_duplicate') || 'Mécénat') : (t('patronage_title') || 'Mécénat (plafond hebdomadaire atteint)')}
            </div>
            <div style={{ fontSize: 12, color: '#cfd8e3', lineHeight: 1.5, marginBottom: 10 }}>
              {offer.duplicate
                ? (t('patronage_body_duplicate') || "Offre ce doublon à un autre joueur. Choisis un critère : un bénéficiaire sera tiré au sort parmi les joueurs correspondants.")
                : (t('patronage_body') || "Tu ne peux plus gagner de geocoin de cette rareté cette semaine. Offre-le à un autre joueur — tu gagnes {rare} PF pour un rare, {epique} PF pour un épique et {legendaire} PF pour un légendaire.")
                    .replace('{rare}', rewardPf.rare).replace('{epique}', rewardPf.epique).replace('{legendaire}', rewardPf.legendaire)}
            </div>
            {/* Décompte : passé le délai, l'auto-roulette part toute seule (critère au hasard). */}
            {secsLeft != null && !busy && (
              <div style={{ fontSize: 12, fontWeight: 900, color: secsLeft <= 5 ? '#e17055' : '#f9ca24', marginBottom: 12, textAlign: 'center' }}>
                ⏳ {(t('patronage_countdown') || 'Encore {n} s pour choisir').replace('{n}', secsLeft)}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 7, marginBottom: 12 }}>
              {enabledCriteria.map(c => (
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
            {/* Plus de « jouer pour la gloire » : le geocoin est déjà compté comme gagné.
                « Laisser le sort choisir » offre à un bénéficiaire d'un critère au hasard. */}
            <button disabled={busy} onClick={() => donate(randomCriterion())} style={{
              width: '100%', background: '#ffffff12', border: '1.5px solid #ffffff22', color: '#cfd8e3',
              borderRadius: 11, padding: '10px 0', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12.5,
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
            }}>
              🎲 {t('patronage_surprise') || 'Laisser le sort choisir'}
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
 * Modale d'INTRODUCTION au mécénat d'un doublon (avant la roulette).
 * `intro` = { card, enabled, reason }.
 *  • enabled  → confirmation « Souhaites-tu offrir ce geocoin ? » Oui / Non.
 *  • !enabled → explication (plafond pas encore atteint / limite atteinte) + Fermer.
 */
export function PatronageIntroModal({ intro, onConfirm, onClose }) {
  const { t } = useT();
  if (!intro) return null;
  const card = intro.card || {};
  const rc = RC[card.rarity];
  const { c1, c2 } = cardCC(card.rarity);
  return (
    <div style={OVERLAY} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'linear-gradient(145deg,#1e3045,#1a2d42)', borderRadius: 22, width: 'min(92vw,400px)',
        border: `2px solid ${rc?.color || '#f9ca24'}66`, boxShadow: '0 28px 70px #000c', padding: '24px 20px', textAlign: 'center',
        fontFamily: "'Nunito',sans-serif",
      }}>
        <div style={{ fontSize: 46, marginBottom: 6 }}>🎁</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#f9ca24', marginBottom: 10, fontFamily: "'Fredoka One',sans-serif" }}>
          {t('patronage_title_duplicate') || 'Mécénat'}
        </div>
        {/* Geocoin concerné */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 8, overflow: 'hidden', border: `2px solid ${c1}`, background: '#1e3045', flexShrink: 0 }}>
            {(card.image_url_thumb || card.image_url || card.image)
              ? <ThumbImage src={card.image_url_thumb || card.image_url || card.image} alt={cardName(card, getLang())} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#fff', background: `linear-gradient(135deg,${c1},${c2})` }}>{(cardName(card, getLang()) || '?')[0]}</div>}
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{cardName(card, getLang())}</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: rc?.color }}>{rarityLabel(card.rarity, t)}</div>
          </div>
        </div>
        <div style={{ fontSize: 13.5, color: '#cfd8e3', lineHeight: 1.55, marginBottom: 20 }}>
          {intro.enabled ? (t('patronage_confirm_body') || 'Souhaites-tu offrir ce geocoin à un autre joueur ?') : intro.reason}
        </div>
        {intro.enabled ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{
              flex: 1, background: '#ffffff12', border: '1.5px solid #ffffff22', color: '#cfd8e3', borderRadius: 11,
              padding: '12px 0', fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 14, cursor: 'pointer',
            }}>{t('no') || 'Non'}</button>
            <button onClick={onConfirm} style={{
              flex: 1, background: 'linear-gradient(135deg,#f9ca24,#e17055)', border: 'none', color: '#1e3045', borderRadius: 11,
              padding: '12px 0', fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 14, cursor: 'pointer',
            }}>🎁 {t('yes') || 'Oui'}</button>
          </div>
        ) : (
          <button onClick={onClose} style={{
            width: '100%', background: 'linear-gradient(135deg,#f9ca24,#e17055)', border: 'none', color: '#1e3045', borderRadius: 11,
            padding: '12px 0', fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 14, cursor: 'pointer',
          }}>{t('close') || 'Fermer'}</button>
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
