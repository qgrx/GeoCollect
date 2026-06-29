/* global __COMMIT_SHA__ */
import { useState, useRef, useMemo, useEffect } from 'react';
import { INP, SEL, BTN } from '../../utils/styles.js';
import { useT } from '../../i18n/translations.js';
import { RC, cardCC, RARITY_CONFIG, ACHIEVEMENT_DEF } from '../../data/cards.js';
import { MeltAllPreview } from '../forge/ForgeModal.jsx';
import { PAGE_SIZE } from '../../data/constants.js';
import { apiGetAchievementCards, apiEditAchievementCard, apiTriggerQuiz, apiTriggerShinyQuiz, apiAdminGetMarketHistory, apiAdminGetCardQuizStats, apiAdminAnnounce, apiAdminFlushCache, apiAdminRecalculateScores, apiAdminResetOnboarding,
  apiAdminCancelListing, apiAdminGetListings, apiAdminSetCanSell, apiAdminGetStats, apiAdminReactivate,
  apiAdminGetBots, apiAdminCreateBot, apiAdminUpdateBot, apiAdminDeleteBot,
  apiAdminPurgeOrphans, apiAdminPurgeExpired, apiAdminDiagnoseListings,
  apiAdminSaveTranslations,
  apiAdminEditFullQuestion, apiAdminAddQuestion, apiAdminBatchAddQuestions,
  apiAdminDeleteDraftQuestions, apiAdminDeletePublishedQuestions,
  apiAdminToggleQuestion, apiReleaseHiddenQuestions,
  apiGetAchievementDefs, apiCreateAchievementDef, apiUpdateAchievementDef, apiDeleteAchievementDef, apiReleaseHiddenAchievements,
  apiAdminAddCard,
  apiGetAdminDailyQuests, apiCreateAdminDailyQuest, apiUpdateAdminDailyQuest, apiDeleteAdminDailyQuest,
  apiGetDailySchedule, apiRegenerateDailySchedule,
  apiResetQuestionReports, apiAdminGetQuestions,
  apiGetAdminConfig, apiSetConfig,
  apiAdminGetVersion,
  apiAdminSeedJeu,
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
import AdminReferrals from './AdminReferrals.jsx';
import AdminSeasons from './AdminSeasons.jsx';
import AdminShop    from './AdminShop.jsx';

// ─── Méta des déclencheurs d'achievement (création guidée par type) ──────────
// label : intitulé lisible · unit : ce que compte le seuil · help : explication
const TRIGGER_META = {
  new_card:        { label:"Nouveaux geocoins",        unit:"geocoins",            help:"Nombre de geocoins uniques obtenus pour la première fois." },
  collection_size: { label:"Taille de collection",     unit:"geocoins uniques",    help:"Nombre de geocoins uniques possédés (les cartes achievement ne comptent pas)." },
  buy_count:       { label:"Achats au marché",         unit:"achats",              help:"Nombre total d'achats réalisés au marché." },
  sell_count:      { label:"Mises en vente",           unit:"mises en vente",      help:"Nombre total de mises en vente au marché." },
  quiz_win:        { label:"Quiz gagnés",              unit:"victoires",           help:"Nombre total de quiz gagnés (cumulé)." },
  win_streak:      { label:"Quiz gagnés d'affilée",    unit:"victoires d'affilée", help:"Victoires consécutives dans la journée, remises à zéro en cas de défaite." },
  streak:          { label:"Série de connexion",       unit:"jours",               help:"Jours de connexion consécutifs." },
  shiny_count:     { label:"Geocoins brillants",       unit:"shiny uniques",       help:"Nombre de geocoins brillants uniques possédés." },
  legendary_count: { label:"Cartes légendaires",       unit:"légendaires uniques", help:"Nombre de cartes légendaires uniques possédées (ex. « Première légendaire » = seuil 1)." },
  streak_break:    { label:"Tueur en série",           unit:"interruptions",       help:"Nombre de fois où le joueur casse, en gagnant un quiz, la série « en feu » d'un adversaire (adversaire au-dessus du seuil de handicap)." },
  melt_count:      { label:"Geocoins fondus",          unit:"geocoins fondus",     help:"Nombre total de geocoins fondus à la forge (normaux + brillants)." },
  forge_count:     { label:"Cartes forgées",           unit:"cartes forgées",      help:"Nombre de cartes forgées : rendre brillant ou forger une carte." },
  rank_reached:    { label:"Rang atteint",             unit:"points de score",     help:"Score de rang minimum à atteindre." },
  referral:        { label:"Parrainage « Le parrain »", unit:"filleuls qualifiés", help:"Nombre de filleuls devant chacun récolter assez de geocoins. Le seuil de geocoins par filleul et le max à l'inscription se règlent dans Limites & Prix → Parrainage." },
};
const TRIGGER_KEYS = Object.keys(TRIGGER_META);
const triggerLabel = t => TRIGGER_META[t]?.label || t;

// ─── Composants utilitaires (hors du composant pour éviter remounts) ─────────
function Fld({lbl,children}){
  return <div style={{marginBottom:10}}><div style={{fontSize:10,color:"#aaa",fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>{lbl}</div>{children}</div>;
}
function Tb({id,lbl,tab,setTab,setMsg}){
  return <button onClick={()=>{setTab(id);setMsg("");}} style={{background:tab===id?"#e74c3c":"#ffffff18",border:"none",color:"#fff",padding:"6px 13px",borderRadius:7,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:"pointer"}}>{lbl}</button>;
}
// Sélecteur de geocoin achievement à débloquer — renvoie l'id (number) ou null.
function CardSelect({value,cards,onChange,style}){
  return (
    <select value={value??''} onChange={e=>onChange(e.target.value?+e.target.value:null)} style={style}>
      <option value="">— Aucune —</option>
      {cards.map(c=><option key={c.id} value={c.id}>#{c.id} · {c.name} ({c.rarity})</option>)}
    </select>
  );
}

// ─── Date locale ⇄ ISO pour <input type="datetime-local"> ────────────────────
function isoToLocalInput(iso){
  if(!iso) return '';
  const d=new Date(iso); if(isNaN(d.getTime())) return '';
  const pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(s){
  if(!s) return null;
  const d=new Date(s); return isNaN(d.getTime())?null:d.toISOString();
}
const mapServerQ = q => ({
  id:q.id, q:q.question, a:q.answer, hint:q.hint||'', active:q.active,
  hidden:!!q.hidden, publish_at:q.publish_at||null,
  translations:q.translations||{}, alt_answers:q.alt_answers||[],
  report_count:q.report_count||0,
});
const Q_TRANS_LANGS=[{code:'en',label:'English'},{code:'de',label:'Deutsch'},{code:'es',label:'Español'}];

// ─── Gestionnaire de questions (réutilisé par les onglets « Questions » et « Brouillons ») ──
// mode='published' → questions en jeu (hidden=false) · mode='drafts' → brouillons (hidden=true).
// Composant autonome : il charge ses propres données et n'écrit jamais hors de son périmètre
// (un import de brouillons ne touche pas les questions publiées et inversement).
function QuestionsManager({mode,setMsg,t}){
  const isDraft = mode==='drafts';
  const accent = isDraft ? '#e17055' : '#e74c3c';
  const [all,setAll]=useState(null);                 // toutes les questions (null = chargement)
  const [editQ,setEditQ]=useState(null);
  const emptyNq=()=>({q:"",a:"",hint:"",alt_answers:[],publish_at:null});
  const [nq,setNq]=useState(emptyNq);
  const [altInput,setAltInput]=useState("");
  const [qPage,setQPage]=useState(0);
  const [qSearch,setQSearch]=useState("");
  const [qFilterReported,setQFilterReported]=useState(false);
  const [resetReports]=useState(()=>new Set());
  const [transQ,setTransQ]=useState(null);
  const [transLang,setTransLang]=useState('en');
  const [csvPending,setCsvPending]=useState(null);
  const [globalPublishAt,setGlobalPublishAt]=useState(null); // planification globale des brouillons (ISO ou null)
  const [globalInput,setGlobalInput]=useState("");           // saisie datetime-local en attente
  const csvRef=useRef();

  useEffect(()=>{
    apiAdminGetQuestions().then(({data})=>setAll((data?.questions||[]).map(mapServerQ)));
    if(isDraft) apiGetAdminConfig().then(({data})=>setGlobalPublishAt(data?.config?.drafts_publish_at||null));
  },[isDraft]);

  const items=(all||[]).filter(q=> isDraft ? q.hidden : !q.hidden);

  // ── Planification globale (publie TOUS les brouillons à une date donnée) ──
  async function saveGlobalSchedule(){
    const iso=localInputToIso(globalInput);
    if(!iso){setMsg("❌ Date invalide.");return;}
    const {error}=await apiSetConfig('drafts_publish_at',iso);
    if(error){setMsg("❌ "+error);return;}
    setGlobalPublishAt(iso); setGlobalInput("");
    setMsg(`✅ Tous les brouillons seront publiés le ${new Date(iso).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}.`);
  }
  async function clearGlobalSchedule(){
    const {error}=await apiSetConfig('drafts_publish_at',null);
    if(error){setMsg("❌ "+error);return;}
    setGlobalPublishAt(null); setGlobalInput("");
    setMsg("✅ Planification groupée annulée.");
  }

  // ── CSV (périmètre du mode courant uniquement) ──
  async function handleCSV(e){
    const f=e.target.files[0]; if(!f) return; e.target.value='';
    const rows=parseCSV(await f.text());
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
    const {questions:parsed}=csvPending; setCsvPending(null);
    setMsg("⏳ Importation en cours…");
    if(replace){
      const {error}=await (isDraft?apiAdminDeleteDraftQuestions():apiAdminDeletePublishedQuestions());
      if(error){setMsg("❌ Erreur suppression : "+error);return;}
      setAll(prev=>(prev||[]).filter(q=> isDraft ? !q.hidden : q.hidden));
    }
    const {data,error}=await apiAdminBatchAddQuestions(parsed,isDraft);
    if(error){setMsg("❌ Erreur import : "+error);return;}
    const saved=(data?.questions||[]).map(mapServerQ);
    setAll(prev=>[...saved,...(prev||[])]);
    setMsg(`✅ ${data?.inserted||saved.length} ${isDraft?'brouillon(s)':'question(s)'} importé(s) !`);
  }
  function exportCSV(){
    const header="question,reponse,question_en,reponse_en,question_de,reponse_de,question_es,reponse_es";
    const rows=items.map(q=>{const tr=q.translations||{};return `"${q.q}","${q.a}","${tr.en?.question||""}","${tr.en?.answer||""}","${tr.de?.question||""}","${tr.de?.answer||""}","${tr.es?.question||""}","${tr.es?.answer||""}"`;});
    const blob=new Blob([[header,...rows].join("\n")],{type:"text/csv"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=isDraft?"brouillons.csv":"questions.csv"; a.click();
  }

  // ── Mutations ──
  async function addQuestion(){
    if(!nq.q||!nq.a){setMsg("❌ Q et R requis.");return;}
    const {data,error}=await apiAdminAddQuestion(nq.q,nq.a,{},nq.alt_answers,isDraft,nq.hint,isDraft?nq.publish_at:null);
    if(error||!data?.question){setMsg("❌ Erreur ajout");return;}
    setAll(prev=>[mapServerQ(data.question),...(prev||[])]);
    setMsg(isDraft?"✅ Brouillon ajouté !":"✅ Question ajoutée !");
    setNq(emptyNq()); setAltInput("");
  }
  async function saveEdit(){
    if(!editQ.q||!editQ.a){setMsg("❌ Q et R requis.");return;}
    const fields={q:editQ.q,a:editQ.a,hint:editQ.hint,alt_answers:editQ.alt_answers||[]};
    if(isDraft) fields.publish_at=editQ.publish_at||null;
    const {data,error}=await apiAdminEditFullQuestion(editQ.id,fields);
    if(error){setMsg("❌ Erreur sauvegarde");return;}
    const merged={...editQ,...(data?.question?mapServerQ(data.question):{})};
    setAll(prev=>(prev||[]).map(x=>x.id===merged.id?merged:x));
    setEditQ(null);setAltInput("");setMsg("✅ Question mise à jour !");
  }
  async function toggleActive(q){
    const newActive=q.active===false;
    setAll(prev=>(prev||[]).map(x=>x.id===q.id?{...x,active:newActive}:x));
    const {error}=await apiAdminToggleQuestion(q.id,newActive);
    if(error){setAll(prev=>(prev||[]).map(x=>x.id===q.id?{...x,active:!newActive}:x));setMsg("❌ "+error);return;}
    setMsg(newActive?"✅ Question réactivée.":"⛔ Question désactivée.");
  }
  async function publishNow(q){
    if(!window.confirm("Publier ce brouillon maintenant ? Il entrera dans le pool des quiz."))return;
    const {error}=await apiAdminEditFullQuestion(q.id,{q:q.q,a:q.a,hint:q.hint,alt_answers:q.alt_answers||[],hidden:false,publish_at:null});
    if(error){setMsg("❌ "+error);return;}
    setAll(prev=>(prev||[]).map(x=>x.id===q.id?{...x,hidden:false,publish_at:null}:x));
    setMsg("✅ Brouillon publié !");
  }
  async function publishAll(){
    const count=items.length;
    if(!window.confirm(`Publier ${count} brouillon(s) ? Ils entreront dans le pool des quiz.`))return;
    const {data,error}=await apiReleaseHiddenQuestions();
    if(error){setMsg("❌ "+error);return;}
    setAll(prev=>(prev||[]).map(x=>x.hidden?{...x,hidden:false,publish_at:null}:x));
    setMsg(`✅ ${data?.released??count} brouillon(s) publié(s) !`);
  }
  async function resetRep(q){
    const {error}=await apiResetQuestionReports(q.id);
    if(error){setMsg("❌ "+error);return;}
    setAll(prev=>(prev||[]).map(x=>x.id===q.id?{...x,report_count:0}:x));
    setMsg("✅ Signalements réinitialisés.");
  }
  async function saveTrans(){
    const {error}=await apiAdminSaveTranslations(transQ.id,transQ.translations);
    if(error){setMsg("❌ Erreur sauvegarde");return;}
    setAll(prev=>(prev||[]).map(x=>x.id===transQ.id?{...x,translations:transQ.translations}:x));
    setMsg("✅ Traductions sauvegardées !");
  }

  if(all===null) return <div style={{textAlign:"center",color:"#a8bfcf",padding:"30px 0",fontSize:13}}>⏳ Chargement…</div>;

  const cur = editQ ?? nq;
  const set = v => editQ ? setEditQ(v) : setNq(v);
  const altAnswers = cur.alt_answers || [];
  const addAlt = () => {
    const v = altInput.trim();
    if(!v || altAnswers.includes(v)) { setAltInput(""); return; }
    set({...cur, alt_answers:[...altAnswers, v]});
    setAltInput("");
  };

  const Q_PAGE=10;
  const filtered=items.filter(q=>
    (!qFilterReported || ((q.report_count||0)>0 && !resetReports.has(q.id))) &&
    (q.q.toLowerCase().includes(qSearch.toLowerCase())||
     q.a.toLowerCase().includes(qSearch.toLowerCase())||
     (q.hint||"").toLowerCase().includes(qSearch.toLowerCase())||
     (q.alt_answers||[]).some(a=>a.toLowerCase().includes(qSearch.toLowerCase())))
  );
  const totalPages=Math.ceil(filtered.length/Q_PAGE);
  const pg=Math.min(qPage,Math.max(0,totalPages-1));
  const slice=filtered.slice(pg*Q_PAGE,(pg+1)*Q_PAGE);

  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{flex:1,fontWeight:900,color:accent,fontSize:14}}>{isDraft?"📝 Brouillons":"❓ Questions"} ({items.length})</div>
        {isDraft&&items.length>0&&(
          <button onClick={publishAll} style={{...BTN("linear-gradient(135deg,#e17055,#d63031)"),padding:"5px 11px",fontSize:11,borderRadius:7}} title="Publier tous les brouillons d'un coup">🚀 Publier {items.length}</button>
        )}
        <button onClick={()=>csvRef.current.click()} style={{...BTN("#ffffff18"),padding:"5px 11px",fontSize:11,borderRadius:7}}>📥 CSV</button>
        <button onClick={exportCSV} style={{...BTN("#ffffff18"),padding:"5px 11px",fontSize:11,borderRadius:7}}>📤 Export</button>
        <input ref={csvRef} type="file" accept=".csv" onChange={handleCSV} style={{display:"none"}}/>
      </div>

      {/* Planification groupée (brouillons uniquement) : publie TOUS les brouillons à une date donnée */}
      {isDraft&&(
        <div style={{background:"#e1705512",border:"1px solid #e1705540",borderRadius:11,padding:"11px 14px",marginBottom:14}}>
          <div style={{fontWeight:800,color:"#e17055",fontSize:12,marginBottom:8}}>📅 Publication groupée programmée</div>
          {globalPublishAt?(
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <span style={{fontSize:12,color:"#fff",fontWeight:700}}>Tous les brouillons seront publiés le <span style={{color:"#f9ca24"}}>{new Date(globalPublishAt).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}</span>.</span>
              <button onClick={clearGlobalSchedule} style={{...BTN("#ffffff18"),padding:"5px 11px",fontSize:11,borderRadius:7}}>✕ Annuler la planification</button>
            </div>
          ):(
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <input type="datetime-local" value={globalInput} onChange={e=>setGlobalInput(e.target.value)} style={{...INP,width:220}}/>
              <button onClick={saveGlobalSchedule} disabled={!globalInput} style={{...BTN("linear-gradient(135deg,#e17055,#d63031)"),padding:"7px 14px",fontSize:11,borderRadius:8,opacity:globalInput?1:0.5}}>Programmer</button>
              <span style={{fontSize:11,color:"#8daacc"}}>Publie d'un coup l'ensemble des brouillons à cette date/heure. Les dates individuelles échues restent appliquées avant.</span>
            </div>
          )}
        </div>
      )}

      {/* Dialog choix import CSV */}
      {csvPending&&(
        <div style={{background:"#1a0a2e",border:"1.5px solid #6c5ce7",borderRadius:12,padding:16,marginBottom:14,textAlign:"center"}}>
          <div style={{fontWeight:900,color:"#f9ca24",fontSize:14,marginBottom:6}}>📥 Importer {csvPending.questions.length} {isDraft?"brouillons":"questions"}</div>
          <div style={{color:"#aaa",fontSize:12,marginBottom:14}}>Que faire des {isDraft?"brouillons":"questions publiées"} existant·e·s ? {isDraft&&<span style={{color:"#8daacc"}}>(les questions déjà en jeu ne sont jamais touchées)</span>}</div>
          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={()=>doImportCSV(true)} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"9px 18px",borderRadius:9,fontSize:12}}>🗑️ Remplacer les {isDraft?"brouillons":"existantes"}</button>
            <button onClick={()=>doImportCSV(false)} style={{...BTN("linear-gradient(135deg,#00b894,#00cec9)"),padding:"9px 18px",borderRadius:9,fontSize:12}}>➕ Ajouter</button>
            <button onClick={()=>setCsvPending(null)} style={{background:"none",border:"none",color:"#8daacc",fontSize:12,cursor:"pointer",fontFamily:"'Nunito',sans-serif"}}>Annuler</button>
          </div>
        </div>
      )}

      {/* Formulaire */}
      <div style={{background:"#ffffff08",borderRadius:11,padding:14,border:"1px solid #ffffff12",marginBottom:14}}>
        <div style={{fontWeight:800,color:"#f9ca24",marginBottom:9,fontSize:13}}>{editQ?"✏️ Éditer":(isDraft?"➕ Nouveau brouillon":"➕ Nouvelle question")}</div>
        <Fld lbl="Question"><input value={cur.q} onChange={e=>set({...cur,q:e.target.value})} style={INP} placeholder={t("admin_q_placeholder")}/></Fld>
        <Fld lbl="Réponse attendue"><input value={cur.a} onChange={e=>set({...cur,a:e.target.value})} style={INP} placeholder={t("admin_q_answer_placeholder")||"Réponse exacte"}/></Fld>
        <Fld lbl="Réponses alternatives">
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>
            {altAnswers.map((v,i)=>(
              <span key={i} style={{display:"inline-flex",alignItems:"center",gap:4,background:"#00b89422",border:"1px solid #00b89444",borderRadius:50,padding:"2px 9px",fontSize:11,color:"#00b894",fontWeight:700}}>
                {v}
                <button onClick={()=>set({...cur,alt_answers:altAnswers.filter((_,j)=>j!==i)})} style={{background:"none",border:"none",color:"#00b894",cursor:"pointer",padding:0,fontSize:12,lineHeight:1,fontFamily:"'Nunito',sans-serif"}}>×</button>
              </span>
            ))}
          </div>
          <div style={{display:"flex",gap:6}}>
            <input value={altInput} onChange={e=>setAltInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addAlt();}}} style={{...INP,flex:1,padding:"6px 10px"}} placeholder="Ex: 0 — Entrée pour ajouter"/>
            <button onClick={addAlt} style={{...BTN("#00b89433"),padding:"6px 12px",borderRadius:8,fontSize:11,border:"1px solid #00b89444",color:"#00b894"}}>+</button>
          </div>
        </Fld>
        <Fld lbl="Indice"><input value={cur.hint} onChange={e=>set({...cur,hint:e.target.value})} style={INP} placeholder={t("admin_hint_placeholder")}/></Fld>
        {isDraft&&(
          <Fld lbl="📅 Publication programmée (optionnel)">
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <input type="datetime-local" value={isoToLocalInput(cur.publish_at)} onChange={e=>set({...cur,publish_at:localInputToIso(e.target.value)})} style={{...INP,flex:1}}/>
              {cur.publish_at&&<button onClick={()=>set({...cur,publish_at:null})} title="Retirer la date" style={{...BTN("#ffffff12"),padding:"6px 10px",borderRadius:8,fontSize:11}}>✕</button>}
            </div>
            <div style={{color:"#8daacc",fontSize:11,marginTop:3}}>Le brouillon sera publié automatiquement à cette date/heure et entrera dans le pool des quiz. Laissez vide pour publier manuellement.</div>
          </Fld>
        )}
        <div style={{display:"flex",gap:8}}>
          {editQ?(
            <><button onClick={saveEdit} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"8px 16px",borderRadius:8,fontSize:12}}>Enregistrer</button>
            <button onClick={()=>{setEditQ(null);setAltInput("");}} style={{background:"none",border:"none",color:"#8daacc",fontSize:12,cursor:"pointer",fontFamily:"'Nunito',sans-serif"}}>{t("shop_cancel")}</button></>
          ):(
            <button onClick={addQuestion} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"8px 16px",borderRadius:8,fontSize:12}}>Ajouter</button>
          )}
        </div>
      </div>

      {/* Recherche + pagination */}
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
        <input value={qSearch} onChange={e=>{setQSearch(e.target.value);setQPage(0);}} placeholder="Rechercher…" style={{...INP,flex:1,padding:"7px 11px",fontSize:12}}/>
        <button onClick={()=>{setQFilterReported(v=>!v);setQPage(0);}}
          style={{background:qFilterReported?"#e74c3c22":"#ffffff0a",border:`1px solid ${qFilterReported?"#e74c3c66":"#ffffff18"}`,color:qFilterReported?"#e74c3c":"#888",padding:"5px 10px",borderRadius:7,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:"pointer",whiteSpace:"nowrap"}}>
          ⚠ Signalées {qFilterReported&&`(${filtered.length})`}
        </button>
        <span style={{fontSize:11,color:"#8daacc",whiteSpace:"nowrap",fontWeight:700}}>{filtered.length}/{items.length}</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
        {slice.length===0&&<div style={{textAlign:"center",color:"#a8bfcf",padding:"18px 0",fontSize:12}}>{isDraft?"Aucun brouillon.":"Aucune question trouvée."}</div>}
        {slice.map(q=>{const inactive=q.active===false;return(
          <div key={q.id} style={{display:"flex",alignItems:"flex-start",gap:9,background:editQ?.id===q.id?"#f9ca2410":inactive?"#e74c3c08":"#ffffff08",borderRadius:9,padding:"9px 12px",border:`1px solid ${editQ?.id===q.id?"#f9ca2444":inactive?"#e74c3c22":"#ffffff10"}`,opacity:inactive?0.6:1}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,color:inactive?"#666":"#fff",fontWeight:700,marginBottom:2,textDecoration:inactive?"line-through":"none"}}>{q.q}</div>
              <div style={{fontSize:11,color:"#00b894",fontWeight:700}}>→ {q.a}</div>
              {(q.alt_answers||[]).length>0&&<div style={{fontSize:10,color:"#00b894",opacity:.7,marginTop:1}}>∥ {q.alt_answers.join(", ")}</div>}
              {q.hint&&<div style={{fontSize:10,color:"#a8bfcf",marginTop:2}}>💡 {q.hint}</div>}
              {isDraft&&q.publish_at&&<div style={{display:"inline-block",fontSize:10,color:"#f9ca24",fontWeight:800,marginTop:3,background:"#f9ca2418",borderRadius:4,padding:"1px 6px"}}>📅 Publication : {new Date(q.publish_at).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}</div>}
              {(q.report_count||0)>0&&!resetReports.has(q.id)&&(
                <div style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:3}}>
                  <div style={{display:"inline-flex",alignItems:"center",gap:4,background:"#e74c3c22",border:"1px solid #e74c3c44",borderRadius:50,padding:"1px 7px",fontSize:9,fontWeight:800,color:"#e74c3c"}}>⚠ {q.report_count} signalement{q.report_count>1?"s":""}</div>
                  <button onClick={()=>resetRep(q)} title="Réinitialiser les signalements" style={{background:"#ffffff12",border:"1px solid #ffffff22",color:"#aaa",padding:"1px 7px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:9,cursor:"pointer"}}>↺ reset</button>
                </div>
              )}
              {inactive&&<div style={{fontSize:9,color:"#e74c3c",fontWeight:800,marginTop:3}}>DÉSACTIVÉE</div>}
            </div>
            <div style={{display:"flex",gap:5,flexShrink:0}}>
              {!inactive&&isDraft&&<button onClick={()=>publishNow(q)} title="Publier maintenant" style={{background:"#e1705522",border:"1px solid #e1705544",color:"#e17055",padding:"4px 9px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:10,cursor:"pointer"}}>🚀</button>}
              {!inactive&&<button onClick={()=>{setEditQ(editQ?.id===q.id?null:{...q,alt_answers:q.alt_answers||[]});setAltInput("");}} style={{background:"#f9ca2422",border:"1px solid #f9ca2444",color:"#f9ca24",padding:"4px 9px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:10,cursor:"pointer"}}>✏️</button>}
              {!inactive&&<button onClick={()=>setTransQ(transQ?.id===q.id?null:{...q,translations:q.translations||{}})} title="Traduire" style={{background:"#6c5ce722",border:"1px solid #6c5ce744",color:"#a29bfe",padding:"4px 9px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:10,cursor:"pointer"}}>🌐</button>}
              <button onClick={()=>toggleActive(q)} style={{background:inactive?"#00b89422":"#e74c3c22",border:`1px solid ${inactive?"#00b89444":"#e74c3c44"}`,color:inactive?"#00b894":"#e74c3c",padding:"4px 9px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:10,cursor:"pointer"}}>{inactive?"✅":"🗑️"}</button>
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
              style={{width:i===pg?28:8,height:8,borderRadius:i===pg?6:50,border:"none",cursor:"pointer",background:i===pg?accent:"#ffffff33",padding:0,transition:"all .2s",color:i===pg?"#fff":"transparent",fontSize:10,fontWeight:900}}>
              {i===pg?`${i+1}`:""}
            </button>
          ))}
          <button onClick={()=>setQPage(p=>Math.min(totalPages-1,p+1))} disabled={pg===totalPages-1}
            style={{background:pg===totalPages-1?"#ffffff0a":"#ffffff18",border:"none",color:pg===totalPages-1?"#444":"#fff",width:28,height:28,borderRadius:8,cursor:pg===totalPages-1?"default":"pointer",fontWeight:900,fontSize:14}}>›</button>
          <span style={{fontSize:11,color:"#8daacc",marginLeft:4}}>{pg+1} / {totalPages}</span>
        </div>
      )}

      {/* ── Panneau traductions ── */}
      {transQ&&(
        <div style={{background:"#1a0a3a",border:"1.5px solid #6c5ce766",borderRadius:12,padding:16,marginTop:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontWeight:900,color:"#a29bfe",fontSize:13}}>🌐 Traductions — <span style={{color:"#fff",fontStyle:"italic"}}>{transQ.q}</span></div>
            <button onClick={()=>setTransQ(null)} style={{background:"none",border:"none",color:"#8daacc",fontSize:14,cursor:"pointer"}}>✕</button>
          </div>
          <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
            {Q_TRANS_LANGS.map(l=>(
              <button key={l.code} onClick={()=>setTransLang(l.code)}
                style={{background:transLang===l.code?"#6c5ce7":"#ffffff10",border:"none",color:transLang===l.code?"#fff":"#aaa",padding:"5px 12px",borderRadius:8,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:"pointer"}}>
                {l.label} {transQ.translations?.[l.code]?.question?"✓":""}
              </button>
            ))}
          </div>
          {Q_TRANS_LANGS.filter(l=>l.code===transLang).map(l=>(
            <div key={l.code}>
              <Fld lbl={`Question (${l.label})`}>
                <input value={transQ.translations?.[l.code]?.question||""} onChange={e=>setTransQ(q=>({...q,translations:{...q.translations,[l.code]:{...q.translations?.[l.code],question:e.target.value}}}))} style={INP} placeholder={`Question en ${l.label}…`}/>
              </Fld>
              <Fld lbl={`Réponse (${l.label})`}>
                <input value={transQ.translations?.[l.code]?.answer||""} onChange={e=>setTransQ(q=>({...q,translations:{...q.translations,[l.code]:{...q.translations?.[l.code],answer:e.target.value}}}))} style={INP} placeholder={`Réponse en ${l.label}…`}/>
              </Fld>
            </div>
          ))}
          <button onClick={saveTrans} style={{...BTN("linear-gradient(135deg,#6c5ce7,#a29bfe)"),padding:"8px 18px",borderRadius:8,fontSize:12,marginTop:8}}>
            💾 Sauvegarder les traductions
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
export default function AdminPanel({cardPool,cardTypes,questions,limits,maintenanceMode,maintenanceText,bannedIPs,onClose,onAddCard,onEditCard,onDeleteCard,onAddType,onDeleteType,onRenameType,onAddQuestion,onReplaceQuestions,onReleaseHiddenQuestions,onEditQuestion,onDeleteQuestion,onToggleQuestion,onSetLimits,onSetMaintenance,onBanIP,onUnbanIP,onStartTour,onUpdateCardInPool,onTestAchievement,onShopPacksSaved,onShopTestModeChange}){
  const {t}=useT();
  // Geocoins de type achievement, proposés pour lier une condition à une carte.
  const achievementCards=(cardPool||[]).filter(c=>c.type?.toLowerCase().startsWith('achievement'));
  const [tab,setTab]=useState(()=>window.location.hash.slice(1)||"cards");
  const [showMeltPreview,setShowMeltPreview]=useState(false);
  // Les onglets « Questions » et « Brouillons » sont gérés par <QuestionsManager/> (autonome).

  // ── Mode démo (onboarding) : 5 paires geocoin + question ──────────────────────
  const [demoPairs,setDemoPairs]=useState([]);          // [{card_id, question_id}]
  const [demoQuestions,setDemoQuestions]=useState([]);  // [{id, q}]
  const [demoTribute,setDemoTribute]=useState([]);      // [card_id] geocoins « hommage » (faux feed)
  const [demoLoaded,setDemoLoaded]=useState(false);
  useEffect(()=>{
    if(tab!=='demo'||demoLoaded) return;
    setDemoLoaded(true);
    import('../../services/api.js').then(async (api)=>{
      const [{data:cfg},{data:qs}]=await Promise.all([api.apiGetAdminConfig(),api.apiAdminGetQuestions()]);
      const arr=Array.isArray(cfg?.config?.demo_geocoins)?cfg.config.demo_geocoins:[];
      setDemoPairs(arr.slice(0,5));
      setDemoTribute(Array.isArray(cfg?.config?.demo_tribute_geocoins)?cfg.config.demo_tribute_geocoins.map(Number):[]);
      setDemoQuestions((qs?.questions||[]).map(q=>({id:q.id,q:q.question})));
    }).catch(()=>{});
  },[tab,demoLoaded]);
  const setDemoPair=(i,key,val)=>setDemoPairs(prev=>{const next=[...prev];next[i]={...(next[i]||{}),[key]:val};return next;});
  const addTribute=(id)=>{const n=Number(id);if(n&&!demoTribute.includes(n))setDemoTribute([...demoTribute,n]);};
  const removeTribute=(id)=>setDemoTribute(demoTribute.filter(x=>x!==id));
  const saveDemo=async()=>{
    const pairs=demoPairs.filter(p=>p&&p.card_id&&p.question_id).slice(0,5)
      .map(p=>({card_id:Number(p.card_id),question_id:Number(p.question_id)}));
    const {apiSetConfig}=await import('../../services/api.js');
    const [r1,r2]=await Promise.all([apiSetConfig('demo_geocoins',pairs),apiSetConfig('demo_tribute_geocoins',demoTribute)]);
    const error=r1.error||r2.error;
    setMsg(error?`❌ ${error}`:`✅ Démo sauvegardée (${pairs.length} geocoin${pairs.length>1?'s':''}, ${demoTribute.length} hommage) !`);
  };

  const [achCards,setAchCards]=useState([]);
  const [editAch,setEditAch]=useState(null);
  const [achDefs,setAchDefs]=useState([]);
  const [editDef,setEditDef]=useState(null);
  const [newDef,setNewDef]=useState(null);
  // Variantes de paliers supérieurs (rare/épique/légendaire) d'une définition évolutive :
  // on les masque de la grille pour ne pas afficher 4× le même geocoin (une série = 1 carte).
  const achVariantIds=useMemo(()=>{
    const s=new Set();
    for(const d of achDefs){
      if(d.card_id_rare)      s.add(d.card_id_rare);
      if(d.card_id_epic)      s.add(d.card_id_epic);
      if(d.card_id_legendary) s.add(d.card_id_legendary);
    }
    return s;
  },[achDefs]);
  const baseAchCards=useMemo(()=>achCards.filter(c=>!achVariantIds.has(c.id)),[achCards,achVariantIds]);
  // Définition liée à une carte de base (card_id), pour éditer ses paliers au clic.
  const defByCardId=useMemo(()=>{
    const m={};
    for(const d of achDefs){ if(d.card_id) m[d.card_id]=d; }
    return m;
  },[achDefs]);
  const [newAchCard,setNewAchCard]=useState(null);
  const newAchFileRef=useRef();
  const [dailyQuests,setDailyQuests]=useState([]);
  const [editQuest,setEditQuest]=useState(null);
  const [newQuest,setNewQuest]=useState(null);
  const [questSort,setQuestSort]=useState({col:'id',dir:'asc'});
  const [questTransOpen,setQuestTransOpen]=useState(false);
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
  const [versionInfo,setVersionInfo]=useState(null);
  const [bots,setBots]=useState([]);
  const [botForm,setBotForm]=useState({pseudo:'',type:'seller',config:BOT_DEFAULTS.seller});  // { playerId: bool }
  const [listingsPage,setListingsPage]=useState(0);
  const [listingsQ,setListingsQ]=useState('');
  const [expiredDays,setExpiredDays]=useState(limits.marketExpireDays || 30);
  const [ntName,setNtName]=useState("");
  const [editingType,setEditingType]=useState(null);
  const [editTypeName,setEditTypeName]=useState("");
  const [limEdit,setLimEdit]=useState(limits);
  const [maintText,setMaintText]=useState(maintenanceText||"");
  const [ipInput,setIpInput]=useState("");
  const [msg,setMsg]=useState("");
  const [domainInput,setDomainInput]=useState("");
  const [domainSearch,setDomainSearch]=useState("");

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

  useEffect(()=>{setEditAch(null);setListingsPage(0);setListingsQ('');setMktHistPage(0);setMktHistType('');setMktHistQ('');setDomainInput('');setDomainSearch('');},[tab]);

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
    if(tab!=='version') return;
    apiAdminGetVersion().then(({data})=>{ if(data) setVersionInfo(data); });
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


  const NAV=[
    {label:'Contenu',items:[{id:'cards',icon:'🃏',label:'Cartes'},{id:'types',icon:'🏷️',label:'Types'},{id:'seasons',icon:'🌸',label:'Saisons'}]},
    {label:'Quiz',items:[{id:'questions',icon:'❓',label:'Questions'},{id:'drafts',icon:'📝',label:'Brouillons'},{id:'quiz_config',icon:'🎲',label:'Stats & Taux'},{id:'demo',icon:'🎮',label:'Démo'}]},
    {label:'Économie',items:[{id:'limits',icon:'💰',label:'Limites & Prix'},{id:'shop',icon:'🛍️',label:'Boutique'},{id:'ranks',icon:'🎖️',label:'Rangs'}]},
    {label:'Récompenses',items:[{id:'quests',icon:'🔨',label:'Quêtes'},{id:'achievements',icon:'🏆',label:'Achievements'}]},
    {label:'Communauté',items:[{id:'players',icon:'👤',label:'Joueurs'},{id:'referrals',icon:'🤝',label:'Parrainage'},{id:'bots',icon:'🤖',label:'Bots'},{id:'market_admin',icon:'🏪',label:'Marché admin'},{id:'market_history',icon:'💸',label:'Historique'},{id:'ips',icon:'🌐',label:`IPs${bannedIPs.length?` (${bannedIPs.length})`:''}`}]},
    {label:'Système',items:[{id:'maintenance',icon:'🛠️',label:'Maintenance'},{id:'interface',icon:'📱',label:'Interface'},{id:'cache',icon:'⚡',label:'Cache'},{id:'stats',icon:'📈',label:'Stats'},{id:'domains',icon:'🔒',label:'Domaines'},{id:'version',icon:'🔖',label:'Version'}]},
  ]

  return (
    <div style={{position:"fixed",inset:0,zIndex:2000,display:"flex",flexDirection:"column",fontFamily:"'Nunito',sans-serif",background:"#0f1923",color:"#d4e8f8"}}>

      {/* ── Header ── */}
      <div style={{height:52,flexShrink:0,background:"#0c1620",borderBottom:"1px solid #e74c3c22",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontFamily:"'Fredoka One',sans-serif",fontSize:18,color:"#e74c3c"}}>🔧 {t("admin_title")}</span>
          {msg&&<div style={{background:msg.startsWith("❌")?"#e74c3c22":"#00b89422",border:`1px solid ${msg.startsWith("❌")?"#e74c3c55":"#00b89455"}`,color:msg.startsWith("❌")?"#e74c3c":"#00b894",fontWeight:800,fontSize:11,padding:"3px 10px",borderRadius:6,maxWidth:320,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{msg}</div>}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {onStartTour&&<button onClick={onStartTour} style={{background:"linear-gradient(135deg,#6c5ce7,#a29bfe)",border:"none",color:"#fff",padding:"5px 12px",borderRadius:8,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:"pointer"}}>🎓 Tuto</button>}
          <button onClick={onClose} style={{background:"#ffffff12",border:"none",color:"#8daacc",width:32,height:32,borderRadius:"50%",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>

        {/* Sidebar */}
        <div style={{width:188,flexShrink:0,background:"#0a1018",borderRight:"1px solid #ffffff08",padding:"10px 6px",overflowY:"auto"}}>
          {NAV.map(group=>(
            <div key={group.label}>
              <div style={{fontSize:9,color:"#7a94aa",fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,padding:"14px 12px 4px"}}>{group.label}</div>
              {group.items.map(item=>(
                <button key={item.id}
                  style={{width:"100%",display:"flex",alignItems:"center",gap:8,background:tab===item.id?"#e74c3c14":"none",border:"none",borderLeft:`3px solid ${tab===item.id?"#e74c3c":"transparent"}`,color:tab===item.id?"#e74c3c":"#8daacc",padding:"8px 12px",borderRadius:"0 8px 8px 0",fontFamily:"'Nunito',sans-serif",fontWeight:tab===item.id?800:600,fontSize:13,cursor:"pointer",textAlign:"left",transition:"all .12s"}}
                  onMouseEnter={e=>{if(tab!==item.id){e.currentTarget.style.color="#d4e8f8";e.currentTarget.style.background="#ffffff08"}}}
                  onMouseLeave={e=>{if(tab!==item.id){e.currentTarget.style.color="#8daacc";e.currentTarget.style.background="none"}}}
                  onClick={()=>{setTab(item.id);setMsg('');window.location.hash=item.id;}}>
                  <span style={{fontSize:14,width:18,textAlign:"center"}}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Contenu */}
        <div style={{flex:1,overflowY:"auto",padding:"22px 26px",minWidth:0}}>

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
                    <span style={{fontSize:9,color:"#8daacc"}}>{cardPool.filter(c=>c.type===t).length}c</span>
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
                        <span style={{fontSize:10,color:"#8daacc",width:22}}>{l.label}</span>
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

        {/* ── QUESTIONS (publiées) ── */}
        {tab==="questions"&&<QuestionsManager key="published" mode="published" setMsg={setMsg} t={t}/>}

        {/* ── BROUILLONS ── */}
        {tab==="drafts"&&<QuestionsManager key="drafts" mode="drafts" setMsg={setMsg} t={t}/>}

        {/* ── QUIZ CONFIG ── */}
        {tab==="quiz_config"&&<div>
          {/* Contrôle quiz */}
          <div style={{background:"#ffffff08",borderRadius:12,padding:16,border:"1px solid #ffffff12",marginBottom:16}}>
            <div style={{fontWeight:900,color:"#6c5ce7",fontSize:13,marginBottom:12}}>⚡ Contrôle du quiz</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <button onClick={async()=>{
                setMsg("⏳ Déclenchement en cours…");
                const {error}=await apiTriggerQuiz();
                setMsg(error?"❌ "+error:"✅ Quiz déclenché !");
              }} style={{...BTN("linear-gradient(135deg,#6c5ce7,#a29bfe)"),padding:"10px 22px",borderRadius:9}}>⚡ Déclencher un quiz</button>
              <button onClick={async()=>{
                setMsg("⏳ Déclenchement shiny en cours…");
                const {error}=await apiTriggerShinyQuiz();
                setMsg(error?"❌ "+error:"✅ Quiz shiny déclenché !");
              }} style={{...BTN("linear-gradient(135deg,#f9ca24,#e17055)","#1e3045"),padding:"10px 22px",borderRadius:9}}>✨ Déclencher un quiz shiny</button>
            </div>
            <div style={{fontSize:10,color:"#8daacc",marginTop:10}}>Expire tout quiz actif et en lance un nouveau immédiatement.</div>
          </div>

          {/* Jeu Quotidien — seed */}
          <div style={{background:"#ffffff08",borderRadius:12,padding:16,border:"1px solid #ffffff12",marginBottom:16}}>
            <div style={{fontWeight:900,color:"#f9ca24",fontSize:13,marginBottom:8}}>🪙 Jeu Quotidien — Initialisation</div>
            <div style={{fontSize:11,color:"#8daacc",marginBottom:12}}>Peuple la table <code style={{background:"#ffffff10",padding:"1px 5px",borderRadius:4}}>jeu_geocoins</code> avec les 200 cartes actives et leurs numéros. Idempotent — peut être relancé sans risque.</div>
            <button onClick={async()=>{
              setMsg("⏳ Seed jeu quotidien en cours…");
              const {data,error}=await apiAdminSeedJeu();
              if(error) return setMsg("❌ "+error);
              setMsg(`✅ Seed OK — ${data.seeded} cartes, somme = ${data.sum_check}`);
            }} style={{...BTN("linear-gradient(135deg,#f9ca24,#e17055)","#1e3045"),padding:"10px 22px",borderRadius:9}}>
              🎲 Lancer le seed
            </button>
          </div>
          {/* Taux de rareté */}
          <div style={{background:"#ffffff08",borderRadius:12,padding:16,border:"1px solid #ffffff12",marginBottom:16}}>
            <div style={{fontWeight:900,color:"#f9ca24",fontSize:13,marginBottom:4}}>🎲 Taux d'apparition par rareté</div>
            <div style={{fontSize:11,color:"#8daacc",marginBottom:12}}>
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
            <div style={{textAlign:"center",color:"#8daacc",padding:"20px 0",fontSize:12}}>Chargement…</div>
          ):(()=>{
            const q=quizStatsSearch.toLowerCase();
            const filtered=quizStats.filter(s=>!q||s.card?.name?.toLowerCase().includes(q)||s.card?.rarity?.toLowerCase().includes(q));
            return(
              <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:400,overflowY:"auto"}}>
                {filtered.length===0&&<div style={{textAlign:"center",color:"#a8bfcf",padding:"16px 0",fontSize:12}}>Aucune apparition.</div>}
                {filtered.map((s,i)=>{
                  const {c1}=cardCC(s.card?.rarity||'commun');
                  return(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"#ffffff07",border:"1px solid #ffffff0e",borderRadius:9,padding:"8px 12px",flexWrap:"wrap"}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:c1,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:120}}>
                        <div style={{fontSize:12,color:"#fff",fontWeight:700}}>{s.card?.name||`#${s.card?.id}`}</div>
                        <div style={{fontSize:10,color:"#a8bfcf",marginTop:1}}>
                          {s.dates?.slice(0,3).map(d=>new Date(d).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})).join(' · ')}
                        </div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontWeight:900,fontSize:15,color:c1}}>{s.count}</div>
                        <div style={{fontSize:9,color:"#a8bfcf"}}>apparition{s.count>1?'s':''}</div>
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
              </div>
            </div>
          ))}

          {/* ── TABLE 1 : Quiz ── */}
          <div style={{background:"#ffffff08",borderRadius:11,padding:14,border:"1px solid #ffffff12",marginBottom:16}}>
            <div style={{fontWeight:800,color:"#f9ca24",marginBottom:12,fontSize:13}}>🎮 Économie Quiz</div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{color:"#8daacc",textAlign:"left"}}>
                {["Paramètre","Valeur","Effet anti-triche / économique"].map(h=><th key={h} style={{padding:"5px 8px",borderBottom:"1px solid #ffffff14",fontWeight:700}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[
                  ["Cadence dynamique", <div key="cadence-dyn" style={{display:"flex",flexDirection:"column",gap:5}}>
                    {(Array.isArray(limEdit.quizIntervalTiers)?limEdit.quizIntervalTiers:[]).map((tier,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:4}}>
                        <span style={{color:"#aaa",fontSize:10}}>≥</span>
                        <input type="number" min={1} max={999} value={tier.players??''}
                          onChange={e=>setLimEdit(p=>{const arr=[...(p.quizIntervalTiers||[])];arr[i]={...arr[i],players:Math.max(1,+e.target.value)};return{...p,quizIntervalTiers:arr}})}
                          style={{...INP,width:40,padding:"4px 6px"}}/>
                        <span style={{color:"#aaa",fontSize:10}}>j. →</span>
                        <input type="number" min={10} max={3600} value={tier.seconds??''}
                          onChange={e=>setLimEdit(p=>{const arr=[...(p.quizIntervalTiers||[])];arr[i]={...arr[i],seconds:Math.max(10,+e.target.value)};return{...p,quizIntervalTiers:arr}})}
                          style={{...INP,width:46,padding:"4px 6px"}}/>
                        <span style={{color:"#aaa",fontSize:10}}>s</span>
                      </div>
                    ))}
                  </div>, "Délai avant le prochain quiz selon le nb de joueurs en ligne. Le palier le plus élevé atteint (≥ N joueurs) s'applique."],
                  ["Anti-domination (série)", (()=>{const h=limEdit.quizStreakHandicap||{};const set=(k,v)=>setLimEdit(p=>({...p,quizStreakHandicap:{...(p.quizStreakHandicap||{}),[k]:v}}));return <div key="anti-dom" style={{display:"flex",flexDirection:"column",gap:4}}>
                    <label style={{display:"flex",alignItems:"center",gap:6,color:"#ddd",fontSize:11}}>
                      <input type="checkbox" checked={h.enabled!==false} onChange={e=>set('enabled',e.target.checked)} style={{width:14,height:14}}/> Activer
                    </label>
                    <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:6,fontSize:10,color:"#aaa"}}>
                      <span>seuil</span><input type="number" min={1} max={99} value={h.threshold??3} onChange={e=>set('threshold',Math.max(1,+e.target.value))} style={{...INP,width:42,padding:"4px 6px"}}/>
                      <span>pas</span><input type="number" min={0} max={60} step={0.5} value={h.step_seconds??1.5} onChange={e=>set('step_seconds',Math.max(0,+e.target.value))} style={{...INP,width:46,padding:"4px 6px"}}/><span>s</span>
                      <span>max</span><input type="number" min={0} max={60} value={h.max_seconds??8} onChange={e=>set('max_seconds',Math.max(0,+e.target.value))} style={{...INP,width:42,padding:"4px 6px"}}/><span>s</span>
                      <span>min j.</span><input type="number" min={1} max={99} value={h.min_players??2} onChange={e=>set('min_players',Math.max(1,+e.target.value))} style={{...INP,width:42,padding:"4px 6px"}}/>
                    </div>
                  </div>})(), "Délai de réponse croissant pour un joueur en série (cadeau aux autres). handicap = min(max, (série−seuil+1)×pas), si ≥ min joueurs en ligne."],
                  ["Or / participation", <><input type="number" min={0} max={100} value={limEdit.quizJoinGold??1} onChange={e=>setLimEdit({...limEdit,quizJoinGold:Math.max(0,+e.target.value)})} style={{...INP,width:60}}/> <span style={{color:"#aaa"}}>Or</span></>, "0 = accès gratuit sans animation"],
                  ["Or / victoire (sous limite)", <><input type="number" min={0} max={1000} value={limEdit.quizWinGold??5} onChange={e=>setLimEdit({...limEdit,quizWinGold:Math.max(0,+e.target.value)})} style={{...INP,width:60}}/> <span style={{color:"#aaa"}}>Or + 1 Geocoin</span></>, "Récompense standard du gagnant"],
                  ["Or / victoire (hors limite)", <><input type="number" min={0} max={1000} value={limEdit.quizConsolationGold??5} onChange={e=>setLimEdit({...limEdit,quizConsolationGold:Math.max(0,+e.target.value)})} style={{...INP,width:60}}/> <span style={{color:"#aaa"}}>Or +</span> <input type="number" min={0} max={100} value={limEdit.quizConsolationForge??1} onChange={e=>setLimEdit({...limEdit,quizConsolationForge:Math.max(0,+e.target.value)})} style={{...INP,width:55,marginLeft:4}}/> <span style={{color:"#aaa"}}>PF</span></>, "Zéro inflation — boost Forge"],
                  ["Points de forge max / jour", <><input type="number" min={0} max={999} value={limEdit.quizDailyForgeCap??0} onChange={e=>setLimEdit({...limEdit,quizDailyForgeCap:Math.max(0,+e.target.value)})} style={{...INP,width:60}}/> <span style={{color:"#aaa"}}>PF / jour (0 = ∞)</span></>, "Plafonne les PF de compensation \"hors limite\""],
                  ["Limite horaire", <><input type="number" min={0} max={99} value={limEdit.quizHourlyCardCap??0} onChange={e=>setLimEdit({...limEdit,quizHourlyCardCap:Math.max(0,+e.target.value)})} style={{...INP,width:60}}/> <span style={{color:"#aaa"}}>/ heure (0 = ∞)</span></>, "Bloque le siphonnage nocturne"],
                  ["Limite journalière", <><input type="number" min={0} max={999} value={limEdit.quizDailyCardCap??20} onChange={e=>setLimEdit({...limEdit,quizDailyCardCap:Math.max(0,+e.target.value)})} style={{...INP,width:60}}/> <span style={{color:"#aaa"}}>/ jour (0 = ∞)</span></>, "Régule le rythme de l'album"],
                  ["✨ Limite shiny journalière", <><input type="number" min={0} max={999} value={limEdit.quizDailyShinyCap??0} onChange={e=>setLimEdit({...limEdit,quizDailyShinyCap:Math.max(0,+e.target.value)})} style={{...INP,width:60}}/> <span style={{color:"#aaa"}}>shiny / jour (0 = ∞)</span></>, "Plafonne les shiny gagnés par jour (au-delà : dépôt d'attente ou 1 PF)"],
                  ["🌱 Mode Débutant", <><label style={{display:"flex",alignItems:"center",gap:6,color:"#ddd",fontSize:11}}><input type="checkbox" checked={limEdit.beginnerEnabled!==false} onChange={e=>setLimEdit({...limEdit,beginnerEnabled:e.target.checked})} style={{width:14,height:14}}/> Activer la piste débutant</label></>, "Piste parallèle : communs uniquement, plusieurs gagnants, sans points de forge"],
                  ["Durée manche débutant", <><input type="number" min={10} max={3600} value={limEdit.beginnerDuration??60} onChange={e=>setLimEdit({...limEdit,beginnerDuration:Math.max(10,+e.target.value)})} style={{...INP,width:60}}/> <span style={{color:"#aaa"}}>s</span></>, "Durée fixe d'une manche débutant (nouveau geocoin à la fin du décompte)"],
                  ["🗄️ Dépôt — emplacements permanents", (()=>{const p=Array.isArray(limEdit.holdSlotPrices)?limEdit.holdSlotPrices:[150,400];const set=(idx,v)=>{const next=[...p];next[idx]=Math.max(0,+v);setLimEdit({...limEdit,holdSlotPrices:next})};return <><span style={{color:"#aaa"}}>2ᵉ</span> <input type="number" min={0} value={p[0]??150} onChange={e=>set(0,e.target.value)} style={{...INP,width:70}}/> <span style={{color:"#aaa",marginLeft:6}}>3ᵉ</span> <input type="number" min={0} value={p[1]??400} onChange={e=>set(1,e.target.value)} style={{...INP,width:70,marginLeft:4}}/> <span style={{color:"#aaa"}}>Or</span></>})(), "Prix d'achat permanent des emplacements 2 et 3 du dépôt d'attente"],
                  ["🔑 Dépôt — location 4ᵉ emplacement", <><input type="number" min={0} value={limEdit.holdRentPrice??80} onChange={e=>setLimEdit({...limEdit,holdRentPrice:Math.max(0,+e.target.value)})} style={{...INP,width:70}}/> <span style={{color:"#aaa"}}>Or / dépôt</span></>, "Prix de location du 4ᵉ emplacement temporaire (proposé quand le dépôt est plein, vaut un seul dépôt)"],
                ].map(([label,input,desc],i)=>(
                  <tr key={i} style={{background:i%2===0?"transparent":"#ffffff04"}}>
                    <td style={{padding:"7px 8px",color:"#ddd",fontWeight:700}}>{label}</td>
                    <td style={{padding:"7px 8px"}}>{input}</td>
                    <td style={{padding:"7px 8px",color:"#a8bfcf",fontSize:11}}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{fontSize:9,color:"#a8bfcf",marginTop:8}}>Le changement prend effet au prochain quiz</div>
          </div>

          {/* ── TABLE 2 : Forge ── */}
          {(()=>{
            const RARITIES=[['commun','#78909c'],['rare','#1565c0'],['épique','#6a1b9a'],['légendaire','#e65100']]
            const fc=limEdit.forgeCostByRarity??{commun:60,rare:180,épique:600,légendaire:1800}
            const sc=limEdit.shinyForgeCostByRarity??{}
            return(
              <div style={{background:"#ffffff08",borderRadius:11,padding:14,border:"1px solid #ffffff12",marginBottom:12}}>
                <div style={{fontWeight:800,color:"#f9ca24",marginBottom:12,fontSize:13}}>🔨 Coûts de Forge</div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{color:"#8daacc",textAlign:"left"}}>
                    {["Rareté","Coût Craft (PF)","Coût Évolution Shiny (PF)"].map(h=><th key={h} style={{padding:"5px 8px",borderBottom:"1px solid #ffffff14",fontWeight:700}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {RARITIES.map(([r,color],i)=>(
                      <tr key={r} style={{background:i%2===0?"transparent":"#ffffff04"}}>
                        <td style={{padding:"7px 8px",color,fontWeight:800,textTransform:"capitalize"}}>{r}</td>
                        <td style={{padding:"7px 8px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:5}}>
                            <input type="number" min={1} max={9999} value={fc[r]??''} placeholder="—"
                              onChange={e=>setLimEdit({...limEdit,forgeCostByRarity:{...fc,[r]:Math.max(1,+e.target.value)}})}
                              style={{...INP,width:75}}/>
                            <span style={{color:"#aaa"}}>PF</span>
                          </div>
                        </td>
                        <td style={{padding:"7px 8px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:5}}>
                            <input type="number" min={1} max={9999} value={sc[r]??''} placeholder="—"
                              onChange={e=>{const v=e.target.value===''?null:Math.max(1,+e.target.value);setLimEdit({...limEdit,shinyForgeCostByRarity:{...sc,[r]:v}})}}
                              style={{...INP,width:75}}/>
                            <span style={{color:"#aaa"}}>PF</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })()}

          {/* ── TABLE 2bis : Fonte des doublons ── */}
          {(()=>{
            const RARITIES=[['commun','#78909c'],['rare','#1565c0'],['épique','#6a1b9a'],['légendaire','#e65100']]
            const mp=limEdit.meltPointsByRarity??{}
            return(
              <div style={{background:"#ffffff08",borderRadius:11,padding:14,border:"1px solid #ffffff12",marginBottom:12}}>
                <div style={{fontWeight:800,color:"#f9ca24",marginBottom:12,fontSize:13}}>🔥 Fonte des doublons</div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{color:"#8daacc",textAlign:"left"}}>
                    {["Rareté","PF par doublon fondu"].map(h=><th key={h} style={{padding:"5px 8px",borderBottom:"1px solid #ffffff14",fontWeight:700}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {RARITIES.map(([r,color],i)=>(
                      <tr key={r} style={{background:i%2===0?"transparent":"#ffffff04"}}>
                        <td style={{padding:"7px 8px",color,fontWeight:800,textTransform:"capitalize"}}>{r}</td>
                        <td style={{padding:"7px 8px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:5}}>
                            <input type="number" min={0} max={9999} step={0.1} value={mp[r]??''} placeholder="—"
                              onChange={e=>setLimEdit({...limEdit,meltPointsByRarity:{...mp,[r]:Math.max(0,+e.target.value)}})}
                              style={{...INP,width:75}}/>
                            <span style={{color:"#aaa"}}>PF</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })()}

          {/* ── TABLE 2ter : Fonte des doublons brillants ── */}
          {(()=>{
            const RARITIES=[['commun','#78909c'],['rare','#1565c0'],['épique','#6a1b9a'],['légendaire','#e65100']]
            const mp=limEdit.meltPointsByRarityShiny??{}
            return(
              <div style={{background:"#ffffff08",borderRadius:11,padding:14,border:"1px solid #ffffff12",marginBottom:12}}>
                <div style={{fontWeight:800,color:"#f9ca24",marginBottom:12,fontSize:13}}>✨ Fonte des doublons brillants</div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{color:"#8daacc",textAlign:"left"}}>
                    {["Rareté","PF par doublon brillant fondu"].map(h=><th key={h} style={{padding:"5px 8px",borderBottom:"1px solid #ffffff14",fontWeight:700}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {RARITIES.map(([r,color],i)=>(
                      <tr key={r} style={{background:i%2===0?"transparent":"#ffffff04"}}>
                        <td style={{padding:"7px 8px",color,fontWeight:800,textTransform:"capitalize"}}>{r}</td>
                        <td style={{padding:"7px 8px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:5}}>
                            <input type="number" min={0} max={9999} step={0.1} value={mp[r]??''} placeholder="—"
                              onChange={e=>setLimEdit({...limEdit,meltPointsByRarityShiny:{...mp,[r]:Math.max(0,+e.target.value)}})}
                              style={{...INP,width:75}}/>
                            <span style={{color:"#aaa"}}>PF</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={()=>setShowMeltPreview(true)}
                  style={{...BTN,marginTop:12,background:"linear-gradient(135deg,#e17055,#f9ca24)",color:"#1e3045"}}>
                  🧪 Prévisualiser l'animation "Tout fondre"
                </button>
              </div>
            )
          })()}

          {showMeltPreview && (
            <MeltAllPreview cardPool={cardPool} onClose={()=>setShowMeltPreview(false)} />
          )}

          {/* ── TABLE 3 : Marché ── */}
          {(()=>{
            const RARITIES=[['commun','#78909c'],['rare','#1565c0'],['épique','#6a1b9a'],['légendaire','#e65100']]
            const caps=limEdit.marketPriceCaps??{commun:{floor:5,k:2},rare:{floor:25,k:2.5},épique:{floor:150,k:3},légendaire:{floor:1000,k:4}}
            return(
              <div style={{background:"#ffffff08",borderRadius:11,padding:14,border:"1px solid #ffffff12",marginBottom:12}}>
                <div style={{fontWeight:800,color:"#f9ca24",marginBottom:12,fontSize:13}}>🏪 Marché — Prix par rareté</div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,marginBottom:14}}>
                  <thead><tr style={{color:"#8daacc",textAlign:"left"}}>
                    {["Rareté","Plancher (Or)","Multiplicateur médiane 7j"].map(h=><th key={h} style={{padding:"5px 8px",borderBottom:"1px solid #ffffff14",fontWeight:700}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {RARITIES.map(([r,color],i)=>{
                      const cap=caps[r]??{floor:5,k:2}
                      return(
                        <tr key={r} style={{background:i%2===0?"transparent":"#ffffff04"}}>
                          <td style={{padding:"7px 8px",color,fontWeight:800,textTransform:"capitalize"}}>{r}</td>
                          <td style={{padding:"7px 8px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:5}}>
                              <input type="number" min={0} max={99999} value={cap.floor}
                                onChange={e=>setLimEdit({...limEdit,marketPriceCaps:{...caps,[r]:{...cap,floor:Math.max(0,+e.target.value)}}})}
                                style={{...INP,width:80}}/>
                              <span style={{color:"#aaa"}}>Or</span>
                            </div>
                          </td>
                          <td style={{padding:"7px 8px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:5}}>
                              <span style={{color:"#aaa"}}>×</span>
                              <input type="number" min={1} max={20} step={0.5} value={cap.k}
                                onChange={e=>setLimEdit({...limEdit,marketPriceCaps:{...caps,[r]:{...cap,k:Math.max(1,+e.target.value)}}})}
                                style={{...INP,width:65}}/>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div style={{display:"flex",gap:16,flexWrap:"wrap",borderTop:"1px solid #ffffff10",paddingTop:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                    <span style={{color:"#aaa",fontWeight:700}}>Frais de mise en ligne :</span>
                    <input type="number" min={0} max={100} value={limEdit.marketListingFee??1}
                      onChange={e=>setLimEdit({...limEdit,marketListingFee:Math.max(0,+e.target.value)})}
                      style={{...INP,width:60}}/>
                    <span style={{color:"#aaa"}}>Or (non remboursable)</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                    <span style={{color:"#aaa",fontWeight:700}}>Taxe sur vente :</span>
                    <input type="number" min={0} max={50} step={1} value={Math.round((limEdit.marketSaleTax??0.05)*100)}
                      onChange={e=>setLimEdit({...limEdit,marketSaleTax:Math.min(0.5,Math.max(0,+e.target.value/100))})}
                      style={{...INP,width:55}}/>
                    <span style={{color:"#aaa"}}>% (détruits)</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                    <span style={{color:"#aaa",fontWeight:700}}>Annonces max / joueur :</span>
                    <input type="number" min={1} max={100} value={limEdit.maxActiveListings??10}
                      onChange={e=>setLimEdit({...limEdit,maxActiveListings:Math.max(1,+e.target.value)})}
                      style={{...INP,width:60}}/>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                    <span style={{color:"#aaa",fontWeight:700}}>Expiration :</span>
                    <input type="number" min={1} max={365} value={limEdit.marketExpireDays??30}
                      onChange={e=>setLimEdit({...limEdit,marketExpireDays:Math.max(1,+e.target.value)})}
                      style={{...INP,width:60}}/>
                    <span style={{color:"#aaa"}}>jours</span>
                  </div>
                </div>
              </div>
            )
          })()}

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
            <div style={{fontSize:10,color:"#a8bfcf",marginTop:8}}>Points attribués lors de la première acquisition d'un geocoin normal.</div>
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
                <div style={{fontSize:10,color:"#a8bfcf",marginTop:4}}>Probabilité qu'un quiz génère un geocoin brillant</div>
              </div>
              <div style={{flex:'0 0 100%'}}>
                <div style={{fontSize:11,color:"#aaa",marginBottom:8}}>Points par rareté ✨ (geocoins brillants)</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
                  {['commun','rare','épique','légendaire'].map(r=>(
                    <div key={r}>
                      <div style={{fontSize:11,color:"#aaa",marginBottom:4,textTransform:"capitalize"}}>{r}</div>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <input type="number" min={1} max={999}
                          value={(limEdit.shinyScoreRules ?? {commun:2,rare:6,épique:14,légendaire:40})[r] ?? 2}
                          onChange={e=>setLimEdit({...limEdit,shinyScoreRules:{...(limEdit.shinyScoreRules??{commun:2,rare:6,épique:14,légendaire:40}),[r]:Math.max(1,+e.target.value)}})}
                          style={{...INP,width:70}}/>
                        <span style={{color:"#aaa",fontSize:11}}>pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{flex:'0 0 100%',fontSize:10,color:"#a8bfcf"}}>Les coûts de forge brillance sont maintenant configurables dans le tableau Forge ci-dessus.</div>
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

          {/* Parrainage */}
          <div style={{background:"#ffffff08",borderRadius:11,padding:14,border:"1px solid #ffffff12",marginBottom:12}}>
            <div style={{fontWeight:800,color:"#f9ca24",marginBottom:10,fontSize:13}}>🤝 Parrainage (« Le parrain »)</div>
            <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:180}}>
                <div style={{fontSize:11,color:"#aaa",marginBottom:5}}>Filleuls requis</div>
                <input type="number" min={1} max={100}
                  value={limEdit.referralRequiredCount ?? 1}
                  onChange={e=>setLimEdit({...limEdit,referralRequiredCount:Math.max(1,+e.target.value)})}
                  style={{...INP,width:80}}/>
                <div style={{fontSize:10,color:"#a8bfcf",marginTop:4}}>Nombre de filleuls qualifiés pour débloquer l'achievement</div>
              </div>
              <div style={{flex:1,minWidth:180}}>
                <div style={{fontSize:11,color:"#aaa",marginBottom:5}}>Geocoins par filleul</div>
                <input type="number" min={1} max={500}
                  value={limEdit.referralMinGeocoins ?? 50}
                  onChange={e=>setLimEdit({...limEdit,referralMinGeocoins:Math.max(1,+e.target.value)})}
                  style={{...INP,width:80}}/>
                <div style={{fontSize:10,color:"#a8bfcf",marginTop:4}}>Geocoins uniques qu'un filleul doit récolter pour compter</div>
              </div>
              <div style={{flex:1,minWidth:180}}>
                <div style={{fontSize:11,color:"#aaa",marginBottom:5}}>Max geocoins à l'inscription</div>
                <input type="number" min={1} max={500}
                  value={limEdit.referralMaxJoinGeocoins ?? 10}
                  onChange={e=>setLimEdit({...limEdit,referralMaxJoinGeocoins:Math.max(1,+e.target.value)})}
                  style={{...INP,width:80}}/>
                <div style={{fontSize:10,color:"#a8bfcf",marginTop:4}}>Un compte ayant déjà ce nombre de geocoins (ou plus) ne peut pas être attaché comme filleul</div>
              </div>
            </div>
            <div style={{fontSize:10,color:"#a8bfcf",marginTop:8}}>⚠️ Pense à créer le geocoin « Le parrain », à le lier à la définition d'achievement <code>le_parrain</code> et à l'activer.</div>
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
            <button onClick={async ()=>{
              setMsg("⏳ Déclenchement shiny en cours…");
              const {error}=await apiTriggerShinyQuiz();
              setMsg(error ? "❌ "+error : "✅ Quiz shiny déclenché !");
            }} style={{...BTN("linear-gradient(135deg,#f9ca24,#e17055)","#1e3045"),padding:"10px 22px",borderRadius:9}}>✨ Déclencher un quiz shiny</button>
          </div>
        </div>}

        {/* ── INTERFACE ── */}
        {tab==="interface"&&<div>
          <div style={{fontWeight:900,color:"#e74c3c",marginBottom:14,fontSize:14}}>📱 Personnalisation de l'interface</div>
          <div style={{background:"#ffffff08",borderRadius:11,padding:14,border:"1px solid #ffffff12",marginBottom:12}}>
            <div style={{fontWeight:800,color:"#f9ca24",marginBottom:4,fontSize:13}}>Fonctionnalités</div>
            <div style={{fontSize:10,color:"#a8bfcf",marginBottom:12}}>Quand désactivée, la section s'affiche grisée avec un bandeau "Revient bientôt".</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[
                {key:'featureTresor',     label:'💎 Trésors'},
                {key:'featureMarket',     label:'🏪 Marché'},
                {key:'featureForge',      label:'🔨 Forge'},
                {key:'featureLeaderboard',label:'🏆 Classement'},
              ].map(({key,label})=>(
                <label key={key} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
                  <input type="checkbox" checked={limEdit[key]!==false}
                    onChange={e=>setLimEdit({...limEdit,[key]:e.target.checked})} style={{width:15,height:15}}/>
                  <span style={{fontSize:13,fontWeight:700,color:limEdit[key]!==false?"#fff":"#a8bfcf"}}>{label}</span>
                  {limEdit[key]===false&&<span style={{fontSize:10,background:"#e74c3c22",color:"#e74c3c",border:"1px solid #e74c3c33",borderRadius:50,padding:"1px 8px",fontWeight:700}}>désactivé</span>}
                </label>
              ))}
            </div>
          </div>
          {/* ── Shiny Day ── */}
          {(()=>{
            const sd=limEdit.shinyDay||{active:false,date:"",slots:[]};
            const setSD=v=>setLimEdit({...limEdit,shinyDay:v});
            const slots=sd.slots||[];
            const addSlot=()=>setSD({...sd,slots:[...slots,{start:"10:00",end:"12:00",rate:0.5}]});
            const delSlot=i=>setSD({...sd,slots:slots.filter((_,j)=>j!==i)});
            const editSlot=(i,k,v)=>setSD({...sd,slots:slots.map((s,j)=>j===i?{...s,[k]:v}:s)});
            const now=new Date();const pad=n=>String(n).padStart(2,'0');
            const today=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
            const isToday=sd.date===today;
            const hhmm=`${pad(now.getHours())}:${pad(now.getMinutes())}`;
            const dayActive=sd.active&&isToday;
            const dayFuture=sd.active&&sd.date&&sd.date>today;
            const currentSlot=dayActive?slots.find(s=>hhmm>=s.start&&hhmm<s.end):null;
            return <div style={{background:"#ffffff08",borderRadius:11,padding:14,border:`1px solid ${sd.active?"#f9ca2433":"#ffffff12"}`,marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{fontWeight:800,color:"#f9ca24",fontSize:13}}>✨ Shiny Day</div>
                {sd.active&&<span style={{fontSize:10,fontWeight:800,background:dayActive?"#f9ca2433":"#4fc3f733",color:dayActive?"#f9ca24":"#4fc3f7",padding:"2px 8px",borderRadius:50}}>{dayActive?"EN COURS":dayFuture?"PLANIFIÉ":"INACTIF"}</span>}
              </div>
              <div style={{fontSize:10,color:"#a8bfcf",marginBottom:12}}>Définis une date et des plages horaires avec un taux de shiny boosté. La bannière s'affiche toute la journée.</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:12,fontWeight:700,color:"#a8bfcf",minWidth:60}}>Date</span>
                  <input type="date" value={sd.date||""} onChange={e=>setSD({...sd,date:e.target.value})} style={{...INP,flex:1}}/>
                </div>
                <div style={{fontWeight:800,color:"#d4e8f8",fontSize:12,marginTop:4}}>Plages horaires</div>
                {slots.map((slot,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:6,background:currentSlot===slot?"#f9ca2411":"#ffffff06",borderRadius:8,padding:"6px 8px",border:currentSlot===slot?"1px solid #f9ca2433":"1px solid #ffffff08"}}>
                    <input type="time" value={slot.start} onChange={e=>editSlot(i,'start',e.target.value)} style={{...INP,width:90,fontSize:12}}/>
                    <span style={{color:"#a8bfcf",fontSize:11}}>→</span>
                    <input type="time" value={slot.end} onChange={e=>editSlot(i,'end',e.target.value)} style={{...INP,width:90,fontSize:12}}/>
                    <input type="number" min={0} max={100} step={1} value={Math.round((slot.rate??0.1)*100)} onChange={e=>editSlot(i,'rate',Math.min(1,Math.max(0,+e.target.value/100)))} style={{...INP,width:60,fontSize:12}}/>
                    <span style={{color:"#aaa",fontSize:11}}>%</span>
                    {currentSlot===slot&&<span style={{fontSize:9,color:"#f9ca24",fontWeight:800}}>🔥</span>}
                    <button onClick={()=>delSlot(i)} style={{background:"none",border:"none",color:"#e74c3c",cursor:"pointer",fontSize:14,fontWeight:900,marginLeft:"auto"}}>✕</button>
                  </div>
                ))}
                <button onClick={addSlot} style={{...BTN("linear-gradient(135deg,#f9ca24,#b8860b)"),padding:"6px 14px",borderRadius:8,fontSize:11,alignSelf:"flex-start",color:"#1a1a2e"}}>
                  + Ajouter une plage
                </button>
                <div style={{display:"flex",gap:8,marginTop:4}}>
                  {!sd.active?
                    <button onClick={()=>{if(!sd.date||!slots.length){setMsg("❌ Définis une date et au moins une plage horaire.");return;}setSD({...sd,active:true});setMsg("✅ Shiny Day activé ! N'oublie pas de sauvegarder.");}} disabled={!sd.date||!slots.length} style={{...BTN("linear-gradient(135deg,#00b894,#00cec9)"),padding:"8px 18px",borderRadius:9,opacity:(!sd.date||!slots.length)?0.4:1}}>
                      ✨ Activer le Shiny Day
                    </button>
                  :
                    <button onClick={()=>{setSD({...sd,active:false});setMsg("Shiny Day désactivé. N'oublie pas de sauvegarder.");}} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"8px 18px",borderRadius:9}}>
                      ⏹️ Désactiver
                    </button>
                  }
                </div>
              </div>
            </div>;
          })()}

          <button onClick={async ()=>{await onSetLimits(limEdit);setMsg("✅ Interface sauvegardée !");}} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"10px 22px",borderRadius:9}}>
            Sauvegarder les réglages
          </button>
        </div>}

        {/* ── JOUEURS ── */}
        {tab==="players" && (
          <AdminPlayers cardPool={cardPool} limEdit={limEdit} onBanIP={onBanIP} setTab={setTab} setMsg={setMsg} />
        )}

        {/* ── PARRAINAGE ── */}
        {tab==="referrals" && (
          <AdminReferrals setMsg={setMsg} />
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
          {bannedIPs.length===0?<div style={{color:"#a8bfcf",textAlign:"center",padding:"18px 0"}}>{t("admin_no_ip")}</div>:(
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
            <div style={{fontSize:11,color:"#8daacc",marginBottom:10}}>Réinitialise welcome_given pour retester le flux complet (pseudo → carte → tuto).</div>
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
            <div style={{fontWeight:900,color:"#e74c3c",fontSize:14}}>🏆 Cartes Achievement ({baseAchCards.length})</div>
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
                          :<div style={{color:"#8daacc",fontSize:12}}>📁 Choisir un PNG</div>}
                      </div>
                      <input ref={newAchFileRef} type="file" accept=".png,image/png"
                        onChange={e=>imgUpload(e,({imageBase64})=>{if(imageBase64)setNewAchCard(p=>({...p,image:imageBase64}));},{name:newAchCard.name,type:"Achievements",rarity:newAchCard.rarity})}
                        style={{display:"none"}}/>
                    </Fld>
                    <div style={{fontWeight:800,color:"#aaa",fontSize:10,textTransform:"uppercase",letterSpacing:.8,marginBottom:10,marginTop:6}}>🎯 Condition achievement</div>
                    <Fld lbl="Trigger">
                      <select value={newAchCard.trigger} onChange={e=>setNewAchCard({...newAchCard,trigger:e.target.value})} style={SEL}>
                        {['buy_count','sell_count','quiz_win','new_card','streak','win_streak','collection_size','shiny_count','legendary_count','streak_break','melt_count','forge_count','rank_reached'].map(t=><option key={t} value={t}>{t}</option>)}
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
                    <div style={{fontSize:10,color:"#8daacc",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Aperçu</div>
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
                    <div style={{fontSize:9,color:"#a8bfcf",textAlign:"center",maxWidth:148}}>
                      type: Achievements<br/>trigger: {newAchCard.trigger}<br/>seuil: {newAchCard.threshold}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-start"}}>

            {/* Grille de cartes (une série évolutive = une seule carte de base) */}
            <div style={{flex:2,minWidth:260}}>
              <div style={{fontSize:11,color:"#8daacc",marginBottom:10}}>Clique pour éditer le geocoin et ses paliers</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                {baseAchCards.map(c=>{
                  const evo=defByCardId[c.id]?.threshold_rare!=null;
                  return(
                    <div key={c.id} onClick={()=>setEditAch(editAch?.id===c.id?null:{...c,_def:defByCardId[c.id]||null})}
                      style={{position:"relative",cursor:"pointer",outline:editAch?.id===c.id?"2.5px solid #f9ca24":"2.5px solid transparent",borderRadius:18,transition:"outline .15s"}}>
                      <Card card={c} small />
                      {evo&&<div style={{position:"absolute",top:4,left:4,zIndex:6,background:"#f9ca24cc",color:"#1e3045",fontSize:8,fontWeight:900,borderRadius:4,padding:"2px 5px"}}>ÉVOLUTIF</div>}
                    </div>
                  );
                })}
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
                    <div style={{color:"#8daacc",fontSize:12}}>📁 Changer l'image PNG</div>
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

                {/* ── Paliers évolutifs du geocoin (édite la définition liée) ── */}
                {editAch._def&&(
                  <div style={{marginTop:16,padding:12,background:"#ffffff06",borderRadius:10,border:"1px solid #f9ca2440"}}>
                    <div style={{fontWeight:900,color:"#f9ca24",fontSize:12,marginBottom:6}}>🏅 Paliers évolutifs</div>
                    <div style={{fontSize:10,color:"#8daacc",marginBottom:10,lineHeight:1.4}}>
                      Déclencheur : <b>{triggerLabel(editAch._def.type)}</b>. Ce geocoin = palier <b>commun</b>.
                      Laisse un seuil vide pour retirer le palier (et au-dessus).
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <Fld lbl={`Seuil Commun (${TRIGGER_META[editAch._def.type]?.unit||'à atteindre'})`}>
                        <input type="number" min={1} value={editAch._def.threshold??1} onChange={e=>setEditAch({...editAch,_def:{...editAch._def,threshold:+e.target.value}})} style={INP}/>
                      </Fld>
                      <div/>
                      <Fld lbl="Seuil Rare"><input type="number" min={1} value={editAch._def.threshold_rare??''} onChange={e=>setEditAch({...editAch,_def:{...editAch._def,threshold_rare:e.target.value}})} style={INP}/></Fld>
                      <Fld lbl="Geocoin Rare"><CardSelect value={editAch._def.card_id_rare??''} cards={achievementCards} onChange={v=>setEditAch({...editAch,_def:{...editAch._def,card_id_rare:v}})} style={SEL}/></Fld>
                      <Fld lbl="Seuil Épique"><input type="number" min={1} value={editAch._def.threshold_epic??''} onChange={e=>setEditAch({...editAch,_def:{...editAch._def,threshold_epic:e.target.value}})} style={INP}/></Fld>
                      <Fld lbl="Geocoin Épique"><CardSelect value={editAch._def.card_id_epic??''} cards={achievementCards} onChange={v=>setEditAch({...editAch,_def:{...editAch._def,card_id_epic:v}})} style={SEL}/></Fld>
                      <Fld lbl="Seuil Légendaire"><input type="number" min={1} value={editAch._def.threshold_legendary??''} onChange={e=>setEditAch({...editAch,_def:{...editAch._def,threshold_legendary:e.target.value}})} style={INP}/></Fld>
                      <Fld lbl="Geocoin Légendaire"><CardSelect value={editAch._def.card_id_legendary??''} cards={achievementCards} onChange={v=>setEditAch({...editAch,_def:{...editAch._def,card_id_legendary:v}})} style={SEL}/></Fld>
                    </div>
                    <button onClick={async()=>{
                      const d=editAch._def;
                      const {data,error}=await apiUpdateAchievementDef(d.id,{
                        threshold:d.threshold,
                        threshold_rare:d.threshold_rare||null, threshold_epic:d.threshold_epic||null, threshold_legendary:d.threshold_legendary||null,
                        card_id_rare:d.card_id_rare||null, card_id_epic:d.card_id_epic||null, card_id_legendary:d.card_id_legendary||null,
                      });
                      if(error){setMsg("❌ "+error);return;}
                      setAchDefs(prev=>prev.map(x=>x.id===d.id?data.definition:x));
                      setEditAch(a=>({...a,_def:data.definition}));
                      setMsg("✅ Paliers mis à jour !");
                    }} style={{...BTN("linear-gradient(135deg,#f9ca24,#e17055)"),padding:"9px",borderRadius:9,marginTop:10,width:"100%",textAlign:"center",color:"#1e3045"}}>
                      Enregistrer les paliers 🏅
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Conditions (achievement_definitions) ── */}
          <div style={{marginTop:22,background:"#ffffff08",border:"1px solid #ffffff12",borderRadius:12,padding:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{fontWeight:900,color:"#f9ca24",fontSize:13}}>⚙️ Conditions déclenchantes</div>
              <div style={{display:"flex",gap:6}}>
                {(()=>{const hiddenCount=achDefs.filter(d=>d.hidden).length;return hiddenCount>0&&(
                  <button onClick={async()=>{if(!window.confirm(`Publier ${hiddenCount} achievement(s) en brouillon ? Ils deviendront visibles et débloquables par les joueurs.`))return;const {data,error}=await apiReleaseHiddenAchievements();if(error){setMsg("❌ "+error);return;}setAchDefs(prev=>prev.map(d=>d.hidden?{...d,hidden:false}:d));setMsg(`✅ ${data?.released??hiddenCount} achievement(s) publié(s) !`);}}
                    style={{...BTN("linear-gradient(135deg,#e17055,#d63031)"),padding:"5px 12px",borderRadius:8,fontSize:11}} title="Rendre visibles tous les achievements en brouillon">🚀 Publier {hiddenCount} brouillon{hiddenCount>1?"s":""}</button>
                );})()}
                <button onClick={()=>setNewDef({key:'',name:'',description:'',type:'buy_count',threshold:1,card_id:'',points:0,category:'permanent',active:true,hidden:false,threshold_rare:'',threshold_epic:'',threshold_legendary:'',card_id_rare:'',card_id_epic:'',card_id_legendary:''})}
                  style={{...BTN("linear-gradient(135deg,#00b894,#00cec9)"),padding:"5px 12px",borderRadius:8,fontSize:11}}>+ Nouvelle</button>
              </div>
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
                      {TRIGGER_KEYS.map(t=><option key={t} value={t}>{triggerLabel(t)}</option>)}
                    </select>
                  </Fld>
                  <Fld lbl={`Seuil (${TRIGGER_META[newDef.type]?.unit||'à atteindre'})`}><input type="number" value={newDef.threshold} onChange={e=>setNewDef({...newDef,threshold:+e.target.value})} min={1} style={INP}/></Fld>
                  <Fld lbl="Geocoin à débloquer"><CardSelect value={newDef.card_id} cards={achievementCards} onChange={v=>setNewDef({...newDef,card_id:v})} style={SEL}/></Fld>
                  <Fld lbl="Points bonus"><input type="number" value={newDef.points} onChange={e=>setNewDef({...newDef,points:+e.target.value})} min={0} style={INP}/></Fld>
                  <Fld lbl="Catégorie">
                    <select value={newDef.category} onChange={e=>setNewDef({...newDef,category:e.target.value})} style={SEL}>
                      <option value="permanent">permanent</option>
                      <option value="daily">daily</option>
                    </select>
                  </Fld>
                  <Fld lbl="Description"><input value={newDef.description} onChange={e=>setNewDef({...newDef,description:e.target.value})} style={INP}/></Fld>
                  <Fld lbl="Visibilité"><label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginTop:4}}><input type="checkbox" checked={!!newDef.hidden} onChange={e=>setNewDef({...newDef,hidden:e.target.checked})} style={{width:16,height:16}}/><span style={{color:"#e17055",fontSize:12,fontWeight:700}}>🚫 Brouillon (caché jusqu'à publication)</span></label></Fld>
                </div>
                <div style={{marginTop:8,padding:"8px 10px",background:"#ffffff06",borderRadius:8,border:"1px solid #f9ca2433"}}>
                  <div style={{fontWeight:800,color:"#f9ca24",fontSize:11,marginBottom:6}}>🏅 Paliers évolutifs (optionnel) — laisser vide = palier unique. Le geocoin ci-dessus = palier commun.</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <Fld lbl="Seuil Rare"><input type="number" value={newDef.threshold_rare} onChange={e=>setNewDef({...newDef,threshold_rare:e.target.value})} min={1} style={INP}/></Fld>
                    <Fld lbl="Geocoin Rare"><CardSelect value={newDef.card_id_rare} cards={achievementCards} onChange={v=>setNewDef({...newDef,card_id_rare:v})} style={SEL}/></Fld>
                    <Fld lbl="Seuil Épique"><input type="number" value={newDef.threshold_epic} onChange={e=>setNewDef({...newDef,threshold_epic:e.target.value})} min={1} style={INP}/></Fld>
                    <Fld lbl="Geocoin Épique"><CardSelect value={newDef.card_id_epic} cards={achievementCards} onChange={v=>setNewDef({...newDef,card_id_epic:v})} style={SEL}/></Fld>
                    <Fld lbl="Seuil Légendaire"><input type="number" value={newDef.threshold_legendary} onChange={e=>setNewDef({...newDef,threshold_legendary:e.target.value})} min={1} style={INP}/></Fld>
                    <Fld lbl="Geocoin Légendaire"><CardSelect value={newDef.card_id_legendary} cards={achievementCards} onChange={v=>setNewDef({...newDef,card_id_legendary:v})} style={SEL}/></Fld>
                  </div>
                </div>
                {TRIGGER_META[newDef.type]?.help && (
                  <div style={{margin:"2px 0 8px",fontSize:10,color:"#8daacc",lineHeight:1.4,background:"#ffffff08",borderRadius:8,padding:"7px 10px"}}>
                    ℹ️ <b>{triggerLabel(newDef.type)}</b> — {TRIGGER_META[newDef.type].help}
                  </div>
                )}
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
                  <tr style={{color:"#8daacc",textAlign:"left"}}>
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
                                  {TRIGGER_KEYS.map(t=><option key={t} value={t}>{triggerLabel(t)}</option>)}
                                </select>
                              </Fld>
                              <Fld lbl={`Seuil (${TRIGGER_META[editDef.type]?.unit||'à atteindre'})`}><input type="number" value={editDef.threshold} onChange={e=>setEditDef({...editDef,threshold:+e.target.value})} min={1} style={{...INP,fontSize:11}}/></Fld>
                              <Fld lbl="Geocoin à débloquer"><CardSelect value={editDef.card_id} cards={achievementCards} onChange={v=>setEditDef({...editDef,card_id:v})} style={{...SEL,fontSize:11}}/></Fld>
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
                              <Fld lbl="Visibilité">
                                <select value={editDef.hidden?"1":"0"} onChange={e=>setEditDef({...editDef,hidden:e.target.value==="1"})} style={{...SEL,fontSize:11}}>
                                  <option value="0">👁 Publié</option>
                                  <option value="1">🚫 Brouillon</option>
                                </select>
                              </Fld>
                            </div>
                            <div style={{padding:"7px 9px",marginBottom:6,background:"#ffffff06",borderRadius:8,border:"1px solid #f9ca2433"}}>
                              <div style={{fontWeight:800,color:"#f9ca24",fontSize:10,marginBottom:5}}>🏅 Paliers évolutifs (vide = palier unique)</div>
                              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6}}>
                                <Fld lbl="Seuil Rare"><input type="number" value={editDef.threshold_rare??''} onChange={e=>setEditDef({...editDef,threshold_rare:e.target.value})} min={1} style={{...INP,fontSize:11}}/></Fld>
                                <Fld lbl="Geocoin Rare"><CardSelect value={editDef.card_id_rare??''} cards={achievementCards} onChange={v=>setEditDef({...editDef,card_id_rare:v})} style={{...SEL,fontSize:11}}/></Fld>
                                <Fld lbl="Seuil Épique"><input type="number" value={editDef.threshold_epic??''} onChange={e=>setEditDef({...editDef,threshold_epic:e.target.value})} min={1} style={{...INP,fontSize:11}}/></Fld>
                                <Fld lbl="Geocoin Épique"><CardSelect value={editDef.card_id_epic??''} cards={achievementCards} onChange={v=>setEditDef({...editDef,card_id_epic:v})} style={{...SEL,fontSize:11}}/></Fld>
                                <Fld lbl="Seuil Légendaire"><input type="number" value={editDef.threshold_legendary??''} onChange={e=>setEditDef({...editDef,threshold_legendary:e.target.value})} min={1} style={{...INP,fontSize:11}}/></Fld>
                                <Fld lbl="Geocoin Légendaire"><CardSelect value={editDef.card_id_legendary??''} cards={achievementCards} onChange={v=>setEditDef({...editDef,card_id_legendary:v})} style={{...SEL,fontSize:11}}/></Fld>
                              </div>
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
                            <span title={def.type} style={{background:"#ffffff12",borderRadius:5,padding:"2px 7px",fontSize:10}}>{triggerLabel(def.type)}</span>
                          </td>
                          <td style={{padding:"5px 8px",color:"#f9ca24",fontWeight:700,whiteSpace:"nowrap"}}>{def.threshold_rare!=null?`${def.threshold} · ${def.threshold_rare} · ${def.threshold_epic??'—'} · ${def.threshold_legendary??'—'}`:def.threshold}</td>
                          <td style={{padding:"5px 8px",color:"#aaa"}}>{def.cards ? `#${def.card_id} ${def.cards.name}` : def.card_id ? `#${def.card_id}` : '—'}</td>
                          <td style={{padding:"5px 8px",color:"#aaa"}}>{def.points||'—'}</td>
                          <td style={{padding:"5px 8px"}}>
                            <span style={{background:def.category==="daily"?"#f9ca2422":"#ffffff10",color:def.category==="daily"?"#f9ca24":"#aaa",borderRadius:5,padding:"2px 7px",fontSize:10}}>{def.category}</span>
                          </td>
                          <td style={{padding:"5px 8px",whiteSpace:"nowrap"}}>
                            <span style={{color:def.active?"#00b894":"#e74c3c",fontWeight:800,fontSize:12}}>{def.active?"●":"○"}</span>
                            {def.hidden&&<span title="Brouillon — masqué aux joueurs" style={{marginLeft:5,background:"#e17055cc",color:"#fff",borderRadius:4,padding:"1px 5px",fontSize:8,fontWeight:800}}>🚫 BR</span>}
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
              {achDefs.length===0&&<div style={{color:"#a8bfcf",fontSize:11,textAlign:"center",padding:16}}>Aucune définition chargée.</div>}
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
              <div style={{fontSize:10,color:"#a8bfcf",marginTop:8}}>Affiche la modale "Geocoin offert !" sans modifier la collection.</div>
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
                <div style={{fontSize:10,color:"#a8bfcf",marginTop:6}}>Supprime les cartes achievement de ta collection. Recharge ensuite la page.</div>
              </div>
            </div>
          )}
        </div>}

        {/* ── QUÊTES QUOTIDIENNES ── */}
        {tab==="quests"&&<div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <div style={{fontWeight:900,color:"#a29bfe",fontSize:14}}>🔨 Pool de quêtes quotidiennes</div>
            <button onClick={()=>setNewQuest({name:'',description:'',type:'quiz_win',threshold:1,forge_points:10,gold_reward:0})}
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
                    {['buy_count','sell_count','quiz_win','new_card','streak','daily_connection','forge_card','forge_shiny','daily_treasure'].map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </Fld>
                <Fld lbl="Seuil"><input type="number" value={newQuest.threshold} onChange={e=>setNewQuest({...newQuest,threshold:+e.target.value})} min={1} style={INP}/></Fld>
                <Fld lbl="🔨 Points forge"><input type="number" value={newQuest.forge_points} onChange={e=>setNewQuest({...newQuest,forge_points:+e.target.value})} min={0} style={INP}/></Fld>
                <Fld lbl="💰 Or (optionnel)"><input type="number" value={newQuest.gold_reward} onChange={e=>setNewQuest({...newQuest,gold_reward:+e.target.value})} min={0} placeholder="0" style={INP}/></Fld>
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
          {(()=>{
            const COLS=[
              {key:'name',lbl:'Nom'},
              {key:'type',lbl:'Trigger'},
              {key:'threshold',lbl:'Seuil'},
              {key:'forge_points',lbl:'🔨 Points'},
              {key:'gold_reward',lbl:'💰 Or'},
              {key:'active',lbl:'Actif'},
              {key:'',lbl:''},
            ]
            const sortQ=(col)=>setQuestSort(s=>s.col===col?{col,dir:s.dir==='asc'?'desc':'asc'}:{col,dir:'asc'})
            const sorted=[...dailyQuests].sort((a,b)=>{
              const {col,dir}=questSort
              if(!col) return 0
              const av=a[col]??'', bv=b[col]??''
              const cmp=typeof av==='number'?av-bv:String(av).localeCompare(String(bv))
              return dir==='asc'?cmp:-cmp
            })
            return(
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"'Nunito',sans-serif",marginBottom:24}}>
            <thead>
              <tr style={{color:"#8daacc",textAlign:"left"}}>
                {COLS.map(({key,lbl})=>(
                  <th key={lbl} onClick={key?()=>sortQ(key):undefined}
                    style={{padding:"4px 8px",borderBottom:"1px solid #ffffff10",fontWeight:700,cursor:key?"pointer":"default",userSelect:"none",whiteSpace:"nowrap"}}>
                    {lbl}{key&&questSort.col===key?<span style={{marginLeft:4}}>{questSort.dir==='asc'?'▲':'▼'}</span>:null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(q=>(
                <tr key={q.id} style={{borderBottom:"1px solid #ffffff08",background:editQuest?.id===q.id?"#6c5ce710":"transparent"}}>
                  {editQuest?.id===q.id?(
                    <td colSpan={7} style={{padding:"8px"}}>
                      {/* Ligne 1 : champs principaux */}
                      <div style={{display:"grid",gridTemplateColumns:"2fr 2fr 1fr 1fr 1fr 1fr 1fr",gap:6,marginBottom:6}}>
                        <Fld lbl="Nom (FR)"><input value={editQuest.name} onChange={e=>setEditQuest({...editQuest,name:e.target.value})} style={{...INP,fontSize:11}}/></Fld>
                        <Fld lbl="Description (FR)"><input value={editQuest.description||''} onChange={e=>setEditQuest({...editQuest,description:e.target.value})} style={{...INP,fontSize:11}}/></Fld>
                        <Fld lbl="Trigger">
                          <select value={editQuest.type} onChange={e=>setEditQuest({...editQuest,type:e.target.value})} style={{...SEL,fontSize:11}}>
                            {['buy_count','sell_count','quiz_win','new_card','streak','daily_connection','forge_card','forge_shiny','daily_treasure'].map(t=><option key={t} value={t}>{t}</option>)}
                          </select>
                        </Fld>
                        <Fld lbl="Seuil"><input type="number" value={editQuest.threshold} onChange={e=>setEditQuest({...editQuest,threshold:+e.target.value})} min={1} style={{...INP,fontSize:11}}/></Fld>
                        <Fld lbl="🔨 Forge"><input type="number" value={editQuest.forge_points} onChange={e=>setEditQuest({...editQuest,forge_points:+e.target.value})} min={0} style={{...INP,fontSize:11}}/></Fld>
                        <Fld lbl="💰 Or"><input type="number" value={editQuest.gold_reward||0} onChange={e=>setEditQuest({...editQuest,gold_reward:+e.target.value})} min={0} style={{...INP,fontSize:11}}/></Fld>
                        <Fld lbl="Actif">
                          <select value={editQuest.active?"1":"0"} onChange={e=>setEditQuest({...editQuest,active:e.target.value==="1"})} style={{...SEL,fontSize:11}}>
                            <option value="1">✅ Actif</option><option value="0">⏸ Inactif</option>
                          </select>
                        </Fld>
                      </div>
                      {/* Traductions */}
                      <div style={{marginBottom:6}}>
                        <button onClick={()=>setQuestTransOpen(o=>!o)} style={{background:"none",border:"1px solid #6c5ce755",color:"#a29bfe",padding:"3px 10px",borderRadius:6,fontSize:10,cursor:"pointer",fontFamily:"'Nunito',sans-serif",fontWeight:800}}>
                          🌐 Traductions {questTransOpen?'▲':'▼'}
                        </button>
                      </div>
                      {questTransOpen&&(
                        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:8,padding:"10px 12px",background:"#6c5ce710",borderRadius:8,border:"1px solid #6c5ce733"}}>
                          {['en','de','es'].map(lng=>(
                            <div key={lng} style={{display:"grid",gridTemplateColumns:"40px 1fr 1fr",gap:6,alignItems:"center"}}>
                              <span style={{fontSize:11,fontWeight:900,color:"#a29bfe",textTransform:"uppercase"}}>{lng}</span>
                              <input placeholder={`Nom (${lng})`} value={editQuest.translations?.[lng]?.name||''} onChange={e=>setEditQuest(q=>({...q,translations:{...q.translations,[lng]:{...q.translations?.[lng],name:e.target.value}}}))} style={{...INP,fontSize:11}}/>
                              <input placeholder={`Description (${lng})`} value={editQuest.translations?.[lng]?.description||''} onChange={e=>setEditQuest(q=>({...q,translations:{...q.translations,[lng]:{...q.translations?.[lng],description:e.target.value}}}))} style={{...INP,fontSize:11}}/>
                            </div>
                          ))}
                        </div>
                      )}
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
                      <td style={{padding:"5px 8px",color:"#fff",fontWeight:700}}>{q.name}<div style={{fontSize:9,color:"#a8bfcf",fontWeight:400}}>{q.description}</div></td>
                      <td style={{padding:"5px 8px"}}><span style={{background:"#ffffff12",borderRadius:5,padding:"2px 7px",fontSize:10}}>{q.type}</span></td>
                      <td style={{padding:"5px 8px",color:"#f9ca24",fontWeight:700}}>{q.threshold}</td>
                      <td style={{padding:"5px 8px",color:"#a29bfe",fontWeight:900}}>🔨 {q.forge_points}</td>
                      <td style={{padding:"5px 8px",color:"#f9ca24",fontWeight:700}}>{(q.gold_reward||0)>0?`💰 ${q.gold_reward}`:'—'}</td>
                      <td style={{padding:"5px 8px"}}><span style={{color:q.active?"#00b894":"#e74c3c",fontWeight:800}}>●</span></td>
                      <td style={{padding:"5px 8px"}}><button onClick={()=>setEditQuest({...q})} style={{...BTN("#ffffff12"),padding:"3px 10px",borderRadius:6,fontSize:10}}>✏️</button></td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          )
          })()}

          {/* Planning du jour */}
          <div style={{background:"#ffffff08",border:"1px solid #ffffff12",borderRadius:12,padding:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontWeight:900,color:"#f9ca24",fontSize:12}}>
                📅 Quêtes du jour — {new Date().toLocaleDateString('fr-FR')}
                <span style={{fontSize:10,color:"#a8bfcf",fontWeight:400,marginLeft:8}}>({questSchedule.length}/3)</span>
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
              ?<div style={{color:"#a8bfcf",fontSize:11}}>Aucune quête planifiée. Le planning se crée automatiquement à la première connexion du jour.</div>
              :<div style={{display:"flex",flexDirection:"column",gap:6}}>
                {questSchedule.map((s,i)=>{
                  const q=s.daily_quest_definitions;
                  return(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"#ffffff08",borderRadius:8,padding:"6px 12px"}}>
                      <span style={{color:"#a29bfe",fontWeight:900,fontSize:11}}>#{i+1}</span>
                      <span style={{flex:1,fontWeight:700,fontSize:12}}>{q?.name}</span>
                      <span style={{fontSize:10,color:"#a8bfcf"}}>{q?.type} × {q?.threshold}</span>
                      {(q?.forge_points||0)>0&&<span style={{color:"#a29bfe",fontWeight:900,fontSize:11}}>🔨 {q.forge_points}</span>}
                      {(q?.gold_reward||0)>0&&<span style={{color:"#f9ca24",fontWeight:900,fontSize:11}}>💰 {q.gold_reward}</span>}
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
            {bots.length===0&&<div style={{textAlign:"center",color:"#a8bfcf",padding:"18px 0",fontSize:12}}>Aucun bot configuré.</div>}
            {bots.map(bot=>{
              const typeIcon={seller:"🏷️",buyer:"🛒",quiz:"❓"}[bot.type]||"🤖";
              const cfg={...(BOT_DEFAULTS[bot.type]||{}),...(bot.config||{})};
              return(
                <div key={bot.id} style={{display:"flex",alignItems:"center",gap:10,background:bot.active?"#ffffff08":"#ffffff04",border:`1px solid ${bot.active?"#ffffff18":"#ffffff08"}`,borderRadius:12,padding:"10px 14px",flexWrap:"wrap",opacity:bot.active?1:0.6}}>
                  <div style={{fontSize:22,flexShrink:0}}>{typeIcon}</div>
                  <div style={{flex:1,minWidth:120}}>
                    <div style={{fontWeight:900,color:"#fff",fontSize:13}}>{bot.profiles?.pseudo||"Bot"}</div>
                    <div style={{fontSize:10,color:"#8daacc",marginTop:2}}>
                      {bot.type==="seller"&&`Vend toutes les ${cfg.intervalMinutes}min · ${cfg.minPrice}–${cfg.maxPrice}G`}
                      {bot.type==="buyer"&&`Achète toutes les ${cfg.intervalMinutes}min · max ${cfg.maxPrice}G`}
                      {bot.type==="quiz"&&`Répond 1/${cfg.everyNQuestions} quiz en <${cfg.maxSeconds}s`}
                    </div>
                    {bot.last_run_at&&<div style={{fontSize:9,color:"#7a94aa",marginTop:1}}>Dernier run : {new Date(bot.last_run_at).toLocaleString('fr-FR')}</div>}
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
            <div style={{fontSize:11,color:"#8daacc",marginBottom:12,lineHeight:1.6}}>
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
                  <div style={{fontSize:10,color:"#a8bfcf",marginBottom:7}}>{hint}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <input type="number" min={0} max={3600} value={limEdit[key]??''}
                      placeholder="—"
                      onChange={e=>setLimEdit(p=>({...p,[key]:e.target.value===''?undefined:+e.target.value}))}
                      style={{...INP,width:70}}/>
                    <span style={{fontSize:11,color:"#8daacc"}}>s</span>
                    {limEdit[key]!=null&&<span style={{fontSize:9,color:"#a8bfcf"}}>{limEdit[key]>=60?`${Math.round(limEdit[key]/60)}min`:`${limEdit[key]}s`}</span>}
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
            <div style={{textAlign:"center",color:"#8daacc",padding:"24px 0"}}>Chargement…</div>
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
                  <div style={{fontSize:10,color:"#8daacc",fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>{label}</div>
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
            <div style={{textAlign:"center",color:"#8daacc",padding:"24px 0"}}>Chargement…</div>
          ):(
            <>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
                {mktHist.transactions.length===0&&<div style={{textAlign:"center",color:"#a8bfcf",padding:"18px 0",fontSize:12}}>Aucune transaction sur les 7 derniers jours.</div>}
                {mktHist.transactions.map((tx,i)=>{
                  const isAchat=tx.type==='achat';
                  return(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"#ffffff08",borderRadius:9,padding:"8px 12px",border:"1px solid #ffffff10",flexWrap:"wrap"}}>
                      <span style={{fontSize:10,background:isAchat?"#e74c3c22":"#00b89422",color:isAchat?"#e74c3c":"#00b894",border:`1px solid ${isAchat?"#e74c3c44":"#00b89444"}`,borderRadius:50,padding:"2px 8px",fontWeight:800,flexShrink:0}}>{tx.type}</span>
                      <div style={{flex:1,minWidth:100}}>
                        <div style={{fontSize:12,color:"#fff",fontWeight:700}}>{tx.card_name}</div>
                        <div style={{fontSize:10,color:"#8daacc",marginTop:1}}>
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
                  <span style={{fontSize:11,color:"#8daacc",fontWeight:700}}>Page {mktHistPage+1} / {Math.ceil(mktHist.total/30)}</span>
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
                <div style={{fontSize:11,color:"#8daacc"}}>Vendeur inexistant, supprimé, banni ou compte non-actif.</div>
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
                <div style={{fontSize:11,color:"#8daacc"}}>Annule les annonces trop anciennes et restitue les geocoins.</div>
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
            <div style={{textAlign:"center",color:"#8daacc",padding:"18px 0"}}>Chargement…</div>
          ):(
            <>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
                {listingsData.listings.length===0&&<div style={{textAlign:"center",color:"#a8bfcf",fontSize:12,padding:"14px 0"}}>Aucune annonce active.</div>}
                {listingsData.listings.map(l=>{
                  const rc=RC[l.cards?.rarity||"commun"]; const {c1,c2}=cardCC(l.cards?.rarity||"commun");
                  return(
                    <div key={l.id} style={{display:"flex",alignItems:"center",gap:10,background:"#ffffff08",border:"1px solid #ffffff10",borderRadius:10,padding:"9px 12px",flexWrap:"wrap"}}>
                      <div style={{width:32,height:32,borderRadius:8,background:`linear-gradient(135deg,${c1},${c2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"#fff",flexShrink:0}}>
                        {l.cards?.name?.[0]||"?"}
                      </div>
                      <div style={{flex:1,minWidth:120}}>
                        <div style={{fontWeight:800,color:"#fff",fontSize:12}}>{l.cards?.name}</div>
                        <div style={{fontSize:10,color:"#8daacc"}}>Vendeur : <span style={{color:rc.color,fontWeight:700}}>{l.profiles?.pseudo||"?"}</span> · {l.price}G</div>
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
                  <span style={{fontSize:11,color:"#8daacc",fontWeight:700}}>Page {listingsPage+1} / {Math.ceil(listingsData.total/20)}</span>
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
                  <div key={i} style={{display:"flex",flexDirection:"column",gap:6,background:"#ffffff08",borderRadius:10,padding:"10px 12px",border:"1px solid #ffffff10"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <div style={{display:"flex",alignItems:"center",gap:4,flex:1,minWidth:120}}>
                        <span style={{fontSize:10,color:"#8daacc",whiteSpace:"nowrap"}}>FR :</span>
                        <input value={rank.labels?.fr ?? rank.label} onChange={e=>{const r=[...ranks];r[i]={...r[i],label:e.target.value,labels:{...r[i].labels,fr:e.target.value}};setRanks(r);}}
                          style={{...INP,flex:1}}/>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <span style={{fontSize:11,color:"#8daacc"}}>Seuil :</span>
                        <input type="number" min={0} value={rank.min} onChange={e=>{const r=[...ranks];r[i]={...r[i],min:e.target.value===''?'':+e.target.value};setRanks(r);}}
                          style={{...INP,width:70}}/>
                        <span style={{fontSize:11,color:"#8daacc"}}>pts</span>
                      </div>
                      <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(rank.color)?rank.color:'#ffffff'} onChange={e=>{const r=[...ranks];r[i]={...r[i],color:e.target.value};setRanks(r);}}
                        style={{width:32,height:32,borderRadius:6,border:"none",cursor:"pointer",background:"none",padding:0,flexShrink:0}}/>
                      <input value={rank.color} onChange={e=>{const r=[...ranks];r[i]={...r[i],color:e.target.value};setRanks(r);}}
                        maxLength={7} placeholder="#rrggbb"
                        style={{...INP,width:80,fontFamily:"monospace",fontSize:12,padding:"4px 8px",borderColor:/^#[0-9a-fA-F]{6}$/.test(rank.color)?undefined:"#e74c3c88"}}/>
                      <div style={{width:10,height:10,borderRadius:"50%",background:/^#[0-9a-fA-F]{6}$/.test(rank.color)?rank.color:'transparent',flexShrink:0,border:"1px solid #ffffff22"}}/>
                      {ranks.length>1&&<button onClick={()=>setRanks(ranks.filter((_,j)=>j!==i))} style={{background:"#e74c3c22",border:"1px solid #e74c3c44",color:"#e74c3c",padding:"4px 8px",borderRadius:7,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:"pointer"}}>✕</button>}
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {['en','de','es'].map(lng=>(
                        <div key={lng} style={{display:"flex",alignItems:"center",gap:4,flex:1,minWidth:100}}>
                          <span style={{fontSize:10,color:"#8daacc",whiteSpace:"nowrap",textTransform:"uppercase"}}>{lng} :</span>
                          <input value={rank.labels?.[lng] ?? ''} onChange={e=>{const r=[...ranks];r[i]={...r[i],labels:{...r[i].labels,[lng]:e.target.value}};setRanks(r);}}
                            style={{...INP,flex:1}}/>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setRanks([...ranks,{min:(ranks[ranks.length-1]?.min||0)+50,label:"Nouveau rang",color:"#ffffff",labels:{fr:"Nouveau rang",en:"",de:"",es:""}}])}
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
                    <div style={{fontSize:11,color:"#8daacc",lineHeight:1.6}}>
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
                <div style={{fontSize:10,color:"#a8bfcf",marginTop:6}}>Sans le "@" — ex : gmail.com, maboite.fr</div>
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
              <div style={{fontSize:11,color:"#8daacc",marginBottom:8}}>
                {q ? `${filtered.length} / ${domains.length} résultats` : `${domains.length} domaine${domains.length>1?"s":""}`}
              </div>
              <div style={{maxHeight:320,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
                {filtered.length===0&&(
                  <div style={{textAlign:"center",color:"#a8bfcf",padding:"16px 0",fontSize:12}}>
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

        {/* ── DÉMO (onboarding) ── */}
        {tab==="demo"&&<div>
          <div style={{fontWeight:900,color:"#e74c3c",marginBottom:6,fontSize:14}}>🎮 Mode démo — 5 premiers geocoins</div>
          <div style={{fontSize:11,color:"#a8bfcf",marginBottom:14,lineHeight:1.5}}>
            Les visiteurs non connectés jouent ces 5 geocoins (avec la question associée) avant de s'inscrire.
            Laisse les lignes vides pour utiliser le repli automatique (5 communs).
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {Array.from({length:5}).map((_,i)=>{
              const pair=demoPairs[i]||{};
              return (
                <div key={i} style={{display:"flex",gap:8,alignItems:"center",background:"#ffffff08",borderRadius:10,padding:"10px 12px",border:"1px solid #ffffff12"}}>
                  <span style={{fontWeight:900,color:"#f9ca24",width:18,flexShrink:0}}>{i+1}</span>
                  <select value={pair.card_id||''} onChange={e=>setDemoPair(i,'card_id',e.target.value?+e.target.value:null)} style={{...SEL,flex:1,minWidth:0}}>
                    <option value="">— Geocoin —</option>
                    {cardPool.filter(c=>!c.forgeable&&!(c.type||'').toLowerCase().startsWith('achievement')).map(c=>(
                      <option key={c.id} value={c.id}>{c.name} ({c.rarity})</option>
                    ))}
                  </select>
                  <select value={pair.question_id||''} onChange={e=>setDemoPair(i,'question_id',e.target.value?+e.target.value:null)} style={{...SEL,flex:1.4,minWidth:0}}>
                    <option value="">— Question —</option>
                    {demoQuestions.map(q=><option key={q.id} value={q.id}>{(q.q||'').slice(0,70)}</option>)}
                  </select>
                </div>
              );
            })}
          </div>

          {/* Geocoins « hommage » — alimentent le faux feed « derniers geocoins disputés » côté invité */}
          <div style={{fontWeight:800,color:"#f9ca24",marginTop:18,marginBottom:4,fontSize:13}}>Geocoins hommage (feed démo)</div>
          <div style={{fontSize:11,color:"#a8bfcf",marginBottom:8}}>Affichés en faux « derniers disputés » à l'invité. Vide = repli sur des communs.</div>
          <select value="" onChange={e=>{addTribute(e.target.value);e.target.value='';}} style={{...SEL,marginBottom:8}}>
            <option value="">+ Ajouter un geocoin hommage…</option>
            {cardPool.filter(c=>!c.forgeable&&!demoTribute.includes(c.id)).map(c=>(
              <option key={c.id} value={c.id}>{c.name} ({c.rarity})</option>
            ))}
          </select>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {demoTribute.map(id=>{const c=cardPool.find(x=>x.id===id);return (
              <span key={id} style={{display:"inline-flex",alignItems:"center",gap:6,background:"#ffffff10",border:"1px solid #ffffff22",borderRadius:50,padding:"4px 10px",fontSize:11,fontWeight:700,color:"#fff"}}>
                {c?c.name:`#${id}`}
                <button onClick={()=>removeTribute(id)} style={{background:"none",border:"none",color:"#e74c3c",cursor:"pointer",fontSize:13,lineHeight:1,padding:0}}>✕</button>
              </span>
            );})}
          </div>

          <button onClick={saveDemo} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"10px 22px",borderRadius:9,marginTop:14}}>
            Sauvegarder la démo
          </button>
        </div>}

        {tab==="seasons"&&<AdminSeasons setMsg={setMsg}/>}

        {tab==="shop"&&<AdminShop setMsg={setMsg} onSaved={onShopPacksSaved} onShopTestModeChange={onShopTestModeChange}/>}

        {/* ── VERSION ── */}
        {tab==="version"&&<div>
          <div style={{fontWeight:900,color:"#e74c3c",marginBottom:16,fontSize:14}}>🔖 Version déployée</div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:"#ffffff08",borderRadius:12,padding:16,border:"1px solid #ffffff12"}}>
              <div style={{fontSize:11,color:"#8daacc",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Frontend (geocards)</div>
              <div style={{fontFamily:"monospace",fontSize:16,color:"#a29bfe",fontWeight:900,letterSpacing:2}}>
                {typeof __COMMIT_SHA__!=='undefined'?__COMMIT_SHA__:'unknown'}
              </div>
              <div style={{fontSize:10,color:"#556b7a",marginTop:4}}>Injecté au build Vite (git rev-parse --short HEAD)</div>
            </div>
            <div style={{background:"#ffffff08",borderRadius:12,padding:16,border:"1px solid #ffffff12"}}>
              <div style={{fontSize:11,color:"#8daacc",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Backend (geocards-api)</div>
              {!versionInfo?(
                <div style={{color:"#8daacc",fontSize:12}}>Chargement…</div>
              ):(
                <>
                  <div style={{fontFamily:"monospace",fontSize:16,color:"#00b894",fontWeight:900,letterSpacing:2}}>{versionInfo.commit}</div>
                  <div style={{fontSize:10,color:"#556b7a",marginTop:4}}>Variable d'env COMMIT_SHA (build arg Docker)</div>
                  <div style={{fontSize:10,color:"#556b7a",marginTop:2}}>NODE_ENV : {versionInfo.env}</div>
                </>
              )}
              <button onClick={()=>{setVersionInfo(null);apiAdminGetVersion().then(({data})=>{if(data)setVersionInfo(data);});}}
                style={{...BTN("linear-gradient(135deg,#2d3436,#636e72)"),padding:"6px 14px",borderRadius:7,marginTop:10,fontSize:11}}>
                🔄 Rafraîchir
              </button>
            </div>
          </div>
        </div>}

        </div>
      </div>
    </div>
  );
}
