import { useState, useMemo } from 'react'
import { useT } from '../../i18n/translations.js'
import { BTN, INP } from '../../utils/styles.js'
import { RC, cardCC, ACHIEVEMENT_DEF } from '../../data/cards.js'
import { PSEUDO_CHANGE_DAYS } from '../../data/constants.js'
import { apiDeleteAccount } from '../../services/api.js'
import PseudoDisplay from '../../components/PseudoDisplay.jsx'

// ─── Calcul du rang ───────────────────────────────────────────────────────────
const RANKS = [
  { min: 0,   label: 'Novice',           color: '#78909c', icon: '🌱' },
  { min: 5,   label: 'Explorateur',      color: '#42a5f5', icon: '🧭' },
  { min: 20,  label: 'Aventurier',       color: '#66bb6a', icon: '⛺' },
  { min: 50,  label: 'Chasseur',         color: '#ffa726', icon: '🎯' },
  { min: 100, label: 'Expert',           color: '#ab47bc', icon: '🔮' },
  { min: 200, label: 'Maître Geocoins',  color: '#f9ca24', icon: '👑' },
]

function getrank(score, ranks) {
  const r = ranks?.length ? ranks : RANKS
  return [...r].sort((a,b) => b.min - a.min).find(r => score >= r.min) || r[0]
}

function scoreFromCol(col, cardPool) {
  const W = { commun: 1, rare: 3, épique: 7, légendaire: 20 }
  return Object.entries(col || {}).reduce((s, [id, n]) => {
    if (!n) return s
    const c = cardPool.find(x => x.id === +id)
    return s + (W[c?.rarity] || 1)
  }, 0)
}

function bestRarity(col, cardPool) {
  const order = { légendaire: 4, épique: 3, rare: 2, commun: 1 }
  let best = 'commun'
  for (const [id, n] of Object.entries(col || {})) {
    if (!n) continue
    const c = cardPool.find(x => x.id === +id)
    if (c && (order[c.rarity] || 0) > (order[best] || 0)) best = c.rarity
  }
  return best
}

function memberSince(dateStr) {
  if (!dateStr) return null
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 864e5)
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  if (days < 30)  return `Il y a ${days} jours`
  if (days < 365) return `Il y a ${Math.floor(days / 30)} mois`
  return `Il y a ${Math.floor(days / 365)} an${Math.floor(days / 365) > 1 ? 's' : ''}`
}

