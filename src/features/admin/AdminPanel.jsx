import { useState, useRef, useMemo, useEffect } from 'react';
import { INP, SEL, BTN } from '../../utils/styles.js';
import { useT } from '../../i18n/translations.js';
import { RC, cardCC, RARITY_CONFIG, ACHIEVEMENT_DEF } from '../../data/cards.js';
import { PAGE_SIZE } from '../../data/constants.js';
import { apiGetAchievementCards, apiEditAchievementCard, apiTriggerQuiz, apiAdminGetMarketHistory, apiAdminGetCardQuizStats, apiAdminAnnounce, apiAdminFlushCache, apiAdminRecalculateScores, apiAdminResetOnboarding,
  apiAdminCancelListing, apiAdminGetListings, apiAdminSetCanSell, apiAdminGetStats, apiAdminReactivate,
  apiAdminGetBots, apiAdminCreateBot, apiAdminUpdateBot, apiAdminDeleteBot,
  apiAdminPurgeOrphans, apiAdminPurgeExpired, apiAdminDiagnoseListings,
  apiAdminSaveTranslations,
  apiGetAchievementDefs, apiCreateAchievementDef, apiUpdateAchievementDef, apiDeleteAchievementDef,
  apiAdminAddCard,
  apiGetAdminDailyQuests, apiCreateAdminDailyQuest, apiUpdateAdminDailyQuest, apiDeleteAdminDailyQuest,
  apiGetDailySchedule, apiRegenerateDailySchedule,
  apiGetAdminShopPacks, apiUpdateAdminShopPacks,
} from '../../services/api.js';

const DEFAULT_TYPE = 'Normal';

const BOT_DEFAULTS = {
  seller: { intervalMinutes: 5,  minPrice: 5,  maxPrice: 200 },
  buyer:  { intervalMinutes: 3,  maxPrice: 50 },
  quiz:   { everyNQuestions: 3,  maxSeconds: 25 },
};

function parseCSV(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').slice(1).map(line => {
    const cols = []; let cur = ''; let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    return cols;
  }).filter(r => r.some(c => c));
}
import Card from '../../components/Card.jsx';
import AdminCards from './AdminCards.jsx';
import AdminPlayers from './AdminPlayers.jsx';
import AdminSeasons from './AdminSeasons.jsx';

