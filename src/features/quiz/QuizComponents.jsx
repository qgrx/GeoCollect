import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { soundCorrect, soundWrong } from '../../utils/sounds.js';
import { useT } from '../../i18n/translations.js';
import { useTheme } from '../../ThemeContext.jsx';
import { apiReportQuestion, apiStoreHold } from '../../services/api.js';
import { normA, wordCount, isHandicapExemptCard } from '../../utils/gameUtils.js';
import { RC, cardCC, rarityLabel, cardName } from '../../data/cards.js';
import { getLang } from '../../i18n/translations.js';
import { QUIZ_INTERVAL } from '../../data/constants.js';
import Card from '../../components/Card.jsx';
import { BTN } from '../../utils/styles.js';

const SNOOZE_OPTIONS = [
  { label: '1 min',    ms: 60_000 },
  { label: '5 min',   ms: 5 * 60_000 },
  { label: '15 min',  ms: 15 * 60_000 },
  { label: '1 heure', ms: 60 * 60_000 },
];

export function ThumbImage({ src, alt, style }) {
  const [failed, setFailed] = useState(false);
  // Si l'image source change (nouveau quiz), on réessaie de charger la miniature
  useEffect(() => { setFailed(false) }, [src]);
  if (!src) return null;
  const thumbSrc = src.replace(/\.[^/.]+$/, '_thumb.webp');
  return (
    <img
      src={failed ? src : thumbSrc}
      alt={alt}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}

// ─── Quiz Notification (bottom popup, auto-replaced) ─────────────────────────
export function QuizNotif({quiz,onJoin,onSkip}){ const {t}=useT();
  const rc=RC[quiz.card.rarity]; const {c1,c2}=cardCC(quiz.card.rarity);
  const wc=wordCount(quiz.a);
  const [showSnooze,setShowSnooze]=useState(false);

  if (quiz.winner) {
    return (
      <div style={{position:"fixed",bottom:66,left:"50%",transform:"translateX(-50%)",zIndex:900,width:"min(96vw,400px)",background:"linear-gradient(135deg,#1e3045,#1a2d42)",border:`1.5px solid ${c1}66`,borderRadius:20,boxShadow:`0 16px 60px ${c1}33`,fontFamily:"'Nunito',sans-serif",animation:"slideUp 0.4s cubic-bezier(.34,1.56,.64,1) both",textAlign:"center",padding:"16px 20px"}}>
        <div style={{fontSize:32,marginBottom:8}}>😤</div>
        <div style={{fontWeight:900,color:"#fff",fontSize:15,marginBottom:4}}>Trop tard !</div>
        <div style={{color:"#aaa",fontSize:13}}>
          <span style={{color:"#f9ca24",fontWeight:800}}>{quiz.winner}</span> a remporté la carte <span style={{color:c1,fontWeight:800}}>{cardName(quiz.card, getLang())}</span>.
        </div>
      </div>
    );
  }

  return (
    <div style={{position:"fixed",bottom:66,left:"50%",transform:"translateX(-50%)",zIndex:900,width:"min(96vw,500px)",background:"linear-gradient(135deg,#1e3045,#1a4a7a)",border:"2px solid #f9ca2466",borderRadius:20,boxShadow:"0 16px 60px #000b",fontFamily:"'Nunito',sans-serif",animation:"slideUp 0.4s cubic-bezier(.34,1.56,.64,1) both",key:quiz.id}}>
      <div style={{background:`linear-gradient(90deg,${c1},${c2})`,borderRadius:"18px 18px 0 0",padding:"7px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontWeight:900,fontSize:12,color:"#fff"}}>{t("quiz_new_card")}</span>
        <button onClick={() => onSkip()} style={{background:"#e74c3c",border:"none",color:"#fff",width:22,height:22,borderRadius:"50%",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,padding:0,lineHeight:1,transition:"background 0.2s"}} onMouseEnter={e=>e.currentTarget.style.background="#c0392b"} onMouseLeave={e=>e.currentTarget.style.background="#e74c3c"} title="Ignorer">✕</button>
      </div>
      <div style={{padding:"10px 16px 12px",display:"flex",alignItems:"center",gap:12}}>
        <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
          <div style={{ width: '100%', height: '100%', borderRadius: 6, overflow: 'hidden', position: 'relative', border: `2px solid ${c1}`, background: '#1e3045', boxSizing: 'border-box', boxShadow: quiz.card.rarity === 'légendaire' ? `0 0 12px ${c1}aa` : 'none' }}>
            {quiz.card.image_url ? (
              <ThumbImage src={quiz.card.image_url} alt={cardName(quiz.card, getLang())} style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: '-webkit-optimize-contrast' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: '#fff', background: `linear-gradient(135deg,${c1},${c2})` }}>{cardName(quiz.card, getLang())[0]}</div>
            )}
          </div>
        </div>
        <div style={{flex:1}}>
          <div style={{fontWeight:800,color:"#fff",fontSize:13,marginBottom:2}}>{cardName(quiz.card, getLang())} <span style={{color:rc.color,fontWeight:700,fontSize:11}}>({rarityLabel(quiz.card.rarity, t)})</span></div>
          <div style={{fontSize:11,color:"#888",marginBottom:7}}>{t("quiz_answer_correctly")} · <span style={{color:"#f9ca24"}}>{t("quiz_answer_words")} {wc} {wc>1?t("quiz_words"):t("quiz_word")}</span></div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <button onClick={onJoin} style={{...BTN("linear-gradient(135deg,#f9ca24,#e17055)","#1e3045"),padding:"8px 14px",borderRadius:12,fontSize:12}}>{t("quiz_join")}</button>
            <div style={{position:"relative"}}>
              <button onClick={()=>setShowSnooze(v=>!v)} style={{background:"#ffffff18",border:"1px solid #ffffff22",color:"#aaa",padding:"8px 12px",borderRadius:12,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:12,cursor:"pointer"}}>
                Ignorer ▾
              </button>
              {showSnooze&&(
                <>
                  <div onClick={()=>setShowSnooze(false)} style={{position:"fixed",inset:0,zIndex:9}}/>
                  <div style={{position:"fixed",bottom:8,left:"50%",transform:"translateX(-50%)",background:"#1e3045",border:"1.5px solid #ffffff22",borderRadius:14,overflow:"hidden",boxShadow:"0 8px 32px #000c",zIndex:10,width:"min(94vw,280px)"}}>
                    <div style={{fontSize:10,color:"#666",padding:"8px 14px 4px",fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>{t("quiz_snooze_label")}</div>
                    {SNOOZE_OPTIONS.map(opt=>(
                      <button key={opt.label} onClick={()=>{onSkip(opt.ms);setShowSnooze(false);}} style={{display:"block",width:"100%",background:"none",border:"none",borderTop:"1px solid #ffffff0f",color:"#ccc",padding:"11px 16px",fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:13,cursor:"pointer",textAlign:"left"}}
                        onMouseEnter={e=>e.currentTarget.style.background="#ffffff12"}
                        onMouseLeave={e=>e.currentTarget.style.background="none"}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Quiz Modal ───────────────────────────────────────────────────────────────
export function QuizModal({quiz,onAnswer,onExpire,onClose,isShiny=false,limitStatus=null,streakLeader=null,myId=null}){ const {t}=useT();
  const [inp,setInp]=useState("");
  const [status,setStatus]=useState("open");
  const [outcome,setOutcome]=useState("card");  // 'card' | 'consolation' | 'hold'
  const [resultForge,setResultForge]=useState(0);  // PF réellement gagnés (0 = cap PF atteint)
  const [reportStatus,setReportStatus]=useState(()=>{
    if(!quiz.question_id) return 'idle';
    try { const r=JSON.parse(localStorage.getItem('gc_qreported')||'[]'); return r.includes(quiz.question_id)?'done':'idle'; } catch{return 'idle';}
  });
  const [elapsed,setElapsed]=useState(()=>{
    if(!quiz.started_at) return 0;
    return Math.floor((Date.now()-new Date(quiz.started_at).getTime())/1000);
  });
  const [shake,setShake]=useState(false);
  const [npc,setNpc]=useState(null);
  const [revealedLetters,setRevealedLetters]=useState(0);
  const [isSubmitting,setIsSubmitting]=useState(false);
  const [submitError,setSubmitError]=useState(null);
  const ref=useRef(); const doneRef=useRef(false); const submittingRef=useRef(false);
  // Figer l'état "brillant" au montage : un événement quiz:solved (annonçant le prochain
  // quiz) peut mettre à jour isShiny pendant que cette modale affiche encore le résultat.
  const isShinyFrozen=useRef(isShiny).current;
  const rc=RC[quiz.card.rarity]; const {c1,c2}=cardCC(quiz.card.rarity);
  const wc=wordCount(quiz.a);

  useEffect(() => {
    if (quiz.winner && status === "open" && !doneRef.current) {
      doneRef.current = true;
      setNpc(quiz.winner);
      setStatus("lost");
    }
  }, [quiz.winner, status]);

  useEffect(()=>{ref.current?.focus();},[]);

  useEffect(()=>{
    if(status!=="open") return;
    // Indices progressifs : révéler des lettres de la réponse
    if(elapsed===15) setRevealedLetters(1);      // après 15s
    else if(elapsed===30) setRevealedLetters(2); // après 30s
    const t=setTimeout(()=>setElapsed(v=>v+1),1000);
    return()=>clearTimeout(t);
  },[elapsed,status]);

  async function handleReport(){
    if(!quiz.question_id||reportStatus!=='idle') return;
    setReportStatus('loading');
    await apiReportQuestion(quiz.question_id).catch(()=>{});
    try { const r=JSON.parse(localStorage.getItem('gc_qreported')||'[]'); if(!r.includes(quiz.question_id)){r.push(quiz.question_id);localStorage.setItem('gc_qreported',JSON.stringify(r));} } catch(_){ /* ignore */ }
    setReportStatus('done');
  }
  function finish(n){if(doneRef.current)return;doneRef.current=true;setNpc(n || 'Un autre joueur');setStatus("lost");onExpire(n || 'Un autre joueur');}
    async function submit(){
    if(status!=="open") return;
    if(handicapLeft>0) return;  // série : cadeau aux autres, envoi bloqué côté client
    if(submittingRef.current) return
    submittingRef.current = true
    setIsSubmitting(true)
    const startedAt = Date.now()
    const result = await onAnswer(inp)
    const elapsed = Date.now() - startedAt
    if (elapsed < 600) await new Promise(r => setTimeout(r, 600 - elapsed))
    submittingRef.current = false
    setIsSubmitting(false)
    if (result && result.ok) { doneRef.current=true; setOutcome(result.outcome||'card'); setResultForge(result.forge||0); setStatus("won"); soundCorrect(); }
    else if (result && result.handicap) { setSubmitError(t('streak_handicap_wait')); } // série : délai cadeau pas encore écoulé
    else if (result === 'fast') { setSubmitError("⏱️ Réponse trop rapide ! Lis bien la question."); setIsSubmitting(false); submittingRef.current=false; return; }
    else if (result === 'late') { finish(null); }
    else if (result === 'error') { setSubmitError(t('quiz_answer_retry')); } // réseau/serveur : ne pas traiter comme faux (la réponse a pu aboutir)
    else { soundWrong(); setShake(true); setInp(""); setTimeout(()=>setShake(false),480); }
  }

  // Texte "jusqu'à quand" pour la bannière de limite atteinte
  const limitWhen = useMemo(()=>{
    if(!limitStatus?.over) return null;
    if(limitStatus.type==='daily') return t('limit_reset_midnight');
    if(limitStatus.type==='hourly' && limitStatus.resetAt){
      const min=Math.max(1,Math.ceil((new Date(limitStatus.resetAt).getTime()-Date.now())/60000));
      return t('limit_reset_in_min').replace('{n}',min);
    }
    return null;
  },[limitStatus,t]);
  // La carte ira-t-elle au dépôt (choix) ou sera convertie en PF (auto) ?
  const cardHoldable = limitStatus?.over && (quiz.card.rarity==='légendaire' || quiz.card.rarity==='épique' || isShinyFrozen);
  // Handicap anti-domination : si je suis le joueur en série, mon bouton est bloqué le temps du cadeau.
  // Exemption : pas de pénalité sur une carte rare (légendaire / épique brillante) → course équitable.
  const cardExempt     = isHandicapExemptCard(quiz.card.rarity, isShinyFrozen);
  const isStreakLeader = !!(streakLeader && myId && streakLeader.id === myId) && !cardExempt;
  const myHandicap     = isStreakLeader ? (streakLeader.handicap_seconds || 0) : 0;
  const handicapLeft   = Math.max(0, Math.ceil(myHandicap - elapsed));

  // Indice progressif : structure puis premières lettres réelles
  const maskedHint=useMemo(()=>{
    if(revealedLetters>=2 && quiz.answer_first_letters) {
      return quiz.answer_first_letters.split(' ').map(l=>`${l}…`).join('  ');
    }
    return null;
  },[quiz.answer_first_letters,revealedLetters]);
  return (
    <div style={{position:"fixed",inset:0,zIndex:800,background:"#000000bb",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <style>{`@keyframes shakeIt{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}} @keyframes winGlow{0%,100%{box-shadow:0 0 0 0 #00b89400}50%{box-shadow:0 0 32px 8px #00b89466}} @keyframes pulseBorder{0%,100%{box-shadow:0 0 0 0 rgba(231,76,60,.5)}50%{box-shadow:0 0 0 14px rgba(231,76,60,0)}}`}</style>
      <div style={{background:"linear-gradient(145deg,#1e3045,#1a2d42)",borderRadius:20,padding:"14px 16px",width:"min(calc(100vw - 40px),520px)",maxHeight:"calc(100dvh - 100px)",display:"flex",flexDirection:"column",boxSizing:"border-box",border:isShinyFrozen?"2px solid #f9ca24aa":"2px solid #f9ca2444",boxShadow:isShinyFrozen?"0 24px 60px #000c,0 0 40px #f9ca2433":"0 24px 60px #000c",fontFamily:"'Nunito',sans-serif"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{fontFamily:"'Fredoka One',sans-serif",fontSize:17,color:"#f9ca24"}}>{t("quiz_title")}</div>
            {status==="open" && <div style={{display:"flex",alignItems:"center",gap:4,color:"#00b894",fontSize:10,fontWeight:800}}>
              <span style={{display:"inline-block",width:6,height:6,background:"#00b894",borderRadius:"50%",animation:"pulse 1.5s infinite"}}/>
              Live
            </div>}
          </div>
          {status==="open"&&onClose&&<button onClick={onClose} style={{background:"#ffffff18",border:"none",color:"#888",width:26,height:26,borderRadius:"50%",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900}} title="Fermer">✕</button>}
        </div>
        {/* Signalement — en haut, loin du bouton Répondre pour éviter les clics par erreur */}
        <div style={{flexShrink:0,textAlign:"left",marginBottom:8}}>
          {reportStatus==='done'
            ? <span style={{fontSize:10,color:"#00b894",fontWeight:700}}>✓ {t('quiz_report_thanks')}</span>
            : <button onClick={handleReport} disabled={reportStatus==='loading'}
                style={{background:"none",border:"none",color:"#f39c12",fontSize:10,cursor:"pointer",fontFamily:"'Nunito',sans-serif",fontWeight:700,padding:0,textDecoration:"underline",opacity:reportStatus==='loading'?0.5:1}}>
                ⚠ {t('quiz_report_btn')}
              </button>
          }
        </div>
        {/* Bannière d'avertissement : limite atteinte — placée au-dessus du quiz (zone
            fixe) pour que la question reste collée au champ et lisible clavier ouvert */}
        {status==="open" && limitStatus?.over && (
          <div style={{flexShrink:0,background:"linear-gradient(135deg,#3a2a0e,#2a1f0a)",border:"1.5px solid #f9ca2466",borderRadius:12,padding:"10px 13px",marginBottom:12,display:"flex",gap:10,alignItems:"flex-start"}}>
            <span style={{fontSize:20,lineHeight:1.2,flexShrink:0}}>⚠️</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12.5,fontWeight:900,color:"#f9ca24",marginBottom:2}}>
                {(limitStatus.type==='hourly' ? t('quiz_limit_hourly_title') : t('quiz_limit_daily_title'))}
                {limitWhen ? <span style={{color:"#ffd97a",fontWeight:700}}> · {limitWhen}</span> : null}
              </div>
              <div style={{fontSize:11.5,color:"#e9d7a8",lineHeight:1.45}}>
                {limitStatus.forgeCapped
                  ? (cardHoldable ? t('quiz_limit_banner_hold_capped') : t('quiz_limit_banner_forge_capped'))
                  : (cardHoldable ? t('quiz_limit_banner_hold')        : t('quiz_limit_banner_forge'))}
              </div>
            </div>
          </div>
        )}
        {/* Bandeau série (handicap) — au-dessus de la question pour rester lisible mobile */}
        {status==="open" && streakLeader && !cardExempt && (!myId || streakLeader.id !== myId) && (streakLeader.handicap_seconds>0) && (
          <div style={{flexShrink:0,fontSize:11.5,fontWeight:800,color:"#ff8a5c",background:"#ff70431a",border:"1px solid #ff704344",borderRadius:10,padding:"7px 11px",marginBottom:10}}>
            🔥 {t('streak_handicap_others').replace('{pseudo}',streakLeader.pseudo).replace('{x}',streakLeader.handicap_seconds)}
          </div>
        )}
        {status==="open" && isStreakLeader && handicapLeft>0 && (
          <div style={{flexShrink:0,fontSize:11.5,fontWeight:800,color:"#ffd28a",background:"#ff70431a",border:"1px solid #ff7043aa",borderRadius:10,padding:"7px 11px",marginBottom:10}}>
            🎁 {t('streak_handicap_self').replace('{x}',handicapLeft)}
          </div>
        )}
        {/* Zone scrollable : carte + question (collée au champ de réponse en bas) */}
        <div style={{flex:1,minHeight:0,overflowY:"auto",overflowX:"hidden"}}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:12}}>
          <div style={{flexShrink:0,pointerEvents:"none"}}>
            <Card card={quiz.card} small isShiny={isShinyFrozen} />
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:800,color:"#fff",lineHeight:1.5,marginBottom:5}}>{quiz.q}</div>
            {maskedHint&&<div style={{fontSize:10,color:"#f39c12",fontFamily:"monospace",letterSpacing:2,animation:"pulse 1s infinite"}}>🔤 {maskedHint}</div>}
          </div>
        </div>
        </div>
        {/* Pied épinglé : saisie / résultat / signalement (toujours visible) */}
        <div style={{flexShrink:0}}>
        {status==="open"&&<>
          {isSubmitting && (
            <div style={{
              background:"linear-gradient(90deg,#f9ca24,#e17055)",
              color:"#1e3045",fontWeight:900,fontSize:14,
              padding:"12px 16px",borderRadius:12,marginBottom:12,
              display:"flex",alignItems:"center",justifyContent:"center",gap:10,
              animation:"pulse 1.2s ease-in-out infinite"
            }}>
              <span style={{display:"inline-block",width:18,height:18,border:"3px solid #1e3045",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
              ⏳ Validation côté serveur en cours…
            </div>
          )}
          <div style={{display:"flex",gap:9}}>
            {submitError&&<div style={{fontSize:12,color:"#f39c12",fontWeight:700,padding:"7px 10px",background:"#f39c1218",borderRadius:9,marginBottom:6,border:"1px solid #f39c1233"}}>{submitError}</div>}
            <input ref={ref} value={inp} disabled={isSubmitting} onChange={e=>{setInp(e.target.value);setSubmitError(null);}} onKeyDown={e=>{if(e.key==="Enter"&&handicapLeft===0)submit()}} placeholder={wc===1 ? t("quiz_placeholder_word") : t("quiz_placeholder_words").replace("{n}", wc)}
              style={{flex:1,background:isSubmitting?"#ffffff08":"#ffffff12",border:shake?"2px solid #e74c3c":isSubmitting?"2px solid #f9ca2422":"2px solid #f9ca2444",color:"#fff",padding:"10px 12px",borderRadius:11,fontFamily:"'Nunito',sans-serif",fontSize:14,fontWeight:700,outline:"none",animation:shake?"shakeIt .45s":"none",transition:"border .2s",opacity:isSubmitting?0.6:1}}/>
          <button onClick={submit} disabled={isSubmitting||!inp.trim()||handicapLeft>0} style={{...BTN(handicapLeft>0?"linear-gradient(135deg,#ff7043,#e17055)":"linear-gradient(135deg,#f9ca24,#e17055)","#1e3045"),padding:"10px 16px",borderRadius:11,opacity:(isSubmitting||!inp.trim()||handicapLeft>0)?0.6:1,cursor:(isSubmitting||!inp.trim()||handicapLeft>0)?"not-allowed":"pointer",minWidth:90,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              {handicapLeft>0 ? `🎁 ${handicapLeft}s` : isSubmitting ? (<><span style={{display:"inline-block",width:14,height:14,border:"2px solid #1e3045",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.6s linear infinite"}}/>{t("quiz_validating") || "Validation…"}</>) : t("quiz_submit")}
            </button>
          </div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)} } @keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}`}</style>
        </>}
        {/* Turnstile invisible — aucune UI visible */}
        {/* Résultat : geocoin gagné */}
        {status==="won"&&outcome==="card"&&<div style={{textAlign:"center",padding:"14px 0",background:"#00b89420",borderRadius:13,border:"1.5px solid #00b89444",animation:"winGlow 1.5s infinite"}}><div style={{fontSize:38}}>🎉</div><div style={{color:"#00b894",fontWeight:900,fontSize:19,marginTop:7}}>{t("quiz_won").replace("{card}",cardName(quiz.card, getLang()))}</div></div>}
        {/* Résultat : limite atteinte → PF au lieu du geocoin (ou rien si cap PF atteint) */}
        {status==="won"&&outcome==="consolation"&&(resultForge>0 ? (
          <div style={{textAlign:"center",padding:"16px 12px",background:"linear-gradient(135deg,#3a2a0e,#241a08)",borderRadius:13,border:"1.5px solid #f9ca2466"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,marginBottom:8}}>
              <span style={{position:"relative",fontSize:34,opacity:0.7,filter:"grayscale(0.4)"}}>
                🪙
                <span style={{position:"absolute",left:"-6%",top:"46%",width:"112%",height:3,background:"#e74c3c",borderRadius:2,transform:"rotate(-18deg)",boxShadow:"0 0 6px #e74c3c"}}/>
              </span>
              <span style={{fontSize:24,color:"#f9ca24",fontWeight:900}}>→</span>
              <span style={{fontSize:34,filter:"drop-shadow(0 0 8px #f9ca2488)"}}>⚒️</span>
            </div>
            <div style={{color:"#f9ca24",fontWeight:900,fontSize:18}}>+{resultForge} {t('forge_point_short')||'PF'}</div>
            <div style={{color:"#e9d7a8",fontWeight:700,fontSize:12,marginTop:4}}>{t('quiz_result_forge_instead')}</div>
          </div>
        ) : (
          <div style={{textAlign:"center",padding:"16px 12px",background:"#e74c3c14",borderRadius:13,border:"1.5px solid #e74c3c44"}}>
            <div style={{fontSize:32,marginBottom:6,opacity:0.85}}>🚫</div>
            <div style={{color:"#e74c3c",fontWeight:900,fontSize:15}}>{t('quiz_result_nothing')}</div>
          </div>
        ))}
        {/* Résultat : carte précieuse hors-limite → la HoldModal prend le relais */}
        {status==="won"&&outcome==="hold"&&(
          <div style={{textAlign:"center",padding:"14px 0",background:"#6c5ce71f",borderRadius:13,border:"1.5px solid #6c5ce755"}}>
            <div style={{fontSize:34}}>🗄️</div>
            <div style={{color:"#a29bfe",fontWeight:900,fontSize:15,marginTop:6}}>{t('quiz_limit_reached')||'Limite atteinte'}</div>
          </div>
        )}
        {status==="lost"&&<div style={{textAlign:"center",padding:"14px 0",background:"#e74c3c18",borderRadius:13,border:"1.5px solid #e74c3c44"}}><div style={{fontSize:36}}>😤</div><div style={{color:"#e74c3c",fontWeight:900,fontSize:17,marginTop:7}}>{t("quiz_lost").replace("{npc}", npc)}</div></div>}
        </div>
      </div>
    </div>
  );
}

// ─── Countdown Widget ─────────────────────────────────────────────────────────
const CW_STYLES = `
  @keyframes cdPop    { 0%{transform:scale(2.2);opacity:0} 55%{transform:scale(.88)} 100%{transform:scale(1);opacity:1} }
  @keyframes cdShake  { 0%,100%{transform:scale(1)} 20%{transform:scale(1.25) rotate(-4deg)} 60%{transform:scale(1.15) rotate(3deg)} }
  @keyframes cgSlide  { 0%{opacity:0;transform:translateY(12px) scale(.95)} 100%{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes cgTrophy { 0%{transform:scale(0) rotate(-25deg)} 65%{transform:scale(1.25) rotate(8deg)} 100%{transform:scale(1) rotate(0)} }
  @keyframes cgFade   { 0%{opacity:0;transform:translateX(-6px)} 100%{opacity:1;transform:translateX(0)} }
  @keyframes joinPulse    { 0%,100%{box-shadow:0 0 0 0 #f9ca2466,0 4px 14px #f9ca2433} 50%{box-shadow:0 0 0 6px #f9ca2400,0 4px 20px #f9ca2455} }
  @keyframes barSp    { 0%,100%{opacity:0;transform:scale(0) rotate(0deg)} 50%{opacity:1;transform:scale(1) rotate(180deg)} }
  @keyframes shinyGlow { 0%,100%{box-shadow:0 0 15px #f9ca2433} 50%{box-shadow:0 0 36px #f9ca2477, 0 0 70px #f9ca2422} }
  @keyframes cgFadeOut { 0%{opacity:1;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-8px) scale(.97)} }
`;

const BAR_SPARKLES = [
  { top:'20%', left:'3%',  size:11, delay:0,    color:'#fff' },
  { top:'65%', left:'13%', size:8,  delay:0.3,  color:'#f9ca24' },
  { top:'15%', left:'28%', size:9,  delay:0.6,  color:'#ff69b4' },
  { top:'70%', left:'40%', size:7,  delay:0.15, color:'#fff' },
  { top:'25%', left:'53%', size:10, delay:0.8,  color:'#4fc3f7' },
  { top:'68%', left:'65%', size:8,  delay:0.45, color:'#f9ca24' },
  { top:'12%', left:'77%', size:11, delay:0.7,  color:'#ce93d8' },
  { top:'72%', left:'88%', size:9,  delay:0.25, color:'#fff' },
  { top:'42%', left:'97%', size:7,  delay:0.55, color:'#69f0ae' },
];

export function CountdownWidget({secondsLeft,nextCard,nextQuizRarity=null,onJoin,hasPendingQuiz,lostTo=null,cycleTime=60,isShiny=false,owned=false,streakHype=null,streakLeader=null}){
  const {t}=useT(); const {theme}=useTheme();
  const pct        = Math.max(0, Math.min(100, ((cycleTime-secondsLeft)/cycleTime)*100))
  const urgent     = !hasPendingQuiz && !lostTo && secondsLeft <= 10
  const veryUrgent = urgent && secondsLeft <= 5 && secondsLeft > 0
  const hasCard    = !!nextCard && hasPendingQuiz
  const rc         = hasCard ? RC[nextCard.rarity] : null
  const showColors = urgent || hasPendingQuiz
  // Pendant le quiz actif : rareté de la carte. Pendant le teaser : rareté annoncée.
  const colorRarity = hasPendingQuiz ? nextCard?.rarity : (urgent ? nextQuizRarity : null)
  const {c1,c2}    = (colorRarity && showColors) ? cardCC(colorRarity) : {c1:'#6c7c93',c2:'#48576b'}
  const shinyActive = isShiny && (hasPendingQuiz || urgent)

  // ── Annonce « en feu » (série de victoires) — en grand, mais JAMAIS quand un
  // quiz est joignable (le bouton « Participer » reste prioritaire) ───────────
  if (streakHype && !hasPendingQuiz && !lostTo) {
    return (
      <>
        <style>{CW_STYLES}</style>
        <div style={{position:'relative',overflow:'hidden',display:'flex',alignItems:'center',gap:12,background:'linear-gradient(135deg,#3a1a0e,#7a2a10,#3a1a0e)',border:'1.5px solid #ff7043aa',borderRadius:13,padding:'12px 16px',boxShadow:'0 0 30px #ff704344',animation:streakHype.fading?'cgFadeOut .4s ease forwards':'cgSlide .4s cubic-bezier(.34,1.56,.64,1) both'}}>
          <div style={{fontSize:34,flexShrink:0,animation:'cdShake .5s ease-out'}}>🔥</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:15,fontWeight:900,color:'#ffd28a',lineHeight:1.2}}>
              {t('streak_hype_big').replace('{pseudo}', streakHype.pseudo).replace('{n}', streakHype.streak)}
            </div>
            {!streakHype.exempt && streakHype.handicap > 0 && (
              <div style={{fontSize:11,color:'#ffb07a',fontWeight:800,marginTop:3}}>
                {t('streak_hype_gift').replace('{x}', streakHype.handicap)}
              </div>
            )}
          </div>
        </div>
      </>
    )
  }

  // ── État "Félicitations" — quelqu'un vient de gagner ──────────────────────
  if (lostTo) {
    const {c1:wc1} = nextCard ? cardCC(nextCard.rarity) : {c1:'#f9ca24'}
    return (
      <>
        <style>{CW_STYLES}</style>
        <div style={{display:'flex',alignItems:'center',gap:11,background:'linear-gradient(135deg,#f9ca2412,#e1705508)',border:'1.5px solid #f9ca2455',borderRadius:13,padding:'10px 14px',boxShadow:'0 0 28px #f9ca2428',animation:'cgSlide .45s cubic-bezier(.34,1.56,.64,1) both'}}>
          <div style={{width:40,height:40,flexShrink:0,borderRadius:6,border:'2px solid #f9ca2466',background:'#1e3045',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,animation:'cgTrophy .5s .1s cubic-bezier(.34,1.56,.64,1) both',transform:'scale(0)'}}>
            🏆
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:900,color:'#f9ca24',marginBottom:2,animation:'cgFade .35s .2s ease both',opacity:0}}>
              🎉 Félicitations à <span style={{color:theme.textPrimary,fontWeight:900}}>{lostTo}</span> !
            </div>
            {nextCard && (
              <div style={{fontSize:10,color:theme.textSecondary,animation:'cgFade .35s .35s ease both',opacity:0}}>
                a remporté <span style={{color:wc1,fontWeight:800}}>{cardName(nextCard,getLang())}</span>
              </div>
            )}
            <div style={{background:theme.overlayMd,borderRadius:50,height:3,overflow:'hidden',marginTop:6}}>
              <div style={{width:'0%',height:'100%',background:'linear-gradient(90deg,#f9ca24,#e17055)',borderRadius:50}}/>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <style>{CW_STYLES}</style>
      <div style={{position:'relative',overflow:shinyActive?'hidden':'visible',display:'flex',alignItems:'center',gap:11,background:shinyActive?'linear-gradient(135deg,#b8860b22,#f9ca2415,#b8860b22)':urgent?`${c1}15`:theme.overlay,border:`1.5px solid ${shinyActive?'#f9ca2488':urgent?`${c1}55`:theme.border}`,borderRadius:13,padding:'9px 14px',transition:'background .5s,border-color .5s',animation:shinyActive?'shinyGlow 2s ease-in-out infinite':'none',boxShadow:urgent?`0 0 22px ${c1}44`:undefined}}>
        {shinyActive&&(
          <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:5,borderRadius:13}}>
            {BAR_SPARKLES.map((sp,i)=>(
              <div key={i} style={{position:'absolute',top:sp.top,left:sp.left,fontSize:sp.size,lineHeight:1,color:sp.color,animation:'barSp 1.8s ease-in-out infinite',animationDelay:`${sp.delay}s`,filter:`drop-shadow(0 0 ${Math.round(sp.size*.4)}px #fff) drop-shadow(0 0 ${Math.round(sp.size*.6)}px ${sp.color})`,userSelect:'none'}}>✦</div>
            ))}
          </div>
        )}

        {/* Thumbnail */}
        <div style={{position:'relative',width:40,height:40,flexShrink:0}}>
          <div style={{width:'100%',height:'100%',borderRadius:6,overflow:'hidden',border:`2px solid ${c1}`,background:'#1e3045',boxSizing:'border-box',transition:'border-color .5s,box-shadow .5s',boxShadow:(hasCard&&nextCard.rarity==='légendaire')?`0 0 12px ${c1}aa`:urgent?`0 0 10px ${c1}88`:'none'}}>
            {hasCard
              ? nextCard.image_url
                ? <ThumbImage src={nextCard.image_url} alt={cardName(nextCard,getLang())} style={{width:'100%',height:'100%',objectFit:'contain',imageRendering:'-webkit-optimize-contrast'}}/>
                : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:900,color:'#fff',background:`linear-gradient(135deg,${c1},${c2})`}}>{cardName(nextCard,getLang())[0]}</div>
              : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:900,color:urgent?c1:'#888',transition:'color .5s'}}>?</div>
            }
          </div>
          {shinyActive&&(
            <div style={{position:'absolute',top:-4,right:-4,zIndex:15,fontSize:12,animation:'shinySparkle 2s ease-in-out infinite',filter:'drop-shadow(0 0 3px gold)'}}>✨</div>
          )}
        </div>

        {/* Contenu central */}
        <div style={{flex:1,minWidth:0,position:'relative',minHeight:44}}>

          {/* ── Décompte géant (≤10 s) + état "lancement" (0 s) ── */}
          {urgent && (
            <div key={secondsLeft} style={{position:'absolute',top:0,right:0,bottom:0,left:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:3,pointerEvents:'none'}}>
              {secondsLeft > 0
                ? <span style={{
                    fontSize: veryUrgent ? 40 : 34,
                    fontWeight: 900,
                    fontFamily: "'Nunito',sans-serif",
                    color: c1,
                    lineHeight: 1,
                    textShadow: `0 0 18px ${c1}cc, 0 0 40px ${c1}55`,
                    animation: veryUrgent ? 'cdShake .45s ease-out' : 'cdPop .55s cubic-bezier(.34,1.56,.64,1)',
                  }}>{secondsLeft}</span>
                : <span style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: c1,
                    letterSpacing: 5,
                    textShadow: `0 0 12px ${c1}cc`,
                    animation: 'pulse .7s ease-in-out infinite',
                  }}>···</span>
              }
            </div>
          )}

          {/* Titre + secondes (masqué en mode urgent) */}
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:3,opacity:urgent?0:1,transition:'opacity .3s'}}>
            <span style={{fontSize:11,color:hasPendingQuiz?theme.gold:'#aaa',fontWeight:700}}>{hasPendingQuiz?t('quiz_new_card'):t('next_card')}</span>
            {!hasPendingQuiz&&<span style={{fontSize:13,fontWeight:900,color:theme.gold}}>{secondsLeft>0?`${secondsLeft}s`:'...'}</span>}
          </div>

          {/* Barre de progression */}
          <div style={{background:theme.overlayMd,borderRadius:50,height:urgent?8:5,overflow:'hidden',marginBottom:urgent?0:3,marginTop:urgent?30:0,transition:'height .4s,margin .4s'}}>
            <div style={{width:hasPendingQuiz?'100%':`${pct}%`,height:'100%',background:shinyActive?'linear-gradient(90deg,#f9ca24,#e17055)':`linear-gradient(90deg,${c1},${c2})`,borderRadius:50,transition:'width 1s linear,background .5s',boxShadow:urgent?`0 0 8px ${c1}`:''}}/>
          </div>

          {/* Infos carte (masquées en mode urgent) */}
          {!urgent&&(
            <div style={{fontSize:10,color:'#666'}}>
              {hasCard
                ? <><span style={{color:rc.color,fontWeight:800}}>{rarityLabel(nextCard.rarity,t)}</span> — <span style={{color:theme.textSecondary}}>{cardName(nextCard,getLang())}</span>{isShiny&&<span style={{color:'#f9ca24',fontWeight:800,marginLeft:6}}>{t('quiz_shiny_card')||'✨ Geocoin Brillant !'}</span>}</>
                : <span style={{color:theme.textMuted,fontStyle:'italic'}}>{t('quiz_mystery_card')}</span>}
            </div>
          )}
          {/* Déjà possédé — indiqué quand le geocoin précis apparaît */}
          {!urgent&&hasCard&&owned&&(
            <div style={{fontSize:9.5,fontWeight:800,color:'#3fb950',marginTop:2,display:'flex',alignItems:'center',gap:4}}>
              <span>✓</span>{t('quiz_already_owned')}
            </div>
          )}
          {/* Petit message : joueur en série (handicap bienveillant) — sauf carte exemptée */}
          {!urgent&&streakLeader&&(streakLeader.handicap_seconds>0)&&!isHandicapExemptCard(nextCard?.rarity,isShiny)&&(
            <div style={{fontSize:9.5,fontWeight:800,color:'#ff8a5c',marginTop:2,display:'flex',alignItems:'center',gap:4}}>
              <span>🔥</span>{t('streak_bar_small').replace('{pseudo}',streakLeader.pseudo).replace('{n}',streakLeader.streak).replace('{x}',streakLeader.handicap_seconds)}
            </div>
          )}
        </div>

        {/* Bouton participation */}
        {onJoin&&(
          <button onClick={hasPendingQuiz?onJoin:undefined}
            style={{
              background: hasPendingQuiz?'linear-gradient(135deg,#f9ca24,#e17055)':'#ffffff18',
              border: 'none',
              color: hasPendingQuiz?'#1e3045':'#666',
              padding: hasPendingQuiz?'10px 18px':'7px 13px',
              borderRadius: 10,
              fontFamily: "'Nunito',sans-serif",
              fontWeight: 900,
              fontSize: hasPendingQuiz?13:11,
              cursor: hasPendingQuiz?'pointer':'default',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              transition: 'all .4s cubic-bezier(.34,1.56,.64,1)',
              animation: hasPendingQuiz?'joinPulse 1.8s ease-in-out infinite':'none',
            }}>
            {t('quiz_participate')}
          </button>
        )}
      </div>
    </>
  )
}

// ── HoldModal — choix après quiz hors-limite : Dépôt OU 1 Point de Forge ──────
export function HoldModal({ holdCard, existingHold, onStored, onTakeForgePoint, forgeCapped = false }) {
  const { t } = useT()
  const { theme } = useTheme()
  const [loading, setLoading] = useState(false)
  const [confirmReplace, setConfirmReplace] = useState(false)  // étape de confirmation si dépôt occupé
  const { c1, c2 } = holdCard ? cardCC(holdCard.rarity) : { c1: '#6c5ce7', c2: '#a29bfe' }
  const rc = holdCard ? RC[holdCard.rarity] : null
  const hasExisting = !!existingHold?.card

  const doStore = useCallback(async () => {
    if (!holdCard || loading) return
    setLoading(true)
    await apiStoreHold(holdCard.id, holdCard.is_shiny || false)
    setLoading(false)
    onStored(holdCard)
  }, [holdCard, loading, onStored])

  // Clic sur "Mettre au dépôt" : si un objet est déjà déposé, demander confirmation.
  const handleStoreClick = useCallback(() => {
    if (hasExisting && !confirmReplace) { setConfirmReplace(true); return }
    doStore()
  }, [hasExisting, confirmReplace, doStore])

  const handleTakeForge = useCallback(async () => {
    if (loading) return
    setLoading(true)
    await onTakeForgePoint()
    setLoading(false)
  }, [loading, onTakeForgePoint])

  if (!holdCard) return null

  const existCard = existingHold?.card

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000a', padding: 20 }}>
      <div style={{ background: 'linear-gradient(145deg,#0f1923,#1a2736)', border: `1.5px solid ${c1}55`, borderRadius: 20, padding: '24px 22px', maxWidth: 380, width: '100%', boxShadow: `0 0 40px ${c1}33, 0 12px 40px #0008`, fontFamily: "'Nunito',sans-serif" }}>

        {/* Titre */}
        <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 17, color: '#f9ca24', marginBottom: 4 }}>
          🗄️ {t('hold_popup_title')}
        </div>
        <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 16, lineHeight: 1.5 }}>
          {t('hold_popup_body').replace('{rarity}', rarityLabel(holdCard.rarity, t))}
        </div>

        {/* Carte gagnée */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', background: `linear-gradient(135deg,${c1}18,${c2}12)`, border: `1px solid ${c1}44`, borderRadius: 14, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 9, overflow: 'hidden', flexShrink: 0, border: `2px solid ${c1}`, background: '#1e3045', boxShadow: `0 0 12px ${c1}44` }}>
            {holdCard.image_url
              ? <ThumbImage src={holdCard.image_url} alt={cardName(holdCard, getLang())} style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: '-webkit-optimize-contrast' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#fff', background: `linear-gradient(135deg,${c1},${c2})` }}>{cardName(holdCard, getLang())[0]}</div>
            }
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 14, color: '#ffffff' }}>{cardName(holdCard, getLang())}{holdCard.is_shiny ? ' ✨' : ''}</div>
            <div style={{ fontSize: 11, color: rc?.color, fontWeight: 800, marginTop: 2 }}>{rarityLabel(holdCard.rarity, t)}</div>
          </div>
        </div>

        {/* Étape de confirmation de remplacement — rappelle le geocoin déjà déposé */}
        {confirmReplace && hasExisting ? (
          <>
            <div style={{ fontSize: 12, color: '#f9ca24', background: '#f9ca2415', border: '1px solid #f9ca2444', borderRadius: 9, padding: '10px 12px', marginBottom: 14, lineHeight: 1.5 }}>
              {t('hold_popup_replace_named')
                .replace('{card}', cardName(existCard, getLang()) + (existingHold.is_shiny ? ' ✨' : ''))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={doStore} disabled={loading}
                style={{ ...BTN('linear-gradient(135deg,#e74c3c,#c0392b)'), flex: 1, padding: '11px 0', borderRadius: 11, fontSize: 13, opacity: loading ? 0.7 : 1 }}>
                {loading ? '…' : t('hold_popup_replace_confirm')}
              </button>
              <button onClick={() => setConfirmReplace(false)} disabled={loading}
                style={{ ...BTN('#ffffff18'), flex: 1, padding: '11px 0', borderRadius: 11, fontSize: 13, color: theme.textSecondary }}>
                {t('cancel') || 'Annuler'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Avertissement remplacement (avant confirmation) */}
            {hasExisting && (
              <div style={{ fontSize: 11, color: '#f9ca24', background: '#f9ca2415', border: '1px solid #f9ca2433', borderRadius: 9, padding: '7px 11px', marginBottom: 12 }}>
                {t('hold_popup_replace_named')
                  .replace('{card}', cardName(existCard, getLang()) + (existingHold.is_shiny ? ' ✨' : ''))}
              </div>
            )}

            {/* Note */}
            <div style={{ fontSize: 10, color: theme.textMuted, marginBottom: 16, display: 'flex', gap: 6 }}>
              <span>🕛</span>
              <span>{t('hold_popup_note')}</span>
            </div>

            {/* Boutons : Dépôt OU 1 Point de Forge (PF désactivé si cap PF atteint) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <button onClick={handleStoreClick} disabled={loading}
                style={{ ...BTN(`linear-gradient(135deg,${c1},${c2})`), padding: '12px 0', borderRadius: 11, fontSize: 13.5, opacity: loading ? 0.7 : 1 }}>
                🗄️ {t('hold_popup_store')}
              </button>
              {forgeCapped ? (
                <div style={{ textAlign: 'center', fontSize: 11, color: theme.textMuted, padding: '8px 0', fontWeight: 700 }}>
                  ⚒️ {t('hold_forge_capped_note')}
                </div>
              ) : (
                <button onClick={handleTakeForge} disabled={loading}
                  style={{ ...BTN('#ffffff14'), padding: '11px 0', borderRadius: 11, fontSize: 12.5, color: theme.textSecondary }}>
                  ⚒️ {t('hold_popup_take_forge')}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
