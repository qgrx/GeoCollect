import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { soundCorrect, soundWrong } from '../../utils/sounds.js';
import { useT } from '../../i18n/translations.js';
import { useTheme } from '../../ThemeContext.jsx';
import { apiReportQuestion, apiStoreHold } from '../../services/api.js';
import { normA, wordCount, isHandicapExemptCard } from '../../utils/gameUtils.js';
import { RC, cardCC, rarityLabel, cardName } from '../../data/cards.js';
import { getLang } from '../../i18n/translations.js';
import { QUIZ_INTERVAL } from '../../data/constants.js';
import Card from '../../components/Card.jsx';
import Avatar from '../../components/Avatar.jsx';
import { BTN } from '../../utils/styles.js';

const SNOOZE_OPTIONS = [
  { label: '1 min',    ms: 60_000 },
  { label: '5 min',   ms: 5 * 60_000 },
  { label: '15 min',  ms: 15 * 60_000 },
  { label: '1 heure', ms: 60 * 60_000 },
];

// « X, Y & Z » — liste de pseudos jointe, neutre pour toutes les langues.
const joinNames = a => a.length <= 1 ? (a[0] || '') : `${a.slice(0, -1).join(', ')} & ${a[a.length - 1]}`;

// Ordinal localisé (« 1er / 2e », « 1st / 2nd », « 1. », « 1º ») pour le badge de rang.
const ordinal = n => {
  const l = getLang();
  if (l === 'en') return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
  if (l === 'de') return `${n}.`;
  if (l === 'es') return `${n}º`;
  return n === 1 ? '1er' : `${n}e`;
};

// Ligne « Pour la gloire : X, Y » — mini avatars + pseudos, affichée en plus petit
// sous le(s) gagnant(s) du round (modale de quiz et popup « Trop tard »).
// ── Design « en feu » collé à l'avatar ───────────────────────────────────────
// Série 1..seuil-1 : petite pastille 🔥+chiffre en bas à droite de l'avatar.
// Série ≥ seuil (« vraiment en feu ») : avatar ENFLAMMÉ — halo animé + flammes
// dansantes derrière le haut du cercle + pastille chiffre seul (3, 4, 5…).
// Entrées anciennes sans fire_streak (historique pré-snapshot) : 🔥 sans chiffre.
const FIRE_WRAP_CSS = `@keyframes fireGlow{0%,100%{filter:drop-shadow(0 0 3px #ff7043aa)}50%{filter:drop-shadow(0 0 10px #ff5722)}}
@keyframes fireDance{0%,100%{transform:translateY(0) scale(1) rotate(-4deg);opacity:.9}50%{transform:translateY(-16%) scale(1.15) rotate(5deg);opacity:1}}`;
export function FireWrap({ fire = false, streak = null, threshold = 3, size = 30, hint = null, style = {}, children }) {
  if (!fire) return <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, ...style }}>{children}</span>;
  const blazing = (Number(streak) || 0) >= Math.max(1, threshold);
  return (
    <span title={hint || undefined} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, ...(blazing ? { animation: 'fireGlow 1.5s ease-in-out infinite' } : {}), ...style }}>
      <style>{FIRE_WRAP_CSS}</style>
      {blazing && (
        <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: Math.round(-size * 0.30), display: 'flex', justifyContent: 'space-between', padding: `0 ${Math.round(size * 0.06)}px`, zIndex: 0, pointerEvents: 'none' }}>
          <span style={{ fontSize: Math.round(size * 0.40), lineHeight: 1, animation: 'fireDance 1.1s ease-in-out infinite' }}>🔥</span>
          <span style={{ fontSize: Math.round(size * 0.56), lineHeight: 1, animation: 'fireDance 1.3s ease-in-out .25s infinite' }}>🔥</span>
          <span style={{ fontSize: Math.round(size * 0.40), lineHeight: 1, animation: 'fireDance 1.2s ease-in-out .5s infinite' }}>🔥</span>
        </span>
      )}
      <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex' }}>{children}</span>
      <span style={{
        position: 'absolute', right: Math.round(-size * 0.10), bottom: Math.round(-size * 0.08), zIndex: 2,
        display: 'inline-flex', alignItems: 'center', gap: 1, pointerEvents: 'none',
        background: blazing ? 'linear-gradient(135deg,#ff9330,#e6330f)' : 'linear-gradient(135deg,#ff7043,#e74c3c)',
        borderRadius: 999, padding: `0 ${Math.max(2, Math.round(size * 0.08))}px`,
        height: Math.max(11, Math.round(size * 0.40)),
        boxShadow: '0 1px 4px #0007', border: '1px solid #ffffffaa',
      }}>
        {!blazing && <span style={{ fontSize: Math.max(7, Math.round(size * 0.26)), lineHeight: 1 }}>🔥</span>}
        {streak != null && <span style={{ fontSize: Math.max(8, Math.round(size * 0.30)), lineHeight: 1, color: '#fff', fontWeight: 900, fontFamily: "'Nunito',sans-serif" }}>{streak}</span>}
      </span>
    </span>
  );
}

function GloryRow({ glory, color = '#e9a8a8' }) {
  const { t } = useT();
  if (!Array.isArray(glory) || !glory.length) return null;
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5,marginTop:8,flexWrap:'wrap',padding:'0 8px'}}>
      <span style={{display:'flex'}}>
        {glory.map((g,i)=>(
          <FireWrap key={i} fire={!!g.fire} streak={g.fire_streak ?? null} size={18} style={{marginLeft:i?-6:0,zIndex:glory.length-i}}>
            <Avatar pseudo={g.pseudo} avatarUrl={g.avatar||null} verified={!!g.avatar} size={18}/>
          </FireWrap>
        ))}
      </span>
      <span style={{color,fontWeight:700,fontSize:11}}>
        🏆 {(t('quiz_glory_others')||'Pour la gloire : {names}').replace('{names}', joinNames(glory.map(g=>g.pseudo)))}
      </span>
      <GloryInfoButton size={11} />
    </div>
  );
}

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
    // Round multi-prix : citer TOUS les gagnants ; avatar(s) à la place du 😤 si dispo.
    const multiW=Array.isArray(quiz.winners)&&quiz.winners.length>1?quiz.winners:null;
    return (
      <div style={{position:"fixed",bottom:66,left:"50%",transform:"translateX(-50%)",zIndex:900,width:"min(96vw,400px)",background:"linear-gradient(135deg,#1e3045,#1a2d42)",border:`1.5px solid ${c1}66`,borderRadius:20,boxShadow:`0 16px 60px ${c1}33`,fontFamily:"'Nunito',sans-serif",animation:"slideUp 0.4s cubic-bezier(.34,1.56,.64,1) both",textAlign:"center",padding:"16px 20px"}}>
        {multiW
          ? <div style={{display:"flex",justifyContent:"center",marginBottom:8}}>{multiW.map((w,i)=>(<Avatar key={i} pseudo={w.pseudo} avatarUrl={w.avatar||null} verified={!!w.avatar} size={36} style={{marginLeft:i?-10:0,zIndex:multiW.length-i}}/>))}</div>
          : quiz.winner_avatar
          ? <div style={{display:"flex",justifyContent:"center",marginBottom:8}}><Avatar pseudo={quiz.winner} avatarUrl={quiz.winner_avatar} verified size={36}/></div>
          : <div style={{fontSize:32,marginBottom:8}}>😤</div>}
        <div style={{fontWeight:900,color:"#fff",fontSize:15,marginBottom:4}}>Trop tard !</div>
        <div style={{color:"#aaa",fontSize:13}}>
          <span style={{color:"#f9ca24",fontWeight:800}}>{multiW?joinNames(multiW.map(w=>w.pseudo)):quiz.winner}</span> {multiW?'ont remporté':'a remporté'} la carte <span style={{color:c1,fontWeight:800}}>{cardName(quiz.card, getLang())}</span>.
        </div>
        <GloryRow glory={Array.isArray(quiz.glory_winners)&&quiz.glory_winners.length?quiz.glory_winners:null} color="#8d9db1" />
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
// Petit bouton « ⓘ » qui explique le principe « Pour la gloire » dans une mini-popup.
// Réutilisé dans la barre de quiz et la popup des gagnants.
//
// ⚠️ La popup est DÉCOUPLÉE du bouton : elle est rendue par un hôte permanent
// (GloryInfoModalHost, monté une fois dans App) piloté par un singleton de
// module. Sinon, quand le bouton vit dans une bannière éphémère — ex. la
// bannière « Félicitations … a joué pour la gloire », affichée ~8 s puis
// démontée par useQuiz — le démontage détruisait le portail de la popup et la
// fermait en pleine lecture.
let _openGloryInfo = null;

export function GloryInfoButton({ size = 15 }) {
  const { t } = useT();
  return (
    <button onClick={e => { e.stopPropagation(); _openGloryInfo?.(); }} title={t('glory_info_title') || 'Pour la gloire ?'}
      style={{ background:'#f9ca2422', border:'1px solid #f9ca2566', color:'#f9ca24', width:size+5, height:size+5, minWidth:size+5, borderRadius:'50%', fontSize:size-4, fontWeight:900, cursor:'pointer', lineHeight:1, flexShrink:0, display:'inline-flex', alignItems:'center', justifyContent:'center', padding:0 }}>ⓘ</button>
  );
}

// Hôte permanent de la popup « Pour la gloire ». À monter UNE SEULE FOIS à la
// racine (App) pour que la popup survive au démontage du bouton déclencheur.
export function GloryInfoModalHost() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    _openGloryInfo = () => setOpen(true);
    return () => { if (_openGloryInfo) _openGloryInfo = null; };
  }, []);
  if (!open) return null;
  return createPortal((
    <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, zIndex:4000, display:'flex', alignItems:'center', justifyContent:'center', background:'#000b', backdropFilter:'blur(6px)', padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#1a2744', border:'1px solid #ffffff22', borderRadius:16, padding:'18px 20px', maxWidth:360, width:'100%', boxShadow:'0 20px 50px #0009', fontFamily:"'Nunito',sans-serif" }}>
        <div style={{ fontSize:15, fontWeight:900, color:'#f9ca24', marginBottom:9 }}>🏆 {t('glory_info_title') || '« Pour la gloire »'}</div>
        <div style={{ fontSize:12.5, color:'#cfd8e3', lineHeight:1.65, whiteSpace:'pre-line' }}>{t('glory_info_body') || ''}</div>
        <button onClick={() => setOpen(false)} style={{ marginTop:15, background:'linear-gradient(135deg,#f9ca24,#e17055)', border:'none', color:'#1e3045', padding:'8px 18px', borderRadius:10, fontWeight:900, cursor:'pointer', fontSize:12.5 }}>{t('shop_close') || 'Fermer'}</button>
      </div>
    </div>
  ), document.body);
}

// Petit bouton « ⓘ » qui explique la règle de la série « en feu » dans une popup
// fermable manuellement. Affiché dans la barre en feu (bandeau leader + annonce).
//
// ⚠️ Comme « Pour la gloire », la popup est DÉCOUPLÉE du bouton : rendue par un
// hôte permanent (FireInfoModalHost, monté une fois dans App) piloté par un
// singleton de module — la barre en feu est éphémère (teaser), son démontage ne
// doit pas fermer la popup en pleine lecture.
let _openFireInfo = null;

