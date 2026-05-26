import { useState, useEffect, useRef, useMemo } from 'react';
import { soundCorrect, soundWrong } from '../../utils/sounds.js';
import { useT } from '../../i18n/translations.js';
import { useTheme } from '../../ThemeContext.jsx';
import { apiReportQuestion } from '../../services/api.js';
import { normA, wordCount } from '../../utils/gameUtils.js';
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
export function QuizModal({quiz,onAnswer,onExpire,onClose,isShiny=false}){ const {t}=useT();
  const [inp,setInp]=useState("");
  const [status,setStatus]=useState("open");
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
    if(submittingRef.current) return
    submittingRef.current = true
    setIsSubmitting(true)
    const startedAt = Date.now()
    const result = await onAnswer(inp)
    const elapsed = Date.now() - startedAt
    if (elapsed < 600) await new Promise(r => setTimeout(r, 600 - elapsed))
    submittingRef.current = false
    setIsSubmitting(false)
    if (result === true) { doneRef.current=true; setStatus("won"); soundCorrect(); }
    else if (result === 'fast') { setSubmitError("⏱️ Réponse trop rapide ! Lis bien la question."); setIsSubmitting(false); submittingRef.current=false; return; }
    else if (result === 'late') { finish(null); }
    else { soundWrong(); setShake(true); setInp(""); setTimeout(()=>setShake(false),480); }
  }

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
      <div style={{background:"linear-gradient(145deg,#1e3045,#1a2d42)",borderRadius:20,padding:"14px 16px",width:"min(96vw,520px)",border:isShiny?"2px solid #f9ca24aa":"2px solid #f9ca2444",boxShadow:isShiny?"0 24px 60px #000c,0 0 40px #f9ca2433":"0 24px 60px #000c",fontFamily:"'Nunito',sans-serif"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{fontFamily:"'Fredoka One',sans-serif",fontSize:17,color:"#f9ca24"}}>{t("quiz_title")}</div>
            {status==="open" && <div style={{display:"flex",alignItems:"center",gap:4,color:"#00b894",fontSize:10,fontWeight:800}}>
              <span style={{display:"inline-block",width:6,height:6,background:"#00b894",borderRadius:"50%",animation:"pulse 1.5s infinite"}}/>
              Live
            </div>}
          </div>
          {status==="open"&&onClose&&<button onClick={onClose} style={{background:"#ffffff18",border:"none",color:"#888",width:26,height:26,borderRadius:"50%",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900}} title="Fermer">✕</button>}
        </div>
        <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:12}}>
          <div style={{flexShrink:0,pointerEvents:"none"}}>
            <Card card={quiz.card} small isShiny={isShiny} />
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:800,color:"#fff",lineHeight:1.5,marginBottom:5}}>{quiz.q}</div>
            {maskedHint&&<div style={{fontSize:10,color:"#f39c12",fontFamily:"monospace",letterSpacing:2,animation:"pulse 1s infinite"}}>🔤 {maskedHint}</div>}
          </div>
        </div>
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
            <input ref={ref} value={inp} disabled={isSubmitting} onChange={e=>{setInp(e.target.value);setSubmitError(null);}} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder={wc===1 ? t("quiz_placeholder_word") : t("quiz_placeholder_words").replace("{n}", wc)}
              style={{flex:1,background:isSubmitting?"#ffffff08":"#ffffff12",border:shake?"2px solid #e74c3c":isSubmitting?"2px solid #f9ca2422":"2px solid #f9ca2444",color:"#fff",padding:"10px 12px",borderRadius:11,fontFamily:"'Nunito',sans-serif",fontSize:14,fontWeight:700,outline:"none",animation:shake?"shakeIt .45s":"none",transition:"border .2s",opacity:isSubmitting?0.6:1}}/>
          <button onClick={submit} disabled={isSubmitting||!inp.trim()} style={{...BTN("linear-gradient(135deg,#f9ca24,#e17055)","#1e3045"),padding:"10px 16px",borderRadius:11,opacity:(isSubmitting||!inp.trim())?0.5:1,cursor:(isSubmitting||!inp.trim())?"not-allowed":"pointer",minWidth:90,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              {isSubmitting ? (<><span style={{display:"inline-block",width:14,height:14,border:"2px solid #1e3045",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.6s linear infinite"}}/>{t("quiz_validating") || "Validation…"}</>) : t("quiz_submit")}
            </button>
          </div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)} } @keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}`}</style>
        </>}
        {/* Turnstile invisible — aucune UI visible */}
        {status==="won"&&<div style={{textAlign:"center",padding:"14px 0",background:"#00b89420",borderRadius:13,border:"1.5px solid #00b89444",animation:"winGlow 1.5s infinite"}}><div style={{fontSize:38}}>🎉</div><div style={{color:"#00b894",fontWeight:900,fontSize:19,marginTop:7}}>{t("quiz_won").replace("{card}",cardName(quiz.card, getLang()))}</div></div>}
        {status==="lost"&&<div style={{textAlign:"center",padding:"14px 0",background:"#e74c3c18",borderRadius:13,border:"1.5px solid #e74c3c44"}}><div style={{fontSize:36}}>😤</div><div style={{color:"#e74c3c",fontWeight:900,fontSize:17,marginTop:7}}>{t("quiz_lost").replace("{npc}", npc)}</div></div>}
        {/* Signalement */}
        <div style={{textAlign:"right",marginTop:8}}>
          {reportStatus==='done'
            ? <span style={{fontSize:10,color:"#00b894",fontWeight:700}}>✓ {t('quiz_report_thanks')}</span>
            : <button onClick={handleReport} disabled={reportStatus==='loading'}
                style={{background:"none",border:"none",color:"#f39c12",fontSize:10,cursor:"pointer",fontFamily:"'Nunito',sans-serif",fontWeight:700,padding:0,textDecoration:"underline",opacity:reportStatus==='loading'?0.5:1}}>
                ⚠ {t('quiz_report_btn')}
              </button>
          }
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

export function CountdownWidget({secondsLeft,nextCard,nextQuizRarity=null,onJoin,hasPendingQuiz,lostTo=null,cycleTime=60,isShiny=false}){
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