// ─── Composants utilitaires (hors du composant pour éviter remounts) ─────────
function Fld({lbl,children}){
  return <div style={{marginBottom:10}}><div style={{fontSize:10,color:"#aaa",fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>{lbl}</div>{children}</div>;
}
function Tb({id,lbl,tab,setTab,setMsg}){
  return <button onClick={()=>{setTab(id);setMsg("");}} style={{background:tab===id?"#e74c3c":"#ffffff18",border:"none",color:"#fff",padding:"6px 13px",borderRadius:7,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:"pointer"}}>{lbl}</button>;
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
export default function AdminPanel({cardPool,cardTypes,questions,limits,maintenanceMode,maintenanceText,bannedIPs,onClose,onAddCard,onEditCard,onDeleteCard,onAddType,onDeleteType,onRenameType,onAddQuestion,onReplaceQuestions,onEditQuestion,onDeleteQuestion,onToggleQuestion,onSetLimits,onSetMaintenance,onBanIP,onUnbanIP,onStartTour,onUpdateCardInPool,onTestAchievement}){
  const {t}=useT();
  const [tab,setTab]=useState("cards");
  const [editQ,setEditQ]=useState(null);
  const [qPage,setQPage]=useState(0);
  const [qSearch,setQSearch]=useState("");
  const [achCards,setAchCards]=useState([]);
  const [editAch,setEditAch]=useState(null);
  const [achDefs,setAchDefs]=useState([]);
  const [editDef,setEditDef]=useState(null);
  const [newDef,setNewDef]=useState(null);
  const [newAchCard,setNewAchCard]=useState(null);
  const newAchFileRef=useRef();
  const [dailyQuests,setDailyQuests]=useState([]);
  const [editQuest,setEditQuest]=useState(null);
  const [newQuest,setNewQuest]=useState(null);
  const [questSchedule,setQuestSchedule]=useState([]);
  const achFileRef=useRef();
  const [listingsData,setListingsData]=useState({listings:[],total:0,loading:false});
  const [quizStats,setQuizStats]=useState(null);
  const [quizStatsSearch,setQuizStatsSearch]=useState('');
  const [mktHist,setMktHist]=useState({transactions:[],total:0,loading:false});
  const [mktHistPage,setMktHistPage]=useState(0);
  const [mktHistType,setMktHistType]=useState('');
  const [mktHistQ,setMktHistQ]=useState('');
  const [gameStats,setGameStats]=useState(null);
  const [bots,setBots]=useState([]);
  const [botForm,setBotForm]=useState({pseudo:'',type:'seller',config:BOT_DEFAULTS.seller});  // { playerId: bool }
  const [listingsPage,setListingsPage]=useState(0);
  const [listingsQ,setListingsQ]=useState('');
  const [expiredDays,setExpiredDays]=useState(limits.marketExpireDays || 30);
  const [nq,setNq]=useState({q:"",a:"",hint:""});
  const [transQ,setTransQ]=useState(null);   // question en cours de traduction
  const [transLang,setTransLang]=useState('en');
  const TRANS_LANGS=[{code:'en',label:'English'},{code:'de',label:'Deutsch'},{code:'es',label:'Español'}];
  const [ntName,setNtName]=useState("");
  const [editingType,setEditingType]=useState(null);
  const [editTypeName,setEditTypeName]=useState("");
  const [limEdit,setLimEdit]=useState(limits);
  const [maintText,setMaintText]=useState(maintenanceText||"");
  const [ipInput,setIpInput]=useState("");
  const [msg,setMsg]=useState("");
  const [domainInput,setDomainInput]=useState("");
  const [domainSearch,setDomainSearch]=useState("");
  const csvQRef=useRef();

  function imgUpload(e, cb, meta={}) {
    const originalFile = e.target.files[0]; if (!originalFile) return;
    if (!originalFile.type.startsWith('image/')) { setMsg('❌ Fichier image invalide.'); return; }
    setMsg('⏳ Traitement des images…');

    import('../../utils/imageProcessor.js')
      .then(({ processCardImage }) => processCardImage(originalFile, meta))
      .then(({ medium, small, info }) => {
        cb({ imageBase64: medium, thumbnailBase64: small });
        setMsg(`✅ Image traitée (${info.mediumKb}ko). Miniature: ${info.smallKb}ko.`);
      })
      .catch(err => { setMsg('❌ Erreur traitement image: ' + err.message); });
  }

  const [csvPending,setCsvPending]=useState(null); // {questions:[]} en attente du choix

  async function handleCSVQ(e){
    const f=e.target.files[0]; if(!f) return;
    e.target.value='';
    const text = await f.text();
    const rows=parseCSV(text);
    const parsed=rows.map(([q,a,q_en,a_en,q_de,a_de,q_es,a_es])=>{
      if(!q||!a) return null;
      const translations={};
      if(q_en&&a_en) translations.en={question:q_en,answer:a_en};
      if(q_de&&a_de) translations.de={question:q_de,answer:a_de};
      if(q_es&&a_es) translations.es={question:q_es,answer:a_es};
      return {question:q,answer:a,hint:"",translations};
    }).filter(Boolean);
    if(!parsed.length){setMsg("❌ Aucune question valide.");return;}
    setCsvPending({questions:parsed});
  }

  async function doImportCSV(replace){
    if(!csvPending) return;
    const {questions:parsed}=csvPending;
    setCsvPending(null);
    setMsg("⏳ Importation en cours…");
    const {apiAdminBatchAddQuestions,apiAdminDeleteAllQuestions}=await import('../../services/api.js');
    if(replace){
      const {error}=await apiAdminDeleteAllQuestions();
      if(error){setMsg("❌ Erreur suppression : "+error);return;}
      onReplaceQuestions([]);
    }
    const {data,error}=await apiAdminBatchAddQuestions(parsed);
    if(error){setMsg("❌ Erreur import : "+error);return;}
    const saved=(data?.questions||[]).map(q=>({id:q.id,q:q.question,a:q.answer,hint:q.hint||'',active:q.active,translations:q.translations||{}}));
    saved.forEach(q=>onAddQuestion(q));
    setMsg(`✅ ${data?.inserted||saved.length} questions importées !`);
  }
  function exportCSVQ(){
    const header="question,reponse,question_en,reponse_en,question_de,reponse_de,question_es,reponse_es";
    const rows=questions.map(q=>{
      const t=q.translations||{};
      return `"${q.q}","${q.a}","${t.en?.question||""}","${t.en?.answer||""}","${t.de?.question||""}","${t.de?.answer||""}","${t.es?.question||""}","${t.es?.answer||""}"`;
    });
    const csv=[header,...rows];
    const blob=new Blob([csv.join("\n")],{type:"text/csv"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="questions.csv"; a.click();
  }

  useEffect(()=>{setQPage(0);setQSearch("");setEditAch(null);setListingsPage(0);setListingsQ('');setMktHistPage(0);setMktHistType('');setMktHistQ('');setDomainInput('');setDomainSearch('');},[tab]);

  useEffect(()=>{
    if(tab!=='achievements') return;
    apiGetAchievementCards().then(({data})=>{
      if(data?.cards) setAchCards(data.cards.map(c=>({...c, desc: c.desc ?? c.description ?? ''})));
    });
    apiGetAchievementDefs().then(({data})=>{
      if(data?.definitions) setAchDefs(data.definitions);
    });
  },[tab]);

  useEffect(()=>{
    if(tab!=='stats') return;
    apiAdminGetStats().then(({data})=>{ if(data) setGameStats(data); });
  },[tab]);

  useEffect(()=>{
    if(tab!=='quests') return;
    apiGetAdminDailyQuests().then(({data})=>{ if(data?.quests) setDailyQuests(data.quests); });
    apiGetDailySchedule().then(({data})=>{ if(data?.schedule) setQuestSchedule(data.schedule); });
  },[tab]);

  useEffect(()=>{
    if(tab!=='bots') return;
    apiAdminGetBots().then(({data})=>{ if(data?.bots) setBots(data.bots); });
  },[tab]);

  useEffect(()=>{
    if(tab!=='quiz_config') return;
    if(!quizStats) apiAdminGetCardQuizStats().then(({data})=>{ if(data?.stats) setQuizStats(data.stats); });
  },[tab]);

  useEffect(()=>{
    if(tab!=='market_history') return;
    setMktHist(d=>({...d,loading:true}));
    apiAdminGetMarketHistory({page:mktHistPage,...(mktHistType&&{type:mktHistType}),...(mktHistQ&&{q:mktHistQ})})
      .then(({data})=>{
        if(data) setMktHist({transactions:data.transactions||[],total:data.total||0,loading:false});
        else setMktHist(d=>({...d,loading:false}));
      });
  },[tab,mktHistPage,mktHistType,mktHistQ]);

  useEffect(()=>{
    if(tab!=='market_admin') return;
    setListingsData(d=>({...d,loading:true}));
    apiAdminGetListings({page:listingsPage,...(listingsQ&&{q:listingsQ})})
      .then(({data})=>{
        if(data) setListingsData({listings:data.listings||[],total:data.total||0,loading:false});
        else setListingsData(d=>({...d,loading:false}));
      });
  },[tab,listingsPage,listingsQ]);


  return (
    <div style={{position:"fixed",inset:0,background:"#000d",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,backdropFilter:"blur(8px)"}}>
      <div style={{background:"linear-gradient(135deg,#1a0505,#1e3045)",borderRadius:20,padding:22,width:"min(96vw,940px)",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 24px 80px #000b",border:"2px solid #e74c3c55",fontFamily:"'Nunito',sans-serif"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div>
            <div style={{fontFamily:"'Fredoka One',sans-serif",fontSize:21,color:"#e74c3c"}}>{t("admin_title")}</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {onStartTour && (
              <button onClick={onStartTour}
                style={{background:"linear-gradient(135deg,#6c5ce7,#a29bfe)",border:"none",color:"#fff",padding:"6px 12px",borderRadius:9,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:"pointer",whiteSpace:"nowrap"}}>
                🎓 Tester le tuto
              </button>
            )}
            <button onClick={onClose} style={{background:"#ffffff18",border:"none",color:"#fff",width:32,height:32,borderRadius:"50%",fontSize:16,cursor:"pointer"}}>✕</button>
          </div>
        </div>

        <div style={{display:"flex",gap:6,marginBottom:18,flexWrap:"wrap"}}>
          <Tb id="cards"       lbl="🃏 Cartes"                         tab={tab} setTab={setTab} setMsg={setMsg}/>
          <Tb id="types"       lbl="🏷️ Types"                         tab={tab} setTab={setTab} setMsg={setMsg}/>
          <Tb id="questions"   lbl="❓ Questions"                     tab={tab} setTab={setTab} setMsg={setMsg}/>
          <Tb id="quiz_config" lbl="🎲 Quiz"                              tab={tab} setTab={setTab} setMsg={setMsg}/>
          <Tb id="limits"      lbl="📊 Limites"                       tab={tab} setTab={setTab} setMsg={setMsg}/>
          <Tb id="interface"   lbl="📱 Interface"                     tab={tab} setTab={setTab} setMsg={setMsg}/>
          <Tb id="players"     lbl="👤 Joueurs"                       tab={tab} setTab={setTab} setMsg={setMsg}/>
          <Tb id="ips"         lbl={`🌐 IPs (${bannedIPs.length})`}   tab={tab} setTab={setTab} setMsg={setMsg}/>
          <Tb id="maintenance"  lbl="🛠️ Maintenance"                   tab={tab} setTab={setTab} setMsg={setMsg}/>
          <Tb id="achievements"  lbl="🏆 Achievements"                  tab={tab} setTab={setTab} setMsg={setMsg}/>
          <Tb id="quests"        lbl="🔨 Quêtes"                         tab={tab} setTab={setTab} setMsg={setMsg}/>
          <Tb id="bots"         lbl="🤖 Bots"                           tab={tab} setTab={setTab} setMsg={setMsg}/>
          <Tb id="cache"        lbl="⚡ Cache"                           tab={tab} setTab={setTab} setMsg={setMsg}/>
          <Tb id="stats"        lbl="📊 Stats"                          tab={tab} setTab={setTab} setMsg={setMsg}/>
          <Tb id="market_history" lbl="💸 Historique marché"             tab={tab} setTab={setTab} setMsg={setMsg}/>
          <Tb id="market_admin" lbl="🏪 Marché admin"                  tab={tab} setTab={setTab} setMsg={setMsg}/>
          <Tb id="ranks"        lbl="🎖️ Rangs"                         tab={tab} setTab={setTab} setMsg={setMsg}/>
          <Tb id="domains"      lbl="🔒 Domaines"                      tab={tab} setTab={setTab} setMsg={setMsg}/>
          <Tb id="seasons"      lbl="🌸 Saisons"                       tab={tab} setTab={setTab} setMsg={setMsg}/>
          <Tb id="shop"         lbl="🛍️ Boutique"                      tab={tab} setTab={setTab} setMsg={setMsg}/>
        </div>

        {msg&&<div style={{background:msg.startsWith("❌")?"#e74c3c22":"#00b89422",border:`1px solid ${msg.startsWith("❌")?"#e74c3c44":"#00b89444"}`,color:msg.startsWith("❌")?"#e74c3c":"#00b894",fontWeight:800,fontSize:12,padding:"7px 12px",borderRadius:8,marginBottom:12}}>{msg}</div>}

        {/* ── CARTES ── */}
        {tab==="cards" && (
          <AdminCards cardPool={cardPool} cardTypes={cardTypes} onAddCard={onAddCard} onEditCard={onEditCard} onDeleteCard={onDeleteCard} onUpdateCardInPool={onUpdateCardInPool} setMsg={setMsg} imgUpload={imgUpload} />
        )}

        {/* ── TYPES ── */}
        {tab==="types"&&<div>
          <div style={{fontWeight:900,color:"#e74c3c",marginBottom:14,fontSize:14}}>{t("admin_types_title")}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:18}}>
            {cardTypes.map((t,i)=>{
              const isDefault=i===0;
              const isEditing = editingType === t;
              return <div key={t} style={{display:"flex",alignItems:"center",gap:5,background:isDefault?"#f9ca2415":"#ffffff12",border:isDefault?"1px solid #f9ca2433":"1px solid #ffffff18",borderRadius:50,padding:"4px 12px",transition:"all .2s"}}>
                {isEditing ? (
                  <>
                    <input autoFocus value={editTypeName} onChange={e=>setEditTypeName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){if(!editTypeName.trim()||editTypeName.trim()===t){setEditingType(null);return;}if(cardTypes.includes(editTypeName.trim())){setMsg("❌ Type existant.");return;}onRenameType(t,editTypeName.trim());setEditingType(null);setMsg(`✅ Type "${t}" renommé en "${editTypeName.trim()}".`);}else if(e.key==="Escape"){setEditingType(null);}}} style={{...INP, padding:"2px 8px", fontSize:12, marginBottom:0, width:120, height:24, borderRadius:12}} />
                    <button onClick={()=>{if(!editTypeName.trim()||editTypeName.trim()===t){setEditingType(null);return;}if(cardTypes.includes(editTypeName.trim())){setMsg("❌ Type existant.");return;}onRenameType(t,editTypeName.trim());setEditingType(null);setMsg(`✅ Type "${t}" renommé en "${editTypeName.trim()}".`);}} style={{background:"#00b89422",border:"none",color:"#00b894",fontSize:12,cursor:"pointer",borderRadius:"50%",width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center"}}>✓</button>
                    <button onClick={()=>setEditingType(null)} style={{background:"#e74c3c22",border:"none",color:"#e74c3c",fontSize:12,cursor:"pointer",borderRadius:"50%",width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                  </>
                ) : (
                  <>
                    <span style={{fontSize:12,fontWeight:800,color:isDefault?"#f9ca24":"#fff"}}>{t}</span>
                    <span style={{fontSize:9,color:"#666"}}>{cardPool.filter(c=>c.type===t).length}c</span>
                    <button onClick={()=>{setEditingType(t);setEditTypeName(t);}} style={{background:"none",border:"none",color:"#a29bfe",fontSize:12,cursor:"pointer",padding:"0 2px"}}>✏️</button>
                    {!isDefault&&<button onClick={()=>{if(window.confirm(`Supprimer le type "${t}" et déplacer ses cartes vers "${cardTypes[0]}" ?`)){onDeleteType(t);setMsg(`✅ Type "${t}" supprimé.`);}}} style={{background:"none",border:"none",color:"#e74c3c",fontSize:12,cursor:"pointer",padding:"0 2px"}}>🗑️</button>}
                    {isDefault&&<span style={{fontSize:8,color:"#f9ca24"}}>défaut</span>}
                  </>
                )}
              </div>;
            })}
          </div>
          {/* Traductions des types */}
          <div style={{background:"#1a0a3a",border:"1.5px solid #6c5ce766",borderRadius:12,padding:14,marginBottom:14}}>
            <div style={{fontWeight:900,color:"#a29bfe",marginBottom:12,fontSize:13}}>🌐 Traductions des types</div>
            {cardTypes.map(tp=>{
              const trans = (limits.typeTranslations||{})[tp] || {}
              return (
                <div key={tp} style={{marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:800,color:"#f9ca24",marginBottom:5}}>{tp}</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {[{code:'en',label:'EN'},{code:'de',label:'DE'},{code:'es',label:'ES'}].map(l=>(
                      <div key={l.code} style={{display:"flex",alignItems:"center",gap:4}}>
                        <span style={{fontSize:10,color:"#888",width:22}}>{l.label}</span>
                        <input value={trans[l.code]||""} onChange={async e=>{
                          const newTrans = {...(limits.typeTranslations||{}), [tp]:{...trans,[l.code]:e.target.value}}
                          await onSetLimits({...limits, typeTranslations: newTrans})
                        }} style={{...INP,padding:"4px 8px",fontSize:11,width:120,marginBottom:0}} placeholder={tp}/>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            <button onClick={async()=>{await onSetLimits({...limits});setMsg("✅ Traductions des types sauvegardées !");}} style={{...BTN("linear-gradient(135deg,#6c5ce7,#a29bfe)"),padding:"7px 16px",borderRadius:8,fontSize:11,marginTop:6}}>💾 Sauvegarder</button>
          </div>

          <div style={{background:"#ffffff08",borderRadius:11,padding:14,border:"1px solid #ffffff12"}}>
            <div style={{fontWeight:800,color:"#f9ca24",marginBottom:9,fontSize:13}}>➕ Nouveau type</div>
            <div style={{display:"flex",gap:8}}>
              <input value={ntName} onChange={e=>setNtName(e.target.value)} style={{...INP,flex:1}} placeholder={t("admin_type_placeholder")}/>
              <button onClick={()=>{
                if(!ntName.trim()){setMsg("❌ Nom requis.");return;}
                if(cardTypes.includes(ntName.trim())){setMsg("❌ Type existant.");return;}
                onAddType(ntName.trim()); setMsg(`✅ Type "${ntName}" créé !`); setNtName("");
              }} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"8px 16px",borderRadius:8,fontSize:12}}>Ajouter</button>
            </div>
          </div>
        </div>}

        {/* ── QUESTIONS ── */}
        {tab==="questions"&&<div>
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{flex:1,fontWeight:900,color:"#e74c3c",fontSize:14}}>❓ Questions ({questions.length})</div>
            <button onClick={()=>csvQRef.current.click()} style={{...BTN("#ffffff18"),padding:"5px 11px",fontSize:11,borderRadius:7}}>📥 CSV</button>
            <button onClick={exportCSVQ} style={{...BTN("#ffffff18"),padding:"5px 11px",fontSize:11,borderRadius:7}}>📤 Export</button>
            <input ref={csvQRef} type="file" accept=".csv" onChange={handleCSVQ} style={{display:"none"}}/>
          </div>
          {/* Dialog choix import CSV */}
          {csvPending&&(
            <div style={{background:"#1a0a2e",border:"1.5px solid #6c5ce7",borderRadius:12,padding:16,marginBottom:14,textAlign:"center"}}>
              <div style={{fontWeight:900,color:"#f9ca24",fontSize:14,marginBottom:6}}>📥 Importer {csvPending.questions.length} questions</div>
              <div style={{color:"#aaa",fontSize:12,marginBottom:14}}>Que faire des questions existantes ?</div>
              <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
                <button onClick={()=>doImportCSV(true)} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"9px 18px",borderRadius:9,fontSize:12}}>🗑️ Remplacer les existantes</button>
                <button onClick={()=>doImportCSV(false)} style={{...BTN("linear-gradient(135deg,#00b894,#00cec9)"),padding:"9px 18px",borderRadius:9,fontSize:12}}>➕ Ajouter aux existantes</button>
                <button onClick={()=>setCsvPending(null)} style={{background:"none",border:"none",color:"#666",fontSize:12,cursor:"pointer",fontFamily:"'Nunito',sans-serif"}}>Annuler</button>
              </div>
            </div>
          )}

          {/* Form */}
          <div style={{background:"#ffffff08",borderRadius:11,padding:14,border:"1px solid #ffffff12",marginBottom:14}}>
            <div style={{fontWeight:800,color:"#f9ca24",marginBottom:9,fontSize:13}}>{editQ?"✏️ Éditer":"➕ Nouvelle question"}</div>
            <Fld lbl="Question"><input value={editQ?editQ.q:nq.q} onChange={e=>editQ?setEditQ({...editQ,q:e.target.value}):setNq({...nq,q:e.target.value})} style={INP} placeholder={t("admin_q_placeholder")}/></Fld>
            <Fld lbl="Réponse attendue"><input value={editQ?editQ.a:nq.a} onChange={e=>editQ?setEditQ({...editQ,a:e.target.value}):setNq({...nq,a:e.target.value})} style={INP} placeholder={t("admin_q_answer_placeholder")||"Réponse exacte"}/></Fld>
            <Fld lbl="Indice"><input value={editQ?editQ.hint:nq.hint} onChange={e=>editQ?setEditQ({...editQ,hint:e.target.value}):setNq({...nq,hint:e.target.value})} style={INP} placeholder={t("admin_hint_placeholder")}/></Fld>
            <div style={{display:"flex",gap:8}}>
              {editQ?(
                <><button onClick={()=>{if(!editQ.q||!editQ.a){setMsg("❌ Q et R requis.");return;}onEditQuestion(editQ);setEditQ(null);setMsg("✅ Question mise à jour !");}} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"8px 16px",borderRadius:8,fontSize:12}}>Enregistrer</button>
                <button onClick={()=>setEditQ(null)} style={{background:"none",border:"none",color:"#888",fontSize:12,cursor:"pointer",fontFamily:"'Nunito',sans-serif"}}>{t("shop_cancel")}</button></>
              ):(
                <button onClick={()=>{if(!nq.q||!nq.a){setMsg("❌ Q et R requis.");return;}onAddQuestion({...nq});setMsg("✅ Question ajoutée !");setNq({q:"",a:"",hint:""}); }} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"8px 16px",borderRadius:8,fontSize:12}}>Ajouter</button>
              )}
            </div>
          </div>
          {/* Recherche + pagination */}
          {(()=>{
            const Q_PAGE=10;
            const filtered=questions.filter(q=>
              q.q.toLowerCase().includes(qSearch.toLowerCase())||
              q.a.toLowerCase().includes(qSearch.toLowerCase())||
              (q.hint||"").toLowerCase().includes(qSearch.toLowerCase())
            );
            const totalPages=Math.ceil(filtered.length/Q_PAGE);
            const pg=Math.min(qPage,Math.max(0,totalPages-1));
            const slice=filtered.slice(pg*Q_PAGE,(pg+1)*Q_PAGE);
            return(
              <>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
                  <input value={qSearch} onChange={e=>{setQSearch(e.target.value);setQPage(0);}} placeholder="Rechercher…" style={{...INP,flex:1,padding:"7px 11px",fontSize:12}}/>
                  <span style={{fontSize:11,color:"#888",whiteSpace:"nowrap",fontWeight:700}}>{filtered.length}/{questions.length}</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
                  {slice.length===0&&<div style={{textAlign:"center",color:"#555",padding:"18px 0",fontSize:12}}>Aucune question trouvée.</div>}
                  {slice.map(q=>{const inactive=q.active===false;return(
                    <div key={q.id} style={{display:"flex",alignItems:"flex-start",gap:9,background:editQ?.id===q.id?"#f9ca2410":inactive?"#e74c3c08":"#ffffff08",borderRadius:9,padding:"9px 12px",border:`1px solid ${editQ?.id===q.id?"#f9ca2444":inactive?"#e74c3c22":"#ffffff10"}`,opacity:inactive?0.6:1}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,color:inactive?"#666":"#fff",fontWeight:700,marginBottom:2,textDecoration:inactive?"line-through":"none"}}>{q.q}</div>
                        <div style={{fontSize:11,color:"#00b894",fontWeight:700}}>→ {q.a}</div>
                        {q.hint&&<div style={{fontSize:10,color:"#555",marginTop:2}}>💡 {q.hint}</div>}
                        {inactive&&<div style={{fontSize:9,color:"#e74c3c",fontWeight:800,marginTop:3}}>DÉSACTIVÉE</div>}
                      </div>
                      <div style={{display:"flex",gap:5,flexShrink:0}}>
                        {!inactive&&<button onClick={()=>setEditQ(editQ?.id===q.id?null:{...q})} style={{background:"#f9ca2422",border:"1px solid #f9ca2444",color:"#f9ca24",padding:"4px 9px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:10,cursor:"pointer"}}>✏️</button>}
                        {!inactive&&<button onClick={()=>setTransQ(transQ?.id===q.id?null:{...q,translations:q.translations||{}})} title="Traduire" style={{background:"#6c5ce722",border:"1px solid #6c5ce744",color:"#a29bfe",padding:"4px 9px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:10,cursor:"pointer"}}>🌐</button>}
                        <button onClick={()=>{onToggleQuestion(q.id);setMsg(inactive?"✅ Question réactivée.":"⛔ Question désactivée.");}} style={{background:inactive?"#00b89422":"#e74c3c22",border:`1px solid ${inactive?"#00b89444":"#e74c3c44"}`,color:inactive?"#00b894":"#e74c3c",padding:"4px 9px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:10,cursor:"pointer"}}>{inactive?"✅":"🗑️"}</button>
                      </div>
                    </div>
                  );})}

                </div>
                {totalPages>1&&(
                  <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                    <button onClick={()=>setQPage(p=>Math.max(0,p-1))} disabled={pg===0}
                      style={{background:pg===0?"#ffffff0a":"#ffffff18",border:"none",color:pg===0?"#444":"#fff",width:28,height:28,borderRadius:8,cursor:pg===0?"default":"pointer",fontWeight:900,fontSize:14}}>‹</button>
                    {Array.from({length:totalPages},(_,i)=>(
                      <button key={i} onClick={()=>setQPage(i)}
                        style={{width:i===pg?28:8,height:8,borderRadius:i===pg?6:50,border:"none",cursor:"pointer",background:i===pg?"#e74c3c":"#ffffff33",padding:0,transition:"all .2s",color:i===pg?"#fff":"transparent",fontSize:10,fontWeight:900}}>
                        {i===pg?`${i+1}`:""}
                      </button>
                    ))}
                    <button onClick={()=>setQPage(p=>Math.min(totalPages-1,p+1))} disabled={pg===totalPages-1}
                      style={{background:pg===totalPages-1?"#ffffff0a":"#ffffff18",border:"none",color:pg===totalPages-1?"#444":"#fff",width:28,height:28,borderRadius:8,cursor:pg===totalPages-1?"default":"pointer",fontWeight:900,fontSize:14}}>›</button>
                    <span style={{fontSize:11,color:"#888",marginLeft:4}}>{pg+1} / {totalPages}</span>
                  </div>
                )}
              </>
            );
          })()}

          {/* ── Panneau traductions ── */}
          {transQ&&(
            <div style={{background:"#1a0a3a",border:"1.5px solid #6c5ce766",borderRadius:12,padding:16,marginTop:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontWeight:900,color:"#a29bfe",fontSize:13}}>🌐 Traductions — <span style={{color:"#fff",fontStyle:"italic"}}>{transQ.q}</span></div>
                <button onClick={()=>setTransQ(null)} style={{background:"none",border:"none",color:"#666",fontSize:14,cursor:"pointer"}}>✕</button>
              </div>
              <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                {TRANS_LANGS.map(l=>(
                  <button key={l.code} onClick={()=>setTransLang(l.code)}
                    style={{background:transLang===l.code?"#6c5ce7":"#ffffff10",border:"none",color:transLang===l.code?"#fff":"#aaa",padding:"5px 12px",borderRadius:8,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:"pointer"}}>
                    {l.label} {transQ.translations?.[l.code]?.question?"✓":""}
                  </button>
                ))}
              </div>
              {TRANS_LANGS.filter(l=>l.code===transLang).map(l=>(
                <div key={l.code}>
                  <Fld lbl={`Question (${l.label})`}>
                    <input value={transQ.translations?.[l.code]?.question||""} onChange={e=>setTransQ(q=>({...q,translations:{...q.translations,[l.code]:{...q.translations?.[l.code],question:e.target.value}}}))} style={INP} placeholder={`Question en ${l.label}…`}/>
                  </Fld>
                  <Fld lbl={`Réponse (${l.label})`}>
                    <input value={transQ.translations?.[l.code]?.answer||""} onChange={e=>setTransQ(q=>({...q,translations:{...q.translations,[l.code]:{...q.translations?.[l.code],answer:e.target.value}}}))} style={INP} placeholder={`Réponse en ${l.label}…`}/>
                  </Fld>
                </div>
              ))}
              <button onClick={async()=>{
                const {error}=await apiAdminSaveTranslations(transQ.id,transQ.translations);
                if(error){setMsg("❌ Erreur sauvegarde");return;}
                onEditQuestion({...transQ});
                setMsg("✅ Traductions sauvegardées !");
              }} style={{...BTN("linear-gradient(135deg,#6c5ce7,#a29bfe)"),padding:"8px 18px",borderRadius:8,fontSize:12,marginTop:8}}>
                💾 Sauvegarder les traductions
              </button>
            </div>
          )}
        </div>}

        {/* ── QUIZ CONFIG ── */}
        {tab==="quiz_config"&&<div>
          {/* Taux de rareté */}
          <div style={{background:"#ffffff08",borderRadius:12,padding:16,border:"1px solid #ffffff12",marginBottom:16}}>
            <div style={{fontWeight:900,color:"#f9ca24",fontSize:13,marginBottom:4}}>🎲 Taux d'apparition par rareté</div>
            <div style={{fontSize:11,color:"#666",marginBottom:12}}>
              Total actuel : <span style={{color:(()=>{const s=Object.values(limEdit.quizRarityRates||{}).reduce((a,b)=>a+(+b),0);return s===100?'#00b894':'#e74c3c';})(),fontWeight:900}}>{Object.values(limEdit.quizRarityRates||{}).reduce((a,b)=>a+(+b),0)}%</span> (doit être égal à 100%)
            </div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              {[['commun','#78909c'],['rare','#1565c0'],['épique','#6a1b9a'],['légendaire','#e65100']].map(([r,color])=>(
                <div key={r} style={{flex:1,minWidth:100}}>
                  <div style={{fontSize:11,color,fontWeight:800,marginBottom:5,textTransform:"capitalize"}}>{r}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <input type="number" min={0} max={100} value={(limEdit.quizRarityRates||{})[r]??0}
                      onChange={e=>setLimEdit(prev=>({...prev,quizRarityRates:{...(prev.quizRarityRates||{}), [r]:Math.max(0,+e.target.value)}}))}
                      style={{...INP,width:65}}/>
                    <span style={{color:"#aaa",fontSize:12}}>%</span>
                  </div>
                  <div style={{marginTop:5,height:5,borderRadius:3,background:`${color}33`,overflow:"hidden"}}>
                    <div style={{width:`${(limEdit.quizRarityRates||{})[r]||0}%`,height:"100%",background:color,transition:"width .3s"}}/>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={async()=>{
              const total=Object.values(limEdit.quizRarityRates||{}).reduce((a,b)=>a+(+b),0);
              if(total!==100){setMsg(`❌ Le total doit être 100% (actuellement ${total}%)`);return;}
              await onSetLimits(limEdit);
              setMsg("✅ Taux sauvegardés !");
            }} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"8px 18px",borderRadius:9,marginTop:14,fontSize:12}}>
              Sauvegarder
            </button>
          </div>

          {/* Historique apparitions */}
          <div style={{fontWeight:900,color:"#e74c3c",fontSize:13,marginBottom:10}}>📅 Apparitions sur les 12 derniers mois</div>
          <input value={quizStatsSearch} onChange={e=>setQuizStatsSearch(e.target.value)}
            placeholder="Rechercher une carte…" style={{...INP,marginBottom:10,fontSize:12}}/>
          {!quizStats?(
            <div style={{textAlign:"center",color:"#888",padding:"20px 0",fontSize:12}}>Chargement…</div>
          ):(()=>{
            const q=quizStatsSearch.toLowerCase();
            const filtered=quizStats.filter(s=>!q||s.card?.name?.toLowerCase().includes(q)||s.card?.rarity?.toLowerCase().includes(q));
            return(
              <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:400,overflowY:"auto"}}>
                {filtered.length===0&&<div style={{textAlign:"center",color:"#555",padding:"16px 0",fontSize:12}}>Aucune apparition.</div>}
                {filtered.map((s,i)=>{
                  const {c1}=cardCC(s.card?.rarity||'commun');
                  return(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"#ffffff07",border:"1px solid #ffffff0e",borderRadius:9,padding:"8px 12px",flexWrap:"wrap"}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:c1,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:120}}>
                        <div style={{fontSize:12,color:"#fff",fontWeight:700}}>{s.card?.name||`#${s.card?.id}`}</div>
                        <div style={{fontSize:10,color:"#555",marginTop:1}}>
                          {s.dates?.slice(0,3).map(d=>new Date(d).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})).join(' · ')}
                        </div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontWeight:900,fontSize:15,color:c1}}>{s.count}</div>
                        <div style={{fontSize:9,color:"#555"}}>apparition{s.count>1?'s':''}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>}

        {/* ── LIMITES ── */}
        {tab==="limits"&&<div>
          <div style={{fontWeight:900,color:"#e74c3c",marginBottom:14,fontSize:14}}>📊 Limites quotidiennes</div>
          {[["connected", t("stat_players_online")]].map(([k,lbl])=>(
            <div key={k} style={{background:"#ffffff08",borderRadius:11,padding:14,border:"1px solid #ffffff12",marginBottom:12}}>
              <div style={{fontWeight:800,color:"#f9ca24",marginBottom:10,fontSize:13}}>{lbl}</div>
              <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:140}}>
                  <div style={{fontSize:11,color:"#aaa",marginBottom:5}}>Or max / jour</div>
                  <input type="number" min={0} value={limEdit[k].dailyGold} onChange={e=>setLimEdit({...limEdit,[k]:{...limEdit[k],dailyGold:+e.target.value}})} style={{...INP,width:"100%"}}/>
                </div>
                <div style={{flex:1,minWidth:140}}>
                  <div style={{fontSize:11,color:"#aaa",marginBottom:5}}>Cartes max / jour</div>
                  <input type="number" min={0} value={limEdit[k].dailyCards} onChange={e=>setLimEdit({...limEdit,[k]:{...limEdit[k],dailyCards:+e.target.value}})} style={{...INP,width:"100%"}}/>
                </div>
              </div>
              <div style={{flex:1,minWidth:180}}>
                <div style={{fontSize:11,color:"#aaa",marginBottom:8}}>Bouton "Classement"</div>
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                  <input type="checkbox" checked={limEdit.leaderboardVisible!==false}
                    onChange={e=>setLimEdit({...limEdit,leaderboardVisible:e.target.checked})} style={{width:16,height:16}}/>
                  <span style={{color:"#fff",fontSize:13}}>Afficher le bouton dans la barre supérieure</span>
                </label>
              </div>
            </div>
          ))}

          {/* Fréquence et durée des quiz */}
          <div style={{background:"#ffffff08",borderRadius:11,padding:14,border:"1px solid #ffffff12",marginBottom:16}}>
            <div style={{fontWeight:800,color:"#f9ca24",marginBottom:12,fontSize:13}}>⏱️ Paramètres des quiz</div>

            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,color:"#aaa",marginBottom:5}}>Intervalle entre chaque quiz</div>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <input type="number" min={10} max={3600} value={limEdit.quizInterval??60}
                  onChange={e=>setLimEdit({...limEdit,quizInterval:Math.max(10,+e.target.value)})}
                  style={{...INP,width:90}}/>
                <span style={{color:"#aaa",fontSize:12}}>secondes</span>
                <div style={{display:"flex",gap:5}}>
                  {[[30,"30s"],[60,"1 min"],[120,"2 min"],[300,"5 min"]].map(([v,lbl])=>(
                    <button key={v} onClick={()=>setLimEdit({...limEdit,quizInterval:v})}
                      style={{background:(limEdit.quizInterval??60)===v?"#e74c3c":"#ffffff18",border:"none",color:"#fff",padding:"4px 10px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:"pointer"}}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{fontSize:10,color:"#555",marginTop:10}}>
              Le changement prend effet au prochain quiz
            </div>
          </div>

          {/* Marché */}
          <div style={{background:"#ffffff08",borderRadius:11,padding:14,border:"1px solid #ffffff12",marginBottom:12}}>
            <div style={{fontWeight:800,color:"#f9ca24",marginBottom:10,fontSize:13}}>🏪 Marché</div>
            <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:180}}>
                <div style={{fontSize:11,color:"#aaa",marginBottom:5}}>Annonces actives max / joueur</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="number" min={1} max={100} value={limEdit.maxActiveListings??10}
                    onChange={e=>setLimEdit({...limEdit,maxActiveListings:Math.max(1,+e.target.value)})}
                    style={{...INP,width:80}}/>
                  <span style={{color:"#aaa",fontSize:12}}>annonces</span>
                </div>
              </div>
              <div style={{flex:1,minWidth:180}}>
                <div style={{fontSize:11,color:"#aaa",marginBottom:8}}>Bots dans l'interface</div>
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                  <input type="checkbox" checked={!!limEdit.botsVisible}
                    onChange={e=>setLimEdit({...limEdit,botsVisible:e.target.checked})} style={{width:16,height:16}}/>
                  <span style={{color:"#fff",fontSize:13}}>Afficher les bots aux joueurs</span>
                </label>
                <div style={{fontSize:10,color:"#555",marginTop:4}}>Si désactivé, les bots sont masqués du classement et du marché.</div>
              </div>
              <div style={{flex:1,minWidth:180}}>
                <div style={{fontSize:11,color:"#aaa",marginBottom:5}}>Expiration automatique</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="number" min={1} max={365} value={limEdit.marketExpireDays??30}
                    onChange={e=>setLimEdit({...limEdit,marketExpireDays:Math.max(1,+e.target.value)})}
                    style={{...INP,width:80}}/>
                  <span style={{color:"#aaa",fontSize:12}}>jours</span>
                </div>
              </div>
            </div>
          </div>

          {/* Règles de score */}
          <div style={{background:"#ffffff08",borderRadius:11,padding:14,border:"1px solid #ffffff12",marginBottom:12}}>
            <div style={{fontWeight:800,color:"#f9ca24",marginBottom:10,fontSize:13}}>🎯 Points par rareté</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
              {['commun','rare','épique','légendaire'].map(r=>(
                <div key={r}>
                  <div style={{fontSize:11,color:"#aaa",marginBottom:4,textTransform:"capitalize"}}>{r}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <input type="number" min={1} max={999}
                      value={(limEdit.scoreRules ?? {commun:1,rare:3,épique:7,légendaire:20})[r] ?? 1}
                      onChange={e=>setLimEdit({...limEdit,scoreRules:{...(limEdit.scoreRules??{commun:1,rare:3,épique:7,légendaire:20}),[r]:Math.max(1,+e.target.value)}})}
                      style={{...INP,width:70}}/>
                    <span style={{color:"#aaa",fontSize:11}}>pts</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{fontSize:10,color:"#555",marginTop:8}}>Les cartes brillantes rapportent le double. Les changements s'appliquent immédiatement.</div>
          </div>

          {/* Brillance */}
          <div style={{background:"#ffffff08",borderRadius:11,padding:14,border:"1px solid #ffffff12",marginBottom:12}}>
            <div style={{fontWeight:800,color:"#f9ca24",marginBottom:10,fontSize:13}}>✨ Geocoins Brillants</div>
            <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:180}}>
                <div style={{fontSize:11,color:"#aaa",marginBottom:5}}>Taux de brillance (%)</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="number" min={0} max={100}
                    value={Math.round((limEdit.shinyRate ?? 0.1) * 100)}
                    onChange={e=>setLimEdit({...limEdit,shinyRate:Math.min(1,Math.max(0,+e.target.value/100))})}
                    style={{...INP,width:80}}/>
                  <span style={{color:"#aaa",fontSize:12}}>%</span>
                </div>
                <div style={{fontSize:10,color:"#555",marginTop:4}}>Probabilité qu'un quiz génère un geocoin brillant</div>
              </div>
              <div style={{flex:1,minWidth:180}}>
                <div style={{fontSize:11,color:"#aaa",marginBottom:5}}>Multiplicateur de score ✨</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="number" min={1} max={10} step={0.5}
                    value={limEdit.shinyMultiplier ?? 2}
                    onChange={e=>setLimEdit({...limEdit,shinyMultiplier:Math.max(1,+e.target.value)})}
                    style={{...INP,width:80}}/>
                  <span style={{color:"#aaa",fontSize:12}}>×</span>
                </div>
                <div style={{fontSize:10,color:"#555",marginTop:4}}>Points × ce coefficient pour les geocoins brillants</div>
              </div>
              <div style={{flex:'0 0 100%'}}>
                <div style={{fontSize:11,color:"#aaa",marginBottom:8}}>Coût forge brillance par rareté (si non défini sur la carte)</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
                  {['commun','rare','épique','légendaire'].map(r=>{
                    const cur = (limEdit.shinyForgeCostByRarity ?? {})[r]
                    return (
                      <div key={r}>
                        <div style={{fontSize:10,color:"#aaa",marginBottom:3,textTransform:"capitalize"}}>{r}</div>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <input type="number" min={1} max={9999} placeholder="—"
                            value={cur ?? ''}
                            onChange={e=>{
                              const val = e.target.value === '' ? null : Math.max(1,+e.target.value)
                              setLimEdit({...limEdit,shinyForgeCostByRarity:{...(limEdit.shinyForgeCostByRarity??{}),[r]:val}})
                            }}
                            style={{...INP,width:70}}/>
                          <span style={{color:"#aaa",fontSize:11}}>pts</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{flex:1,minWidth:180}}>
                <div style={{fontSize:11,color:"#aaa",marginBottom:8}}>Forge Brillance</div>
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                  <input type="checkbox" checked={limEdit.shinyForgeOpen!==false}
                    onChange={e=>setLimEdit({...limEdit,shinyForgeOpen:e.target.checked})} style={{width:16,height:16}}/>
                  <span style={{color:"#fff",fontSize:13}}>Activer l'onglet Brillance dans la Forge</span>
                </label>
              </div>
            </div>
          </div>

          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button onClick={async ()=>{
              await onSetLimits(limEdit);
              setMsg("✅ Limites sauvegardées !");
            }} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"10px 22px",borderRadius:9}}>{t("admin_save_limits")}</button>
            <button onClick={async ()=>{
              setMsg("⏳ Déclenchement en cours…");
              const {error}=await apiTriggerQuiz();
              setMsg(error ? "❌ "+error : "✅ Quiz déclenché !");
            }} style={{...BTN("linear-gradient(135deg,#6c5ce7,#a29bfe)"),padding:"10px 22px",borderRadius:9}}>⚡ Déclencher un quiz</button>
          </div>
        </div>}

        {/* ── INTERFACE ── */}
        {tab==="interface"&&<div>
          <div style={{fontWeight:900,color:"#e74c3c",marginBottom:14,fontSize:14}}>📱 Personnalisation de l'interface</div>
          <div style={{background:"#ffffff08",borderRadius:11,padding:14,border:"1px solid #ffffff12",marginBottom:12}}>
            <div style={{fontWeight:800,color:"#f9ca24",marginBottom:10,fontSize:13}}>Menus et boutons</div>
            <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:180}}>
                <div style={{fontSize:11,color:"#aaa",marginBottom:8}}>Bouton "Soutenir"</div>
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                  <input type="checkbox" checked={limEdit.supportVisible!==false}
                    onChange={e=>setLimEdit({...limEdit,supportVisible:e.target.checked})} style={{width:16,height:16}}/>
                  <span style={{color:"#fff",fontSize:13}}>Afficher le bouton dans le menu principal</span>
                </label>
              </div>
            </div>
          </div>
          <button onClick={async ()=>{await onSetLimits(limEdit);setMsg("✅ Interface sauvegardée !");}} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"10px 22px",borderRadius:9}}>
            Sauvegarder les réglages
          </button>
        </div>}

        {/* ── JOUEURS ── */}
        {tab==="players" && (
          <AdminPlayers cardPool={cardPool} limEdit={limEdit} onBanIP={onBanIP} setTab={setTab} setMsg={setMsg} />
        )}

        {/* ── IPs ── */}
        {tab==="ips"&&<div>
          <div style={{fontWeight:900,color:"#e74c3c",marginBottom:12,fontSize:14}}>🌐 Bannissement IP</div>
          <div style={{background:"#ffffff08",borderRadius:11,padding:13,border:"1px solid #ffffff12",marginBottom:14}}>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <input value={ipInput} onChange={e=>setIpInput(e.target.value)} placeholder="ex: 192.168.1.42" style={{...INP,flex:1,minWidth:140,fontFamily:"monospace"}}/>
              <button onClick={()=>{
                const ip=ipInput.trim();
                if(!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)){setMsg("❌ Format invalide");return;}
                if(bannedIPs.includes(ip)){setMsg("⚠️ Déjà bannie");return;}
                onBanIP(ip);setIpInput("");setMsg(`✅ ${ip} bannie.`);
              }} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"7px 14px",borderRadius:8,fontSize:12}}>Bannir</button>
            </div>
          </div>
          {bannedIPs.length===0?<div style={{color:"#555",textAlign:"center",padding:"18px 0"}}>{t("admin_no_ip")}</div>:(
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {bannedIPs.map(ip=><div key={ip} style={{display:"flex",alignItems:"center",gap:10,background:"#e74c3c0a",border:"1px solid #e74c3c22",borderRadius:9,padding:"7px 13px"}}>
                <span style={{fontFamily:"monospace",color:"#e74c3c",fontWeight:800,fontSize:12,flex:1}}>{ip}</span>
                <button onClick={()=>{onUnbanIP(ip);setMsg(`✅ ${ip} débannie.`);}} style={{background:"#00b89422",border:"1px solid #00b89444",color:"#00b894",padding:"4px 11px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:10,cursor:"pointer"}}>Débannir</button>
              </div>)}
            </div>
          )}
        </div>}

        {/* ── MAINTENANCE ── */}
        {tab==="maintenance"&&<div>
          <div style={{fontWeight:900,color:"#e74c3c",marginBottom:14,fontSize:14}}>{t("admin_maintenance_title")}</div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:12,color:"#aaa",marginBottom:8}}>Message affiché aux joueurs :</div>
            <textarea value={maintText} onChange={e=>setMaintText(e.target.value)} placeholder="Nous revenons très bientôt !" style={{...INP,height:90,resize:"vertical"}}/>
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button onClick={()=>{onSetMaintenance(true,maintText);setMsg("🛠️ Maintenance activée !");}} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"10px 20px",borderRadius:9}}>{t("admin_maintenance_activate")}</button>
            {maintenanceMode&&<button onClick={()=>{onSetMaintenance(false,"");setMsg("✅ Site remis en ligne !");}} style={{...BTN("linear-gradient(135deg,#00b894,#00cec9)"),padding:"10px 20px",borderRadius:9}}>🟢 Remettre en ligne</button>}
          </div>
          {maintenanceMode&&<div style={{marginTop:12,padding:"10px 14px",background:"#e74c3c22",border:"1px solid #e74c3c44",borderRadius:9,fontSize:13,color:"#e74c3c",fontWeight:700}}>{t("admin_maintenance_active")}</div>}

          {/* Test onboarding */}
          <div style={{marginTop:20,background:"#6c5ce711",borderRadius:11,padding:14,border:"1px solid #6c5ce733"}}>
            <div style={{fontWeight:800,color:"#a29bfe",marginBottom:8,fontSize:13}}>🧪 Test onboarding</div>
            <div style={{fontSize:11,color:"#888",marginBottom:10}}>Réinitialise welcome_given pour retester le flux complet (pseudo → carte → tuto).</div>
            <button onClick={async()=>{
              const {error} = await apiAdminResetOnboarding('me');
              if(error) setMsg("❌ "+error);
              else { setMsg("✅ Rechargez la page pour tester l'onboarding"); }
            }} style={{...BTN("linear-gradient(135deg,#6c5ce7,#a29bfe)"),padding:"8px 18px",borderRadius:9,fontSize:12}}>
              🔄 Réinitialiser mon onboarding
            </button>
          </div>
          {/* Annonce broadcast */}
          <div style={{marginTop:20,background:"#ffffff08",borderRadius:11,padding:14,border:"1px solid #ffffff12"}}>
            <div style={{fontWeight:800,color:"#f9ca24",marginBottom:8,fontSize:13}}>📢 Message aux joueurs connectés</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end"}}>
              <input value={maintText} onChange={e=>setMaintText(e.target.value)} placeholder="Texte du message…"
                style={{...INP,flex:1,minWidth:200}}/>
              <select style={{...SEL,width:110}} id="announce-type">
                <option value="success">✅ Info</option>
                <option value="error">⚠️ Urgent</option>
              </select>
              <button onClick={async()=>{
                if(!maintText.trim()){setMsg("❌ Message vide.");return;}
                const type=document.getElementById('announce-type')?.value||'success';
                const{error}=await apiAdminAnnounce(maintText.trim(),type);
                if(error) setMsg("❌ "+error);
                else{setMsg("✅ Message envoyé !");setMaintText("");}
              }} style={{...BTN("linear-gradient(135deg,#f9ca24,#e17055)","#1e3045"),padding:"9px 16px",borderRadius:9}}>
                Envoyer
              </button>
            </div>
          </div>
        </div>}

        {/* ── TRANSACTIONS ── */}
        {tab==="transactions"&&<div>
          {/* Purge des annonces fictives — accessible directement ici */}
          <div style={{background:"#e74c3c0a",border:"1px solid #e74c3c22",borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <div style={{flex:1,fontSize:11,color:"#aaa"}}>
              <span style={{color:"#e74c3c",fontWeight:800}}>🧹 Annonces suspectes</span> — vendeur inexistant, supprimé ou banni
            </div>
            <button onClick={async()=>{
              setMsg("⏳ Diagnostic…");
              const{data,error}=await apiAdminDiagnoseListings();
              if(error){setMsg("❌ "+error);return;}
              setMsg(`🔍 ${data.suspicious_count} annonce(s) suspecte(s) sur ${data.total_active} actives`);
              if(data.suspicious?.length) console.table(data.suspicious);
            }} style={{...BTN("#ffffff18"),padding:"6px 13px",borderRadius:8,fontSize:11}}>🔍 Diagnostiquer</button>
            <button onClick={async()=>{
              if(!window.confirm("Annuler toutes les annonces de vendeurs invalides ?")) return;
              setMsg("⏳ Purge…");
              const{data,error}=await apiAdminPurgeOrphans();
              if(error) setMsg("❌ "+error);
              else setMsg(`✅ ${data.deleted} annonce(s) purgée(s).`);
            }} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"6px 13px",borderRadius:8,fontSize:11}}>🧹 Purger</button>
          </div>
        </div>}

        {/* ── ACHIEVEMENTS ── */}
        {tab==="achievements"&&<div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div style={{fontWeight:900,color:"#e74c3c",fontSize:14}}>🏆 Cartes Achievement ({achCards.length})</div>
            <button onClick={()=>setNewAchCard(newAchCard?null:{name:"",description:"",rarity:"commun",image:null,trigger:"buy_count",threshold:1,category:"permanent",points:0})}
              style={{...BTN(newAchCard?"#ffffff18":"linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"6px 14px",borderRadius:8,fontSize:11}}>
              {newAchCard?"✕ Annuler":"➕ Nouvelle carte achievement"}
            </button>
          </div>

          {/* ── Formulaire création carte achievement ── */}
          {newAchCard&&(()=>{
            const {c1,c2}=cardCC(newAchCard.rarity);
            const isLeg=newAchCard.rarity==="légendaire";
            return(
              <div style={{marginBottom:20,padding:16,background:"#ffffff08",border:"1.5px solid #e74c3c44",borderRadius:14}}>
                <div style={{fontWeight:900,color:"#e74c3c",marginBottom:14,fontSize:13}}>✨ Nouvelle carte achievement</div>
                <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-start"}}>
                  {/* Champs */}
                  <div style={{flex:1,minWidth:240}}>
                    <div style={{fontWeight:800,color:"#aaa",fontSize:10,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>🃏 Carte</div>
                    <Fld lbl="Nom de la carte">
                      <input value={newAchCard.name} onChange={e=>setNewAchCard({...newAchCard,name:e.target.value})} placeholder="ex: Grand collectionneur" style={INP}/>
                    </Fld>
                    <Fld lbl="Description">
                      <input value={newAchCard.description} onChange={e=>setNewAchCard({...newAchCard,description:e.target.value})} placeholder="ex: Obtiens 200 cartes uniques" style={INP}/>
                    </Fld>
                    <Fld lbl="Rareté">
                      <select value={newAchCard.rarity} onChange={e=>setNewAchCard({...newAchCard,rarity:e.target.value})} style={SEL}>
                        {["commun","rare","épique","légendaire"].map(r=><option key={r} value={r}>{RC[r].label}</option>)}
                      </select>
                      <div style={{marginTop:5,height:5,borderRadius:3,background:`linear-gradient(90deg,${c1},${c2})`}}/>
                    </Fld>
                    <Fld lbl="Image PNG">
                      <div onClick={()=>newAchFileRef.current.click()} style={{border:"2px dashed #ffffff33",borderRadius:9,padding:"11px",textAlign:"center",cursor:"pointer",background:"#ffffff08"}}
                        onMouseEnter={e=>e.currentTarget.style.borderColor="#f9ca2466"}
                        onMouseLeave={e=>e.currentTarget.style.borderColor="#ffffff33"}>
                        {newAchCard.image
                          ?<img src={newAchCard.image} style={{maxWidth:"100%",maxHeight:70,objectFit:"contain",borderRadius:5}} alt="prev"/>
                          :<div style={{color:"#888",fontSize:12}}>📁 Choisir un PNG</div>}
                      </div>
                      <input ref={newAchFileRef} type="file" accept=".png,image/png"
                        onChange={e=>imgUpload(e,({imageBase64})=>{if(imageBase64)setNewAchCard(p=>({...p,image:imageBase64}));},{name:newAchCard.name,type:"Achievements",rarity:newAchCard.rarity})}
                        style={{display:"none"}}/>
                    </Fld>
                    <div style={{fontWeight:800,color:"#aaa",fontSize:10,textTransform:"uppercase",letterSpacing:.8,marginBottom:10,marginTop:6}}>🎯 Condition achievement</div>
                    <Fld lbl="Trigger">
                      <select value={newAchCard.trigger} onChange={e=>setNewAchCard({...newAchCard,trigger:e.target.value})} style={SEL}>
                        {['buy_count','sell_count','quiz_win','new_card','streak','collection_size'].map(t=><option key={t} value={t}>{t}</option>)}
                      </select>
                    </Fld>
                    <Fld lbl="Seuil (nombre d'événements)">
                      <input type="number" value={newAchCard.threshold} onChange={e=>setNewAchCard({...newAchCard,threshold:+e.target.value})} min={1} style={INP}/>
                    </Fld>
                    <div style={{display:"flex",gap:10}}>
                      <Fld lbl="Catégorie"><select value={newAchCard.category} onChange={e=>setNewAchCard({...newAchCard,category:e.target.value})} style={{...SEL,fontSize:11}}>
                        <option value="permanent">permanent</option><option value="daily">daily</option>
                      </select></Fld>
                      <Fld lbl="Points bonus"><input type="number" value={newAchCard.points} onChange={e=>setNewAchCard({...newAchCard,points:+e.target.value})} min={0} style={{...INP,fontSize:11}}/></Fld>
                    </div>
                    <button onClick={async()=>{
                      if(!newAchCard.name.trim()){setMsg("❌ Nom requis.");return;}
                      if(!newAchCard.threshold||newAchCard.threshold<1){setMsg("❌ Seuil ≥ 1.");return;}
                      setMsg("⏳ Création en cours…");
                      // 1. Créer la carte
                      const {data:cardData,error:cardErr}=await apiAdminAddCard({
                        name:newAchCard.name.trim(),type:"Achievements",rarity:newAchCard.rarity,
                        image_url:newAchCard.image||null,desc:newAchCard.description,
                        sellable:false,min_price:null,
                      });
                      if(cardErr||!cardData?.card){setMsg("❌ Carte: "+(cardErr||"erreur"));return;}
                      const card=cardData.card;
                      // 2. Créer la définition avec clé auto
                      const key=`ach_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,5)}`;
                      const {data:defData,error:defErr}=await apiCreateAchievementDef({
                        key,name:newAchCard.name.trim(),description:newAchCard.description,
                        type:newAchCard.trigger,threshold:newAchCard.threshold,
                        card_id:card.id,points:newAchCard.points,category:newAchCard.category,
                      });
                      if(defErr){setMsg("❌ Définition: "+defErr);return;}
                      // 3. Mettre à jour le state
                      const normalized={...card,desc:card.description??''};
                      setAchCards(prev=>[...prev,normalized]);
                      onUpdateCardInPool?.(normalized);
                      setAchDefs(prev=>[...prev,defData.definition]);
                      setNewAchCard(null);
                      if(newAchFileRef.current)newAchFileRef.current.value='';
                      setMsg(`✅ "${card.name}" créée (id ${card.id}) + condition liée !`);
                    }} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"11px",borderRadius:10,marginTop:4,width:"100%",textAlign:"center"}}>
                      Créer la carte + la condition ✨
                    </button>
                  </div>
                  {/* Aperçu */}
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,flexShrink:0}}>
                    <div style={{fontSize:10,color:"#888",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Aperçu</div>
                    <div style={{position:"relative",width:148,height:190,borderRadius:16,
                      border:isLeg?`2px solid ${c1}`:`1.5px solid ${c1}66`,
                      boxShadow:isLeg?`0 0 20px ${c1}66,0 4px 20px #0004`:"0 4px 14px #0003",
                      overflow:"hidden",background:newAchCard.image?"transparent":`linear-gradient(145deg,${c1}44,${c2}66)`,
                      fontFamily:"'Nunito',sans-serif"}}>
                      {isLeg&&<div style={{position:"absolute",inset:0,borderRadius:16,zIndex:2,background:"linear-gradient(135deg,transparent 40%,#ffffff1a 50%,transparent 60%)",backgroundSize:"400px 100%",animation:"shimmer 2.5s linear infinite",pointerEvents:"none"}}/>}
                      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:6}}>
                        {newAchCard.image?<img src={newAchCard.image} style={{width:"100%",height:"88%",objectFit:"contain"}} alt=""/>:<div style={{fontSize:52,opacity:.22,marginTop:40}}>🏆</div>}
                      </div>
                      <div style={{position:"absolute",bottom:0,left:0,right:0,zIndex:3,background:`linear-gradient(to top,${c1}ee,${c1}99 50%,transparent)`,padding:"28px 8px 7px",textAlign:"center"}}>
                        <div style={{fontWeight:900,fontSize:13,color:"#fff",textShadow:"0 1px 4px #0008",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{newAchCard.name||"Nom"}</div>
                      </div>
                      <div style={{position:"absolute",bottom:0,left:0,right:0,zIndex:4,height:4,background:`linear-gradient(90deg,${c1},${c2})`}}/>
                      <div style={{position:"absolute",top:5,left:5,zIndex:5,background:"#e74c3ccc",color:"#fff",fontSize:8,fontWeight:800,borderRadius:4,padding:"2px 5px"}}>NON VENDABLE</div>
                    </div>
                    <div style={{fontSize:9,color:"#555",textAlign:"center",maxWidth:148}}>
                      type: Achievements<br/>trigger: {newAchCard.trigger}<br/>seuil: {newAchCard.threshold}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-start"}}>

            {/* Grille de cartes */}
            <div style={{flex:2,minWidth:260}}>
              <div style={{fontSize:11,color:"#888",marginBottom:10}}>Clique pour éditer</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                {achCards.map(c=>(
                  <div key={c.id} onClick={()=>setEditAch(editAch?.id===c.id?null:{...c})}
                    style={{cursor:"pointer",outline:editAch?.id===c.id?"2.5px solid #f9ca24":"2.5px solid transparent",borderRadius:18,transition:"outline .15s"}}>
                    <Card card={c} small />
                  </div>
                ))}
              </div>
            </div>

            {/* Formulaire d'édition */}
            {editAch&&(
              <div style={{flex:1,minWidth:260}}>
                <div style={{fontWeight:800,color:"#f9ca24",marginBottom:12,fontSize:13}}>✏️ {editAch.name}</div>

                {/* Aperçu pleine taille */}
                <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
                  <Card card={editAch} />
                </div>

                <Fld lbl="Nom">
                  <input value={editAch.name} onChange={e=>setEditAch({...editAch,name:e.target.value})} style={INP}/>
                </Fld>
                <Fld lbl="Description (condition d'obtention)">
                  <textarea value={editAch.desc??editAch.description??''} onChange={e=>setEditAch({...editAch,desc:e.target.value,description:e.target.value})} style={{...INP,height:64,resize:'vertical'}}/>
                </Fld>
                <Fld lbl="Type">
                  <select value={editAch.type==='Achievement'||!editAch.type ? (cardTypes[0]||'Normal') : editAch.type} onChange={e=>setEditAch({...editAch,type:e.target.value})} style={SEL}>
                    {cardTypes.filter(t=>t!=='Achievement').map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </Fld>
                <Fld lbl="Rareté">
                  <select value={editAch.rarity} onChange={e=>setEditAch({...editAch,rarity:e.target.value})} style={SEL}>
                    {["commun","rare","épique","légendaire"].map(r=><option key={r} value={r}>{RC[r].label}</option>)}
                  </select>
                  {(()=>{const {c1,c2}=cardCC(editAch.rarity);return<div style={{marginTop:5,height:5,borderRadius:3,background:`linear-gradient(90deg,${c1},${c2})`}}/>;})()}
                </Fld>
                <Fld lbl="Image PNG">
                  <div onClick={()=>achFileRef.current.click()} style={{border:"2px dashed #ffffff33",borderRadius:9,padding:"11px",textAlign:"center",cursor:"pointer",background:"#ffffff08"}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor="#f9ca2466"}
                    onMouseLeave={e=>e.currentTarget.style.borderColor="#ffffff33"}>
                    <div style={{color:"#888",fontSize:12}}>📁 Changer l'image PNG</div>
                  </div>
                  <input ref={achFileRef} type="file" accept=".png,image/png" onChange={e => imgUpload(e, ({ imageBase64 }) => {
                    if (imageBase64) setEditAch(ach => ({ ...ach, image_url: imageBase64, image: imageBase64 }));
                  }, { name: editAch?.name || '', type: editAch?.type || 'Achievement', rarity: editAch?.rarity || '' })} style={{display:"none"}}/>
                </Fld>
                <div style={{display:"flex",gap:8,marginTop:4}}>
                  <button onClick={async()=>{
                    if(!editAch.name.trim()){setMsg("❌ Nom requis.");return;}
                    const finalType = editAch.type==='Achievement'||!editAch.type ? (cardTypes[0]||'Normal') : editAch.type;
                    const optimisticUpdated = { ...editAch, type:finalType, image_url:editAch.image_url||editAch.image||null };
                    const prevAch = achCards.find(c=>c.id===editAch.id);
                    setAchCards(prev=>prev.map(c=>c.id===editAch.id?optimisticUpdated:c));
                    setEditAch(optimisticUpdated);
                    onUpdateCardInPool?.(optimisticUpdated);
                    const {data,error}=await apiEditAchievementCard(editAch.id,{name:editAch.name,desc:editAch.desc,rarity:editAch.rarity,type:finalType,image:editAch.image_url||editAch.image||null});
                    if(error){setAchCards(prev=>prev.map(c=>c.id===editAch.id?prevAch:c));setEditAch(prevAch);onUpdateCardInPool?.(prevAch);setMsg("❌ "+error);return;}
                    const updated = data?.card ? {...data.card, desc: data.card.desc??data.card.description??''} : optimisticUpdated;
                    setAchCards(prev=>prev.map(c=>c.id===editAch.id?updated:c));
                    setEditAch(updated);
                    onUpdateCardInPool?.(updated);
                    setMsg(`✅ "${editAch.name}" mis à jour !`);
                  }} style={{flex:1,...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"10px",borderRadius:10,textAlign:"center"}}>
                    Enregistrer ✏️
                  </button>
                  <button onClick={()=>setEditAch(null)} style={{...BTN("#ffffff18"),padding:"10px 14px",borderRadius:10}}>Annuler</button>
                </div>
              </div>
            )}
          </div>

          {/* ── Conditions (achievement_definitions) ── */}
          <div style={{marginTop:22,background:"#ffffff08",border:"1px solid #ffffff12",borderRadius:12,padding:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{fontWeight:900,color:"#f9ca24",fontSize:13}}>⚙️ Conditions déclenchantes</div>
              <button onClick={()=>setNewDef({key:'',name:'',description:'',type:'buy_count',threshold:1,card_id:'',points:0,category:'permanent',active:true})}
                style={{...BTN("linear-gradient(135deg,#00b894,#00cec9)"),padding:"5px 12px",borderRadius:8,fontSize:11}}>+ Nouvelle</button>
            </div>

            {/* Formulaire nouvelle définition */}
            {newDef&&(
              <div style={{marginBottom:14,padding:12,background:"#ffffff0a",borderRadius:10,border:"1px solid #00b89444"}}>
                <div style={{fontWeight:800,color:"#00b894",marginBottom:10,fontSize:12}}>✨ Nouvelle condition</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <Fld lbl="Clé unique"><input value={newDef.key} onChange={e=>setNewDef({...newDef,key:e.target.value})} placeholder="ex: buyer_200" style={INP}/></Fld>
                  <Fld lbl="Nom affiché"><input value={newDef.name} onChange={e=>setNewDef({...newDef,name:e.target.value})} placeholder="ex: Méga acheteur" style={INP}/></Fld>
                  <Fld lbl="Type de déclencheur">
                    <select value={newDef.type} onChange={e=>setNewDef({...newDef,type:e.target.value})} style={SEL}>
                      {['buy_count','sell_count','quiz_win','new_card','streak','collection_size'].map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </Fld>
                  <Fld lbl="Seuil"><input type="number" value={newDef.threshold} onChange={e=>setNewDef({...newDef,threshold:+e.target.value})} min={1} style={INP}/></Fld>
                  <Fld lbl="card_id (carte à débloquer)"><input type="number" value={newDef.card_id} onChange={e=>setNewDef({...newDef,card_id:+e.target.value||''})} placeholder="ex: 901" style={INP}/></Fld>
                  <Fld lbl="Points bonus"><input type="number" value={newDef.points} onChange={e=>setNewDef({...newDef,points:+e.target.value})} min={0} style={INP}/></Fld>
                  <Fld lbl="Catégorie">
                    <select value={newDef.category} onChange={e=>setNewDef({...newDef,category:e.target.value})} style={SEL}>
                      <option value="permanent">permanent</option>
                      <option value="daily">daily</option>
                    </select>
                  </Fld>
                  <Fld lbl="Description"><input value={newDef.description} onChange={e=>setNewDef({...newDef,description:e.target.value})} style={INP}/></Fld>
                </div>
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <button onClick={async()=>{
                    if(!newDef.key.trim()||!newDef.name.trim()){setMsg("❌ Clé et nom requis.");return;}
                    const {data,error}=await apiCreateAchievementDef({...newDef,card_id:newDef.card_id||null});
                    if(error){setMsg("❌ "+error);return;}
                    setAchDefs(prev=>[...prev,data.definition]);
                    setNewDef(null);setMsg("✅ Condition créée !");
                  }} style={{...BTN("linear-gradient(135deg,#00b894,#00cec9)"),padding:"7px 14px",borderRadius:8,fontSize:11}}>Créer</button>
                  <button onClick={()=>setNewDef(null)} style={{...BTN("#ffffff18"),padding:"7px 12px",borderRadius:8,fontSize:11}}>Annuler</button>
                </div>
              </div>
            )}

            {/* Tableau des définitions */}
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"'Nunito',sans-serif"}}>
                <thead>
                  <tr style={{color:"#888",textAlign:"left"}}>
                    {["Clé","Trigger","Seuil","Carte","Points","Catégorie","Actif",""].map(h=>(
                      <th key={h} style={{padding:"4px 8px",borderBottom:"1px solid #ffffff10",fontWeight:700}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {achDefs.map(def=>(
                    <tr key={def.id} style={{borderBottom:"1px solid #ffffff08",background:editDef?.id===def.id?"#ffffff0a":"transparent"}}>
                      {editDef?.id===def.id ? (
                        // ── Ligne d'édition inline ──
                        <>
                          <td style={{padding:"6px 8px"}} colSpan={7}>
                            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:6}}>
                              <Fld lbl="Nom"><input value={editDef.name} onChange={e=>setEditDef({...editDef,name:e.target.value})} style={{...INP,fontSize:11}}/></Fld>
                              <Fld lbl="Trigger">
                                <select value={editDef.type} onChange={e=>setEditDef({...editDef,type:e.target.value})} style={{...SEL,fontSize:11}}>
                                  {['buy_count','sell_count','quiz_win','new_card','streak','collection_size'].map(t=><option key={t} value={t}>{t}</option>)}
                                </select>
                              </Fld>
                              <Fld lbl="Seuil"><input type="number" value={editDef.threshold} onChange={e=>setEditDef({...editDef,threshold:+e.target.value})} min={1} style={{...INP,fontSize:11}}/></Fld>
                              <Fld lbl="card_id"><input type="number" value={editDef.card_id??''} onChange={e=>setEditDef({...editDef,card_id:+e.target.value||null})} style={{...INP,fontSize:11}}/></Fld>
                              <Fld lbl="Points"><input type="number" value={editDef.points} onChange={e=>setEditDef({...editDef,points:+e.target.value})} min={0} style={{...INP,fontSize:11}}/></Fld>
                              <Fld lbl="Catégorie">
                                <select value={editDef.category} onChange={e=>setEditDef({...editDef,category:e.target.value})} style={{...SEL,fontSize:11}}>
                                  <option value="permanent">permanent</option>
                                  <option value="daily">daily</option>
                                </select>
                              </Fld>
                              <Fld lbl="Description"><input value={editDef.description??''} onChange={e=>setEditDef({...editDef,description:e.target.value})} style={{...INP,fontSize:11}}/></Fld>
                              <Fld lbl="Actif">
                                <select value={editDef.active?"1":"0"} onChange={e=>setEditDef({...editDef,active:e.target.value==="1"})} style={{...SEL,fontSize:11}}>
                                  <option value="1">✅ Actif</option>
                                  <option value="0">⏸ Inactif</option>
                                </select>
                              </Fld>
                            </div>
                            <div style={{display:"flex",gap:6}}>
                              <button onClick={async()=>{
                                const {data,error}=await apiUpdateAchievementDef(editDef.id,editDef);
                                if(error){setMsg("❌ "+error);return;}
                                setAchDefs(prev=>prev.map(d=>d.id===editDef.id?data.definition:d));
                                setEditDef(null);setMsg("✅ Mis à jour !");
                              }} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"5px 12px",borderRadius:7,fontSize:11}}>Enregistrer</button>
                              <button onClick={()=>setEditDef(null)} style={{...BTN("#ffffff18"),padding:"5px 10px",borderRadius:7,fontSize:11}}>Annuler</button>
                              <button onClick={async()=>{
                                if(!window.confirm(`Supprimer "${def.key}" ?`)) return;
                                const {error}=await apiDeleteAchievementDef(def.id);
                                if(error){setMsg("❌ "+error);return;}
                                setAchDefs(prev=>prev.filter(d=>d.id!==def.id));
                                setEditDef(null);setMsg("✅ Supprimé.");
                              }} style={{...BTN("#e74c3c22"),border:"1px solid #e74c3c44",color:"#e74c3c",padding:"5px 10px",borderRadius:7,fontSize:11,marginLeft:"auto"}}>🗑 Supprimer</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        // ── Ligne normale ──
                        <>
                          <td style={{padding:"5px 8px",color:"#aaa",fontFamily:"monospace"}}>{def.key}</td>
                          <td style={{padding:"5px 8px"}}>
                            <span style={{background:"#ffffff12",borderRadius:5,padding:"2px 7px",fontSize:10}}>{def.type}</span>
                          </td>
                          <td style={{padding:"5px 8px",color:"#f9ca24",fontWeight:700}}>{def.threshold}</td>
                          <td style={{padding:"5px 8px",color:"#aaa"}}>{def.cards ? `#${def.card_id} ${def.cards.name}` : def.card_id ? `#${def.card_id}` : '—'}</td>
                          <td style={{padding:"5px 8px",color:"#aaa"}}>{def.points||'—'}</td>
                          <td style={{padding:"5px 8px"}}>
                            <span style={{background:def.category==="daily"?"#f9ca2422":"#ffffff10",color:def.category==="daily"?"#f9ca24":"#aaa",borderRadius:5,padding:"2px 7px",fontSize:10}}>{def.category}</span>
                          </td>
                          <td style={{padding:"5px 8px"}}>
                            <span style={{color:def.active?"#00b894":"#e74c3c",fontWeight:800,fontSize:12}}>{def.active?"●":"○"}</span>
                          </td>
                          <td style={{padding:"5px 8px"}}>
                            <button onClick={()=>setEditDef({...def})} style={{...BTN("#ffffff12"),padding:"3px 10px",borderRadius:6,fontSize:10,cursor:"pointer"}}>✏️</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {achDefs.length===0&&<div style={{color:"#555",fontSize:11,textAlign:"center",padding:16}}>Aucune définition chargée.</div>}
            </div>
          </div>

          {/* ── Test des notifications achievement ── */}
          {onTestAchievement && (
            <div style={{marginTop:18,background:"#ffffff08",border:"1px solid #ffffff12",borderRadius:12,padding:14}}>
              <div style={{fontWeight:900,color:"#f9ca24",fontSize:13,marginBottom:12}}>🧪 Tester les notifications</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {ACHIEVEMENT_DEF.map(def => {
                  const card = achCards.find(c => c.id === def.cardId)
                  return (
                    <button key={def.id} onClick={() => { if (card) onTestAchievement(card); else setMsg(`❌ Carte #${def.cardId} introuvable`); }}
                      style={{...BTN("#6c5ce722"),border:"1px solid #6c5ce744",color:"#a29bfe",padding:"6px 12px",borderRadius:8,fontSize:11,fontFamily:"'Nunito',sans-serif",fontWeight:800,cursor:"pointer"}}>
                      {def.icon} {def.label}
                    </button>
                  )
                })}
              </div>
              <div style={{fontSize:10,color:"#555",marginTop:8}}>Affiche la modale "Geocoin offert !" sans modifier la collection.</div>
              <div style={{marginTop:14,borderTop:"1px solid #ffffff10",paddingTop:12}}>
                <button onClick={async()=>{
                  if(!window.confirm("Supprimer tous tes geocoins achievement de ta collection pour re-tester ?")) return;
                  const {apiResetAchievements}=await import('../../services/api.js');
                  const {error}=await apiResetAchievements();
                  if(error){setMsg("❌ Erreur reset");return;}
                  setMsg("✅ Achievements réinitialisés — recharge la page pour re-tester !");
                }} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"7px 16px",borderRadius:8,fontSize:11}}>
                  🔄 Réinitialiser mes achievements (test)
                </button>
                <div style={{fontSize:10,color:"#555",marginTop:6}}>Supprime les cartes achievement de ta collection. Recharge ensuite la page.</div>
              </div>
            </div>
          )}
        </div>}

        {/* ── QUÊTES QUOTIDIENNES ── */}
        {tab==="quests"&&<div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <div style={{fontWeight:900,color:"#a29bfe",fontSize:14}}>🔨 Pool de quêtes quotidiennes</div>
            <button onClick={()=>setNewQuest({name:'',description:'',type:'quiz_win',threshold:1,forge_points:10})}
              style={{...BTN("linear-gradient(135deg,#6c5ce7,#a29bfe)"),padding:"6px 14px",borderRadius:8,fontSize:11}}>
              {newQuest?"✕ Annuler":"+ Nouvelle quête"}
            </button>
          </div>

          {/* Formulaire création */}
          {newQuest&&(
            <div style={{marginBottom:16,padding:14,background:"#6c5ce710",border:"1px solid #6c5ce744",borderRadius:12}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
                <Fld lbl="Nom"><input value={newQuest.name} onChange={e=>setNewQuest({...newQuest,name:e.target.value})} placeholder="Quiz enchaîné" style={INP}/></Fld>
                <Fld lbl="Description"><input value={newQuest.description} onChange={e=>setNewQuest({...newQuest,description:e.target.value})} placeholder="Remporte 2 quiz" style={INP}/></Fld>
                <Fld lbl="Trigger">
                  <select value={newQuest.type} onChange={e=>setNewQuest({...newQuest,type:e.target.value})} style={SEL}>
                    {['buy_count','sell_count','quiz_win','new_card','streak'].map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </Fld>
                <Fld lbl="Seuil"><input type="number" value={newQuest.threshold} onChange={e=>setNewQuest({...newQuest,threshold:+e.target.value})} min={1} style={INP}/></Fld>
                <Fld lbl="Points de forge"><input type="number" value={newQuest.forge_points} onChange={e=>setNewQuest({...newQuest,forge_points:+e.target.value})} min={1} style={INP}/></Fld>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={async()=>{
                  if(!newQuest.name.trim()){setMsg("❌ Nom requis.");return;}
                  const {data,error}=await apiCreateAdminDailyQuest(newQuest);
                  if(error){setMsg("❌ "+error);return;}
                  setDailyQuests(prev=>[...prev,data.quest]);
                  setNewQuest(null);setMsg("✅ Quête créée !");
                }} style={{...BTN("linear-gradient(135deg,#6c5ce7,#a29bfe)"),padding:"7px 16px",borderRadius:8,fontSize:11}}>Créer</button>
                <button onClick={()=>setNewQuest(null)} style={{...BTN("#ffffff18"),padding:"7px 12px",borderRadius:8,fontSize:11}}>Annuler</button>
              </div>
            </div>
          )}

          {/* Tableau des quêtes */}
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"'Nunito',sans-serif",marginBottom:24}}>
            <thead>
              <tr style={{color:"#888",textAlign:"left"}}>
                {["Nom","Trigger","Seuil","🔨 Points","Actif",""].map(h=>(
                  <th key={h} style={{padding:"4px 8px",borderBottom:"1px solid #ffffff10",fontWeight:700}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dailyQuests.map(q=>(
                <tr key={q.id} style={{borderBottom:"1px solid #ffffff08",background:editQuest?.id===q.id?"#6c5ce710":"transparent"}}>
                  {editQuest?.id===q.id?(
                    <td colSpan={6} style={{padding:"8px"}}>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:6}}>
                        <Fld lbl="Nom"><input value={editQuest.name} onChange={e=>setEditQuest({...editQuest,name:e.target.value})} style={{...INP,fontSize:11}}/></Fld>
                        <Fld lbl="Trigger">
                          <select value={editQuest.type} onChange={e=>setEditQuest({...editQuest,type:e.target.value})} style={{...SEL,fontSize:11}}>
                            {['buy_count','sell_count','quiz_win','new_card','streak'].map(t=><option key={t} value={t}>{t}</option>)}
                          </select>
                        </Fld>
                        <Fld lbl="Seuil"><input type="number" value={editQuest.threshold} onChange={e=>setEditQuest({...editQuest,threshold:+e.target.value})} min={1} style={{...INP,fontSize:11}}/></Fld>
                        <Fld lbl="🔨 Points"><input type="number" value={editQuest.forge_points} onChange={e=>setEditQuest({...editQuest,forge_points:+e.target.value})} min={1} style={{...INP,fontSize:11}}/></Fld>
                        <Fld lbl="Actif">
                          <select value={editQuest.active?"1":"0"} onChange={e=>setEditQuest({...editQuest,active:e.target.value==="1"})} style={{...SEL,fontSize:11}}>
                            <option value="1">✅ Actif</option><option value="0">⏸ Inactif</option>
                          </select>
                        </Fld>
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={async()=>{
                          const {data,error}=await apiUpdateAdminDailyQuest(editQuest.id,editQuest);
                          if(error){setMsg("❌ "+error);return;}
                          setDailyQuests(prev=>prev.map(d=>d.id===editQuest.id?data.quest:d));
                          setEditQuest(null);setMsg("✅ Mis à jour !");
                        }} style={{...BTN("linear-gradient(135deg,#6c5ce7,#a29bfe)"),padding:"5px 12px",borderRadius:7,fontSize:11}}>Enregistrer</button>
                        <button onClick={()=>setEditQuest(null)} style={{...BTN("#ffffff18"),padding:"5px 10px",borderRadius:7,fontSize:11}}>Annuler</button>
                        <button onClick={async()=>{
                          if(!window.confirm(`Supprimer "${q.name}" ?`)) return;
                          const {error}=await apiDeleteAdminDailyQuest(q.id);
                          if(error){setMsg("❌ "+error);return;}
                          setDailyQuests(prev=>prev.filter(d=>d.id!==q.id));
                          setEditQuest(null);setMsg("✅ Supprimée.");
                        }} style={{...BTN("#e74c3c22"),border:"1px solid #e74c3c44",color:"#e74c3c",padding:"5px 10px",borderRadius:7,fontSize:11,marginLeft:"auto"}}>🗑 Supprimer</button>
                      </div>
                    </td>
                  ):(
                    <>
                      <td style={{padding:"5px 8px",color:"#fff",fontWeight:700}}>{q.name}<div style={{fontSize:9,color:"#555",fontWeight:400}}>{q.description}</div></td>
                      <td style={{padding:"5px 8px"}}><span style={{background:"#ffffff12",borderRadius:5,padding:"2px 7px",fontSize:10}}>{q.type}</span></td>
                      <td style={{padding:"5px 8px",color:"#f9ca24",fontWeight:700}}>{q.threshold}</td>
                      <td style={{padding:"5px 8px",color:"#a29bfe",fontWeight:900}}>🔨 {q.forge_points}</td>
                      <td style={{padding:"5px 8px"}}><span style={{color:q.active?"#00b894":"#e74c3c",fontWeight:800}}>●</span></td>
                      <td style={{padding:"5px 8px"}}><button onClick={()=>setEditQuest({...q})} style={{...BTN("#ffffff12"),padding:"3px 10px",borderRadius:6,fontSize:10}}>✏️</button></td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Planning du jour */}
          <div style={{background:"#ffffff08",border:"1px solid #ffffff12",borderRadius:12,padding:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontWeight:900,color:"#f9ca24",fontSize:12}}>
                📅 Quêtes du jour — {new Date().toLocaleDateString('fr-FR')}
                <span style={{fontSize:10,color:"#555",fontWeight:400,marginLeft:8}}>({questSchedule.length}/3)</span>
              </div>
              <button onClick={async()=>{
                if(!window.confirm("Régénérer aléatoirement les 3 quêtes du jour ?")) return;
                const {error}=await apiRegenerateDailySchedule();
                if(error){setMsg("❌ "+error);return;}
                const {data}=await apiGetDailySchedule();
                if(data?.schedule) setQuestSchedule(data.schedule);
                setMsg("✅ Quêtes du jour régénérées !");
              }} style={{...BTN("#ffffff18"),padding:"5px 12px",borderRadius:8,fontSize:11}}>🎲 Régénérer</button>
            </div>
            {questSchedule.length===0
              ?<div style={{color:"#555",fontSize:11}}>Aucune quête planifiée. Le planning se crée automatiquement à la première connexion du jour.</div>
              :<div style={{display:"flex",flexDirection:"column",gap:6}}>
                {questSchedule.map((s,i)=>{
                  const q=s.daily_quest_definitions;
                  return(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"#ffffff08",borderRadius:8,padding:"6px 12px"}}>
                      <span style={{color:"#a29bfe",fontWeight:900,fontSize:11}}>#{i+1}</span>
                      <span style={{flex:1,fontWeight:700,fontSize:12}}>{q?.name}</span>
                      <span style={{fontSize:10,color:"#555"}}>{q?.type} × {q?.threshold}</span>
                      <span style={{color:"#a29bfe",fontWeight:900,fontSize:11}}>🔨 {q?.forge_points}</span>
                    </div>
                  );
                })}
              </div>
            }
          </div>
        </div>}

        {/* ── BOTS ── */}
        {tab==="bots"&&<div>
          <div style={{fontWeight:900,color:"#e74c3c",fontSize:14,marginBottom:16}}>🤖 Gestion des bots</div>

          {/* Formulaire création */}
          <div style={{background:"#ffffff08",borderRadius:12,padding:16,border:"1px solid #ffffff12",marginBottom:16}}>
            <div style={{fontWeight:800,color:"#f9ca24",marginBottom:12,fontSize:13}}>➕ Créer un bot</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
              <div>
                <div style={{fontSize:10,color:"#aaa",marginBottom:4}}>Pseudo</div>
                <input value={botForm.pseudo} onChange={e=>setBotForm(f=>({...f,pseudo:e.target.value}))} placeholder="BotVendeur" style={{...INP,width:120}}/>
              </div>
              <div>
                <div style={{fontSize:10,color:"#aaa",marginBottom:4}}>Type</div>
                <select value={botForm.type} onChange={e=>setBotForm(f=>({...f,type:e.target.value,config:BOT_DEFAULTS[e.target.value]||{}}))} style={SEL}>
                  <option value="seller">🏷️ Vendeur</option>
                  <option value="buyer">🛒 Acheteur</option>
                  <option value="quiz">❓ Quiz</option>
                </select>
              </div>
              {botForm.type==="seller"&&<>
                <div><div style={{fontSize:10,color:"#aaa",marginBottom:4}}>Intervalle (min)</div><input type="number" min={1} value={botForm.config.intervalMinutes||5} onChange={e=>setBotForm(f=>({...f,config:{...f.config,intervalMinutes:+e.target.value}}))} style={{...INP,width:70}}/></div>
                <div><div style={{fontSize:10,color:"#aaa",marginBottom:4}}>Prix min</div><input type="number" min={1} value={botForm.config.minPrice||5} onChange={e=>setBotForm(f=>({...f,config:{...f.config,minPrice:+e.target.value}}))} style={{...INP,width:70}}/></div>
                <div><div style={{fontSize:10,color:"#aaa",marginBottom:4}}>Prix max</div><input type="number" min={1} value={botForm.config.maxPrice||200} onChange={e=>setBotForm(f=>({...f,config:{...f.config,maxPrice:+e.target.value}}))} style={{...INP,width:70}}/></div>
              </>}
              {botForm.type==="buyer"&&<>
                <div><div style={{fontSize:10,color:"#aaa",marginBottom:4}}>Intervalle (min)</div><input type="number" min={1} value={botForm.config.intervalMinutes||3} onChange={e=>setBotForm(f=>({...f,config:{...f.config,intervalMinutes:+e.target.value}}))} style={{...INP,width:70}}/></div>
                <div><div style={{fontSize:10,color:"#aaa",marginBottom:4}}>Prix max (G)</div><input type="number" min={1} value={botForm.config.maxPrice||50} onChange={e=>setBotForm(f=>({...f,config:{...f.config,maxPrice:+e.target.value}}))} style={{...INP,width:70}}/></div>
              </>}
              {botForm.type==="quiz"&&<>
                <div><div style={{fontSize:10,color:"#aaa",marginBottom:4}}>1 quiz sur N</div><input type="number" min={1} value={botForm.config.everyNQuestions||3} onChange={e=>setBotForm(f=>({...f,config:{...f.config,everyNQuestions:+e.target.value}}))} style={{...INP,width:70}}/></div>
                <div><div style={{fontSize:10,color:"#aaa",marginBottom:4}}>Délai max (s)</div><input type="number" min={1} max={59} value={botForm.config.maxSeconds||20} onChange={e=>setBotForm(f=>({...f,config:{...f.config,maxSeconds:+e.target.value}}))} style={{...INP,width:70}}/></div>
              </>}
              <button onClick={async()=>{
                if(!botForm.pseudo.trim()){setMsg("❌ Pseudo requis.");return;}
                const{data,error}=await apiAdminCreateBot({pseudo:botForm.pseudo.trim(),type:botForm.type,config:botForm.config});
                if(error){setMsg("❌ "+error);return;}
                setBots(prev=>[data.bot,...prev]);
                setBotForm({pseudo:'',type:'seller',config:BOT_DEFAULTS.seller});
                setMsg("✅ Bot créé !");
              }} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"8px 16px",borderRadius:9,fontSize:12,alignSelf:"flex-end"}}>Créer</button>
            </div>
          </div>

          {/* Liste des bots */}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {bots.length===0&&<div style={{textAlign:"center",color:"#555",padding:"18px 0",fontSize:12}}>Aucun bot configuré.</div>}
            {bots.map(bot=>{
              const typeIcon={seller:"🏷️",buyer:"🛒",quiz:"❓"}[bot.type]||"🤖";
              const cfg={...(BOT_DEFAULTS[bot.type]||{}),...(bot.config||{})};
              return(
                <div key={bot.id} style={{display:"flex",alignItems:"center",gap:10,background:bot.active?"#ffffff08":"#ffffff04",border:`1px solid ${bot.active?"#ffffff18":"#ffffff08"}`,borderRadius:12,padding:"10px 14px",flexWrap:"wrap",opacity:bot.active?1:0.6}}>
                  <div style={{fontSize:22,flexShrink:0}}>{typeIcon}</div>
                  <div style={{flex:1,minWidth:120}}>
                    <div style={{fontWeight:900,color:"#fff",fontSize:13}}>{bot.profiles?.pseudo||"Bot"}</div>
                    <div style={{fontSize:10,color:"#888",marginTop:2}}>
                      {bot.type==="seller"&&`Vend toutes les ${cfg.intervalMinutes}min · ${cfg.minPrice}–${cfg.maxPrice}G`}
                      {bot.type==="buyer"&&`Achète toutes les ${cfg.intervalMinutes}min · max ${cfg.maxPrice}G`}
                      {bot.type==="quiz"&&`Répond 1/${cfg.everyNQuestions} quiz en <${cfg.maxSeconds}s`}
                    </div>
                    {bot.last_run_at&&<div style={{fontSize:9,color:"#444",marginTop:1}}>Dernier run : {new Date(bot.last_run_at).toLocaleString('fr-FR')}</div>}
                  </div>
                  <div style={{fontSize:11,color:"#f9ca24",fontWeight:700}}>{bot.profiles?.gold||0}G</div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={async()=>{
                      const next=!bot.active;
                      setBots(prev=>prev.map(b=>b.id===bot.id?{...b,active:next}:b));
                      const{data,error}=await apiAdminUpdateBot(bot.id,{active:next});
                      if(error){
                        setBots(prev=>prev.map(b=>b.id===bot.id?{...b,active:!next}:b));
                        setMsg("❌ "+error);
                        return;
                      }
                      if(data?.bot) setBots(prev=>prev.map(b=>b.id===bot.id?{...b,...data.bot}:b));
                    }} style={{background:bot.active?"#e74c3c22":"#00b89422",border:`1px solid ${bot.active?"#e74c3c44":"#00b89444"}`,color:bot.active?"#e74c3c":"#00b894",padding:"4px 10px",borderRadius:8,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:10,cursor:"pointer"}}>
                      {bot.active?"Désactiver":"Activer"}
                    </button>
                    <button onClick={async()=>{
                      if(!window.confirm(`Supprimer le bot ${bot.profiles?.pseudo} ?`)) return;
                      setBots(prev=>prev.filter(b=>b.id!==bot.id));
                      const{error}=await apiAdminDeleteBot(bot.id);
                      if(error){
                        setBots(prev=>[...prev,bot].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)));
                        setMsg("❌ "+error);
                      }
                    }} style={{background:"#e74c3c22",border:"1px solid #e74c3c44",color:"#e74c3c",padding:"4px 10px",borderRadius:8,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:10,cursor:"pointer"}}>Supprimer</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>}

        {/* ── CACHE ── */}
        {tab==="cache"&&<div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontWeight:900,color:"#e74c3c",fontSize:14}}>⚡ Cache Redis</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={async()=>{
                setMsg("⏳ Recalcul des scores…");
                const{data,error}=await apiAdminRecalculateScores();
                if(error) setMsg("❌ "+error);
                else setMsg(`✅ ${data?.updated??0} profil(s) mis à jour`);
              }} style={{...BTN("linear-gradient(135deg,#6c5ce7,#a29bfe)"),padding:"7px 16px",borderRadius:9,fontSize:12}}>
                🔄 Recalculer les scores
              </button>
              <button onClick={async()=>{
                setMsg("⏳ Vidage en cours…");
                const{data,error}=await apiAdminFlushCache();
                if(error) setMsg("❌ "+error+(error.includes('Redis')||error.includes('connect')?' — Redis non configuré ou indisponible':''));
                else setMsg(`✅ ${data?.flushed??0} clé(s) supprimée(s)`);
              }} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"7px 16px",borderRadius:9,fontSize:12}}>
                🗑️ Vider tout le cache
              </button>
            </div>
          </div>
          <div style={{background:"#ffffff08",borderRadius:11,padding:14,border:"1px solid #ffffff12",marginBottom:14}}>
            <div style={{fontSize:11,color:"#888",marginBottom:12,lineHeight:1.6}}>
              Configure la durée de mise en cache pour chaque ressource.<br/>
              <strong style={{color:"#f9ca24"}}>0</strong> = désactivé · TTL en secondes · sauvegarde via "Enregistrer les limites"
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12}}>
              {[
                {key:"cache_ttl_cards",       label:"🃏 Cartes",       hint:"Chargé à chaque login"},
                {key:"cache_ttl_config",      label:"⚙️ Config",       hint:"Paramètres publics"},
                {key:"cache_ttl_leaderboard", label:"🏆 Classement",   hint:"Page + recherche"},
                {key:"cache_ttl_market",      label:"🏪 Marché",       hint:"Carnet d'ordres"},
                {key:"cache_ttl_quiz_stats",  label:"🎲 Quiz stats",   hint:"Agrégat 1 an"},
              ].map(({key,label,hint})=>(
                <div key={key} style={{background:"#ffffff08",borderRadius:10,padding:"10px 12px",border:"1px solid #ffffff10"}}>
                  <div style={{fontWeight:800,color:"#fff",fontSize:12,marginBottom:2}}>{label}</div>
                  <div style={{fontSize:10,color:"#555",marginBottom:7}}>{hint}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <input type="number" min={0} max={3600} value={limEdit[key]??''}
                      placeholder="—"
                      onChange={e=>setLimEdit(p=>({...p,[key]:e.target.value===''?undefined:+e.target.value}))}
                      style={{...INP,width:70}}/>
                    <span style={{fontSize:11,color:"#888"}}>s</span>
                    {limEdit[key]!=null&&<span style={{fontSize:9,color:"#555"}}>{limEdit[key]>=60?`${Math.round(limEdit[key]/60)}min`:`${limEdit[key]}s`}</span>}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={async()=>{await onSetLimits(limEdit);setMsg("✅ TTL sauvegardés !");}}
              style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"8px 18px",borderRadius:9,marginTop:14,fontSize:12}}>
              Sauvegarder les TTL
            </button>
          </div>
          <div style={{background:"#6c5ce712",borderRadius:11,padding:"10px 14px",border:"1px solid #6c5ce733",fontSize:11,color:"#a29bfe"}}>
            ℹ️ Redis est requis. Sans <code>REDIS_URL</code>, le cache est silencieusement désactivé et les requêtes passent directement en base.
          </div>
        </div>}

        {/* ── STATS ── */}
        {tab==="stats"&&<div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <div style={{fontWeight:900,color:"#e74c3c",fontSize:14}}>📊 Statistiques du jeu</div>
            <button onClick={()=>{setGameStats(null);apiAdminGetStats().then(({data})=>{if(data)setGameStats(data);});}}
              style={{...BTN("#ffffff18"),padding:"6px 13px",borderRadius:9,fontSize:12}}>↻ Actualiser</button>
          </div>
          {!gameStats?(
            <div style={{textAlign:"center",color:"#888",padding:"24px 0"}}>Chargement…</div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12}}>
              {[
                {icon:"👥",label:"Joueurs inscrits",    value:gameStats.players?.total??'—',      color:"#a29bfe"},
                {icon:"🔥",label:"Actifs (7 jours)",    value:gameStats.players?.active7d??'—',   color:"#fd79a8"},
                {icon:"❓",label:"Quiz lancés",          value:gameStats.quizzes?.total??'—',      color:"#74b9ff"},
                {icon:"🤝",label:"Geocoins vendus",      value:gameStats.market?.soldCount??'—',   color:"#00b894"},
                {icon:"🏪",label:"Annonces actives",     value:gameStats.market?.activeListings??'—', color:"#fdcb6e"},
                {icon:"💰",label:"Volume total marché",  value:(gameStats.market?.totalVolume??0)+'G', color:"#f9ca24"},
                {icon:"🪙",label:"Or en circulation",    value:(gameStats.economy?.totalGold??0)+'G',  color:"#e17055"},
                {icon:"👑",label:"Légendaires en jeu",   value:gameStats.cardsInGame?.légendaire??0,  color:"#e65100"},
                {icon:"✨",label:"Épiques en jeu",       value:gameStats.cardsInGame?.épique??0,      color:"#6a1b9a"},
                {icon:"💠",label:"Rares en jeu",         value:gameStats.cardsInGame?.rare??0,        color:"#1565c0"},
                {icon:"⚪",label:"Communs en jeu",       value:gameStats.cardsInGame?.commun??0,      color:"#78909c"},
              ].map(({icon,label,value,color})=>(
                <div key={label} style={{background:"#ffffff08",border:"1px solid #ffffff10",borderRadius:13,padding:"16px 14px",textAlign:"center"}}>
                  <div style={{fontSize:28,marginBottom:6}}>{icon}</div>
                  <div style={{fontFamily:"'Fredoka One',sans-serif",fontSize:22,color,marginBottom:3}}>{value}</div>
                  <div style={{fontSize:10,color:"#666",fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>}

        {/* ── HISTORIQUE MARCHÉ (7 jours) ── */}
        {tab==="market_history"&&<div>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{fontWeight:900,color:"#e74c3c",fontSize:14,flex:1}}>💸 Historique marché — 7 derniers jours ({mktHist.total})</div>
            {['','achat','vente'].map(v=>(
              <button key={v} onClick={()=>{setMktHistType(v);setMktHistPage(0);}}
                style={{background:mktHistType===v?"#e74c3c":"#ffffff18",border:"none",color:"#fff",padding:"5px 12px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:"pointer"}}>
                {v===''?'Tout':v==='achat'?'Achats':'Ventes'}
              </button>
            ))}
          </div>
          <input value={mktHistQ} onChange={e=>{setMktHistQ(e.target.value);setMktHistPage(0);}} placeholder="Rechercher carte ou joueur…" style={{...INP,width:"100%",marginBottom:12,fontSize:12}}/>
          {mktHist.loading?(
            <div style={{textAlign:"center",color:"#888",padding:"24px 0"}}>Chargement…</div>
          ):(
            <>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
                {mktHist.transactions.length===0&&<div style={{textAlign:"center",color:"#555",padding:"18px 0",fontSize:12}}>Aucune transaction sur les 7 derniers jours.</div>}
                {mktHist.transactions.map((tx,i)=>{
                  const isAchat=tx.type==='achat';
                  return(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"#ffffff08",borderRadius:9,padding:"8px 12px",border:"1px solid #ffffff10",flexWrap:"wrap"}}>
                      <span style={{fontSize:10,background:isAchat?"#e74c3c22":"#00b89422",color:isAchat?"#e74c3c":"#00b894",border:`1px solid ${isAchat?"#e74c3c44":"#00b89444"}`,borderRadius:50,padding:"2px 8px",fontWeight:800,flexShrink:0}}>{tx.type}</span>
                      <div style={{flex:1,minWidth:100}}>
                        <div style={{fontSize:12,color:"#fff",fontWeight:700}}>{tx.card_name}</div>
                        <div style={{fontSize:10,color:"#888",marginTop:1}}>
                          {tx.profiles?.pseudo||'?'} → {tx.counterpart} · {new Date(tx.created_at).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                        </div>
                      </div>
                      <div style={{fontWeight:900,fontSize:14,color:isAchat?"#e74c3c":"#f9ca24",flexShrink:0}}>{tx.price}G</div>
                    </div>
                  );
                })}
              </div>
              {mktHist.total>30&&(
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  <button onClick={()=>setMktHistPage(p=>Math.max(0,p-1))} disabled={mktHistPage===0}
                    style={{background:mktHistPage===0?"#ffffff0a":"#ffffff18",border:"none",color:mktHistPage===0?"#444":"#fff",width:28,height:28,borderRadius:8,cursor:mktHistPage===0?"default":"pointer",fontWeight:900,fontSize:14}}>‹</button>
                  <span style={{fontSize:11,color:"#888",fontWeight:700}}>Page {mktHistPage+1} / {Math.ceil(mktHist.total/30)}</span>
                  <button onClick={()=>setMktHistPage(p=>p+1)} disabled={(mktHistPage+1)*30>=mktHist.total}
                    style={{background:(mktHistPage+1)*30>=mktHist.total?"#ffffff0a":"#ffffff18",border:"none",color:(mktHistPage+1)*30>=mktHist.total?"#444":"#fff",width:28,height:28,borderRadius:8,cursor:(mktHistPage+1)*30>=mktHist.total?"default":"pointer",fontWeight:900,fontSize:14}}>›</button>
                </div>
              )}
            </>
          )}
        </div>}

        {/* ── MARCHÉ ADMIN ── */}
        {tab==="market_admin"&&<div>
          {/* Ouverture/fermeture des ventes */}
          <div style={{background:"#ffffff08",borderRadius:11,padding:14,border:"1px solid #ffffff12",marginBottom:16,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:900,color:"#f9ca24",fontSize:13,marginBottom:3}}>🔒 Ventes sur le marché</div>
              <div style={{fontSize:12,color:"#aaa"}}>Désactiver empêche tout nouveau listing (les annonces existantes restent).</div>
            </div>
            <button onClick={async()=>{
              const next=!limEdit.marketSalesOpen;
              const updated={...limEdit,marketSalesOpen:next};
              setLimEdit(updated);
              await onSetLimits(updated);
              setMsg(next?"✅ Ventes réouvertes.":"⛔ Ventes fermées.");
            }} style={{...BTN(limEdit.marketSalesOpen?"linear-gradient(135deg,#00b894,#00cec9)":"linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"9px 18px",borderRadius:9,minWidth:110,textAlign:"center"}}>
              {limEdit.marketSalesOpen?"✅ Ouvert":"⛔ Fermé"}
            </button>
          </div>

          {/* Diagnostic + Purge */}
          <div style={{background:"#e74c3c0a",borderRadius:11,padding:12,border:"1px solid #e74c3c22",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:8}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,color:"#e74c3c",fontSize:12,marginBottom:2}}>🧹 Annonces invalides</div>
                <div style={{fontSize:11,color:"#888"}}>Vendeur inexistant, supprimé, banni ou compte non-actif.</div>
              </div>
              <button onClick={async()=>{
                setMsg("⏳ Diagnostic…");
                const{data,error}=await apiAdminDiagnoseListings();
                if(error){setMsg("❌ "+error);return;}
                setMsg(`🔍 ${data.total_active} annonces actives · ${data.suspicious_count} suspectes`);
                if(data.suspicious?.length){
                  console.table(data.suspicious);
                }
              }} style={{...BTN("#ffffff18"),padding:"7px 14px",borderRadius:9,fontSize:11}}>Diagnostiquer</button>
              <button onClick={async()=>{
                setMsg("⏳ Nettoyage en cours…");
                const{data,error}=await apiAdminPurgeOrphans();
                if(error) setMsg("❌ "+error);
                else { setMsg(`✅ ${data.deleted} annonce(s) annulée(s).`); setListingsPage(0); }
              }} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"7px 14px",borderRadius:9,fontSize:11,whiteSpace:"nowrap"}}>
                Purger
              </button>
            </div>
          </div>

          {/* Purge Expirées */}
          <div style={{background:"#e74c3c0a",borderRadius:11,padding:12,border:"1px solid #e74c3c22",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:8}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,color:"#e74c3c",fontSize:12,marginBottom:2}}>⏳ {t('admin_purge_expired')}</div>
                <div style={{fontSize:11,color:"#888"}}>Annule les annonces trop anciennes et restitue les geocoins.</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:11,color:"#aaa"}}>{t('admin_purge_expired_days')}</span>
                <input type="number" min={1} max={365} value={expiredDays} onChange={e=>setExpiredDays(+e.target.value)} style={{...INP,width:60,fontSize:12,padding:"4px 8px"}}/>
              </div>
              <button onClick={async()=>{
                if(!window.confirm(`Purger les annonces de plus de ${expiredDays} jours ?`)) return;
                setMsg("⏳ Nettoyage en cours…");
                const {data,error} = await apiAdminPurgeExpired(expiredDays);
                if(error) setMsg("❌ "+error);
                else { setMsg(`✅ ${data.deleted} annonce(s) expirée(s) annulée(s).`); setListingsPage(0); }
              }} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"7px 14px",borderRadius:9,fontSize:11,whiteSpace:"nowrap"}}>
                {t('admin_purge_expired_btn')}
              </button>
            </div>
          </div>

          {/* Annonces actives */}
          <div style={{fontWeight:800,color:"#e74c3c",fontSize:13,marginBottom:10}}>Annonces actives ({listingsData.total})</div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <input value={listingsQ} onChange={e=>{setListingsQ(e.target.value);setListingsPage(0);}} placeholder="Rechercher une carte…" style={{...INP,flex:1,fontSize:12}}/>
          </div>
          {listingsData.loading?(
            <div style={{textAlign:"center",color:"#888",padding:"18px 0"}}>Chargement…</div>
          ):(
            <>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
                {listingsData.listings.length===0&&<div style={{textAlign:"center",color:"#555",fontSize:12,padding:"14px 0"}}>Aucune annonce active.</div>}
                {listingsData.listings.map(l=>{
                  const rc=RC[l.cards?.rarity||"commun"]; const {c1,c2}=cardCC(l.cards?.rarity||"commun");
                  return(
                    <div key={l.id} style={{display:"flex",alignItems:"center",gap:10,background:"#ffffff08",border:"1px solid #ffffff10",borderRadius:10,padding:"9px 12px",flexWrap:"wrap"}}>
                      <div style={{width:32,height:32,borderRadius:8,background:`linear-gradient(135deg,${c1},${c2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"#fff",flexShrink:0}}>
                        {l.cards?.name?.[0]||"?"}
                      </div>
                      <div style={{flex:1,minWidth:120}}>
                        <div style={{fontWeight:800,color:"#fff",fontSize:12}}>{l.cards?.name}</div>
                        <div style={{fontSize:10,color:"#888"}}>Vendeur : <span style={{color:rc.color,fontWeight:700}}>{l.profiles?.pseudo||"?"}</span> · {l.price}G</div>
                      </div>
                      <button onClick={async()=>{
                        const prevListings = listingsData.listings;
                        setListingsData(prev=>({...prev,listings:prev.listings.filter(x=>x.id!==l.id),total:prev.total-1}));
                        const {error}=await apiAdminCancelListing(l.id);
                        if(error){
                          setListingsData(prev=>({...prev,listings:prevListings,total:prev.total+1}));
                          setMsg("❌ "+error);return;
                        }
                      }} style={{background:"#e74c3c22",border:"1px solid #e74c3c44",color:"#e74c3c",padding:"4px 10px",borderRadius:7,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:"pointer"}}>
                        Annuler
                      </button>
                    </div>
                  );
                })}
              </div>
              {listingsData.total>20&&(
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  <button onClick={()=>setListingsPage(p=>Math.max(0,p-1))} disabled={listingsPage===0} style={{background:listingsPage===0?"#ffffff0a":"#ffffff18",border:"none",color:listingsPage===0?"#444":"#fff",width:28,height:28,borderRadius:8,cursor:listingsPage===0?"default":"pointer",fontWeight:900,fontSize:14}}>‹</button>
                  <span style={{fontSize:11,color:"#888",fontWeight:700}}>Page {listingsPage+1} / {Math.ceil(listingsData.total/20)}</span>
                  <button onClick={()=>setListingsPage(p=>p+1)} disabled={(listingsPage+1)*20>=listingsData.total} style={{background:(listingsPage+1)*20>=listingsData.total?"#ffffff0a":"#ffffff18",border:"none",color:(listingsPage+1)*20>=listingsData.total?"#444":"#fff",width:28,height:28,borderRadius:8,cursor:(listingsPage+1)*20>=listingsData.total?"default":"pointer",fontWeight:900,fontSize:14}}>›</button>
                </div>
              )}
            </>
          )}
        </div>}

        {/* ── RANGS ── */}
        {tab==="ranks"&&(()=>{
          // Pas de sort pendant l'édition — les éléments bougent sinon à chaque frappe
          const ranks = limEdit.playerRanks || [];
          const setRanks = r => setLimEdit(prev => ({...prev, playerRanks: r}));
          return(
            <div>
              <div style={{fontSize:12,color:"#aaa",marginBottom:14,lineHeight:1.6}}>
                Les rangs sont calculés à partir du <strong>score de collection</strong> (Commun×1 · Rare×3 · Épique×7 · Légendaire×20).<br/>
                Le rang le plus élevé bénéficie d'un <strong style={{color:"#f9ca24"}}>effet brillant</strong> sur tous les pseudos.
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
                {ranks.map((rank,i)=>(
                  <div key={rank.label+i} style={{display:"flex",alignItems:"center",gap:8,background:"#ffffff08",borderRadius:10,padding:"10px 12px",border:"1px solid #ffffff10",flexWrap:"wrap"}}>
                    <input value={rank.icon} onChange={e=>{const r=[...ranks];r[i]={...r[i],icon:e.target.value};setRanks(r);}}
                      style={{...INP,width:50,textAlign:"center",fontSize:18,padding:"4px"}}/>
                    <input value={rank.label} onChange={e=>{const r=[...ranks];r[i]={...r[i],label:e.target.value};setRanks(r);}}
                      style={{...INP,flex:1,minWidth:100}}/>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <span style={{fontSize:11,color:"#888"}}>Seuil :</span>
                      <input type="number" min={0} value={rank.min} onChange={e=>{const r=[...ranks];r[i]={...r[i],min:e.target.value===''?'':+e.target.value};setRanks(r);}}
                        style={{...INP,width:70}}/>
                      <span style={{fontSize:11,color:"#888"}}>pts</span>
                    </div>
                    <input type="color" value={rank.color} onChange={e=>{const r=[...ranks];r[i]={...r[i],color:e.target.value};setRanks(r);}}
                      style={{width:32,height:32,borderRadius:6,border:"none",cursor:"pointer",background:"none",padding:0}}/>
                    <div style={{width:10,height:10,borderRadius:"50%",background:rank.color,flexShrink:0}}/>
                    {ranks.length>1&&<button onClick={()=>setRanks(ranks.filter((_,j)=>j!==i))} style={{background:"#e74c3c22",border:"1px solid #e74c3c44",color:"#e74c3c",padding:"4px 8px",borderRadius:7,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:"pointer"}}>✕</button>}
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setRanks([...ranks,{min:(ranks[ranks.length-1]?.min||0)+50,label:"Nouveau rang",color:"#ffffff",icon:"⭐"}])}
                  style={{...BTN("#ffffff18"),padding:"8px 16px",borderRadius:9,fontSize:12}}>+ Ajouter un rang</button>
                <button onClick={async()=>{
                  const sorted={...limEdit,playerRanks:[...ranks].sort((a,b)=>(+a.min||0)-(+b.min||0))};
                  await onSetLimits(sorted);
                  setLimEdit(sorted);
                  setMsg("✅ Rangs sauvegardés !");
                }}
                  style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"8px 16px",borderRadius:9,fontSize:12}}>Sauvegarder</button>
              </div>
            </div>
          );
        })()}

        {/* ── DOMAINES ── */}
        {tab==="domains"&&(()=>{
          const wl = limEdit.registrationWhitelist ?? { enabled: false, domains: [] };
          const domains = Array.isArray(wl.domains) ? wl.domains : [];
          const q = domainSearch.toLowerCase().trim();
          const filtered = q ? domains.filter(d => d.includes(q)) : domains;
          function setWl(next) { setLimEdit(prev => ({ ...prev, registrationWhitelist: next })); }
          function toggleEnabled() { setWl({ ...wl, enabled: !wl.enabled }); }
          function addDomain() {
            const d = domainInput.trim().toLowerCase().replace(/^@/, '');
            if (!d) { setMsg("❌ Domaine vide."); return; }
            if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) { setMsg("❌ Format invalide (ex: gmail.com)"); return; }
            if (domains.includes(d)) { setMsg("⚠️ Domaine déjà présent."); return; }
            setWl({ ...wl, domains: [...domains, d].sort() });
            setDomainInput("");
          }
          function removeDomain(d) { setWl({ ...wl, domains: domains.filter(x => x !== d) }); }
          return (
            <div>
              <div style={{fontWeight:900,color:"#e74c3c",marginBottom:14,fontSize:14}}>🔒 Liste blanche des domaines d'inscription</div>

              {/* Toggle activer/désactiver */}
              <div style={{background:"#ffffff08",borderRadius:11,padding:14,border:"1px solid #ffffff12",marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                  <div>
                    <div style={{fontWeight:800,color:"#f9ca24",fontSize:13,marginBottom:3}}>Filtrage par domaine</div>
                    <div style={{fontSize:11,color:"#888",lineHeight:1.6}}>
                      Si activé, seuls les emails dont le domaine figure dans la liste ci-dessous pourront créer un compte.<br/>
                      Les connexions Google OAuth ne sont <strong style={{color:"#f9ca24"}}>pas</strong> concernées par ce filtre.
                    </div>
                  </div>
                  <button onClick={()=>{toggleEnabled();setMsg(wl.enabled?"⛔ Filtre désactivé.":"✅ Filtre activé — n'oublie pas de sauvegarder !");}}
                    style={{...BTN(wl.enabled?"linear-gradient(135deg,#00b894,#00cec9)":"linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"9px 18px",borderRadius:9,minWidth:110,textAlign:"center",flexShrink:0}}>
                    {wl.enabled?"✅ Activé":"⛔ Désactivé"}
                  </button>
                </div>
                {wl.enabled&&<div style={{marginTop:10,padding:"8px 12px",background:"#e74c3c22",border:"1px solid #e74c3c44",borderRadius:8,fontSize:11,color:"#e74c3c",fontWeight:700}}>
                  ⚠️ Filtre actif — {domains.length} domaine{domains.length>1?"s":""} autorisé{domains.length>1?"s":""}.
                </div>}
              </div>

              {/* Ajouter un domaine */}
              <div style={{background:"#ffffff08",borderRadius:11,padding:14,border:"1px solid #ffffff12",marginBottom:14}}>
                <div style={{fontWeight:800,color:"#f9ca24",marginBottom:9,fontSize:13}}>➕ Ajouter un domaine</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <input value={domainInput} onChange={e=>setDomainInput(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&addDomain()}
                    placeholder="ex: monentreprise.com"
                    style={{...INP,flex:1,minWidth:180,fontFamily:"monospace"}}/>
                  <button onClick={addDomain}
                    style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"7px 16px",borderRadius:8,fontSize:12}}>
                    Ajouter
                  </button>
                </div>
                <div style={{fontSize:10,color:"#555",marginTop:6}}>Sans le "@" — ex : gmail.com, maboite.fr</div>
              </div>

              {/* Sauvegarder */}
              <button onClick={async()=>{
                await onSetLimits(limEdit);
                setMsg("✅ Liste blanche sauvegardée !");
              }} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"9px 20px",borderRadius:9,marginBottom:16,fontSize:12}}>
                💾 Sauvegarder
              </button>

              {/* Liste des domaines */}
              <div style={{fontWeight:800,color:"#e74c3c",fontSize:13,marginBottom:10}}>
                Domaines autorisés ({domains.length})
              </div>
              <input value={domainSearch} onChange={e=>setDomainSearch(e.target.value)}
                placeholder="Rechercher un domaine…"
                style={{...INP,marginBottom:10,fontSize:12}}/>
              <div style={{fontSize:11,color:"#888",marginBottom:8}}>
                {q ? `${filtered.length} / ${domains.length} résultats` : `${domains.length} domaine${domains.length>1?"s":""}`}
              </div>
              <div style={{maxHeight:320,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
                {filtered.length===0&&(
                  <div style={{textAlign:"center",color:"#555",padding:"16px 0",fontSize:12}}>
                    {q?"Aucun résultat.":"Aucun domaine configuré."}
                  </div>
                )}
                {filtered.map(d=>(
                  <div key={d} style={{display:"flex",alignItems:"center",gap:8,background:"#ffffff08",border:"1px solid #ffffff10",borderRadius:8,padding:"6px 12px"}}>
                    <span style={{flex:1,fontFamily:"monospace",fontSize:12,color:"#aaa"}}>{d}</span>
                    <button onClick={()=>{removeDomain(d);setMsg(`✅ "${d}" retiré.`);}}
                      style={{background:"#e74c3c22",border:"1px solid #e74c3c44",color:"#e74c3c",padding:"3px 9px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:10,cursor:"pointer"}}>
                      Retirer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {tab==="seasons"&&<AdminSeasons setMsg={setMsg}/>}

        {tab==="shop"&&(()=>{
          const PACK_LABELS = {
            petit_soutien: { title:'Petit soutien', desc:'2 communs, 2 rares, 1 épique/rare (50/50)' },
            soutien:       { title:'Soutien',        desc:'6 communs, 2 rares, 1 épique/rare (50/50), 1 légen./épique (50/50), 120 Golds' },
            gros_soutien:  { title:'Gros soutien',   desc:'6 communs, 2 rares, 1 épique garantie, 1 légendaire garantie, 200 Golds' },
          }
          const [shopPacks, setShopPacks] = useState(null)
          const [shopEdit,  setShopEdit]  = useState({})

          useEffect(()=>{
            if(shopPacks!==null) return
            apiGetAdminShopPacks().then(({data})=>{
              const p = data?.packs || {}
              setShopPacks(p)
              setShopEdit(JSON.parse(JSON.stringify(p)))
            })
          },[tab])

          async function saveShop(){
            const {error} = await apiUpdateAdminShopPacks(shopEdit)
            if(error){setMsg('❌ '+error);return;}
            setShopPacks(JSON.parse(JSON.stringify(shopEdit)))
            setMsg('✅ Packs sauvegardés.')
          }

          if(!shopPacks) return <div style={{color:'#888',fontSize:13}}>Chargement…</div>

          return (
            <div>
              <div style={{fontWeight:900,fontSize:15,color:'#fff',marginBottom:16}}>🛍️ Packs Boutique</div>
              {Object.entries(PACK_LABELS).map(([id,{title,desc}])=>{
                const pk = shopEdit[id] || {}
                return (
                  <div key={id} style={{background:'#1a2744',border:'1px solid #ffffff22',borderRadius:10,padding:'14px',marginBottom:12}}>
                    <div style={{fontWeight:800,color:'#f9ca24',fontSize:13,marginBottom:6}}>{title}</div>
                    <div style={{fontSize:10,color:'#888',marginBottom:10}}>{desc}</div>
                    <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:8}}>
                      <div>
                        <div style={{fontSize:10,color:'#aaa',fontWeight:700,marginBottom:3,textTransform:'uppercase'}}>Nom affiché</div>
                        <input value={pk.name||''} onChange={e=>setShopEdit(s=>({...s,[id]:{...s[id],name:e.target.value}}))}
                          placeholder={title} style={{...INP,width:160}}/>
                      </div>
                      <div>
                        <div style={{fontSize:10,color:'#aaa',fontWeight:700,marginBottom:3,textTransform:'uppercase'}}>Prix affiché</div>
                        <input value={pk.price||''} onChange={e=>setShopEdit(s=>({...s,[id]:{...s[id],price:e.target.value}}))}
                          placeholder="ex: 3,00 €" style={{...INP,width:100}}/>
                      </div>
                      <div style={{display:'flex',alignItems:'flex-end',marginBottom:3}}>
                        <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}>
                          <input type="checkbox" checked={pk.enabled!==false}
                            onChange={e=>setShopEdit(s=>({...s,[id]:{...s[id],enabled:e.target.checked}}))}
                            style={{width:16,height:16}}/>
                          <span style={{color:'#fff',fontSize:12,fontWeight:700}}>Activé</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )
              })}
              <button onClick={saveShop} style={{...BTN('linear-gradient(135deg,#e74c3c,#c0392b)'),padding:'11px 24px',borderRadius:10,fontSize:13,fontWeight:900}}>
                💾 Sauvegarder
              </button>
            </div>
          )
        })()}

      </div>
    </div>
  );
}