export function FireInfoButton({ size = 15 }) {
  const { t } = useT();
  return (
    <button onClick={e => { e.stopPropagation(); _openFireInfo?.(); }} title={t('fire_info_title') || 'Série « en feu »'}
      style={{ background:'#ff704322', border:'1px solid #ff704366', color:'#ff8a5c', width:size+5, height:size+5, minWidth:size+5, borderRadius:'50%', fontSize:size-4, fontWeight:900, cursor:'pointer', lineHeight:1, flexShrink:0, display:'inline-flex', alignItems:'center', justifyContent:'center', padding:0 }}>ⓘ</button>
  );
}

// Hôte permanent de la popup « Série en feu ». À monter UNE SEULE FOIS à la
// racine (App) pour que la popup survive au démontage du bouton déclencheur.
export function FireInfoModalHost() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    _openFireInfo = () => setOpen(true);
    return () => { if (_openFireInfo) _openFireInfo = null; };
  }, []);
  if (!open) return null;
  return createPortal((
    <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, zIndex:4000, display:'flex', alignItems:'center', justifyContent:'center', background:'#000b', backdropFilter:'blur(6px)', padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#1a2744', border:'1px solid #ffffff22', borderRadius:16, padding:'18px 20px', maxWidth:360, width:'100%', boxShadow:'0 20px 50px #0009', fontFamily:"'Nunito',sans-serif" }}>
        <div style={{ fontSize:15, fontWeight:900, color:'#ff8a5c', marginBottom:9 }}>🔥 {t('fire_info_title') || 'Série « en feu »'}</div>
        <div style={{ fontSize:12.5, color:'#cfd8e3', lineHeight:1.65, whiteSpace:'pre-line' }}>{t('fire_info_body') || ''}</div>
        <button onClick={() => setOpen(false)} style={{ marginTop:15, background:'linear-gradient(135deg,#ff8a5c,#e17055)', border:'none', color:'#1e3045', padding:'8px 18px', borderRadius:10, fontWeight:900, cursor:'pointer', fontSize:12.5 }}>{t('shop_close') || 'Fermer'}</button>
      </div>
    </div>
  ), document.body);
}

// Petit bouton « ⓘ » qui explique la limite atteinte (titre + délai de reset + ce
// qu'on gagne quand même) dans une popup. Permet de garder le bandeau du quiz sur
// une seule ligne pour que la question reste visible sans scroll.
//
// ⚠️ Comme « Pour la gloire », la popup est DÉCOUPLÉE du bouton : elle est rendue
// par un hôte permanent (LimitInfoModalHost) piloté par un singleton de module.
// Sinon, quand la manche de quiz tourne, le démontage du QuizModal détruisait le
// portail de la popup et la fermait en pleine lecture. Le contenu est passé au
// déclenchement car il dépend du contexte (limite horaire/quotidienne, carte
// déposable ou non).
let _openLimitInfo = null;

export function LimitInfoButton({ title, body, size = 14 }) {
  return (
    <button onClick={e => { e.stopPropagation(); _openLimitInfo?.(title, body); }} title={title}
      style={{ background:'#f9ca2422', border:'1px solid #f9ca2566', color:'#f9ca24', width:size+5, height:size+5, minWidth:size+5, borderRadius:'50%', fontSize:size-4, fontWeight:900, cursor:'pointer', lineHeight:1, flexShrink:0, display:'inline-flex', alignItems:'center', justifyContent:'center', padding:0 }}>ⓘ</button>
  );
}

