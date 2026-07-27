import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../../ThemeContext.jsx'
import { useT } from '../../i18n/translations.js'
import { nextDailyResetParis, nextWeeklyResetParis, todayParis, weekStartParis } from '../../utils/gameUtils.js'

// Panneau de quêtes unifié : onglets « Jour / Semaine » — on n'affiche que les 3
// quêtes de la période active (moitié de la hauteur vs deux listes empilées),
// chaque quête gardant tout son détail (progression, récompenses, reroll).
//
// Remplace DailyQuests + WeeklyQuests. Chaque période reçoit ses propres données
// et son handler de reroll ; « weekly » peut être null (mode démo) → seul l'onglet
// Jour s'affiche, sans barre d'onglets.

const questText = (txt, threshold) => (txt || '').replace(/\{n\}/g, threshold)

// Type de quête non remplaçable (récompense quasi-automatique) par période.
const NON_REROLLABLE = { daily: 'daily_connection', weekly: 'weekly_connection' }

// Ordre des onglets (gauche → droite) : sert à orienter la transition de bascule.
const TAB_ORDER = { daily: 0, weekly: 1 }

// Durées (ms) de la transition d'onglet — calées sur les animations CSS plus bas
// (durée + décalage de la 3e quête) : sortie .18s + 2×.04s ≈ 260 ; entrée .26s + 2×.05s ≈ 360.
const TX_OUT_MS = 260
const TX_IN_MS  = 380
const REVEAL_MS = 1700   // découverte en cascade (1re fois après un reset)

// Étincelles de l'effet de remplacement (positions/timings fixes → burst « à la
// Hearthstone » quand la nouvelle quête apparaît). Placées DANS la ligne, montent en
// s'effaçant.
const SPARKS = [
  { left: '10%', top: '55%', size: 11, dur: 1.0,  delay: 0.05 },
  { left: '34%', top: '18%', size: 9,  dur: 1.1,  delay: 0.20 },
  { left: '58%', top: '62%', size: 12, dur: 1.0,  delay: 0.10 },
  { left: '80%', top: '26%', size: 9,  dur: 1.15, delay: 0.26 },
  { left: '48%', top: '40%', size: 13, dur: 1.05, delay: 0.0  },
]

// Délai (ms) → « Nj Hh » / « Hh Mm » / « Mm Ss » (2 unités max), unités localisées
// via la clé i18n quest_time_units ("j h min s"). Les secondes ne s'affichent que
// sous l'heure (sinon inutile de faire défiler chaque seconde toute la journée).
function formatCountdown(ms, units) {
  const [uD, uH, uM, uS] = units.split(' ')
  const total = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (d > 0) return `${d}${uD} ${h}${uH}`
  if (h > 0) return `${h}${uH} ${m}${uM}`
  return `${m}${uM} ${String(s).padStart(2, '0')}${uS}`
}

// Décompte avant le prochain renouvellement des quêtes (minuit Paris au quotidien,
// lundi minuit Paris à l'hebdo). Composant isolé : lui seul se re-rend chaque seconde,
// pas tout le panneau. La cible est recalculée à chaque tic → elle bascule d'elle-même
// sur la période suivante une fois le reset passé.
function QuestCountdown({ period, theme }) {
  const { t } = useT()
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const target = period === 'weekly' ? nextWeeklyResetParis() : nextDailyResetParis()
  const ms = target.getTime() - Date.now()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
      marginTop: 3, fontSize: 9, fontWeight: 800, letterSpacing: .2,
      color: theme.textMuted,
    }}>
      <span style={{ opacity: .85 }}>⏳</span>
      <span>
        {t('quest_renew_label')}{' '}
        <b style={{ color: theme.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
          {formatCountdown(ms, t('quest_time_units') || 'd h m s')}
        </b>
      </span>
    </div>
  )
}
// Clés i18n du texte de reroll (bouton + corps de confirmation) par période.
const REROLL_KEYS = {
  daily:  { btn: 'quest_reroll_btn',        body: 'quest_reroll_body' },
  weekly: { btn: 'weekly_quest_reroll_btn', body: 'weekly_quest_reroll_body' },
}

