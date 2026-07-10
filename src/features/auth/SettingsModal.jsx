import { useState } from 'react'
import { useT } from '../../i18n/translations.js'
import { useTheme } from '../../ThemeContext.jsx'
import { BTN, INP } from '../../utils/styles.js'
import { RC } from '../../data/cards.js'
import { rankCC, getRankLabel } from '../../utils/rankUtils.js'
import { PSEUDO_CHANGE_DAYS } from '../../data/constants.js'
import { apiDeleteAccount } from '../../services/api.js'
import { ReferralPanel } from '../referral/ReferralModal.jsx'
import { todayParis, countOwnedUnique } from '../../utils/gameUtils.js'
import PseudoDisplay from '../../components/PseudoDisplay.jsx'

import { DEFAULT_RANKS } from '../../data/constants.js'

function getrank(score, ranks) {
  const r = ranks?.length ? ranks : DEFAULT_RANKS
  return [...r].sort((a,b) => b.min - a.min).find(r => score >= r.min) || r[0]
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
export default function SettingsModal({ auth, collection = {}, shinyCollection = {}, cardPool = [], ranks = [], limits = {}, score: scoreProp, onBuyPocketBoost = null, onBuyBagSlot = null, onClose, onStartTour }) {
  // Succès = nombre de geocoins d'achievement possédés (variantes évolutives incluses).
  const achievementsOwned = (cardPool || []).filter(c => (c.type || '').toLowerCase().startsWith('achievement') && (collection[c.id] || 0) > 0).length
  const { t, lang } = useT()
  const { theme } = useTheme()
  const { profile } = auth
  const [newP,    setNewP]    = useState('')
  const [msg,     setMsg]     = useState({ text: '', ok: false })
  const [loading, setLoading] = useState(false)
  const [changed, setChanged] = useState(false)
  const [showCardsInfo, setShowCardsInfo] = useState(false)
  const [buying,  setBuying]  = useState(null)   // 'bag' | 'pocket' pendant un achat d'agrandissement

  if (!profile) return null

  const lastChange = profile.pseudo_changed_at ? new Date(profile.pseudo_changed_at) : null
  const daysSince  = lastChange ? Math.floor((Date.now() - lastChange.getTime()) / 864e5) : 999
  const canChange  = daysSince >= PSEUDO_CHANGE_DAYS
  const history    = profile.pseudo_history || []
  const score = scoreProp ?? 0
  const rank = getrank(score, ranks)
  const { c1, c2 } = rankCC(rank)
  const uniqueCards = countOwnedUnique(collection)
  const shinyCards  = countOwnedUnique(shinyCollection)
  const memberStr   = memberSince(profile.joined_at)

  // Limites quotidiennes — affichées à tous les joueurs pour comprendre
  // leur progression vis-à-vis des limites de gold/cartes/forge.
  let limitsDebug = null
  {
    const today = todayParis()
    const isNewDay = !profile.daily_reset_at || profile.daily_reset_at < today
    const lastHourReset = profile.cards_hour_reset_at ? new Date(profile.cards_hour_reset_at).getTime() : null
    // Un nouveau jour réinitialise aussi la fenêtre horaire (cohérent avec le backend)
    const hourlyReset = isNewDay || !lastHourReset || (Date.now() - lastHourReset) >= 60 * 60 * 1000
    // Caps effectifs : sac permanent (+1 geocoin/jour par emplacement) et poches
    // boostées du jour (+N geocoins/heure jusqu'à minuit) — miroir de computeCardLimitStatus.
    const bagSlots      = Math.max(0, Number(profile.bag_slots) || 0)
    const pocketBoost   = profile.pocket_boost_day === today ? Math.max(0, Number(profile.pocket_boost) || 0) : 0
    const baseDailyCap  = limits.quizDailyCardCap  || 0
    const baseHourlyCap = limits.quizHourlyCardCap || 0
    limitsDebug = {
      dailyGold:        isNewDay ? 0 : (profile.daily_gold || 0),
      dailyGoldCap:     limits.connected?.dailyGold || 0,
      dailyGoldJoin:    isNewDay ? 0 : (profile.daily_gold_join || 0),
      dailyGoldJoinCap: limits.quizJoinGoldCap || 0,
      dailyCards:       isNewDay ? 0 : (profile.daily_cards || 0),
      dailyCardsCap:    baseDailyCap > 0 ? baseDailyCap + bagSlots : 0,
      dailyShiny:       isNewDay ? 0 : (profile.daily_shiny || 0),
      dailyShinyCap:    limits.quizDailyShinyCap || 0,
      hourlyCards:      hourlyReset ? 0 : (profile.hourly_cards || 0),
      hourlyCardsCap:   baseHourlyCap > 0 ? baseHourlyCap + pocketBoost : 0,
      bagSlots,
      canBuyBag:        baseDailyCap  > 0,
      canBuyPocket:     baseHourlyCap > 0,
      dailyForgeConsolation:    isNewDay ? 0 : (profile.daily_forge_consolation || 0),
      dailyForgeConsolationCap: limits.quizDailyForgeCap || 0,
      isNewDay,
      lastActivityDate: profile.daily_reset_at || null,
      hourlyResetInMin: hourlyReset ? null : Math.ceil((60 * 60 * 1000 - (Date.now() - lastHourReset)) / 60000),
    }
  }

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

  // Styles de cartes — sections homogènes et lisibles
  const card      = { background: theme.bgCard, border: `1px solid ${theme.borderLight}`, borderRadius: 14, padding: 16, marginBottom: 12 }
  const cardHi    = { ...card, background: `${theme.gold}14`, border: `1.5px solid ${theme.gold}66` }
  const cardTitle = { fontWeight: 900, fontSize: 13, color: theme.gold, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000c', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 3000, backdropFilter: 'blur(8px)',
      padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))' }}>
      <div style={{ background: `linear-gradient(145deg,${theme.bgSurface},${theme.bgElevated})`, borderRadius: 24,
        width: 'min(94vw,440px)', maxHeight: 'calc(100dvh - 100px)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        border: `1.5px solid ${theme.borderLight}`, boxShadow: '0 32px 80px #000b',
        fontFamily: "'Nunito',sans-serif", position: 'relative' }}>

        {/* ── Bouton fermer (épinglé hors du contenu scrollable pour rester visible) ── */}
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, zIndex: 5,
          background: '#000000aa', border: 'none', color: '#fff', width: 32, height: 32,
          borderRadius: '50%', fontSize: 15, cursor: 'pointer', fontWeight: 900 }}>✕</button>

        {/* ── Contenu scrollable ── */}
        <div style={{ overflowY: 'auto', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>

        {/* ── Hero card ── */}
        <div style={{ background: `linear-gradient(135deg,${c1}cc,${c2}88,#1a4a7a)`,
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
                <span style={{ fontSize: 12, fontWeight: 800, color: rank.color }}>{getRankLabel(rank, lang)}</span>
                {profile.role === 'admin' && (
                  <span style={{ fontSize: 10, background: '#e74c3c', color: '#fff',
                    padding: '1px 7px', borderRadius: 50, fontWeight: 900, marginLeft: 2 }}>ADMIN</span>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {[
              { icon: '💰', value: profile.gold ?? 0,  label: 'Or' },
              { icon: '🃏', value: uniqueCards,          label: 'Geocoins', shiny: shinyCards },
              { icon: '🏆', value: achievementsOwned,  label: 'Succès' },
            ].map(({ icon, value, label, shiny }) => (
              <div key={label} style={{ background: '#00000033', borderRadius: 12,
                padding: '10px 6px', textAlign: 'center', backdropFilter: 'blur(4px)' }}>
                <div style={{ fontSize: 18, marginBottom: 2 }}>{icon}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
                  <span style={{ fontWeight: 900, fontSize: 16, color: '#fff' }}>{value}</span>
                  {shiny > 0 && <span style={{ fontWeight: 800, fontSize: 11, color: '#f9ca24' }}>✨{shiny}</span>}
                </div>
                <div style={{ fontSize: 9, color: '#ffffff88', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Score + membre depuis */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <div style={{ fontSize: 11, color: '#ffffff88' }}>
              Score : <span style={{ color: theme.gold, fontWeight: 900 }}>{score} pts</span>
            </div>
            {memberStr && (
              <div style={{ fontSize: 11, color: '#ffffff66' }}>
                Membre {memberStr}
              </div>
            )}
          </div>
        </div>

        {/* ── Contenu (cartes homogènes) ── */}
        <div style={{ padding: 16 }}>

          {/* Parrainage — mis en avant */}
          <div style={cardHi}>
            <ReferralPanel theme={theme} />
          </div>

          {/* Progression de rang */}
          {(() => {
            const activeRanks = ranks?.length ? [...ranks].sort((a,b) => a.min - b.min) : DEFAULT_RANKS
            const nextRank = activeRanks.find(r => r.min > score)
            return (
              <div style={card}>
                <div style={cardTitle}>🎖️ {t('rank_next')}</div>
                {!nextRank ? (
                  <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 800, color: theme.gold }}>{t('rank_max')}</div>
                ) : (() => {
                  const pct = Math.min(100, Math.round((score / nextRank.min) * 100))
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 11, color: theme.textMuted }}>
                        <span style={{ color: nextRank.color, fontWeight: 800 }}>{nextRank.icon} {getRankLabel(nextRank, lang)}</span>
                        <span style={{ fontWeight: 700, color: theme.textSecondary }}>{t('rank_progress').replace('{score}',score).replace('{max}',nextRank.min)}</span>
                      </div>
                      <div style={{ background: theme.overlayMd, borderRadius: 50, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 50,
                          background: `linear-gradient(90deg,${c1},${c2})`, transition: 'width .5s' }}/>
                      </div>
                    </>
                  )
                })()}
              </div>
            )
          })()}

          {/* Limites du jour */}
          {limitsDebug && (
            <div style={card}>
              <div style={cardTitle}>📊 Limites du jour</div>
              {[
                { label: 'Or quotidien',       value: limitsDebug.dailyGold,     cap: limitsDebug.dailyGoldCap },
                ...(limits.quizJoinGold > 0 ? [{ label: 'Or de participation', value: limitsDebug.dailyGoldJoin, cap: limitsDebug.dailyGoldJoinCap }] : []),
                { label: 'Geocoins du jour',   value: limitsDebug.dailyCards,    cap: limitsDebug.dailyCardsCap, info: true,
                  // Agrandir le sac : +1 geocoin/jour permanent, prix du prochain emplacement (masqué si 5/5).
                  buy: (() => {
                    if (!onBuyBagSlot || !limitsDebug.canBuyBag) return null
                    const prices = Array.isArray(limits.bagSlotPrices) ? limits.bagSlotPrices : []
                    const price  = Number(prices[limitsDebug.bagSlots])
                    return Number.isFinite(price) ? { icon: '🎒', kind: 'bag', label: t('limit_bag_buy'), price, onClick: onBuyBagSlot } : null
                  })() },
                { label: 'Geocoins/heure',     value: limitsDebug.hourlyCards,   cap: limitsDebug.hourlyCardsCap,
                  // Agrandir les poches : +N geocoins/heure jusqu'à minuit (cumulable).
                  buy: (onBuyPocketBoost && limitsDebug.canBuyPocket)
                    ? { icon: '🧤', kind: 'pocket', label: t('limit_pocket_buy').replace('{n}', limits.pocketBoostCards ?? 10), price: limits.pocketBoostPrice ?? 100, onClick: onBuyPocketBoost }
                    : null },
                ...(limitsDebug.dailyShinyCap > 0 ? [{ label: '✨ Shiny du jour', value: limitsDebug.dailyShiny, cap: limitsDebug.dailyShinyCap }] : []),
                ...(limits.quizConsolationForge > 0 ? [{ label: 'Forge de compensation', value: limitsDebug.dailyForgeConsolation, cap: limitsDebug.dailyForgeConsolationCap }] : []),
              ].map(({ label, value, cap, info, buy }) => {
                const unlimited = !cap || cap <= 0
                const pct = unlimited ? 0 : Math.min(100, Math.round((value / cap) * 100))
                return (
                  <div key={label} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: theme.textMuted }}>
                      <span>
                        {label}
                        {info && (
                          <span onClick={() => setShowCardsInfo(v => !v)} style={{ cursor: 'pointer', marginLeft: 4, fontWeight: 800 }}>ⓘ</span>
                        )}
                      </span>
                      <span style={{ fontWeight: 700, color: theme.textSecondary }}>{value} / {unlimited ? '∞' : cap}</span>
                    </div>
                    {!unlimited && (
                      <div style={{ background: theme.overlayMd, borderRadius: 50, height: 5, overflow: 'hidden', marginTop: 3 }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 50, background: pct >= 100 ? '#eb4d4b' : `linear-gradient(90deg,${c1},${c2})`, transition: 'width .5s' }}/>
                      </div>
                    )}
                    {buy && (() => {
                      const poor = (profile.gold ?? 0) < buy.price
                      return (
                        <button
                          onClick={async () => { if (buying || poor) return; setBuying(buy.kind); try { await buy.onClick() } finally { setBuying(null) } }}
                          disabled={!!buying || poor}
                          title={poor ? t('limit_upsell_no_gold') : undefined}
                          style={{ marginTop: 4, background: poor ? theme.overlayMd : `${theme.gold}22`, border: `1px solid ${theme.gold}55`,
                            color: poor ? theme.textMuted : theme.gold, fontWeight: 800, fontSize: 10.5, padding: '5px 10px', borderRadius: 8,
                            cursor: poor ? 'not-allowed' : 'pointer', fontFamily: "'Nunito',sans-serif", opacity: buying === buy.kind ? 0.6 : 1 }}>
                          {buy.icon} {buy.label} · {buy.price} Or
                        </button>
                      )
                    })()}
                    {info && showCardsInfo && (
                      <div style={{ marginTop: 4, padding: 8, borderRadius: 8, background: theme.overlayMd, fontSize: 10, color: theme.textSecondary, lineHeight: 1.4 }}>
                        Pas de panique, si un geocoin vous intéresse alors que vous avez atteint la limite, il y a le dépôt d'attente. Un point de forge est également offert en compensation pour chaque quiz gagné.
                      </div>
                    )}
                  </div>
                )
              })}
              <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 6, lineHeight: 1.4 }}>
                {limitsDebug.isNewDay && <>✅ Compteurs quotidiens réinitialisés (dernière activité : {limitsDebug.lastActivityDate ?? 'jamais'}, aujourd'hui {todayParis()}) · </>}
                Prochain reset horaire dans {limitsDebug.hourlyResetInMin != null ? `${limitsDebug.hourlyResetInMin}min` : '—'}
              </div>
            </div>
          )}

          {/* Changer le pseudo */}
          <div style={card}>
            <div style={cardTitle}>✏️ {t('settings_title')}</div>
            <div style={{ fontSize: 12, color: canChange ? '#00b894' : '#f39c12',
              background: canChange ? '#00b89412' : '#f39c1212',
              border: `1px solid ${canChange ? '#00b89433' : '#f39c1233'}`,
              borderRadius: 9, padding: '7px 12px', marginBottom: 12, fontWeight: 700 }}>
              {canChange ? '✅ Tu peux changer ton pseudo.' : `⏳ ${t('settings_wait').replace('{n}', PSEUDO_CHANGE_DAYS - daysSince)}`}
            </div>
            <input value={newP} onChange={e => setNewP(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doChange()}
              placeholder={t('settings_new_pseudo')}
              disabled={!canChange || changed || loading}
              maxLength={20}
              style={{ ...INP, background: theme.bgInput, border: `1px solid ${theme.border}`, color: theme.textPrimary,
                marginBottom: 10, opacity: (!canChange || changed) ? 0.5 : 1 }}/>
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

          {/* Historique pseudos */}
          {history.length > 1 && (
            <div style={card}>
              <div style={{ ...cardTitle, color: theme.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: .8 }}>
                {t('settings_pseudo_history')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {history.slice().reverse().map((h, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
                    fontSize: 11, padding: '3px 0', borderBottom: `1px solid ${theme.borderLight}` }}>
                    <span style={{ color: theme.textSecondary, fontWeight: 700 }}>{h.pseudo}</span>
                    <span style={{ color: theme.textMuted }}>{h.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {onStartTour && (
            <button onClick={onStartTour} style={{ background: '#6c5ce722', border: '1px solid #6c5ce744', color: '#a29bfe', padding: '10px 16px', borderRadius: 10, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 12, cursor: 'pointer', width: '100%', marginBottom: 12 }}>
              🎓 Revoir le tutoriel
            </button>
          )}

          {/* Désactivation compte */}
          <details style={{ marginTop: 4 }}>
            <summary style={{ fontSize: 11, color: theme.textMuted, cursor: 'pointer', fontWeight: 700, userSelect: 'none' }}>
              {t('account_danger_zone')}
            </summary>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 10, lineHeight: 1.5 }}
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
        </div>

      </div>
    </div>
  )
}