// Hôte permanent de la popup « Limites atteintes ». À monter UNE SEULE FOIS à la
// racine (App) pour que la popup survive au démontage du bouton déclencheur.
export function LimitInfoModalHost() {
  const { t } = useT();
  const [info, setInfo] = useState(null);  // { title, body } | null
  useEffect(() => {
    _openLimitInfo = (title, body) => setInfo({ title, body });
    return () => { if (_openLimitInfo) _openLimitInfo = null; };
  }, []);
  if (!info) return null;
  return createPortal((
    <div onClick={() => setInfo(null)} style={{ position:'fixed', inset:0, zIndex:4000, display:'flex', alignItems:'center', justifyContent:'center', background:'#000b', backdropFilter:'blur(6px)', padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#1a2744', border:'1px solid #ffffff22', borderRadius:16, padding:'18px 20px', maxWidth:360, width:'100%', boxShadow:'0 20px 50px #0009', fontFamily:"'Nunito',sans-serif" }}>
        <div style={{ fontSize:15, fontWeight:900, color:'#f9ca24', marginBottom:9 }}>⚠️ {info.title}</div>
        <div style={{ fontSize:12.5, color:'#cfd8e3', lineHeight:1.65, whiteSpace:'pre-line' }}>{info.body}</div>
        <button onClick={() => setInfo(null)} style={{ marginTop:15, background:'linear-gradient(135deg,#f9ca24,#e17055)', border:'none', color:'#1e3045', padding:'8px 18px', borderRadius:10, fontWeight:900, cursor:'pointer', fontSize:12.5 }}>{t('shop_close') || 'Fermer'}</button>
      </div>
    </div>
  ), document.body);
}

export function QuizModal({quiz,onAnswer,onExpire,onClose,isShiny=false,limitStatus=null,upsell=null,streakLeaders=null,myId=null,onNeedQuestion=null,beginner=false,roundDuration=null,graceDeadline=null,alreadyOwned=false,holdState=null}){ const {t}=useT();
  const [inp,setInp]=useState("");
  const [status,setStatus]=useState("open");
  // Sélecteur de dépôt (remplacer / louer) ouvert quand le joueur choisit « dépôt » sans
  // slot gratuit : on ne débite jamais une location/un remplacement sur un tap accidentel.
  const [showHoldChooser,setShowHoldChooser]=useState(false);
  const [outcome,setOutcome]=useState("card");  // 'card' | 'consolation' | 'hold'
  const [resultForge,setResultForge]=useState(0);  // PF réellement gagnés (0 = cap PF atteint)
  const [reportStatus,setReportStatus]=useState(()=>{
    if(!quiz.question_id) return 'idle';
    try { const r=JSON.parse(localStorage.getItem('gc_qreported')||'[]'); return r.includes(quiz.question_id)?'done':'idle'; } catch{return 'idle';}
  });
  const [elapsed,setElapsed]=useState(()=>{
    if(!quiz.started_at) return 0;
    // Ancrage sur l'horloge serveur : un décalage d'horloge du device fait démarrer
    // `elapsed` en négatif, ce qui gonfle le décompte du handicap « cadeau aux autres »
    // au-dessus du plafond annoncé (ex. +8s affiché en décompte de 10s).
    // ⚠️ Le skew (client_skew_ms) est figé À LA RÉCEPTION du payload, pas recalculé ici :
    // recalculé au montage avec le server_time du fetch, les Date.now() s'annulent et
    // elapsed devient la constante server_time−started_at → fermer/rouvrir la fenêtre
    // faisait repartir le décompte « en feu » du début au lieu de continuer à défiler.
    const srvSkew=quiz.client_skew_ms??(quiz.server_time?(Date.now()-new Date(quiz.server_time).getTime()):0);
    return Math.floor((Date.now()-srvSkew-new Date(quiz.started_at).getTime())/1000);
  });
  const [shake,setShake]=useState(false);
  const [upsellBusy,setUpsellBusy]=useState(false);
  const [upsellConfirm,setUpsellConfirm]=useState(null);  // 'pocket' | 'bag' : confirmation d'achat ouverte
  const [npc,setNpc]=useState(null);
  const [isSubmitting,setIsSubmitting]=useState(false);
  const [submitError,setSubmitError]=useState(null);
  // Question récupérée après le délai cadeau (protection anti-domination) : le
  // serveur ne l'envoie pas au leader tant que sa fenêtre n'est pas écoulée.
  const [revealed,setRevealed]=useState(null);
  // iOS : le clavier ne réduit pas 100dvh, il recouvre le bas de l'écran. On suit
  // le visualViewport pour redimensionner la modale dans la zone réellement visible
  // (sinon iOS fait défiler la page et masque le haut de la question — cf. capture
  // où seule la dernière ligne de la question restait visible clavier ouvert).
  const [vv,setVv]=useState(null);
  const ref=useRef(); const doneRef=useRef(false); const submittingRef=useRef(false); const retryRef=useRef(0);
  // Figer l'état "brillant" au montage : un événement quiz:solved (annonçant le prochain
  // quiz) peut mettre à jour isShiny pendant que cette modale affiche encore le résultat.
  const isShinyFrozen=useRef(isShiny).current;
  const rc=RC[quiz.card.rarity]; const {c1,c2}=cardCC(quiz.card.rarity);
  const wc=wordCount(revealed?.a ?? quiz.a);
  // Mode Débutant : décompte de la manche (durée fixe). À 0 → « Trop tard » + réponse bloquée.
  const timeLeft=(beginner&&roundDuration!=null)?Math.max(0,Math.ceil(roundDuration-elapsed)):null;
  // Round multi-prix : un geocoin a été pris mais il en reste → décompte de grâce affiché
  // à tous (« encore Ns pour répondre »). À 0, la réponse est bloquée (round bientôt clos).
  // graceLeft se recalcule à chaque tick de `elapsed` (ticker actif tant que status='open').
  const graceLeft=(!beginner&&graceDeadline)?Math.max(0,Math.ceil((graceDeadline-Date.now())/1000)):null;
  const graceOver=graceLeft!=null&&graceLeft<=0;
  const tooLate=(beginner&&timeLeft!=null&&timeLeft<=0&&status==="open")||(graceOver&&status==="open");
  // Geocoin précieux déjà possédé ET hors-limite → proposer le CHOIX dépôt / gloire (double bouton).
  const isPreciousCard=quiz.card?.rarity==='légendaire'||quiz.card?.rarity==='épique'||isShiny;
  const showDepositChoice=status==="open"&&!beginner&&isPreciousCard&&!!limitStatus?.over&&alreadyOwned;
  // Disponibilité réelle du dépôt (même plan que le serveur), pour piloter le sélecteur
  // remplacer/louer. Un slot gratuit → dépôt direct ; sinon on propose remplacer OU louer,
  // et le bouton n'est désactivé QUE si aucune de ces options n'est possible/abordable.
  const hs=holdState||{};
  const hHolds=hs.holds||[];
  const hFreeSlot=(hHolds.filter(h=>!h.rented).length < (hs.holdSlots||0)) || (!!hs.holdRentActive && !hHolds.some(h=>h.rented));
  const hCanReplace=hHolds.length>0 && (hs.gold||0) >= (hs.replacePrice ?? 50);
  const hCanRent=!hs.holdRentActive && (hs.gold||0) >= (hs.rentPrice ?? 80);
  const canDeposit=hFreeSlot||hCanReplace||hCanRent;

  useEffect(() => {
    if (quiz.winner && status === "open" && !doneRef.current) {
      doneRef.current = true;
      setNpc(quiz.winner);
      setStatus("lost");
    }
  }, [quiz.winner, status]);

  useEffect(()=>{ref.current?.focus();},[]);

  // Suivi du visualViewport : hauteur visible (hors clavier) + décalage vertical.
  useEffect(()=>{
    const visualViewport=window.visualViewport;
    if(!visualViewport) return;
    const update=()=>setVv({height:visualViewport.height,offsetTop:visualViewport.offsetTop});
    update();
    visualViewport.addEventListener('resize',update);
    visualViewport.addEventListener('scroll',update);
    return()=>{visualViewport.removeEventListener('resize',update);visualViewport.removeEventListener('scroll',update);};
  },[]);

  useEffect(()=>{
    if(status!=="open"&&status!=="glory") return;  // glory : on continue de ticker pour rafraîchir le décompte de grâce
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
    async function submit(choiceArg, holdAction){
    if(status!=="open") return;
    if(tooLate) return;  // mode débutant : décompte terminé, réponse bloquée
    if(handicapLeft>0) return;  // série : cadeau aux autres, envoi bloqué côté client
    if(submittingRef.current) return
    submittingRef.current = true
    setIsSubmitting(true)
    const startedAt = Date.now()
    const result = await onAnswer(inp, choiceArg, holdAction)
    const elapsed = Date.now() - startedAt
    if (elapsed < 600) await new Promise(r => setTimeout(r, 600 - elapsed))
    submittingRef.current = false
    setIsSubmitting(false)
    if (result && result.ok) { doneRef.current=true; setOutcome(result.outcome||'card'); setResultForge(result.forge||0); setStatus(result.outcome==='glory'?"glory":"won"); soundCorrect(); retryRef.current=0; }
    else if (result && result.handicap) { setSubmitError(t('streak_handicap_wait')); } // série : délai cadeau pas encore écoulé
    else if (result === 'fast') { setSubmitError("⏱️ Réponse trop rapide ! Lis bien la question."); setIsSubmitting(false); submittingRef.current=false; return; }
    else if (result === 'blocked') { onClose?.(); }   // protection inter-modes (prochaine manche)
    else if (result === 'late') { if (beginner) { onClose?.(); } else finish(null); }
    else if (result === 'error') {
      // Réseau/5xx : la réponse a PEUT-ÊTRE abouti côté serveur (le serveur est
      // idempotent → renvoie « déjà gagné »). On revalide AUTOMATIQUEMENT la même
      // réponse, sans que le joueur la re-saisisse.
      if (retryRef.current < 3) {
        retryRef.current += 1;
        setSubmitError(t('quiz_answer_checking'));
        setIsSubmitting(true); submittingRef.current = true;
        setTimeout(() => { submittingRef.current = false; submit(choiceArg, holdAction); }, 1500);
        return;
      }
      retryRef.current = 0; setSubmitError(t('quiz_answer_retry'));
    }
    else { soundWrong(); setShake(true); setInp(""); setTimeout(()=>setShake(false),480); retryRef.current=0; }
  }

  // Texte "jusqu'à quand" pour la bannière de limite atteinte
  const limitWhen = useMemo(()=>{
    if(!limitStatus?.over) return null;
    if(limitStatus.type==='daily'||limitStatus.type==='shiny') return t('limit_reset_midnight');
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
  // PLUSIEURS joueurs peuvent être en feu (P places par round) : chacun subit SON
  // délai — on cherche MON entrée dans la liste au lieu du seul leader.
  const myFire         = (Array.isArray(streakLeaders) && myId) ? streakLeaders.find(l => l && l.id === myId) : null;
  const isStreakLeader = !!myFire && !cardExempt;
  const myHandicap     = isStreakLeader ? (myFire.handicap_seconds || 0) : 0;
  // Plafonné à myHandicap : le décompte affiché ne doit jamais dépasser la pénalité
  // annoncée (« +8s »), même en cas de skew résiduel ou de server_time absent.
  const handicapLeft   = Math.max(0, Math.min(myHandicap, Math.ceil(myHandicap - elapsed)));
  // Pénalité du joueur en série : la question lui est retenue (côté serveur) ET la
  // saisie/bouton bloqués pendant le délai cadeau → vraie longueur d'avance pour
  // les autres. displayedQ = question révélée (récupérée après le délai) ou celle
  // déjà reçue (non-leader / carte exemptée).
  const displayedQ     = revealed?.q ?? quiz.q;
  // Masqué tant qu'on est dans la fenêtre (défense en profondeur si la question a
  // fuité dans le payload) ou que la question retenue n'a pas encore été récupérée.
  const questionMasked = isStreakLeader && (handicapLeft > 0 || !displayedQ);

  // Fin du délai cadeau → récupérer la question retenue par le serveur (via /current).
  // Le serveur teste elapsedMs<handicapMs à la milliseconde près alors que le client
  // compte en secondes entières : sur la frontière (ou un aléa réseau) /current peut
  // encore retenir la question → on réessaie en boucle jusqu'à l'obtenir, sinon
  // 🔥 + « … » resteraient affichés indéfiniment.
  useEffect(()=>{
    if(status!=="open"||!isStreakLeader) return;
    if(handicapLeft>0||displayedQ) return;
    let cancelled=false; let timer;
    const tryFetch=()=>{
      Promise.resolve(onNeedQuestion?.()).then(d=>{
        if(cancelled) return;
        if(d) setRevealed(d);
        else timer=setTimeout(tryFetch,700);   // serveur retient encore → on réessaie
      }).catch(()=>{ if(!cancelled) timer=setTimeout(tryFetch,700); });
    };
    tryFetch();
    return ()=>{ cancelled=true; clearTimeout(timer); };
  },[status,isStreakLeader,handicapLeft,displayedQ]);

  // Clavier ouvert (ou écran court) → hauteur visible réduite : on bascule en mode
  // compact (vignette au lieu de la grande carte) pour que la question reste
  // entièrement lisible au-dessus du champ de saisie.
  const compact = !!vv && vv.height < 540;
  return (
    <div style={{position:"fixed",left:0,right:0,top:vv?vv.offsetTop:0,height:vv?vv.height:"100%",zIndex:800,background:"#000000bb",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",padding:compact?10:20}}>
      <style>{`@keyframes shakeIt{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}} @keyframes winGlow{0%,100%{box-shadow:0 0 0 0 #00b89400}50%{box-shadow:0 0 32px 8px #00b89466}} @keyframes pulseBorder{0%,100%{box-shadow:0 0 0 0 rgba(231,76,60,.5)}50%{box-shadow:0 0 0 14px rgba(231,76,60,0)}}`}</style>
      <div style={{background:"linear-gradient(145deg,#1e3045,#1a2d42)",borderRadius:20,padding:"14px 16px",width:"min(calc(100vw - 40px),520px)",maxHeight:vv?`${Math.max(0,vv.height-(compact?20:40))}px`:"calc(100dvh - 100px)",display:"flex",flexDirection:"column",boxSizing:"border-box",border:isShinyFrozen?"2px solid #f9ca24aa":"2px solid #f9ca2444",boxShadow:isShinyFrozen?"0 24px 60px #000c,0 0 40px #f9ca2433":"0 24px 60px #000c",fontFamily:"'Nunito',sans-serif"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <div style={{fontFamily:"'Fredoka One',sans-serif",fontSize:17,color:"#f9ca24"}}>{t("quiz_title")}</div>
            {quiz.prizes_total>1 && (
              <span style={{display:"inline-flex",alignItems:"center",gap:3,background:"linear-gradient(135deg,#6c5ce7,#a29bfe)",color:"#fff",fontSize:10,fontWeight:900,padding:"3px 8px",borderRadius:20,boxShadow:"0 2px 8px #6c5ce755"}}>
                🎁 {(t('quiz_prizes_to_win')||'{n} à gagner').replace('{n}',quiz.prizes_total)}
              </span>
            )}
            {status==="open" && (
              (beginner && timeLeft!=null)
                ? <div style={{display:"flex",alignItems:"center",gap:4,color:tooLate?"#e74c3c":(timeLeft<=10?"#e17055":"#00b894"),fontSize:11,fontWeight:900}}>
                    {tooLate ? `⏰ ${t('quiz_too_late')||'Trop tard'}` : `⏳ ${(t('beginner_time_left')||'Il reste {n}s pour répondre').replace('{n}',timeLeft)}`}
                  </div>
                : graceLeft!=null
                  ? <div style={{display:"flex",alignItems:"center",gap:4,color:graceOver?"#e74c3c":(graceLeft<=5?"#e74c3c":"#e17055"),fontSize:11,fontWeight:900,animation:"pulse 1s infinite"}}>
                      {graceOver ? `⏰ ${t('quiz_too_late')||'Trop tard'}` : `⏳ ${(t('quiz_grace_left')||'encore {n}s pour répondre').replace('{n}',graceLeft)}`}
                    </div>
                  : <div style={{display:"flex",alignItems:"center",gap:4,color:"#00b894",fontSize:10,fontWeight:800}}>
                      <span style={{display:"inline-block",width:6,height:6,background:"#00b894",borderRadius:"50%",animation:"pulse 1.5s infinite"}}/>
                      Live
                    </div>
            )}
          </div>
          {status==="open"&&onClose&&<button onClick={onClose} style={{background:"#ffffff18",border:"none",color:"#888",width:26,height:26,borderRadius:"50%",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900}} title="Fermer">✕</button>}
        </div>
        {/* Signalement — en haut, loin du bouton Répondre pour éviter les clics par erreur.
            Masqué en mode démo (pas de question_id) : rien à signaler côté visiteur. */}
        {quiz.question_id && <div style={{flexShrink:0,textAlign:"left",marginBottom:8}}>
          {reportStatus==='done'
            ? <span style={{fontSize:10,color:"#00b894",fontWeight:700}}>✓ {t('quiz_report_thanks')}</span>
            : <button onClick={handleReport} disabled={reportStatus==='loading'}
                style={{background:"none",border:"none",color:"#f39c12",fontSize:10,cursor:"pointer",fontFamily:"'Nunito',sans-serif",fontWeight:700,padding:0,textDecoration:"underline",opacity:reportStatus==='loading'?0.5:1}}>
                ⚠ {t('quiz_report_btn')}
              </button>
          }
        </div>}
        {/* Bandeau cadeau du leader uniquement — l'info aux autres joueurs a déjà
            été annoncée dans la barre (countdown), inutile de la répéter ici. */}
        {status==="open" && isStreakLeader && handicapLeft>0 && (
          <div style={{flexShrink:0,fontSize:11.5,fontWeight:800,color:"#ffd28a",background:"#ff70431a",border:"1px solid #ff7043aa",borderRadius:10,padding:"7px 11px",marginBottom:10}}>
            🎁 {t('streak_handicap_self').replace('{x}',handicapLeft)}
          </div>
        )}
        {/* Zone scrollable : bannière limite + carte + question (collée au champ en bas).
            La bannière est DANS le scroll (pas en section fixe) : sur viewport court
            (S23, clavier), les sections fixes ne dépassent plus le cadre et la question
            reste lisible / le bouton Répondre ne déborde plus. */}
        <div style={{flex:1,minHeight:0,overflowY:"auto",overflowX:"hidden"}}>
        {/* Bandeau limite atteinte — compacté sur UNE ligne (⚠️ « Limites atteintes » +
            ⓘ + bouton d'agrandissement) pour que la question reste visible sans scroll.
            Le détail (délai de reset, ce qu'on gagne quand même) est déporté dans la
            popup ⓘ (LimitInfoButton), et l'achat garde son panneau de confirmation
            Payer/Annuler (déplié sous la ligne quand on tape le bouton). */}
        {status==="open" && limitStatus?.over && (()=>{
          const bannerTitle = limitStatus.type==='hourly' ? t('quiz_limit_hourly_title') : limitStatus.type==='shiny' ? t('quiz_limit_shiny_title') : t('quiz_limit_daily_title');
          const bannerBody  = limitStatus.forgeCapped
            ? (cardHoldable ? t('quiz_limit_banner_hold_capped') : t('quiz_limit_banner_forge_capped'))
            : (cardHoldable ? t('quiz_limit_banner_hold')        : t('quiz_limit_banner_forge'));
          const infoBody    = (limitWhen ? `${bannerTitle} — ${limitWhen}\n\n` : '') + bannerBody + `\n\n${t('quiz_limit_info_note')}`;
          const pocket   = limitStatus.type==='hourly';
          const price    = upsell ? (pocket?upsell.pocketPrice:upsell.bagPrice) : null;
          // Cap shiny : ni le sac ni les poches ne l'augmentent → pas d'upsell trompeur.
          const showUpsell = upsell && price!=null && limitStatus.type!=='shiny';
          const poor     = (upsell?.gold??0)<price;
          const active   = upsellConfirm===(pocket?'pocket':'bag');
          const buy=async()=>{ if(upsellBusy||poor) return; setUpsellBusy(true); try{ await (pocket?upsell.onBuyPocket:upsell.onBuyBag)(); } finally{ setUpsellBusy(false); setUpsellConfirm(null); } };
          return (
          <div style={{background:"linear-gradient(135deg,#3a2a0e,#2a1f0a)",border:"1.5px solid #f9ca2466",borderRadius:12,padding:"8px 11px",marginBottom:12}}>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:15,lineHeight:1,flexShrink:0}}>⚠️</span>
              <span style={{fontSize:12.5,fontWeight:900,color:"#f9ca24",whiteSpace:"nowrap"}}>{t('quiz_limit_reached')}</span>
              <LimitInfoButton title={bannerTitle} body={infoBody} />
              {showUpsell && !active && (
                <button onClick={()=>{ if(!poor) setUpsellConfirm(pocket?'pocket':'bag'); }} disabled={poor} title={poor?t('limit_upsell_no_gold'):undefined}
                  style={{marginLeft:"auto",flexShrink:0,background:poor?"#ffffff10":"linear-gradient(135deg,#f9ca24,#e17055)",border:"none",color:poor?"#8d8d8d":"#1e2b3a",fontWeight:900,fontSize:11,padding:"6px 10px",borderRadius:9,cursor:poor?"not-allowed":"pointer",fontFamily:"'Nunito',sans-serif",whiteSpace:"nowrap"}}>
                  {pocket ? `🧤 ${t('limit_pocket_buy_short')} · ${price}💰` : `🎒 ${t('limit_bag_buy_short')} · ${price}💰`}
                </button>
              )}
            </div>
            {/* Achat en 2 temps — panneau Payer/Annuler (même pattern que l'achat
                d'emplacement du dépôt, TresorPage) : fiable mobile/desktop, pas de
                window.confirm. Le profil mis à jour recalcule limitStatus → la
                bannière se referme après paiement. */}
            {showUpsell && active && (
              <div style={{marginTop:8,background:"#00000033",border:"1px solid #f9ca2444",borderRadius:10,padding:"9px 11px"}}>
                <div style={{fontSize:11.5,color:"#e9d7a8",lineHeight:1.5,marginBottom:8}}>
                  {pocket
                    ? t('pocket_buy_confirm').replace('{price}',price).replace('{n}',upsell.pocketCards)
                    : t('bag_buy_confirm').replace('{price}',price)}
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={buy} disabled={upsellBusy}
                    style={{flex:1,background:"linear-gradient(135deg,#f9ca24,#e17055)",border:"none",color:"#1e2b3a",fontWeight:900,fontSize:12,padding:"8px 0",borderRadius:9,cursor:upsellBusy?"default":"pointer",fontFamily:"'Nunito',sans-serif",opacity:upsellBusy?0.6:1}}>
                    {upsellBusy ? '…' : `${t('hold_confirm_pay')} — ${price} G`}
                  </button>
                  <button onClick={()=>setUpsellConfirm(null)} disabled={upsellBusy}
                    style={{flex:1,background:"#ffffff18",border:"none",color:"#a8bfcf",fontWeight:900,fontSize:12,padding:"8px 0",borderRadius:9,cursor:"pointer",fontFamily:"'Nunito',sans-serif"}}>
                    {t('cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
          );
        })()}
        <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:12}}>
          <div style={{flexShrink:0,pointerEvents:"none"}}>
            {compact ? (
              <div style={{width:48,height:48,borderRadius:8,overflow:"hidden",border:`2px solid ${c1}`,background:"#1e3045",boxShadow:isShinyFrozen?`0 0 10px ${c1}aa`:"none"}}>
                {quiz.card.image_url
                  ? <ThumbImage src={quiz.card.image_url} alt={cardName(quiz.card,getLang())} style={{width:"100%",height:"100%",objectFit:"contain",imageRendering:"-webkit-optimize-contrast"}}/>
                  : <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:900,color:"#fff",background:`linear-gradient(135deg,${c1},${c2})`}}>{cardName(quiz.card,getLang())[0]}</div>}
              </div>
            ) : (
              <Card card={quiz.card} small isShiny={isShinyFrozen} />
            )}
          </div>
          <div style={{flex:1,minWidth:0}}>
            {questionMasked ? (
              <div style={{fontSize:13,fontWeight:800,color:"#ffd28a",lineHeight:1.5,display:"flex",alignItems:"center",gap:8,minHeight:42}}>
                <span style={{fontSize:22}}>🔥</span>
                <span>{handicapLeft>0 ? `${t('quiz_on_fire')} ${handicapLeft}s` : '…'}</span>
              </div>
            ) : (
              <div style={{fontSize:13,fontWeight:800,color:"#fff",lineHeight:1.5,marginBottom:5}}>{displayedQ}</div>
            )}
          </div>
        </div>
        </div>
        {/* Pied épinglé : saisie / résultat / signalement (toujours visible) */}
        <div style={{flexShrink:0}}>
        {/* Mode Débutant : décompte écoulé → « Trop tard », saisie masquée */}
        {status==="open"&&tooLate&&(
          <div style={{textAlign:"center",padding:"14px 0",background:"#e74c3c18",borderRadius:13,border:"1.5px solid #e74c3c44"}}>
            <div style={{fontSize:34}}>⏰</div>
            <div style={{color:"#e74c3c",fontWeight:900,fontSize:17,marginTop:6}}>{t('quiz_too_late')||'Trop tard !'}</div>
            <div style={{color:"#e9a8a8",fontWeight:700,fontSize:12,marginTop:4}}>{t('beginner_won_waiting')||'En attente du prochain geocoin…'}</div>
          </div>
        )}
        {status==="open"&&!tooLate&&<>
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
            <input ref={ref} value={inp} disabled={isSubmitting||questionMasked} onChange={e=>{setInp(e.target.value);setSubmitError(null);}} onKeyDown={e=>{if(e.key==="Enter"&&handicapLeft===0&&!questionMasked)submit(showDepositChoice?'glory':undefined)}} placeholder={questionMasked ? (handicapLeft>0?`🎁 ${handicapLeft}s`:"…") : (wc===1 ? t("quiz_placeholder_word") : t("quiz_placeholder_words").replace("{n}", wc))}
              style={{flex:1,background:(isSubmitting||questionMasked)?"#ffffff08":"#ffffff12",border:shake?"2px solid #e74c3c":(isSubmitting||questionMasked)?"2px solid #f9ca2422":"2px solid #f9ca2444",color:"#fff",padding:"10px 12px",borderRadius:11,fontFamily:"'Nunito',sans-serif",fontSize:14,fontWeight:700,outline:"none",animation:shake?"shakeIt .45s":"none",transition:"border .2s",opacity:(isSubmitting||questionMasked)?0.6:1}}/>
          {showDepositChoice ? (
            <div style={{display:"flex",flexDirection:"column",gap:5,flexShrink:0}}>
              <button onClick={()=> hFreeSlot ? submit('hold') : setShowHoldChooser(true)} disabled={isSubmitting||!inp.trim()||handicapLeft>0||questionMasked||!canDeposit} title={!canDeposit?(t("quiz_choice_deposit_full")||"Dépôt plein — impossible de déposer"):hFreeSlot?(t("quiz_choice_deposit_hint")||"Mettre un exemplaire au dépôt"):(t("quiz_choice_deposit_choose")||"Choisir : remplacer un geocoin ou louer un emplacement")} style={{...BTN("linear-gradient(135deg,#6c5ce7,#4834d4)","#fff"),padding:"6px 14px",borderRadius:10,opacity:(isSubmitting||!inp.trim()||handicapLeft>0||questionMasked||!canDeposit)?0.6:1,cursor:(isSubmitting||!inp.trim()||handicapLeft>0||questionMasked||!canDeposit)?"not-allowed":"pointer",minWidth:98,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",lineHeight:1.05}}>
                <span style={{fontSize:12,fontWeight:900}}>{t("quiz_submit")}</span><span style={{fontSize:9,fontWeight:800,opacity:.9}}>📥 {t("quiz_choice_deposit")||'dépôt'}{hFreeSlot?'':'…'}</span>
              </button>
              <button onClick={()=>submit('glory')} disabled={isSubmitting||!inp.trim()||handicapLeft>0||questionMasked} title={t("quiz_choice_glory_hint")||"Jouer pour la gloire (or + PF)"} style={{...BTN("linear-gradient(135deg,#f9ca24,#e17055)","#1e3045"),padding:"6px 14px",borderRadius:10,opacity:(isSubmitting||!inp.trim()||handicapLeft>0||questionMasked)?0.6:1,cursor:(isSubmitting||!inp.trim()||handicapLeft>0||questionMasked)?"not-allowed":"pointer",minWidth:98,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",lineHeight:1.05}}>
                <span style={{fontSize:12,fontWeight:900}}>{t("quiz_submit")}</span><span style={{fontSize:9,fontWeight:800,opacity:.9}}>🏆 {t("quiz_choice_glory")||'gloire'}</span>
              </button>
            </div>
          ) : (
          <button onClick={()=>submit()} disabled={isSubmitting||!inp.trim()||handicapLeft>0||questionMasked} style={{...BTN(handicapLeft>0?"linear-gradient(135deg,#ff7043,#e17055)":"linear-gradient(135deg,#f9ca24,#e17055)","#1e3045"),padding:"10px 16px",borderRadius:11,opacity:(isSubmitting||!inp.trim()||handicapLeft>0||questionMasked)?0.6:1,cursor:(isSubmitting||!inp.trim()||handicapLeft>0||questionMasked)?"not-allowed":"pointer",minWidth:90,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              {handicapLeft>0 ? `🎁 ${handicapLeft}s` : isSubmitting ? (<><span style={{display:"inline-block",width:14,height:14,border:"2px solid #1e3045",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.6s linear infinite"}}/>{t("quiz_validating") || "Validation…"}</>) : t("quiz_submit")}
            </button>
          )}
          </div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)} } @keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}`}</style>
        </>}
        {/* Turnstile invisible — aucune UI visible */}
        {/* Résultat : geocoin gagné */}
        {status==="won"&&outcome==="card"&&<div style={{textAlign:"center",padding:"14px 0",background:"#00b89420",borderRadius:13,border:"1.5px solid #00b89444",animation:"winGlow 1.5s infinite"}}><div style={{fontSize:38}}>🎉</div><div style={{color:"#00b894",fontWeight:900,fontSize:19,marginTop:7}}>{t("quiz_won").replace("{card}",cardName(quiz.card, getLang()))}</div>{beginner&&<div style={{color:"#8fe3c8",fontWeight:700,fontSize:12,marginTop:6}}>{t("beginner_won_waiting")}</div>}</div>}
        {/* Mode Débutant hors-limite : pas de PF — message neutre et positif */}
        {status==="won"&&outcome==="consolation"&&beginner&&(
          <div style={{textAlign:"center",padding:"16px 12px",background:"#00b89418",borderRadius:13,border:"1.5px solid #00b89444"}}>
            <div style={{fontSize:30,marginBottom:6}}>🪙</div>
            <div style={{color:"#00b894",fontWeight:900,fontSize:15}}>{t('quiz_limit_reached')||'Limite de geocoins atteinte'}</div>
            <div style={{color:"#8fe3c8",fontWeight:700,fontSize:12,marginTop:4}}>{t('beginner_won_waiting')}</div>
          </div>
        )}
        {/* Résultat : limite atteinte → PF au lieu du geocoin (ou rien si cap PF atteint) */}
        {status==="won"&&outcome==="consolation"&&!beginner&&(resultForge>0 ? (
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
        {status==="lost"&&(()=>{
          // Round multi-prix : afficher TOUS les gagnants (avatars + pseudos), pas seulement le 1er.
          const multiW=Array.isArray(quiz.winners)&&quiz.winners.length>1?quiz.winners:null;
          // Avatar du gagnant unique — seulement si npc correspond bien au gagnant annoncé
          // (finish() peut poser « Un autre joueur » sans que quiz.winner soit connu).
          const lostAvatar=(!multiW&&npc&&quiz.winner===npc)?(quiz.winner_avatar||null):null;
          // Joueurs « pour la gloire » du round — affichés en plus petit sous le(s) gagnant(s).
          const gloryW=Array.isArray(quiz.glory_winners)&&quiz.glory_winners.length?quiz.glory_winners:null;
          return (
            <div style={{textAlign:"center",padding:"14px 12px",background:"#e74c3c18",borderRadius:13,border:"1.5px solid #e74c3c44"}}>
              {multiW ? (
                <>
                  <div style={{display:"flex",justifyContent:"center"}}>
                    {multiW.map((w,i)=>(
                      <FireWrap key={i} fire={!!w.fire} streak={w.fire_streak ?? null} size={40} style={{marginLeft:i?-10:0,zIndex:multiW.length-i}}>
                        <Avatar pseudo={w.pseudo} avatarUrl={w.avatar||null} verified={!!w.avatar} size={40}/>
                      </FireWrap>
                    ))}
                  </div>
                  <div style={{color:"#e74c3c",fontWeight:900,fontSize:16,marginTop:7}}>{(t("quiz_lost_multi")||"{names} ont remporté le geocoin !").replace("{names}", joinNames(multiW.map(w=>w.pseudo)))}</div>
                </>
              ) : (
                <>
                  {lostAvatar
                    ? <div style={{display:"flex",justifyContent:"center"}}>
                        <FireWrap fire={!!quiz.winner_fire_info} streak={quiz.winner_fire_info?.fire_streak ?? null} size={44}>
                          <Avatar pseudo={npc} avatarUrl={lostAvatar} verified size={44}/>
                        </FireWrap>
                      </div>
                    : <div style={{fontSize:36}}>😤</div>}
                  <div style={{color:"#e74c3c",fontWeight:900,fontSize:17,marginTop:7}}>{t("quiz_lost").replace("{npc}", npc)}</div>
                </>
              )}
              <GloryRow glory={gloryW} />
            </div>
          );
        })()}
        {status==="glory"&&(
          <div style={{textAlign:"center",padding:"16px 12px",background:"linear-gradient(135deg,#f9ca2418,#e1705512)",borderRadius:13,border:"1.5px solid #f9ca2466"}}>
            <div style={{fontSize:34,marginBottom:6}}>🏆</div>
            <div style={{color:"#f9ca24",fontWeight:900,fontSize:17}}>{t('quiz_glory_title')}</div>
            <div style={{color:"#ffd97a",fontWeight:700,fontSize:12,marginTop:6,lineHeight:1.5}}>{t('quiz_glory_subtitle')}</div>
            {graceLeft!=null&&graceLeft>0&&(
              <div style={{color:"#ffd97a",fontWeight:900,fontSize:13,marginTop:11,animation:"pulse 1s infinite"}}>
                ⏳ {(t('quiz_glory_grace_countdown')||'Les autres joueurs ont encore {n}s pour répondre à la question.').replace('{n}',graceLeft)}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
      {/* Sélecteur de dépôt (dépôt plein / location payante) : le joueur choisit
          EXPLICITEMENT remplacer un geocoin OU louer avant tout débit. Annuler ⇒ retour
          au quiz (il peut encore jouer pour la gloire). La réponse n'est soumise (et le
          prix débité) qu'au choix confirmé, via submit('hold', {rent, replaceId}). */}
      {showHoldChooser && showDepositChoice && (
        <HoldModal
          holdCard={{ ...quiz.card, id: quiz.card.id, is_shiny: isShinyFrozen }}
          holds={hHolds}
          holdSlots={hs.holdSlots||0}
          holdRentActive={!!hs.holdRentActive}
          rentPrice={hs.rentPrice ?? 80}
          replacePrice={hs.replacePrice ?? 50}
          gold={hs.gold||0}
          owned={true}
          onClose={()=>setShowHoldChooser(false)}
          onChoose={(action)=>{ setShowHoldChooser(false); submit('hold', action); }}
        />
      )}
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

export function CountdownWidget({secondsLeft,nextCard,nextQuizRarity=null,onJoin,hasPendingQuiz,lostTo=null,lostToGlory=false,lostToAvatar=null,lostToWinners=null,lostToGloryWinners=null,lostToFire=null,cycleTime=60,isShiny=false,owned=false,streakHype=null,streakLeaders=null,prizesTotal=1,graceDeadline=null}){
  const {t}=useT(); const {theme}=useTheme();
  // Décompte de grâce « encore Ns pour répondre » (gloire / multi-prix) — ticker local 1 s.
  const [,graceTick]=useState(0)
  useEffect(()=>{ if(!graceDeadline) return; const i=setInterval(()=>graceTick(v=>v+1),1000); return()=>clearInterval(i) },[graceDeadline])
  const graceLeft  = graceDeadline ? Math.max(0, Math.ceil((graceDeadline-Date.now())/1000)) : null
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
  // Joueurs « en feu » (série de victoires) à signaler pour la prochaine carte —
  // ils peuvent être PLUSIEURS (P places par round), chacun avec son délai.
  const fireList = (Array.isArray(streakLeaders) ? streakLeaders : []).filter(l => l && l.handicap_seconds > 0)
  const onFire   = fireList.length > 0 && !isHandicapExemptCard(nextCard?.rarity, isShiny)

  // ── Annonce « en feu » (série de victoires) — en grand, mais JAMAIS quand un
  // quiz est joignable (le bouton « Participer » reste prioritaire) ───────────
  if (streakHype && !hasPendingQuiz && !lostTo) {
    return (
      <>
        <style>{CW_STYLES}</style>
        <div style={{position:'relative',overflow:'hidden',display:'flex',alignItems:'center',gap:12,background:'linear-gradient(135deg,#3a1a0e,#7a2a10,#3a1a0e)',border:'1.5px solid #ff7043aa',borderRadius:13,padding:'12px 16px',boxShadow:'0 0 30px #ff704344',animation:streakHype.fading?'cgFadeOut .4s ease forwards':'cgSlide .4s cubic-bezier(.34,1.56,.64,1) both'}}>
          <div style={{fontSize:34,flexShrink:0,animation:'cdShake .5s ease-out'}}>🔥</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:15,fontWeight:900,color:'#ffd28a',lineHeight:1.2,display:'flex',alignItems:'center',gap:6}}>
              <span>{t('streak_hype_big').replace('{pseudo}', streakHype.pseudo).replace('{n}', streakHype.streak)}</span>
              <FireInfoButton size={12}/>
            </div>
            {!streakHype.exempt && streakHype.handicap > 0 && (
              <div style={{fontSize:11,color:'#ffb07a',fontWeight:800,marginTop:3}}>
                {t('streak_hype_gift').replace('{x}', streakHype.handicap).replace('{pseudo}', streakHype.pseudo)}
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
    // Round multi-prix : féliciter TOUS les gagnants (avatars empilés + pseudos joints).
    const lw = Array.isArray(lostToWinners)&&lostToWinners.length>1 ? lostToWinners : null
    return (
      <>
        <style>{CW_STYLES}</style>
        <div style={{display:'flex',alignItems:'center',gap:11,background:'linear-gradient(135deg,#f9ca2412,#e1705508)',border:'1.5px solid #f9ca2455',borderRadius:13,padding:'10px 14px',boxShadow:'0 0 28px #f9ca2428',animation:'cgSlide .45s cubic-bezier(.34,1.56,.64,1) both'}}>
          <div style={{flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',animation:'cgTrophy .5s .1s cubic-bezier(.34,1.56,.64,1) both',transform:'scale(0)'}}>
            {lw
              ? lw.map((w,i)=>(
                  <FireWrap key={i} fire={!!w.fire} streak={w.fire_streak ?? null} size={40} style={{marginLeft:i?-12:0,zIndex:lw.length-i}}>
                    <Avatar pseudo={w.pseudo} avatarUrl={w.avatar||null} verified={!!w.avatar} size={40}/>
                  </FireWrap>
                ))
              : <FireWrap fire={!!lostToFire} streak={lostToFire?.fire_streak ?? null} size={40}>
                  {lostToAvatar
                    ? <Avatar pseudo={lostTo} avatarUrl={lostToAvatar} verified size={40} />
                    : <div style={{width:40,height:40,borderRadius:6,border:'2px solid #f9ca2466',background:'#1e3045',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>🏆</div>}
                </FireWrap>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:900,color:'#f9ca24',marginBottom:2,animation:'cgFade .35s .2s ease both',opacity:0}}>
              🎉 Félicitations à <span style={{color:theme.textPrimary,fontWeight:900}}>{lw?joinNames(lw.map(w=>w.pseudo)):lostTo}</span> !
            </div>
            {lostToGlory ? (
              <div style={{fontSize:10,color:theme.textSecondary,display:'flex',alignItems:'center',gap:5,animation:'cgFade .35s .35s ease both',opacity:0}}>
                <span>🏆 {lw?(t('glory_played_plural')||'ont joué pour la gloire'):(t('glory_played')||'a joué pour la gloire')}</span>
                <GloryInfoButton size={12} />
              </div>
            ) : nextCard && (
              <div style={{fontSize:10,color:theme.textSecondary,animation:'cgFade .35s .35s ease both',opacity:0}}>
                {lw?'ont remporté':'a remporté'} <span style={{color:wc1,fontWeight:800}}>{cardName(nextCard,getLang())}</span>
              </div>
            )}
            {/* Joueurs « pour la gloire » du round — en plus petit sous le(s) gagnant(s)
                (uniquement quand le geocoin a un vrai gagnant ; sinon la bannière entière
                leur est déjà consacrée via lostToGlory). */}
            {!lostToGlory && Array.isArray(lostToGloryWinners) && lostToGloryWinners.length>0 && (
              <div style={{fontSize:10,color:theme.textSecondary,display:'flex',alignItems:'center',gap:4,marginTop:3,minWidth:0,animation:'cgFade .35s .45s ease both',opacity:0}}>
                <span style={{display:'flex',flexShrink:0}}>
                  {lostToGloryWinners.map((g,i)=>(
                    <FireWrap key={i} fire={!!g.fire} streak={g.fire_streak ?? null} size={15} style={{marginLeft:i?-5:0,zIndex:lostToGloryWinners.length-i}}>
                      <Avatar pseudo={g.pseudo} avatarUrl={g.avatar||null} verified={!!g.avatar} size={15}/>
                    </FireWrap>
                  ))}
                </span>
                <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>🏆 {(t('quiz_glory_others')||'Pour la gloire : {names}').replace('{names}',joinNames(lostToGloryWinners.map(g=>g.pseudo)))}</span>
                <GloryInfoButton size={11}/>
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
          {/* Coche « déjà possédé » sur l'image — identique au marché */}
          {hasCard&&owned&&(
            <div title={t('quiz_already_owned')} style={{position:'absolute',bottom:-4,right:-4,zIndex:16,width:16,height:16,borderRadius:'50%',background:'#00b894',border:`2px solid ${theme.bgSurface}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#fff',fontWeight:900,lineHeight:1,boxShadow:'0 1px 3px #0006'}}>✓</div>
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
            <span style={{fontSize:11,color:hasPendingQuiz?theme.gold:'#aaa',fontWeight:900}}>⚔️ {t('pvp_badge')||'Mode PVP'}</span>
            {!hasPendingQuiz&&<span style={{fontSize:13,fontWeight:900,color:theme.gold}}>{secondsLeft>0?`${secondsLeft}s`:'...'}</span>}
          </div>

          {/* Barre de progression */}
          <div style={{background:theme.overlayMd,borderRadius:50,height:urgent?8:5,overflow:'hidden',marginBottom:urgent?0:3,marginTop:urgent?30:0,transition:'height .4s,margin .4s'}}>
            <div style={{width:hasPendingQuiz?'100%':`${pct}%`,height:'100%',background:shinyActive?'linear-gradient(90deg,#f9ca24,#e17055)':`linear-gradient(90deg,${c1},${c2})`,borderRadius:50,transition:'width 1s linear,background .5s',boxShadow:urgent?`0 0 8px ${c1}`:''}}/>
          </div>

          {/* Infos carte (masquées en mode urgent). Pour un geocoin mystère, le message
              « joueur en feu » remplace le texte « Geocoin mystère ». */}
          {!urgent&&(
            <div style={{fontSize:10,color:'#666',display:'flex',alignItems:'center',gap:4}}>
              {graceLeft!=null&&graceLeft>0
                ? <span style={{color:'#e17055',fontWeight:900,animation:'pulse 1s infinite'}}>⏳ {(t('quiz_grace_left')||'encore {n}s pour répondre').replace('{n}',graceLeft)}</span>
                : hasCard
                ? <><span style={{color:rc.color,fontWeight:800}}>{rarityLabel(nextCard.rarity,t)}</span> — <span style={{color:theme.textSecondary}}>{cardName(nextCard,getLang())}</span>{isShiny&&<span style={{color:'#f9ca24',fontWeight:800,marginLeft:6}}>{t('quiz_shiny_card')||'✨ Geocoin Brillant !'}</span>}{prizesTotal>1&&<span style={{color:'#a29bfe',fontWeight:900,marginLeft:6}}>🎁 {(t('quiz_prizes_to_win')||'{n} à gagner').replace('{n}',prizesTotal)}</span>}</>
                : onFire
                  ? <><span style={{color:'#ff8a5c',fontWeight:800}}>🔥 {fireList.length>1
                      ? (t('streak_bar_small_multi')||'{names} sont en feu').replace('{names}',fireList.map(l=>`${l.pseudo} (${l.streak})`).join(', '))
                      : t('streak_bar_small').replace('{pseudo}',fireList[0].pseudo).replace('{n}',fireList[0].streak).replace('{x}',fireList[0].handicap_seconds)}</span><FireInfoButton size={11}/></>
                  : <span style={{color:theme.textMuted,fontStyle:'italic'}}>{t('next_card')}</span>}
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
              touchAction: 'manipulation',
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
export function HoldModal({ holdCard, holds = [], holdSlots = 0, holdRentActive = false, rentPrice = 80, replacePrice = 50, gold = 0, onStored, onStoreError, onTakeForgePoint, onClose, forgeCapped = false, owned = false, onChoose = null }) {
  const { t } = useT()
  const { theme } = useTheme()
  const [loading, setLoading] = useState(false)
  const [confirmReplace, setConfirmReplace] = useState(false)  // mode sélection du geocoin à remplacer
  const [selectedReplaceId, setSelectedReplaceId] = useState(null)
  const { c1, c2 } = holdCard ? cardCC(holdCard.rarity) : { c1: '#6c5ce7', c2: '#a29bfe' }
  const rc = holdCard ? RC[holdCard.rarity] : null

  // État du dépôt (holdSlots = emplacements permanents ACHETÉS ; aucun gratuit)
  const nonRented     = holds.filter(h => !h.rented)
  const freePermSlot  = nonRented.length < holdSlots            // emplacement permanent (acheté) libre
  const rentSlotFree  = holdRentActive && !holds.some(h => h.rented)  // slot loué déjà payé, libre
  const canStoreRented = !freePermSlot && rentSlotFree          // stocker (gratuit) dans le slot loué
  const canReplace    = !freePermSlot && holds.length > 0       // remplacer un geocoin déjà déposé (payant)
  const canRent       = !freePermSlot && !holdRentActive        // louer un emplacement temporaire
  const rentTooPoor    = gold < rentPrice
  const replaceTooPoor = gold < replacePrice

  const doStore = useCallback(async (rent = false, replaceId = null) => {
    if (!holdCard || loading) return
    // Mode « sélecteur » (quiz : précieux déjà possédé, dépôt payant) : on ne stocke pas
    // ici. On remonte la méthode choisie à l'appelant, qui soumet la réponse ET débite
    // atomiquement côté serveur (POST /api/quiz/answer). Pas d'appel apiStoreHold.
    if (onChoose) { onChoose({ rent: !!rent, replaceId: replaceId ?? null }); return }
    setLoading(true)
    const { data, error } = await apiStoreHold(holdCard.id, holdCard.is_shiny || false, rent, replaceId)
    setLoading(false)
    // Le serveur refuse tout stockage qui détruirait un geocoin sans choix explicite
    // (dépôt plein). On ne prétend pas avoir stocké : on remonte l'erreur pour que
    // l'appelant rafraîchisse l'état et ré-affiche les bons choix (dont « Louer »).
    if (error) { onStoreError?.(error); return }
    onStored(holdCard, data || {})
  }, [holdCard, loading, onStored, onStoreError, onChoose])

  // Clic sur "Remplacer un geocoin" : passer en sélection du geocoin à remplacer.
  const handleStoreClick = useCallback(() => {
    if (canReplace && !confirmReplace) { setConfirmReplace(true); return }
    doStore(false)
  }, [canReplace, confirmReplace, doStore])

  const handleTakeForge = useCallback(async () => {
    if (loading) return
    setLoading(true)
    await onTakeForgePoint()
    setLoading(false)
  }, [loading, onTakeForgePoint])

  if (!holdCard) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000a', padding: 20 }}>
      <div style={{ background: 'linear-gradient(145deg,#0f1923,#1a2736)', border: `1.5px solid ${c1}55`, borderRadius: 20, padding: '24px 22px', maxWidth: 380, width: '100%', boxShadow: `0 0 40px ${c1}33, 0 12px 40px #0008`, fontFamily: "'Nunito',sans-serif" }}>

        {/* Titre */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 17, color: '#f9ca24' }}>
            🗄️ {t('hold_popup_title')}
          </div>
          {onClose && <button onClick={onClose} style={{ background: '#ffffff18', border: 'none', color: '#888', width: 28, height: 28, borderRadius: '50%', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }} title={t('close') || 'Fermer'}>✕</button>}
        </div>
        <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 16, lineHeight: 1.5 }}>
          {t('hold_popup_body').replace('{rarity}', rarityLabel(holdCard.rarity, t))}
        </div>

        {/* Carte gagnée */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', background: `linear-gradient(135deg,${c1}18,${c2}12)`, border: `1px solid ${c1}44`, borderRadius: 14, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
            <div style={{ width: '100%', height: '100%', borderRadius: 9, overflow: 'hidden', border: `2px solid ${c1}`, background: '#1e3045', boxShadow: `0 0 12px ${c1}44` }}>
              {holdCard.image_url
                ? <ThumbImage src={holdCard.image_url} alt={cardName(holdCard, getLang())} style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: '-webkit-optimize-contrast' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#fff', background: `linear-gradient(135deg,${c1},${c2})` }}>{cardName(holdCard, getLang())[0]}</div>
              }
            </div>
            {/* Coche « déjà possédé » sur l'image — identique au marché */}
            {owned && (
              <div title={t('quiz_already_owned')} style={{ position: 'absolute', bottom: -4, right: -4, zIndex: 16, width: 16, height: 16, borderRadius: '50%', background: '#00b894', border: `2px solid ${theme.bgSurface}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 900, lineHeight: 1, boxShadow: '0 1px 3px #0006' }}>✓</div>
            )}
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 14, color: '#ffffff' }}>{cardName(holdCard, getLang())}{holdCard.is_shiny ? ' ✨' : ''}</div>
            <div style={{ fontSize: 11, color: rc?.color, fontWeight: 800, marginTop: 2 }}>{rarityLabel(holdCard.rarity, t)}</div>
          </div>
        </div>

        {/* Étape de sélection du geocoin à remplacer — aucun emplacement libre */}
        {confirmReplace && canReplace ? (
          <>
            <div style={{ fontSize: 12, color: '#f9ca24', background: '#f9ca2415', border: '1px solid #f9ca2444', borderRadius: 9, padding: '10px 12px', marginBottom: 12, lineHeight: 1.5 }}>
              {t('hold_popup_replace_choose').replace('{price}', replacePrice)}
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 14, paddingBottom: 4 }}>
              {holds.map(h => {
                const hCard = h.card
                const cc = cardCC(hCard?.rarity || 'commun')
                const sel = selectedReplaceId === h.id
                return (
                  <button key={h.id} onClick={() => setSelectedReplaceId(h.id)} disabled={loading}
                    style={{ flexShrink: 0, width: 84, background: sel ? `linear-gradient(135deg,${cc.c1}33,${cc.c2}22)` : '#ffffff08', border: sel ? `2px solid ${cc.c1}` : `1.5px solid ${theme.border}`, borderRadius: 11, padding: 7, cursor: loading ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ position: 'relative', width: 60, height: 60, borderRadius: 8, overflow: 'hidden', border: `2px solid ${cc.c1}`, background: '#1e3045' }}>
                      {hCard?.image_url
                        ? <ThumbImage src={hCard.image_url} alt={cardName(hCard, getLang())} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#fff', background: `linear-gradient(135deg,${cc.c1},${cc.c2})` }}>{hCard?.name?.[0] || '?'}</div>}
                      {h.rented && <div title={t('hold_rented_badge')} style={{ position: 'absolute', top: -2, right: -2, fontSize: 12 }}>🔑</div>}
                    </div>
                    <div style={{ width: '100%', textAlign: 'center', fontSize: 10, fontWeight: 800, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.is_shiny && '✨'}{cardName(hCard, getLang())}
                    </div>
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={selectedReplaceId && !replaceTooPoor ? () => doStore(false, selectedReplaceId) : undefined} disabled={loading || !selectedReplaceId || replaceTooPoor}
                style={{ ...BTN('linear-gradient(135deg,#e74c3c,#c0392b)'), flex: 1, padding: '11px 0', borderRadius: 11, fontSize: 13, opacity: (loading || !selectedReplaceId || replaceTooPoor) ? 0.5 : 1, cursor: (selectedReplaceId && !replaceTooPoor) ? 'pointer' : 'default' }}>
                {loading ? '…' : t('hold_popup_replace_confirm').replace('{price}', replacePrice)}
              </button>
              <button onClick={() => { setConfirmReplace(false); setSelectedReplaceId(null) }} disabled={loading}
                style={{ ...BTN('#ffffff18'), flex: 1, padding: '11px 0', borderRadius: 11, fontSize: 13, color: theme.textSecondary }}>
                {t('cancel') || 'Annuler'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Avertissement : aucun emplacement permanent libre */}
            {!freePermSlot && canReplace && (
              <div style={{ fontSize: 11, color: '#f9ca24', background: '#f9ca2415', border: '1px solid #f9ca2433', borderRadius: 9, padding: '7px 11px', marginBottom: 12 }}>
                {t('hold_popup_full_warning').replace('{price}', replacePrice)}
              </div>
            )}

            {/* Note */}
            <div style={{ fontSize: 10, color: theme.textMuted, marginBottom: 16, display: 'flex', gap: 6 }}>
              <span>🕛</span>
              <span>{t('hold_popup_note')}</span>
            </div>

            {/* Boutons : Dépôt gratuit si slot permanent libre ; sinon slot loué / Remplacer / Louer ; puis 1 Point de Forge */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {freePermSlot ? (
                <button onClick={() => doStore(false)} disabled={loading}
                  style={{ ...BTN(`linear-gradient(135deg,${c1},${c2})`), padding: '12px 0', borderRadius: 11, fontSize: 13.5, opacity: loading ? 0.7 : 1 }}>
                  🗄️ {t('hold_popup_store')}
                </button>
              ) : (
                <>
                  {canStoreRented && (
                    <button onClick={() => doStore(false)} disabled={loading}
                      style={{ ...BTN('linear-gradient(135deg,#00b894,#55efc4)'), padding: '12px 0', borderRadius: 11, fontSize: 13.5, color: '#1e3045', opacity: loading ? 0.7 : 1 }}>
                      🔑 {t('hold_popup_store_rented')}
                    </button>
                  )}
                  {canReplace && (
                    <button onClick={replaceTooPoor ? undefined : handleStoreClick} disabled={loading || replaceTooPoor}
                      style={{ ...BTN(`linear-gradient(135deg,${c1},${c2})`), padding: '12px 0', borderRadius: 11, fontSize: 13.5, opacity: (loading || replaceTooPoor) ? 0.5 : 1, cursor: replaceTooPoor ? 'default' : 'pointer' }}>
                      🔄 {t('hold_popup_replace_open').replace('{price}', replacePrice)}
                    </button>
                  )}
                  {canRent && (
                    <button onClick={rentTooPoor ? undefined : () => doStore(true)} disabled={loading || rentTooPoor}
                      style={{ ...BTN('linear-gradient(135deg,#00b894,#55efc4)'), padding: '12px 0', borderRadius: 11, fontSize: 13.5, color: '#1e3045', opacity: (loading || rentTooPoor) ? 0.5 : 1, cursor: rentTooPoor ? 'default' : 'pointer' }}>
                      🔑 {t('hold_popup_rent').replace('{price}', rentPrice)}
                    </button>
                  )}
                </>
              )}
              {canRent && rentTooPoor && (
                <div style={{ textAlign: 'center', fontSize: 10, color: '#e17055', fontWeight: 700 }}>{t('hold_rent_too_poor')}</div>
              )}
              {canReplace && replaceTooPoor && (
                <div style={{ textAlign: 'center', fontSize: 10, color: '#e17055', fontWeight: 700 }}>{t('hold_replace_too_poor')}</div>
              )}
              {onChoose ? (
                // Sélecteur (quiz) : l'alternative au dépôt n'est pas 1 PF mais la gloire —
                // annuler revient au quiz, où le joueur peut choisir « pour la gloire ».
                <button onClick={onClose} disabled={loading}
                  style={{ ...BTN('#ffffff14'), padding: '11px 0', borderRadius: 11, fontSize: 12.5, color: theme.textSecondary }}>
                  🏆 {t('hold_popup_rather_glory') || 'Plutôt jouer pour la gloire'}
                </button>
              ) : forgeCapped ? (
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

// ─── Bascule de mode (icône seule, compacte) + accès règles ──────────────────
// Colonne étroite à gauche de la barre : un seul bouton pour basculer PVP↔Débutant
// (icône du mode courant) + un petit « ? » pour les règles, pour gagner de la place.
export function ModeToggle({ mode, onChange, onOpenRules }) {
  const { t } = useT(); const { theme } = useTheme();
  const beginner = mode === 'beginner';
  const accent = beginner ? '#00b894' : '#f9ca24';
  return (
    <div data-tour="mode-toggle" style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center', flexShrink: 0 }}>
      <button
        onClick={() => onChange(beginner ? 'pvp' : 'beginner')}
        title={beginner ? (t('mode_switch_to_pvp') || 'Passer en mode PVP') : (t('mode_switch_to_beginner') || 'Passer en mode Débutant')}
        style={{
          width: 34, height: 30, borderRadius: 9, background: `${accent}22`, border: `1.5px solid ${accent}88`,
          color: accent, cursor: 'pointer', fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 12px ${accent}44`, transition: 'all .2s',
        }}>{beginner ? '🌱' : '⚔️'}</button>
      <button onClick={onOpenRules} title={t('rules_open') || 'Règles du jeu'} style={{
        width: 34, height: 20, borderRadius: 7, background: theme.overlay, border: `1.5px solid ${theme.border}`,
        color: theme.textSecondary, cursor: 'pointer', fontWeight: 900, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>?</button>
    </div>
  );
}

// ─── Barre de quiz — MODE DÉBUTANT (style distinct, communs, multi-gagnants) ──
export function BeginnerCountdownWidget({ secondsLeft, cycleTime = 60, nextCard, hasPendingQuiz, alreadyWon = false, onJoin, owned = false, blocked = false, blockMessage = '' }) {
  const { t } = useT(); const { theme } = useTheme();
  const pct = Math.max(0, Math.min(100, ((cycleTime - secondsLeft) / cycleTime) * 100));
  const c1 = '#00b894', c2 = '#0984e3';
  // Vignette : couleur de RARETÉ du geocoin (comme en PVP), pas la couleur du mode.
  const rcc = nextCard ? cardCC(nextCard.rarity) : { c1, c2 };
  return (
    <>
      <style>{CW_STYLES}</style>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11, background: `${c1}12`, border: `1.5px solid ${c1}55`, borderRadius: 13, padding: '9px 14px' }}>
        {/* Vignette — la coche « déjà possédé » déborde du cadre (overflow uniquement
            sur le calque image, pas sur le conteneur parent), comme en PVP. */}
        <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
          <div style={{ width: '100%', height: '100%', borderRadius: 6, overflow: 'hidden', border: `2px solid ${rcc.c1}`, background: '#1e3045', boxSizing: 'border-box' }}>
            {nextCard
              ? nextCard.image_url
                ? <ThumbImage src={nextCard.image_url} alt={cardName(nextCard, getLang())} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#fff', background: `linear-gradient(135deg,${rcc.c1},${rcc.c2})` }}>{cardName(nextCard, getLang())[0]}</div>
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: c1, fontWeight: 900 }}>?</div>}
          </div>
          {nextCard && owned && (
            <div title={t('quiz_already_owned')} style={{ position: 'absolute', bottom: -4, right: -4, zIndex: 5, width: 16, height: 16, borderRadius: '50%', background: '#00b894', border: `2px solid ${theme.bgSurface}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 900, lineHeight: 1, boxShadow: '0 1px 3px #0006' }}>✓</div>
          )}
        </div>
        {/* Contenu */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
            {/* Titre homogène : « 🌱 Mode Débutant - Plusieurs gagnants » */}
            <span style={{ fontSize: 11, color: c1, fontWeight: 900, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🌱 {t('beginner_badge') || 'Mode Entraînement'}</span>
            {/* Décompte de la manche */}
            <span style={{ fontSize: 12, fontWeight: 900, color: secondsLeft > 0 && secondsLeft <= 10 ? '#e17055' : c1, flexShrink: 0 }}>⏳ {secondsLeft > 0 ? `${secondsLeft}s` : '…'}</span>
          </div>
          <div style={{ background: theme.overlayMd, borderRadius: 50, height: 5, overflow: 'hidden', marginBottom: 3 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg,${c1},${c2})`, borderRadius: 50, transition: 'width 1s linear' }} />
          </div>
          {/* Info homogène avec le PVP : « Rareté - Nom » (toujours commun en débutant) */}
          <div style={{ fontSize: 10, color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nextCard
              ? <><span style={{ color: (RC[nextCard.rarity] || {}).color || c1, fontWeight: 800 }}>{rarityLabel(nextCard.rarity, t)}</span> - {cardName(nextCard, getLang())}</>
              : t('next_card')}
          </div>
        </div>
        {/* Bouton */}
        {blocked ? (
          <div style={{ flexShrink: 0, maxWidth: 150, color: '#e7b04a', fontWeight: 800, fontSize: 10, lineHeight: 1.3, textAlign: 'right' }}>{blockMessage}</div>
        ) : alreadyWon ? (
          <div style={{ flexShrink: 0, color: c1, fontWeight: 900, fontSize: 12, whiteSpace: 'nowrap' }}>✓ {t('beginner_already_won') || 'Gagné'}</div>
        ) : (
          <button onClick={hasPendingQuiz ? onJoin : undefined} style={{
            background: hasPendingQuiz ? `linear-gradient(135deg,${c1},${c2})` : '#ffffff18', border: 'none',
            color: hasPendingQuiz ? '#0e1822' : '#666', padding: hasPendingQuiz ? '10px 18px' : '7px 13px', borderRadius: 10,
            fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: hasPendingQuiz ? 13 : 11, flexShrink: 0, whiteSpace: 'nowrap',
            cursor: hasPendingQuiz ? 'pointer' : 'default', animation: hasPendingQuiz ? 'joinPulse 1.8s ease-in-out infinite' : 'none',
          }}>{t('quiz_participate')}</button>
        )}
      </div>
    </>
  );
}

// ─── Pause récap entre 2 manches Entraînement (félicitations aux gagnants) ────
// Pas d'emoji : le top 3 (les plus rapides) est mis en avant avec des coupes
// or / argent / bronze. Les gagnants sont déjà ordonnés par rapidité.
export function BeginnerRecap({ winners = [], secondsLeft = 0, revealAnswer = null }) {
  const { t } = useT(); const { theme } = useTheme();
  const c1 = '#00b894', c2 = '#0984e3';
  const has = winners.length > 0;
  const top3 = winners.slice(0, 3);
  const rest = winners.slice(3, 3 + 15);
  const extra = Math.max(0, winners.length - (3 + rest.length));
  const MEDALS = [
    { bg: 'linear-gradient(135deg,#fde68a,#f59e0b)', ring: '#f59e0b' },  // or
    { bg: 'linear-gradient(135deg,#eef2f5,#9aa6b2)', ring: '#9aa6b2' },  // argent
    { bg: 'linear-gradient(135deg,#e6b07a,#b45309)', ring: '#b45309' },  // bronze
  ];
  const Cup = ({ ring, size }) => (
    // Petite coupe stylisée (CSS) : coupe + anses + pied.
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size }}>
      <span style={{ position: 'absolute', left: '18%', top: 0, width: '64%', height: '52%', background: MEDALS_BG_FROM_RING(ring), borderRadius: '0 0 50% 50% / 0 0 70% 70%', border: `1.5px solid ${ring}`, boxShadow: `0 1px 6px ${ring}66` }} />
      <span style={{ position: 'absolute', left: '2%', top: '8%', width: '20%', height: '30%', border: `1.5px solid ${ring}`, borderRight: 'none', borderRadius: '50% 0 0 50%' }} />
      <span style={{ position: 'absolute', right: '2%', top: '8%', width: '20%', height: '30%', border: `1.5px solid ${ring}`, borderLeft: 'none', borderRadius: '0 50% 50% 0' }} />
      <span style={{ position: 'absolute', left: '42%', top: '50%', width: '16%', height: '22%', background: ring }} />
      <span style={{ position: 'absolute', left: '30%', bottom: 0, width: '40%', height: '14%', background: ring, borderRadius: 2 }} />
    </span>
  );
  return (
    <>
      <style>{CW_STYLES}</style>
      <div style={{ background: `linear-gradient(135deg,${c1}1f,${c2}14)`, border: `1.5px solid ${c1}66`, borderRadius: 13, padding: '12px 14px', textAlign: 'center', animation: 'cgSlide .4s cubic-bezier(.34,1.56,.64,1) both', boxShadow: `0 0 26px ${c1}22` }}>
        <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 14, color: c1, marginBottom: has ? 10 : 4 }}>
          {has ? (t('beginner_recap_title') || 'Bravo aux gagnants !') : (t('beginner_recap_none') || "Personne n'a trouvé cette fois !")}
        </div>
        {has && (<>
          {/* Podium des 3 plus rapides, avec coupes */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 14, marginBottom: rest.length ? 10 : 4 }}>
            {top3.map((p, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, maxWidth: 96 }}>
                <Cup ring={MEDALS[i].ring} size={i === 0 ? 30 : 26} />
                <span style={{ fontSize: i === 0 ? 12 : 11, fontWeight: 900, color: theme.textPrimary, maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p}</span>
              </div>
            ))}
          </div>
          {/* Autres gagnants — puces qui s'enroulent */}
          {rest.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxHeight: 56, overflow: 'hidden', marginBottom: 8 }}>
              {rest.map((p, i) => (
                <span key={i} style={{ background: `${c1}1c`, border: `1px solid ${c1}44`, color: theme.textSecondary, borderRadius: 50, padding: '2px 9px', fontSize: 11, fontWeight: 700, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p}</span>
              ))}
              {extra > 0 && <span style={{ background: '#ffffff14', border: `1px solid ${theme.border}`, color: theme.textSecondary, borderRadius: 50, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>+{extra}</span>}
            </div>
          )}
        </>)}
        {/* Aide d'entraînement : réponse révélée (phrase secrète tapée pendant la manche).
            Affichée seulement ici, une fois la manche terminée → aucun avantage en jeu. */}
        {revealAnswer && (
          <div style={{ marginTop: 8, marginBottom: 2, background: '#ffffff10', border: `1px solid ${c1}44`, borderRadius: 10, padding: '7px 11px', fontSize: 12, color: theme.textSecondary, fontWeight: 700 }}>
            💡 {t('beginner_reveal_answer') || 'La réponse était'} : <span style={{ color: c1, fontWeight: 900 }}>{revealAnswer}</span>
          </div>
        )}
        <div style={{ fontSize: 11, color: theme.textSecondary, fontWeight: 700 }}>
          {(t('beginner_next_round') || 'Prochaine manche dans {n}s').replace('{n}', Math.max(0, secondsLeft))}
        </div>
      </div>
    </>
  );
}
// Coupe : remplissage métallique dérivé de la couleur d'anneau.
function MEDALS_BG_FROM_RING(ring) {
  if (ring === '#f59e0b') return 'linear-gradient(135deg,#fde68a,#f59e0b)';
  if (ring === '#9aa6b2') return 'linear-gradient(135deg,#eef2f5,#9aa6b2)';
  return 'linear-gradient(135deg,#e6b07a,#b45309)';
}

// ─── Modale de règles du jeu (PVP vs Débutant) ───────────────────────────────
export function GameRulesModal({ onClose }) {
  const { t } = useT();
  // Carte sombre → texte clair en couleurs explicites (indépendant du thème).
  const Col = ({ accent, title, emoji, rules }) => (
    <div style={{ flex: 1, minWidth: 0, background: `${accent}10`, border: `1.5px solid ${accent}44`, borderRadius: 14, padding: '14px 14px' }}>
      <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 15, color: accent, marginBottom: 10 }}>{emoji} {title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {rules.map((r, i) => <li key={i} style={{ fontSize: 12.5, color: '#eef2f7', lineHeight: 1.45 }}>{r}</li>)}
      </ul>
    </div>
  );
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000b', backdropFilter: 'blur(8px)', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'linear-gradient(145deg,#0f1923,#1a2736)', border: '1.5px solid #ffffff22', borderRadius: 20, padding: '20px 20px', maxWidth: 720, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px #000c', fontFamily: "'Nunito',sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 18, color: '#f9ca24' }}>📜 {t('rules_title') || 'Règles du jeu'}</div>
          <button onClick={onClose} style={{ background: '#ffffff18', border: 'none', color: '#888', width: 28, height: 28, borderRadius: '50%', fontSize: 14, cursor: 'pointer', fontWeight: 900 }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Col accent="#f9ca24" emoji="⚔️" title={t('mode_pvp') || 'PVP'} rules={[
            t('rules_pvp_1') || 'Le premier à répondre juste remporte un geocoin.',
            t('rules_pvp_2') || 'Toutes les raretés, et parfois des geocoins brillants (shiny).',
            t('rules_pvp_3') || 'Cadence variable selon le nombre de joueurs en ligne.',
            t('rules_pvp_4') || 'Or, points de forge et bonus de série à gagner.',
            t('rules_pvp_5') || 'Plus il y a de joueurs, plus il y a de geocoins identiques à gagner : 2 dès 10 joueurs en ligne, 3 à 20, 4 à 30… Si une seule personne répond, les autres ont quelques secondes de plus pour décrocher le suivant.',
          ]} />
          <Col accent="#00b894" emoji="🌱" title={t('mode_beginner') || 'Entraînement'} rules={[
            t('rules_beginner_1') || 'Plusieurs gagnants : tout le monde a une minute pour répondre.',
            t('rules_beginner_2') || 'Geocoins communs uniquement, jamais de brillant.',
            t('rules_beginner_3') || 'Un nouveau geocoin à la fin de chaque minute.',
            t('rules_beginner_gold') || 'Seuls les 5 premiers gagnants reçoivent de l\'or.',
            t('rules_beginner_4') || 'Aucun point de forge dans ce mode.',
          ]} />
        </div>
        <div style={{ fontSize: 11.5, color: '#c2ccd8', marginTop: 14, textAlign: 'center' }}>
          {t('rules_limits_note') || 'Les limites quotidiennes de geocoins s\'appliquent aux deux modes.'}
        </div>
      </div>
    </div>
  );
}

// ─── Liste des gagnants d'une manche (Entraînement ou PVP) ───────────────────
// Carte CLAIRE (couleurs explicites, indépendantes du thème) pour une lecture nette.
// gloryCount > 0 : les N premiers sont des glory winners, les suivants les vrais gagnants.
// Affichage HOMOGÈNE quel que soit le mode : avatar (photo de profil geocaching ou
// initiale) + pseudo + badge de rang « 🏆 1er / 2e / 3e » (or / argent / bronze).
export function BeginnerWinnersModal({ card, winners = [], gloryCount = 0, onClose, fireThreshold = 3, isShiny = false, onCardClick }) {
  const { t } = useT();
  const RANK = ['#f59e0b', '#9aa6b2', '#b45309'];   // or / argent / bronze
  // winners.length === gloryCount : joué pour la gloire, personne n'a remporté le geocoin.
  const hasGlory = gloryCount > 0 && winners.length >= gloryCount;
  // Après les glory winners peuvent venir PLUSIEURS gagnants réels (round multi-prix).
  const realWinners = hasGlory ? (winners.length > gloryCount ? winners.slice(gloryCount) : []) : winners;
  const gloryList  = hasGlory ? winners.slice(0, gloryCount) : [];
  // Chaque gagnant peut être un pseudo (string) ou { pseudo, avatar, hold }.
  const nameOf = w => typeof w === 'string' ? w : (w?.pseudo ?? '');
  const avatarOf = w => (typeof w === 'object' && w?.avatar) ? w.avatar : null;
  const isHoldEntry = w => typeof w === 'object' && !!w?.hold;
  // Place « en feu » : bonne réponse parmi les P premières du round → flammes graduées
  // à côté du pseudo (🔥 série 1, 🔥🔥 série 2, 🔥🔥🔥 animé ≥ seuil = vraiment en feu).
  const isFireEntry = w => typeof w === 'object' && !!w?.fire;
  const fireHint = w => (w?.fire_streak != null)
    ? (t('fire_badge_hint') || 'Série en cours : {n} — « en feu » à partir de {t}').replace('{n}', w.fire_streak).replace('{t}', fireThreshold)
    : (t('fire_slot_hint') || 'Parmi les premières bonnes réponses : la série « en feu » continue');
  const rankColor = i => i < 3 ? RANK[i] : '#94a3b8';
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000b', backdropFilter: 'blur(8px)', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '18px 18px', maxWidth: 360, width: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 24px 60px #0009', fontFamily: "'Nunito',sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontFamily: "'Fredoka One',sans-serif", fontSize: 15, color: '#1a2538' }}>
            {t('beginner_winners_title') || 'Gagnants'}
          </div>
          <button onClick={onClose} style={{ background: '#eef1f5', border: 'none', color: '#64748b', width: 26, height: 26, borderRadius: '50%', fontSize: 13, cursor: 'pointer', fontWeight: 900 }}>✕</button>
        </div>
        {card && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <Card card={card} isShiny={isShiny} onClick={onCardClick} />
          </div>
        )}
        {winners.length === 0 ? (
          <div style={{ fontSize: 12.5, color: '#64748b', textAlign: 'center', padding: '10px 0' }}>{t('beginner_recap_none') || "Personne n'a trouvé cette fois !"}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {realWinners.length > 0 ? (
              realWinners.map((w, i) => (
                <div key={`rw${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, background: `${rankColor(i)}${i < 3 ? '22' : '15'}`, border: `1px solid ${rankColor(i)}88`, borderRadius: 9, padding: '8px 11px' }}>
                  <FireWrap fire={isFireEntry(w)} streak={w.fire_streak ?? null} threshold={fireThreshold} hint={fireHint(w)} size={30}>
                    <Avatar pseudo={nameOf(w)} avatarUrl={avatarOf(w)} verified={!!avatarOf(w)} size={30} />
                  </FireWrap>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#1a2538', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameOf(w)}</span>
                  <span style={{ marginLeft: 'auto', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 3, background: '#ffffff', border: `1.5px solid ${rankColor(i)}`, color: '#334155', fontWeight: 900, fontSize: 10.5, padding: '3px 8px', borderRadius: 20 }}>🏆 {ordinal(i + 1)}</span>
                </div>
              ))
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 9, padding: '9px 11px' }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>🚫</span>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#78716c' }}>{t('glory_nobody_won') || "Personne n'a remporté ce geocoin"}</div>
              </div>
            )}
            {gloryList.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: '#a8a29e' }}>{t('glory_section_title') || 'Pour la gloire'}</span>
                  <GloryInfoButton size={13} />
                </div>
                {gloryList.map((p, i) => {
                  const hold = isHoldEntry(p);
                  return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: hold ? '#6c5ce715' : '#f9ca2412', border: `1px solid ${hold ? '#6c5ce755' : '#f9ca2444'}`, borderRadius: 9, padding: '6px 11px' }}>
                    <FireWrap fire={isFireEntry(p)} streak={p.fire_streak ?? null} threshold={fireThreshold} hint={fireHint(p)} size={24}>
                      <Avatar pseudo={nameOf(p)} avatarUrl={avatarOf(p)} verified={!!avatarOf(p)} size={24} />
                    </FireWrap>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#78716c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameOf(p)}</span>
                    <span style={{ fontSize: 12, marginLeft: 'auto', flexShrink: 0 }}>{hold ? '📥' : '🎖️'}</span>
                    {hold && <span style={{ fontSize: 9, fontWeight: 800, color: '#6c5ce7', flexShrink: 0 }}>{t('quiz_choice_deposit') || 'dépôt'}</span>}
                  </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