export default function QuestsPanel({ daily, weekly }) {
  const { theme } = useTheme()
  const { t, lang } = useT()
  const [active, setActive] = useState('daily')
  const [confirmQuest, setConfirmQuest] = useState(null)
  const [rerollBusy,   setRerollBusy]   = useState(false)
  const [rerollErr,    setRerollErr]    = useState('')
  // Quête fraîchement tirée au reroll → joue l'effet d'apparition ({ key, id }).
  const [flash,        setFlash]        = useState(null)
  // Période dont on découvre les quêtes pour la 1re fois après un reset → cascade.
  const [reveal,       setReveal]       = useState(null)
  // Sens de la dernière bascule d'onglet (1 = vers la droite, -1 = vers la gauche).
  const [dir,          setDir]          = useState(0)
  // Phase de la transition d'onglet : 'idle' | 'out' (sortie à gauche) | 'in' (entrée).
  const [phase,        setPhase]        = useState('idle')

  // Timers de transition/découverte, purgés au démontage (évite un setState tardif).
  const timers = useRef([])
  const addTimer = (fn, ms) => { timers.current.push(setTimeout(fn, ms)) }
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current = [] }, [])

  // Clé de reset de la période (jour ou lundi, heure de Paris).
  const resetKeyOf = (key) => (key === 'weekly' ? weekStartParis() : todayParis())
  // Marque une période « vue » pour son reset courant. Renvoie true s'il fallait la
  // révéler (pas encore vue). Best-effort : stockage indispo → on révèle (1×/session).
  const markSeen = (key) => {
    const rk = resetKeyOf(key), sk = `gc_qseen_${key}`
    let seen = null
    try { seen = localStorage.getItem(sk) } catch { return true }
    if (seen === rk) return false
    try { localStorage.setItem(sk, rk) } catch { /* ignore */ }
    return true
  }
  const triggerReveal = (key) => {
    setReveal(key)
    addTimer(() => setReveal(r => (r === key ? null : r)), REVEAL_MS)
  }

  // Découverte au tout 1er affichage des quêtes (période par défaut), une seule fois.
  // Les découvertes déclenchées par un changement d'onglet sont gérées dans switchTo.
  const activeHasQuests = (((active === 'weekly' ? weekly : daily)?.quests?.length) || 0) > 0
  const didInitReveal = useRef(false)
  useEffect(() => {
    if (didInitReveal.current || !activeHasQuests) return
    didInitReveal.current = true
    if (markSeen(active)) triggerReveal(active)
  }, [activeHasQuests])

  // Périodes réellement disponibles (weekly absent en démo → onglet unique).
  const periods = [
    daily?.quests?.length ? { key: 'daily',  label: t('quest_tab_day'),  ...daily }  : null,
    weekly?.quests?.length ? { key: 'weekly', label: t('quest_tab_week'), ...weekly } : null,
  ].filter(Boolean)

  if (!periods.length) return null

  // Onglet actif (retombe sur le 1er dispo si l'actif a disparu).
  const cur = periods.find(p => p.key === active) || periods[0]
  const quests   = cur.quests
  const onReroll = cur.onReroll
  const rerollUsed = cur.rerollUsed
  const canReroll  = !!onReroll && !rerollUsed
  const nonReroll  = NON_REROLLABLE[cur.key]
  const rerollKeys = REROLL_KEYS[cur.key]

  const doneCount = quests.filter(q => q.completed_at).length
  const allDone   = doneCount === quests.length

  // Bascule d'onglet en 2 temps : les quêtes courantes sortent (glissement, décalées),
  // PUIS les nouvelles entrent depuis l'autre bord (ou cascade de découverte si 1re
  // fois). Verrouillé pendant l'animation pour éviter tout chevauchement.
  const switchTo = (key) => {
    if (key === active || phase !== 'idle') return
    setDir((TAB_ORDER[key] ?? 0) > (TAB_ORDER[active] ?? 0) ? 1 : -1)
    setConfirmQuest(null); setRerollErr('')
    setPhase('out')
    addTimer(() => {
      setActive(key)
      if (markSeen(key)) triggerReveal(key)   // 1re découverte → cascade en guise d'entrée
      setPhase('in')
      addTimer(() => setPhase('idle'), TX_IN_MS)
    }, TX_OUT_MS)
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      width: '100%',
      animation: 'fadeUp .4s ease-out both',
    }}>
      {/* En-tête : titre « QUÊTES » (toujours affiché) à gauche + onglets segmentés
          à droite (ou badge « complètes » si période unique). */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 6, marginBottom: 2,
      }}>
        <div style={{
          fontSize: 9, color: theme.textMuted, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: 1,
          display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
        }}>
          {t('quest_title_generic')}
          {periods.length === 1 && allDone && (
            <span style={{ color: theme.gold, fontSize: 8 }}>{t('quest_all_done')}</span>
          )}
        </div>

        {periods.length > 1 && (
          <div style={{
            display: 'flex', gap: 2, padding: 2,
            background: theme.overlay, borderRadius: 999,
            border: `1px solid ${theme.border}`,
          }}>
            {periods.map(p => {
              const on   = p.key === cur.key
              const dc   = p.quests.filter(q => q.completed_at).length
              const done = dc === p.quests.length
              return (
                <button
                  key={p.key}
                  onClick={() => switchTo(p.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    border: 'none', cursor: 'pointer', borderRadius: 999,
                    padding: '3px 9px', fontSize: 9.5, fontWeight: 800,
                    letterSpacing: .3, lineHeight: 1,
                    fontFamily: "'Nunito',sans-serif",
                    background: on ? 'linear-gradient(135deg,#6c5ce7,#a29bfe)' : 'transparent',
                    color: on ? '#fff' : theme.textSecondary,
                    transition: 'all .15s',
                  }}>
                  {p.label}
                  <span style={{
                    fontSize: 8.5, fontWeight: 900,
                    color: done ? (on ? '#ffe9a8' : theme.gold) : (on ? 'rgba(255,255,255,.75)' : theme.textMuted),
                  }}>
                    {done ? '✦' : `${dc}/${p.quests.length}`}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Contenu de la période active (liste + décompte). Les lignes s'animent
          individuellement (sortie/entrée décalées) ; le conteneur reste stable pour
          éviter tout « clignotement » global. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Liste des quêtes de la période active */}
      {quests.map((q, i) => {
        const done     = !!q.completed_at
        const pct      = Math.min(100, Math.round((q.progress / q.threshold) * 100))
        const isFlash  = flash && flash.key === cur.key && flash.id === q.id
        const isReveal = reveal === cur.key
        const isOut    = phase === 'out'
        const isIn     = phase === 'in'
        // Une seule animation par ligne, par priorité : sortie > découverte > entrée > reroll.
        // Sortie « vers la gauche » / entrée « depuis la droite » (miroir en sens inverse).
        const flipAnim = 'questFlip .6s cubic-bezier(.2,.8,.25,1) both, questGlow 1.2s ease-out'
        let rowAnim, rowDelay = 0
        if      (isOut)    { rowAnim = 'questRowOut .18s ease-in both';               rowDelay = i * 0.04 }
        else if (isReveal) { rowAnim = flipAnim;                                      rowDelay = i * 0.14 }
        else if (isIn)     { rowAnim = 'questRowIn .26s cubic-bezier(.2,.8,.25,1) both'; rowDelay = i * 0.05 }
        else if (isFlash)  { rowAnim = flipAnim;                                      rowDelay = 0 }
        const fx      = isFlash || isReveal          // habillage doré (balayage + étincelles)
        const fxDelay = isReveal ? i * 0.14 : 0

        return (
          <div key={`${cur.key}-${q.id}`} style={{
            position: 'relative',
            background: done ? '#00b89410' : theme.overlay,
            border: `1px solid ${fx ? '#ffd17a' : (done ? '#00b89433' : theme.border)}`,
            borderRadius: 8, padding: '5px 8px',
            transition: 'all .2s',
            transformOrigin: 'center top',
            '--tx-out': dir > 0 ? '-14px' : '14px',
            '--tx-in':  dir > 0 ? '16px'  : '-16px',
            animation: rowAnim || undefined,
            animationDelay: rowAnim ? `${rowDelay}s` : undefined,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {/* Statut — remplacé par le bouton reroll tant qu'il est disponible et
                  que la quête n'est pas réussie. La quête « connexion » (jour ou
                  semaine) n'est pas remplaçable (refusée côté API). */}
              {canReroll && !done && q.type !== nonReroll ? (
                <button
                  onClick={() => { setRerollErr(''); setConfirmQuest(q) }}
                  title={t(rerollKeys.btn)} aria-label={t(rerollKeys.btn)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, padding: 0, flexShrink: 0, opacity: .7, lineHeight: 1,
                  }}>
                  🔄
                </button>
              ) : (
                <span style={{
                  fontSize: 12, flexShrink: 0,
                  color: done ? '#00b894' : theme.textMuted,
                }}>
                  {done ? '✔' : '○'}
                </span>
              )}

              {/* Texte */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: 800,
                  color: done ? '#00b894' : theme.textPrimary,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {questText(q.translations?.[lang]?.name || q.name, q.threshold)}
                </div>
                {!done && (
                  <div style={{ fontSize: 9, color: theme.textSecondary, marginTop: 1 }}>
                    {q.progress}/{q.threshold} {t(`trigger_${q.type}`) || q.type}
                  </div>
                )}
              </div>

              {/* Récompenses */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, flexShrink: 0 }}>
                {q.forge_points > 0 && (
                  <div style={{ fontSize: 10, fontWeight: 900, color: done ? '#a29bfe' : theme.textMuted }}>
                    🔨 {q.forge_points}
                  </div>
                )}
                {(q.gold_reward || 0) > 0 && (
                  <div style={{ fontSize: 10, fontWeight: 900, color: done ? '#f9ca24' : theme.textMuted }}>
                    💰 {q.gold_reward}G
                  </div>
                )}
              </div>
            </div>

            {/* Barre de progression */}
            {!done && q.progress > 0 && (
              <div style={{
                marginTop: 4, height: 2, borderRadius: 1,
                background: theme.overlay, overflow: 'hidden',
              }}>
                <div style={{
                  width: `${pct}%`, height: '100%',
                  background: 'linear-gradient(90deg,#6c5ce7,#a29bfe)',
                  transition: 'width .3s',
                }} />
              </div>
            )}

            {/* Effet « à la Hearthstone » : balayage doré + étincelles. Sert au reroll
                (immédiat) ET à la découverte du jour/semaine (décalé par ligne). */}
            {fx && (
              <>
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 8,
                  overflow: 'hidden', pointerEvents: 'none', zIndex: 2,
                }}>
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, left: 0, width: '45%',
                    background: 'linear-gradient(105deg, transparent, rgba(255,231,150,.5) 40%, rgba(255,255,255,.9) 50%, rgba(255,231,150,.5) 60%, transparent)',
                    animation: 'questShine .85s ease-out both', animationDelay: `${fxDelay}s`,
                  }} />
                </div>
                {SPARKS.map((sp, k) => (
                  <span key={k} aria-hidden="true" style={{
                    position: 'absolute', left: sp.left, top: sp.top,
                    fontSize: sp.size, lineHeight: 1, pointerEvents: 'none', zIndex: 3,
                    animation: `questSpark ${sp.dur}s ease-out ${(sp.delay + fxDelay).toFixed(2)}s both`,
                  }}>✨</span>
                ))}
              </>
            )}
          </div>
        )
      })}

      {/* Décompte avant renouvellement de la période active (répond au « on ne sait
          pas quand ça se termine »). */}
      <QuestCountdown period={cur.key} theme={theme} />
      </div>

      {/* Keyframes de l'effet de remplacement (portées par le panneau). */}
      <style>{`
        @keyframes questRowOut {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(var(--tx-out, -14px)); }
        }
        @keyframes questRowIn {
          from { opacity: 0; transform: translateX(var(--tx-in, 16px)); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes questFlip {
          0%   { opacity: 0; transform: perspective(700px) rotateX(-82deg) scale(.96); }
          55%  { opacity: 1; transform: perspective(700px) rotateX(10deg)  scale(1.02); }
          100% { opacity: 1; transform: none; }
        }
        @keyframes questShine {
          0%   { transform: translateX(-130%) skewX(-18deg); }
          100% { transform: translateX(320%)  skewX(-18deg); }
        }
        @keyframes questSpark {
          0%   { opacity: 0; transform: translateY(2px)   scale(.4); }
          25%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(-20px) scale(1.1); }
        }
        @keyframes questGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,209,122,0); }
          45%      { box-shadow: 0 0 16px 3px rgba(255,209,122,.55); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes questRowOut { from { opacity: 1; } to { opacity: 0; } }
          @keyframes questRowIn  { from { opacity: 0; } to { opacity: 1; } }
        }
      `}</style>

      {/* Écran de confirmation du remplacement — porté sur <body> (portal). */}
      {confirmQuest && createPortal(
        <div
          onClick={() => !rerollBusy && setConfirmQuest(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100001,
            background: 'rgba(0,0,0,.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: theme.bgSurface, border: `1px solid ${theme.border}`,
              borderRadius: 14, padding: '18px 20px', maxWidth: 340, width: '100%',
              boxShadow: '0 12px 40px rgba(0,0,0,.35)',
              fontFamily: "'Nunito',sans-serif",
            }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: theme.textPrimary, marginBottom: 8 }}>
              🔄 {t('quest_reroll_title')}
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: theme.textPrimary, marginBottom: 6 }}>
              {questText(confirmQuest.translations?.[lang]?.name || confirmQuest.name, confirmQuest.threshold)}
            </div>
            <div style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 1.5, marginBottom: 12 }}>
              {t(rerollKeys.body)}
            </div>
            {rerollErr && (
              <div style={{ fontSize: 11, color: '#e74c3c', fontWeight: 800, marginBottom: 10 }}>
                ⚠️ {rerollErr}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                disabled={rerollBusy}
                onClick={() => setConfirmQuest(null)}
                style={{
                  background: theme.overlayMd, border: 'none', color: theme.textPrimary,
                  padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: 800,
                  cursor: 'pointer', fontFamily: "'Nunito',sans-serif",
                }}>
                {t('quest_reroll_cancel')}
              </button>
              <button
                disabled={rerollBusy}
                onClick={async () => {
                  setRerollBusy(true); setRerollErr('')
                  const periodKey = cur.key
                  const { data, error } = await onReroll(confirmQuest.id)
                  setRerollBusy(false)
                  if (error) { setRerollErr(typeof error === 'string' ? error : (t('quest_reroll_error') || 'Remplacement impossible')); return }
                  setConfirmQuest(null)
                  // Déclenche l'effet d'apparition sur la nouvelle quête (elle arrive
                  // dans la liste après le refresh async côté parent).
                  const newId = data?.quest?.id
                  if (newId != null) {
                    setFlash({ key: periodKey, id: newId })
                    setTimeout(() => setFlash(f => (f && f.key === periodKey && f.id === newId) ? null : f), 2200)
                  }
                }}
                style={{
                  background: 'linear-gradient(135deg,#6c5ce7,#a29bfe)', border: 'none', color: '#fff',
                  padding: '7px 16px', borderRadius: 8, fontSize: 11, fontWeight: 800,
                  cursor: rerollBusy ? 'wait' : 'pointer', opacity: rerollBusy ? .7 : 1,
                  fontFamily: "'Nunito',sans-serif",
                }}>
                {rerollBusy ? '…' : `🔄 ${t('quest_reroll_confirm')}`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