// ─── SettingsModal ────────────────────────────────────────────────────────────
export default function SettingsModal({ auth, collection = {}, cardPool = [], unlockedAch = [], ranks = [], score: scoreProp, onClose, onStartTour }) {
  const { t } = useT()
  const { profile } = auth
  const [tab,     setTab]     = useState('profil')   // profil | achievements
  const [newP,    setNewP]    = useState('')
  const [msg,     setMsg]     = useState({ text: '', ok: false })
  const [loading, setLoading] = useState(false)
  const [changed, setChanged] = useState(false)

  if (!profile) return null

  const lastChange = profile.pseudo_changed_at ? new Date(profile.pseudo_changed_at) : null
  const daysSince  = lastChange ? Math.floor((Date.now() - lastChange.getTime()) / 864e5) : 999
  const canChange  = daysSince >= PSEUDO_CHANGE_DAYS
  const history    = profile.pseudo_history || []

  const computedScore = useMemo(() => scoreFromCol(collection, cardPool), [collection, cardPool])
  const score = scoreProp ?? computedScore
  const rank     = getrank(score, ranks)
  const topRarity = bestRarity(collection, cardPool)
  const { c1, c2 } = cardCC(topRarity)
  const uniqueCards = Object.values(collection).filter(n => n > 0).length
  const memberStr   = memberSince(profile.joined_at)

  async function doChange() {
    if (!newP.trim())      { setMsg({ text: t('settings_pseudo_empty'), ok: false }); return }
    if (newP.length < 3)   { setMsg({ text: t('settings_pseudo_short'), ok: false }); return }
    if (!canChange)        { setMsg({ text: t('settings_wait').replace('{n}', PSEUDO_CHANGE_DAYS - daysSince), ok: false }); return }
    setLoading(true); setMsg({ text: '', ok: false })
    const { error } = await auth.updatePseudo(newP.trim())
    setLoading(false)
    if (error) {
      setMsg({ text: error.message === 'pseudo_taken' ? t('settings_pseudo_taken') : error.message, ok: false })
      return
    }
    setChanged(true)
    setMsg({ text: `✅ Pseudo changé en « ${newP.trim()} » !`, ok: true })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000c', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 3000, backdropFilter: 'blur(8px)', padding: 16 }}>
      <div style={{ background: 'linear-gradient(145deg,#1a1a2e,#16213e)', borderRadius: 24,
        width: 'min(94vw,440px)', maxHeight: '92vh', overflowY: 'auto',
        border: '1.5px solid #ffffff18', boxShadow: '0 32px 80px #000b',
        fontFamily: "'Nunito',sans-serif", position: 'relative' }}>

        {/* ── Bouton fermer ── */}
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, zIndex: 1,
          background: '#00000044', border: 'none', color: '#fff', width: 30, height: 30,
          borderRadius: '50%', fontSize: 15, cursor: 'pointer', fontWeight: 900 }}>✕</button>

        {/* ── Hero card ── */}
        <div style={{ background: `linear-gradient(135deg,${c1}cc,${c2}88,#0f3460)`,
          borderRadius: '22px 22px 0 0', padding: '32px 24px 24px', position: 'relative', overflow: 'hidden' }}>

          {/* Fond décoratif */}
          <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160,
            borderRadius: '50%', background: `${c1}22`, pointerEvents: 'none' }}/>
          <div style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100,
            borderRadius: '50%', background: `${c2}18`, pointerEvents: 'none' }}/>

          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 20 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%',
              background: `linear-gradient(135deg,${c1},${c2})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 900, color: '#fff', flexShrink: 0,
              boxShadow: `0 0 24px ${c1}88, 0 4px 12px #0008`,
              border: '3px solid #ffffff33' }}>
              {profile.pseudo?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 26,
                textShadow: '0 2px 8px #0006', lineHeight: 1.1 }}>
                <PseudoDisplay pseudo={profile.pseudo} score={score} ranks={ranks} style={{ color: '#fff' }}/>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 14 }}>{rank.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: rank.color }}>{rank.label}</span>
                {profile.role === 'admin' && (
                  <span style={{ fontSize: 10, background: '#e74c3c', color: '#fff',
                    padding: '1px 7px', borderRadius: 50, fontWeight: 900, marginLeft: 2 }}>ADMIN</span>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {[
              { icon: '💰', value: profile.gold ?? 0,  label: 'Or' },
              { icon: '🃏', value: uniqueCards,          label: 'Cartes' },
              { icon: '🔥', value: profile.streak ?? 0, label: 'Série' },
              { icon: '🏆', value: unlockedAch.length,  label: 'Succès' },
            ].map(({ icon, value, label }) => (
              <div key={label} style={{ background: '#00000033', borderRadius: 12,
                padding: '10px 6px', textAlign: 'center', backdropFilter: 'blur(4px)' }}>
                <div style={{ fontSize: 18, marginBottom: 2 }}>{icon}</div>
                <div style={{ fontWeight: 900, fontSize: 16, color: '#fff' }}>{value}</div>
                <div style={{ fontSize: 9, color: '#ffffff88', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Score + membre depuis */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <div style={{ fontSize: 11, color: '#ffffff88' }}>
              Score : <span style={{ color: '#f9ca24', fontWeight: 900 }}>{score} pts</span>
            </div>
            {memberStr && (
              <div style={{ fontSize: 11, color: '#ffffff66' }}>
                Membre {memberStr}
              </div>
            )}
          </div>
        </div>

        {/* ── Barre de progression vers le rang suivant ── */}
        {(() => {
          const activeRanks = ranks?.length ? [...ranks].sort((a,b) => a.min - b.min) : RANKS
          const nextRank = activeRanks.find(r => r.min > score)
          if (!nextRank) return (
            <div style={{ padding: '12px 24px', background: '#f9ca2412', textAlign: 'center',
              fontSize: 12, fontWeight: 800, color: '#f9ca24', borderBottom: '1px solid #ffffff0a' }}>
              {t('rank_max')}
            </div>
          )
          const prevMin = [...activeRanks].reverse().find(r => r.min <= score)?.min || 0
          const pct = Math.round(((score - prevMin) / (nextRank.min - prevMin)) * 100)
          return (
            <div style={{ padding: '12px 24px', borderBottom: '1px solid #ffffff0a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 11, color: '#888' }}>
                <span>{t('rank_next')} <span style={{ color: nextRank.color, fontWeight: 800 }}>{nextRank.icon} {nextRank.label}</span></span>
                <span style={{ fontWeight: 700 }}>{t('rank_progress').replace('{score}',score).replace('{max}',nextRank.min)}</span>
              </div>
              <div style={{ background: '#ffffff0f', borderRadius: 50, height: 6, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 50,
                  background: `linear-gradient(90deg,${c1},${c2})`, transition: 'width .5s' }}/>
              </div>
            </div>
          )
        })()}

        {/* ── Onglets ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid #ffffff0a' }}>
          {[['profil','👤 Profil'],['achievements','🏆 Succès']].map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ flex: 1, background: 'none', border: 'none', borderBottom: `2px solid ${tab===id?'#f9ca24':'transparent'}`,
                color: tab===id?'#f9ca24':'#666', padding: '11px 0', fontFamily: "'Nunito',sans-serif",
                fontWeight: 800, fontSize: 13, cursor: 'pointer', transition: 'all .2s' }}>
              {lbl}
            </button>
          ))}
        </div>

        {/* ── Onglet PROFIL ── */}
        {tab === 'profil' && <>

        {/* ── Changer le pseudo ── */}
        <div style={{ padding: '20px 24px' }}>
          <div style={{ fontWeight: 900, fontSize: 14, color: '#f9ca24', marginBottom: 14 }}>
            ✏️ {t('settings_title')}
          </div>

          <div style={{ fontSize: 12, color: canChange ? '#00b894' : '#f39c12',
            background: canChange ? '#00b89412' : '#f39c1212',
            border: `1px solid ${canChange ? '#00b89433' : '#f39c1233'}`,
            borderRadius: 9, padding: '7px 12px', marginBottom: 14, fontWeight: 700 }}>
            {canChange ? '✅ Tu peux changer ton pseudo.' : `⏳ ${t('settings_wait').replace('{n}', PSEUDO_CHANGE_DAYS - daysSince)}`}
          </div>

          <input value={newP} onChange={e => setNewP(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doChange()}
            placeholder={t('settings_new_pseudo')}
            disabled={!canChange || changed || loading}
            maxLength={20}
            style={{ ...INP, marginBottom: 10, opacity: (!canChange || changed) ? 0.5 : 1 }}/>

          {msg.text && (
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, padding: '7px 12px',
              borderRadius: 9, background: msg.ok ? '#00b89422' : '#e74c3c22',
              color: msg.ok ? '#00b894' : '#e74c3c',
              border: `1px solid ${msg.ok ? '#00b89444' : '#e74c3c44'}` }}>
              {msg.text}
            </div>
          )}

          <button onClick={doChange} disabled={!canChange || changed || loading}
            style={{ ...BTN(canChange && !changed ? 'linear-gradient(135deg,#6c5ce7,#a29bfe)' : '#333'),
              padding: '11px', borderRadius: 11, width: '100%', textAlign: 'center',
              cursor: canChange && !changed ? 'pointer' : 'not-allowed', opacity: loading ? 0.7 : 1 }}>
            {loading ? '⏳' : t('settings_change_btn')}
          </button>
        </div>

        {/* ── Historique pseudos ── */}
        {history.length > 1 && (
          <div style={{ padding: '0 24px 20px' }}>
            <div style={{ fontSize: 10, color: '#444', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: .8, marginBottom: 8 }}>
              {t('settings_pseudo_history')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {history.slice().reverse().map((h, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
                  fontSize: 11, color: '#555', padding: '3px 0',
                  borderBottom: '1px solid #ffffff08' }}>
                  <span style={{ color: '#888', fontWeight: 700 }}>{h.pseudo}</span>
                  <span style={{ color: '#444' }}>{h.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {onStartTour && (
          <div style={{ padding: '0 24px 12px' }}>
            <button onClick={onStartTour} style={{ background: '#6c5ce722', border: '1px solid #6c5ce744', color: '#a29bfe', padding: '8px 16px', borderRadius: 10, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: 'pointer', width: '100%' }}>
              🎓 Revoir le tutoriel
            </button>
          </div>
        )}

        {/* ── Désactivation compte ── */}
        {tab === 'profil' && (
          <div style={{ padding: '0 24px 20px', borderTop: '1px solid #ffffff08', paddingTop: 16, marginTop: 4 }}>
            <details>
              <summary style={{ fontSize: 11, color: '#444', cursor: 'pointer', fontWeight: 700, userSelect: 'none' }}>
                {t('account_danger_zone')}
              </summary>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 10, lineHeight: 1.5 }}
                  dangerouslySetInnerHTML={{ __html: t('account_deactivate_warning').replace('permanente', '<strong style="color:#e74c3c">permanente</strong>').replace('définitive', '<strong style="color:#e74c3c">définitive</strong>').replace('endgültig', '<strong style="color:#e74c3c">endgültig</strong>') }}/>
                <button onClick={async () => {
                  if (!window.confirm(t('account_deactivate_confirm'))) return
                  const { error } = await auth.deactivateAccount()
                  if (error) alert('Erreur : ' + error.message)
                  else onClose()
                }} style={{ background: '#e74c3c22', border: '1px solid #e74c3c44', color: '#e74c3c', padding: '9px 18px', borderRadius: 10, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
                  {t('account_deactivate_btn')}
                </button>
              </div>
            </details>
          </div>
        )}
        </>}

        {/* ── Onglet ACHIEVEMENTS ── */}
        {tab === 'achievements' && (
          <div style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 14, fontWeight: 700 }}>
              {unlockedAch.length} / {ACHIEVEMENT_DEF.length} succès débloqués
            </div>
            {/* Barre globale */}
            <div style={{ background: '#ffffff0f', borderRadius: 50, height: 6, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ width: `${Math.round(unlockedAch.length/ACHIEVEMENT_DEF.length*100)}%`,
                height: '100%', borderRadius: 50,
                background: 'linear-gradient(90deg,#f9ca24,#e17055)', transition: 'width .5s' }}/>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ACHIEVEMENT_DEF.map(def => {
                const done = unlockedAch.includes(def.id)
                return (
                  <div key={def.id} style={{ display: 'flex', alignItems: 'center', gap: 12,
                    background: done ? '#f9ca2410' : '#ffffff06',
                    border: `1px solid ${done ? '#f9ca2433' : '#ffffff0a'}`,
                    borderRadius: 12, padding: '10px 14px',
                    opacity: done ? 1 : 0.55, transition: 'all .2s' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: done ? 'linear-gradient(135deg,#f9ca24,#e17055)' : '#ffffff12',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                      boxShadow: done ? '0 2px 12px #f9ca2444' : 'none' }}>
                      {done ? def.icon : '🔒'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 900, fontSize: 13, color: done ? '#fff' : '#555' }}>
                        {def.label}
                      </div>
                      <div style={{ fontSize: 11, color: done ? '#aaa' : '#444', marginTop: 2 }}>
                        {done ? '✅ Débloqué' : 'Non débloqué'}
                      </div>
                    </div>
                    {done && <div style={{ fontSize: 10, color: '#f9ca24', fontWeight: 800 }}>+1 carte</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
