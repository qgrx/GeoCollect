import { useState, useRef, useMemo, useEffect } from 'react';
import { INP, SEL, BTN } from '../../utils/styles.js';
import { useT } from '../../i18n/translations.js';
import { RC, cardCC } from '../../data/cards.js';
import { supabase } from '../../lib/supabase.js';
import { apiAdminSaveCardNameTrans, apiAdminSaveCardDescTrans, apiAdminSaveCardLongDesc, apiAdminLookupGeocache, apiGetAdminSeasons, apiReleaseHiddenCards, apiAdminDeployFrontend } from '../../services/api.js';
import { PUBLISHED_TYPES, MIN_INDEXABLE_DESCRIPTION } from '../geocoins/publicGeocoins.js';
import { TRIBUTE_TYPES, GEOCACHE_TYPES, GEOCACHE_TYPE_GROUPS, gcCodeIssue, gcCodeUrl, gcCodeFromInput } from '../../data/geocaching.js';
import { buildPath, geocoinSlug } from '../../routes.js';
import { abs } from '../../seo/site.js';
import Card from '../../components/Card.jsx';
import AdminCardBatch from './AdminCardBatch.jsx';
import RichTextEditor from '../docs/RichTextEditor.jsx';
import { richTextHtml, richTextLength } from '../../utils/richText.js';
import { cardNameFromFile } from '../../utils/cardFileName.js';

// Petits utilitaires dupliqués pour rendre le composant autonome
function Fld({lbl,children}){
  return <div style={{marginBottom:10}}><div style={{fontSize:10,color:"#aaa",fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>{lbl}</div>{children}</div>;
}

function parseCSV(text) {
  return text.split('\n').slice(1).map(line => {
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

export default function AdminCards({ cardPool, cardTypes, onAddCard, onEditCard, onDeleteCard, onUpdateCardInPool, setMsg, imgUpload }) {
  const { t } = useT();
  const [editCard, setEditCard]       = useState(null);
  const [newCardMode, setNewCardMode] = useState(false);
  const [batchMode, setBatchMode]     = useState(false);
  const [search, setSearch]           = useState('');
  const [filterType, setFilterType]   = useState('Tous');
  const [filterRarity, setFilterRarity] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [gridPage, setGridPage]       = useState(0);
  const GRID_PAGE = 24;
  const [showAdv, setShowAdv]                     = useState(false);
  const [filterForgeable, setFilterForgeable]     = useState('');
  const [filterHidden, setFilterHidden]           = useState('');
  const [filterSellable, setFilterSellable]       = useState('');
  const [filterMinPrice, setFilterMinPrice]       = useState('');
  const [filterMinPriceVal, setFilterMinPriceVal] = useState('');
  const [filterShiny, setFilterShiny]             = useState('');
  const [filterShinyVal, setFilterShinyVal]       = useState('');
  const [filterForgeCost, setFilterForgeCost]     = useState('');
  const [filterForgeCostVal, setFilterForgeCostVal] = useState('');
  const advActiveCount = [filterSellable, filterMinPrice, filterShiny, filterForgeCost].filter(Boolean).length;
  const [circulation, setCirculation] = useState(null);
  // Valeurs d'une nouvelle carte. Les trois points de remise à zéro (état
  // initial, bouton « ➕ Nouvelle carte », fermeture du formulaire) partagent
  // cette fabrique : les listes recopiées avaient déjà divergé (celle de
  // closeForm avait perdu `hidden`).
  //
  // Une carte naît CACHÉE, comme celles de la création par lot : on prépare les
  // geocoins puis on les publie depuis l'onglet « 🚫 Cachées ». `sellable` reste
  // à true — c'est l'état voulu une fois la carte publiée ; tant qu'elle est
  // cachée, l'enregistrement force la non-vendabilité.
  function blankCard() {
    return { name: "", type: filterType !== 'Tous' ? filterType : cardTypes[0] || "", rarity: "commun", image: null, thumbnail: null, desc: "", sellable: true, minPrice: "", forgeable: false, forgeCost: "", shiny_forge_cost: null, season_id: null, hidden: true, gc_code: "", gc_owner: "", gc_cache_type: "", gc_placed_date: "", gc_country: "" };
  }
  const [nc, setNc] = useState(blankCard);

  const displayCards = useMemo(() => {
    const RARITY_ORDER = { légendaire: 0, épique: 1, rare: 2, commun: 3 };
    let cards = cardPool.filter(c => !c.type?.toLowerCase().includes('achievement'));
    if (filterType !== 'Tous') cards = cards.filter(c => c.type === filterType);
    if (filterRarity) cards = cards.filter(c => c.rarity === filterRarity);
    if (filterSeason === '__none__') cards = cards.filter(c => !c.season_id);
    else if (filterSeason) cards = cards.filter(c => String(c.season_id) === filterSeason);
    if (search) cards = cards.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    if (filterForgeable === 'true')  cards = cards.filter(c => !!c.forgeable);
    if (filterForgeable === 'false') cards = cards.filter(c => !c.forgeable);
    if (filterHidden === 'true')     cards = cards.filter(c => !!c.hidden);
    if (filterHidden === 'false')    cards = cards.filter(c => !c.hidden);
    if (filterHidden === 'scheduled') cards = cards.filter(c => !!c.hidden && !!c.publish_at);
    if (filterSellable === 'true')   cards = cards.filter(c => c.sellable !== false);
    if (filterSellable === 'false')  cards = cards.filter(c => c.sellable === false);
    const mp = c => c.min_price ?? c.minPrice ?? null;
    if (filterMinPrice === 'none') cards = cards.filter(c => mp(c) == null);
    if (filterMinPrice === 'gt' && filterMinPriceVal !== '') cards = cards.filter(c => (mp(c) ?? 0) > +filterMinPriceVal);
    if (filterMinPrice === 'lt' && filterMinPriceVal !== '') cards = cards.filter(c => (mp(c) ?? 0) < +filterMinPriceVal);
    const sf = c => c.shiny_forge_cost ?? null;
    if (filterShiny === 'none') cards = cards.filter(c => sf(c) == null);
    if (filterShiny === 'gt' && filterShinyVal !== '') cards = cards.filter(c => (sf(c) ?? 0) > +filterShinyVal);
    if (filterShiny === 'lt' && filterShinyVal !== '') cards = cards.filter(c => (sf(c) ?? 0) < +filterShinyVal);
    const fc = c => c.forge_cost ?? c.forgeCost ?? null;
    if (filterForgeCost === 'none') cards = cards.filter(c => fc(c) == null);
    if (filterForgeCost === 'gt' && filterForgeCostVal !== '') cards = cards.filter(c => (fc(c) ?? 0) > +filterForgeCostVal);
    if (filterForgeCost === 'lt' && filterForgeCostVal !== '') cards = cards.filter(c => (fc(c) ?? 0) < +filterForgeCostVal);
    return [...cards].sort((a, b) => (RARITY_ORDER[a.rarity] ?? 4) - (RARITY_ORDER[b.rarity] ?? 4) || a.name.localeCompare(b.name));
  }, [cardPool, filterType, filterRarity, filterSeason, search, filterForgeable, filterHidden, filterSellable, filterMinPrice, filterMinPriceVal, filterShiny, filterShinyVal, filterForgeCost, filterForgeCostVal]);

  const [seasons, setSeasons] = useState([]);
  const [deploying, setDeploying] = useState(false);
  const [transCard, setTransCard] = useState(null);
  const [transCardLang, setTransCardLang] = useState('en');
  const [transDescLang, setTransDescLang] = useState('en');
  const [transLongLang, setTransLongLang] = useState('en');
  const TRANS_LANGS = [{code:'en',label:'English'},{code:'de',label:'Deutsch'},{code:'es',label:'Español'}];
  // Le nom d'un geocoin d'hommage est celui d'une cache réelle, donc rarement
  // français : sa traduction FRANÇAISE a un sens, et elle seule s'affiche en
  // sous-titre pour un joueur francophone (cf. cardNameTranslation).
  const NAME_TRANS_LANGS = TRIBUTE_TYPES.includes(editCard?.type)
    ? [{code:'fr',label:'Français'}, ...TRANS_LANGS]
    : TRANS_LANGS;

  // Retour du bouton « ⤓ Remplir » : '…' pendant l'appel, sinon le résumé de ce
  // qui a été posé (ou l'erreur). Effacé dès qu'on ouvre une autre carte.
  const [gcLookup, setGcLookup] = useState('');
  useEffect(() => { setGcLookup(''); }, [editCard?.id, newCardMode]);

  /**
   * Remplit les champs de la cache honorée depuis geocaching.com.
   *
   * Ne pose QUE ce que la fiche donne : un champ absent (type inconnu de notre
   * liste, poseur illisible) laisse la saisie en place plutôt que de l'effacer.
   * Le titre de la carte n'est écrasé que s'il est vide — le nom d'un geocoin
   * est un choix éditorial, souvent volontairement plus court que celui de la
   * cache, et le perdre d'un clic serait rageant.
   */
  async function lookupGeocache(code, set, src) {
    if (!code) return;
    setGcLookup('…');
    const { data, error } = await apiAdminLookupGeocache(code);
    if (error || !data?.geocache) { setGcLookup(`❌ ${error || 'Réponse illisible'}`); return; }

    const g = data.geocache;
    const patch = { gc_code: g.gc_code };
    const filled = [];
    if (g.name && !src.name?.trim()) { patch.name = g.name; filled.push('titre'); }
    if (g.gc_owner)       { patch.gc_owner = g.gc_owner;             filled.push('poseur'); }
    if (g.gc_cache_type)  { patch.gc_cache_type = g.gc_cache_type;   filled.push('type'); }
    if (g.gc_placed_date) { patch.gc_placed_date = g.gc_placed_date; filled.push('date'); }
    if (g.gc_country)     { patch.gc_country = g.gc_country;         filled.push('pays'); }
    set(patch);

    const skipped = [];
    if (g.name && src.name?.trim() && g.name !== src.name) skipped.push(`titre gardé (la cache s'appelle « ${g.name} »)`);
    if (!g.gc_cache_type && g.type_label) skipped.push(`type « ${g.type_label} » inconnu de la liste`);
    if (!g.gc_country && g.place_label) skipped.push(`pays de « ${g.place_label} » non reconnu`);
    setGcLookup(`✅ ${filled.length ? filled.join(', ') + ' — ' : ''}à vérifier puis enregistrer${skipped.length ? ` · ${skipped.join(' · ')}` : ''}`);
  }

  const csvCardRef = useRef();
  const fileRef = useRef();
  const editFileRef = useRef();

  /**
   * Dépôt de l'image d'un geocoin.
   *
   * À la CRÉATION, un nom encore vide est complété d'après le nom du fichier
   * (« ile_de_re.png » → « Ile de re »), comme le fait la création par lot. Le
   * nom est dérivé AVANT le traitement de l'image : il est gravé dans les
   * métadonnées PNG, qui seraient sinon vides pour la carte la plus courante.
   * Un nom déjà saisi n'est jamais écrasé — même règle qu'au remplissage depuis
   * geocaching.com, et en édition on ne touche jamais au nom.
   */
  function handleCardImage(e) {
    const src = editCard || nc;
    const autoName = (!editCard && !src.name?.trim())
      ? cardNameFromFile(e.target.files?.[0]?.name || '')
      : '';
    if (autoName) setNc(p => (p.name?.trim() ? p : { ...p, name: autoName }));

    imgUpload(
      e,
      ({ imageBase64, thumbnailBase64 }) => {
        if (editCard) setEditCard(p => ({ ...p, image: imageBase64, thumbnail: thumbnailBase64 }));
        else setNc(p => ({ ...p, image: imageBase64, thumbnail: thumbnailBase64 }));
      },
      { name: autoName || src.name || '', type: src.type || '', rarity: src.rarity || '' }
    );
  }

  const { c1p, c2p } = useMemo(() => { const { c1, c2 } = cardCC(nc.rarity); return { c1p: c1, c2p: c2 }; }, [nc.rarity]);

  useEffect(() => {
    if (!editCard) {
      setCirculation(null);
      return;
    }
    let mounted = true;
    setCirculation('…');
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      fetch(`${import.meta.env.VITE_API_URL}/api/admin/cards/${editCard.id}/circulation`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      .then(r => r.json())
      .then(d => {
        if (mounted && d.circulation !== undefined) setCirculation(d.circulation);
      }).catch(() => { if (mounted) setCirculation('?'); });
    });
    return () => { mounted = false; };
  }, [editCard?.id]);

  useEffect(() => {
    apiGetAdminSeasons().then(({ data }) => { if (data?.seasons) setSeasons(data.seasons); });
  }, []);

  async function handleCSVCards(e){
    const f = e.target.files[0];
    if (!f) return;
    e.target.value = null; // Réinitialise l'input immédiatement

    setMsg("⏳ Importation en cours…");

    try {
      let rows = [];
      let zip = null;

      if (f.name.endsWith('.zip')) {
        const JSZip = (await import('jszip')).default;
        zip = await JSZip.loadAsync(f);
        const csvFile = zip.file("cards.csv");
        if (!csvFile) throw new Error("cards.csv introuvable dans le zip.");
        rows = parseCSV(await csvFile.async("string"));
      } else {
        const text = await new Promise((res) => {
          const r = new FileReader();
          r.onload = (ev) => res(ev.target.result);
          r.readAsText(f);
        });
        rows = parseCSV(text);
      }

      let count = 0, skipped = 0, errors = 0;
      const knownNames = new Set(cardPool.map(c => c.name?.trim().toLowerCase()).filter(Boolean));

      for (const [name, type, rarity, desc, sellable, minPrice, imgRef] of rows) {
        if (!name || !type || !rarity) continue;
        const safeName = name.trim().toLowerCase();
        if (knownNames.has(safeName)) { skipped++; continue; }

        let image_url = imgRef || null;
        let image_url_thumb = imgRef || null;

        if (zip && imgRef?.startsWith('images/')) {
          const imgF = zip.file(imgRef);
          if (imgF) {
            const imgBlob = await imgF.async("blob");
            const ext = imgRef.split('.').pop() || 'png';
            const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
            const imageFile = new File([imgBlob], imgRef.split('/').pop(), { type: mime });
            const { processCardImage } = await import('../../utils/imageProcessor.js');
            const { medium, small } = await processCardImage(imageFile, { name: name.trim(), type, rarity: rarity || "commun" });
            image_url = medium;
            image_url_thumb = small;
          }
        }
        const err = await onAddCard({ name: name.trim(), type, rarity: rarity || "commun", image_url, image_url_thumb, desc: desc || "", sellable: sellable !== "false", min_price: minPrice ? +minPrice : null });
        if (err) errors++; else { knownNames.add(safeName); count++; }
      }
      setMsg(`✅ ${count} cartes importées !${skipped > 0 ? ` (${skipped} doublons ignorés)` : ''}${errors > 0 ? ` ❌ (${errors} erreurs)` : ''}`);
    } catch (err) { setMsg("❌ Erreur: " + err.message); }
  }

  async function exportCSVCards(){
    try {
      setMsg("⏳ Génération de l'export ZIP…");
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const imgFolder = zip.folder("images");
      const csvRows = ["name,type,rarity,desc,sellable,minPrice,image"];
      const toExport = cardPool.filter(c=>c.type!=='Achievement');
      for (const c of toExport) {
        let imgRef = "";
        if (c.image && c.image.startsWith('data:image/')) {
          const match = c.image.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
          if (match) {
            const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
            const fileName = `${c.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${c.id}.${ext}`;
            imgFolder.file(fileName, match[2], { base64: true });
            imgRef = `images/${fileName}`;
          }
        } else if (c.image) { imgRef = c.image; }
        csvRows.push(`"${c.name}","${c.type}","${c.rarity}","${c.desc||""}",${c.sellable!==false},${c.minPrice||""},"${imgRef}"`);
      }
      zip.file("cards.csv", csvRows.join("\n"));
      const content = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = "geocards_export.zip";
      a.click();
      setMsg("✅ Export ZIP terminé !");
    } catch (err) { setMsg("❌ Erreur export: " + err.message); }
  }

  function closeForm() {
    setEditCard(null); setNewCardMode(false); setBatchMode(false);
    setNc(blankCard());
    if (fileRef.current) fileRef.current.value = '';
    if (editFileRef.current) editFileRef.current.value = '';
  }

  return (
    <div>
      {/* ── Header ── */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{flex:1,fontWeight:800,color:"#e74c3c",fontSize:14}}>
          {editCard ? `✏️ ${editCard.name}` : newCardMode ? "➕ Nouvelle carte" : batchMode ? "📦 Création par lot" : "🃏 Geocoins"}
        </div>
        {!editCard && !newCardMode && !batchMode && (
          <button onClick={()=>{ setNewCardMode(true); setNc(blankCard()); }}
            style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"6px 14px",fontSize:12,borderRadius:8}}>➕ Nouvelle carte</button>
        )}
        {!editCard && !newCardMode && !batchMode && (
          <button onClick={()=>setBatchMode(true)} title="Uploader plusieurs images d'un coup : un geocoin caché par image, nommé d'après le fichier"
            style={{...BTN("linear-gradient(135deg,#6c5ce7,#a29bfe)"),padding:"6px 14px",fontSize:12,borderRadius:8}}>📦 Créer par lot</button>
        )}
        {!editCard && !newCardMode && !batchMode && (()=>{const hiddenCards=(cardPool||[]).filter(c=>c.hidden);return hiddenCards.length>0&&(
          <button onClick={async()=>{if(!window.confirm(`Publier les ${hiddenCards.length} carte(s) cachée(s) ? Elles deviendront visibles, comptées et utilisables par les joueurs (dates de publication programmées incluses).\n\nPour n'en publier qu'une partie ou programmer une release, utilisez l'onglet « 🚫 Cachées ».`))return;const {data,error}=await apiReleaseHiddenCards();if(error){setMsg("❌ "+error);return;}hiddenCards.forEach(c=>onUpdateCardInPool?.({...c,hidden:false,publish_at:null,sellable:c.forgeable?false:true}));setMsg(`✅ ${data?.released??hiddenCards.length} carte(s) publiée(s) !`);}}
            style={{...BTN("linear-gradient(135deg,#e17055,#d63031)"),padding:"6px 14px",fontSize:12,borderRadius:8}} title="Rendre visibles toutes les cartes cachées">🚀 Publier {hiddenCards.length} cachée{hiddenCards.length>1?"s":""}</button>
        );})()}
        {!batchMode && <button onClick={()=>csvCardRef.current.click()} style={{...BTN("#ffffff18"),padding:"6px 12px",fontSize:11,borderRadius:8}}>📥 Importer</button>}
        {!batchMode && <button onClick={exportCSVCards} style={{...BTN("#ffffff18"),padding:"6px 12px",fontSize:11,borderRadius:8}}>📤 Exporter</button>}
        <input ref={csvCardRef} type="file" accept=".csv,.zip" onChange={handleCSVCards} style={{display:"none"}}/>
      </div>

      {/* ── Fil d'Ariane ── */}
      {(editCard || newCardMode || batchMode) && (
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:14,fontSize:12,color:"#8daacc"}}>
          <button onClick={closeForm} style={{background:"none",border:"none",color:"#e74c3c",fontWeight:800,fontSize:12,cursor:"pointer",fontFamily:"'Nunito',sans-serif",padding:0}}>← Tous les geocoins</button>
          <span>›</span>
          <span style={{color:"#f9ca24",fontWeight:700}}>
            {editCard ? <>✏️ {editCard.name}{circulation!==null&&<span style={{color:"#aaa",fontSize:11,fontWeight:600,marginLeft:4}}>({circulation} en circulation)</span>}</> : batchMode ? "Création par lot" : "Nouvelle carte"}
          </span>
        </div>
      )}

      {/* ── Création par lot (N images → N geocoins cachés) ── */}
      {batchMode && !editCard && !newCardMode && (
        <AdminCardBatch
          cardPool={cardPool}
          cardTypes={cardTypes}
          defaultType={filterType!=='Tous'?filterType:cardTypes[0]||''}
          seasons={seasons}
          onAddCard={onAddCard}
          setMsg={setMsg}
          onClose={closeForm}
        />
      )}

      {/* ── Grille de geocoins ── */}
      {!editCard && !newCardMode && !batchMode && (
        <>
          <div style={{display:"flex",gap:6,marginBottom:6,flexWrap:"wrap"}}>
            <input value={search} onChange={e=>{setSearch(e.target.value);setGridPage(0);}} placeholder="Rechercher…"
              style={{...INP,flex:1,minWidth:120,fontSize:12,padding:"6px 10px"}}/>
            <select value={filterType} onChange={e=>{setFilterType(e.target.value);setGridPage(0);}} style={{...SEL,fontSize:12,padding:"6px 10px"}}>
              <option value="Tous">Tous les types</option>
              {cardTypes.map(tp=><option key={tp} value={tp}>{tp}</option>)}
            </select>
            <select value={filterRarity} onChange={e=>{setFilterRarity(e.target.value);setGridPage(0);}} style={{...SEL,fontSize:12,padding:"6px 10px"}}>
              <option value="">Toutes raretés</option>
              {["commun","rare","épique","légendaire"].map(r=><option key={r} value={r}>{RC[r]?.label||r}</option>)}
            </select>
            {seasons.length > 0 && (
              <select value={filterSeason} onChange={e=>{setFilterSeason(e.target.value);setGridPage(0);}} style={{...SEL,fontSize:12,padding:"6px 10px"}}>
                <option value="">Toutes saisons</option>
                <option value="__none__">Sans saison</option>
                {seasons.map(s=><option key={s.id} value={String(s.id)}>{s.name}</option>)}
              </select>
            )}
            <select value={filterForgeable} onChange={e=>{setFilterForgeable(e.target.value);setGridPage(0);}} style={{...SEL,fontSize:12,padding:"6px 10px"}}>
              <option value="">Forge : tous</option>
              <option value="true">🔨 Forgeables</option>
              <option value="false">Non forgeables</option>
            </select>
            <select value={filterHidden} onChange={e=>{setFilterHidden(e.target.value);setGridPage(0);}}
              style={{...SEL,fontSize:12,padding:"6px 10px",...(filterHidden?{border:"1px solid #e1705588",color:"#e17055"}:null)}}>
              <option value="">Visibilité : toutes</option>
              <option value="false">👁️ Visibles</option>
              <option value="true">🚫 Cachées</option>
              <option value="scheduled">⏰ Cachées programmées</option>
            </select>
            <button onClick={()=>setShowAdv(v=>!v)}
              style={{background:showAdv||advActiveCount>0?'#6c5ce722':'#ffffff0a',border:`1px solid ${advActiveCount>0?'#6c5ce7':'#ffffff22'}`,color:advActiveCount>0?'#a29bfe':'#aaa',padding:"6px 10px",borderRadius:6,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:"pointer"}}>
              Filtres {advActiveCount>0?`(${advActiveCount}) `:''}▾
            </button>
          </div>
          {showAdv && (
            <div style={{background:"#ffffff08",border:"1px solid #ffffff14",borderRadius:8,padding:"10px 12px",marginBottom:8,display:"flex",flexDirection:"column",gap:7}}>
              {/* Vendable */}
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <select value={filterSellable} onChange={e=>{setFilterSellable(e.target.value);setGridPage(0);}} style={{...SEL,fontSize:11,padding:"4px 8px",flex:1}}>
                  <option value="">Vendable : tous</option>
                  <option value="true">✓ Vendables</option>
                  <option value="false">✕ Non vendables</option>
                </select>
              </div>
              {/* Prix minimum */}
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{fontSize:11,color:"#aaa",fontWeight:700,minWidth:90}}>Prix min :</span>
                <select value={filterMinPrice} onChange={e=>{setFilterMinPrice(e.target.value);setFilterMinPriceVal('');setGridPage(0);}} style={{...SEL,fontSize:11,padding:"4px 8px",flex:1}}>
                  <option value="">Tous</option>
                  <option value="none">Sans prix minimum</option>
                  <option value="gt">Supérieur à</option>
                  <option value="lt">Inférieur à</option>
                </select>
                {(filterMinPrice==='gt'||filterMinPrice==='lt')&&(
                  <input type="text" inputMode="numeric" value={filterMinPriceVal}
                    onChange={e=>{setFilterMinPriceVal(e.target.value.replace(/[^0-9]/g,''));setGridPage(0);}}
                    placeholder="valeur" style={{...INP,width:70,fontSize:11,padding:"4px 8px"}}/>
                )}
              </div>
              {/* Coût brillance */}
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{fontSize:11,color:"#f9ca24",fontWeight:700,minWidth:90}}>✨ Brillance :</span>
                <select value={filterShiny} onChange={e=>{setFilterShiny(e.target.value);setFilterShinyVal('');setGridPage(0);}} style={{...SEL,fontSize:11,padding:"4px 8px",flex:1}}>
                  <option value="">Tous</option>
                  <option value="none">Sans coût brillance</option>
                  <option value="gt">Coût supérieur à</option>
                  <option value="lt">Coût inférieur à</option>
                </select>
                {(filterShiny==='gt'||filterShiny==='lt')&&(
                  <input type="text" inputMode="numeric" value={filterShinyVal}
                    onChange={e=>{setFilterShinyVal(e.target.value.replace(/[^0-9]/g,''));setGridPage(0);}}
                    placeholder="valeur" style={{...INP,width:70,fontSize:11,padding:"4px 8px"}}/>
                )}
              </div>
              {/* Coût de forge */}
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{fontSize:11,color:"#a29bfe",fontWeight:700,minWidth:90}}>🔨 Forge :</span>
                <select value={filterForgeCost} onChange={e=>{setFilterForgeCost(e.target.value);setFilterForgeCostVal('');setGridPage(0);}} style={{...SEL,fontSize:11,padding:"4px 8px",flex:1}}>
                  <option value="">Tous</option>
                  <option value="none">Sans coût de forge</option>
                  <option value="gt">Coût supérieur à</option>
                  <option value="lt">Coût inférieur à</option>
                </select>
                {(filterForgeCost==='gt'||filterForgeCost==='lt')&&(
                  <input type="text" inputMode="numeric" value={filterForgeCostVal}
                    onChange={e=>{setFilterForgeCostVal(e.target.value.replace(/[^0-9]/g,''));setGridPage(0);}}
                    placeholder="valeur" style={{...INP,width:70,fontSize:11,padding:"4px 8px"}}/>
                )}
              </div>
              {advActiveCount>0&&(
                <button onClick={()=>{setFilterSellable('');setFilterMinPrice('');setFilterMinPriceVal('');setFilterShiny('');setFilterShinyVal('');setFilterForgeCost('');setFilterForgeCostVal('');setGridPage(0);}}
                  style={{background:"#e74c3c22",border:"1px solid #e74c3c44",color:"#e74c3c",padding:"4px 10px",borderRadius:6,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:"pointer",alignSelf:"flex-start"}}>
                  ✕ Réinitialiser les filtres avancés
                </button>
              )}
            </div>
          )}
          <div style={{fontSize:11,color:"#a8bfcf",marginBottom:8}}>{displayCards.length} geocoin{displayCards.length!==1?"s":""} · {t("admin_click_to_edit")}</div>
          {displayCards.length === 0
            ? <div style={{color:"#a8bfcf",fontSize:13,textAlign:"center",padding:"30px 0",fontStyle:"italic"}}>Aucun geocoin trouvé.</div>
            : (()=>{
                const totalPg = Math.ceil(displayCards.length / GRID_PAGE);
                const pg = Math.min(gridPage, Math.max(0, totalPg-1));
                const slice = displayCards.slice(pg*GRID_PAGE, (pg+1)*GRID_PAGE);
                return (
                  <>
                    <div style={{display:"flex",flexWrap:"wrap",justifyContent:"space-evenly",gap:6,marginBottom:10}}>
                      {slice.map(c=>(
                        <div key={c.id} onClick={()=>setEditCard({...c})} style={{cursor:"pointer",position:"relative",opacity:c.hidden?0.6:1}} title={c.hidden?`${c.name} (cachée)`:c.name}>
                          <Card card={c} small />
                          {c.hidden&&<div style={{position:"absolute",top:4,left:4,zIndex:5,background:"#e17055ee",color:"#fff",fontSize:8,fontWeight:800,borderRadius:4,padding:"2px 5px"}}>🚫 CACHÉE</div>}
                        </div>
                      ))}
                    </div>
                    {totalPg>1&&(
                      <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:8,marginBottom:8}}>
                        <button onClick={()=>setGridPage(p=>Math.max(0,p-1))} disabled={pg===0} style={{background:pg===0?"#ffffff0a":"#ffffff18",border:"none",color:pg===0?"#444":"#fff",padding:"4px 12px",borderRadius:6,cursor:pg===0?"default":"pointer",fontWeight:900,fontSize:12}}>←</button>
                        <span style={{fontSize:11,color:"#a8bfcf",fontWeight:700}}>{pg+1}/{totalPg}</span>
                        <button onClick={()=>setGridPage(p=>Math.min(totalPg-1,p+1))} disabled={pg===totalPg-1} style={{background:pg===totalPg-1?"#ffffff0a":"#ffffff18",border:"none",color:pg===totalPg-1?"#444":"#fff",padding:"4px 12px",borderRadius:6,cursor:pg===totalPg-1?"default":"pointer",fontWeight:900,fontSize:12}}>→</button>
                      </div>
                    )}
                  </>
                );
              })()
          }
        </>
      )}

      {/* ── Formulaire création / édition ── */}
      {(editCard || newCardMode) && (
        <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:240}}>
            {[["Nom de la carte","name","ex: Frostpike"],["Description","desc","Courte description…"]].map(([label,key,ph])=>(<Fld key={key} lbl={label}><input value={editCard?editCard[key]:nc[key]} onChange={e=>{editCard?setEditCard({...editCard,[key]:e.target.value}):setNc({...nc,[key]:e.target.value});}} placeholder={ph} style={INP}/></Fld>))}
            <Fld lbl="Type"><select value={editCard?editCard.type:nc.type} onChange={e=>{editCard?setEditCard({...editCard,type:e.target.value}):setNc({...nc,type:e.target.value});}} style={SEL}>{cardTypes.map(tp=><option key={tp} value={tp}>{tp}</option>)}</select></Fld>
            {/* ── Cache honorée : réservé aux geocoins d'hommage ──
                 Un geocoin de pays ou de chasseur de trésor ne renvoie à aucune
                 cache du monde réel — le bloc n'apparaît donc que pour les types
                 d'hommage. Les valeurs déjà saisies sont conservées si le type
                 change : elles réapparaissent telles quelles au retour. */}
            {(() => {
              const src = editCard || nc;
              if (!TRIBUTE_TYPES.includes(src.type)) return null;
              const set = patch => { editCard ? setEditCard({...editCard, ...patch}) : setNc({...nc, ...patch}); };
              const issue = gcCodeIssue(src.gc_code);
              // Le lien se construit sur le code NORMALISÉ — celui qui sera
              // réellement enregistré — et pas sur la saisie, qui peut déjà être
              // une URL collée.
              const code  = gcCodeFromInput(src.gc_code);
              return (
                <div style={{background:"#0a2436",border:"1.5px solid #00b89444",borderRadius:10,padding:"12px 12px 2px",marginBottom:12}}>
                  <div style={{fontWeight:900,color:"#00b894",fontSize:12,marginBottom:3}}>🧭 Cache honorée par ce geocoin</div>
                  <div style={{fontSize:11,color:"#8887a8",marginBottom:10}}>Facultatif — la cache réelle à laquelle ce geocoin rend hommage.</div>
                  <Fld lbl="Code GC">
                    <div style={{display:"flex",gap:6}}>
                      <input value={src.gc_code??''} onChange={e=>set({gc_code:e.target.value})}
                        placeholder="GC1A2B3 — ou collez le lien de la cache" style={{...INP,flex:1,minWidth:0}}/>
                      {/* Le code suffit : l'API lit la fiche sur geocaching.com et
                          renvoie titre, poseur, type et date. Rien n'est
                          enregistré ici — les champs sont remplis dans le
                          formulaire, l'admin relit puis sauvegarde. */}
                      <button
                        onClick={()=>lookupGeocache(code, set, src)}
                        disabled={!code || gcLookup==='…'}
                        title={code ? `Lire ${code} sur geocaching.com et remplir les champs` : "Saisir d'abord un code GC"}
                        style={{...BTN(code?"linear-gradient(135deg,#00b894,#0984e3)":"#ffffff18"),padding:"0 14px",borderRadius:8,fontSize:12,whiteSpace:"nowrap",cursor:code?"pointer":"not-allowed",opacity:code?1:.5}}>
                        {gcLookup==='…' ? '⏳' : '⤓ Remplir'}
                      </button>
                    </div>
                    {issue && <div style={{fontSize:11,color:"#e17055",fontWeight:700,marginTop:4}}>⚠️ {issue}</div>}
                    {gcLookup && gcLookup!=='…' && <div style={{fontSize:11,color:gcLookup.startsWith('❌')?"#e17055":"#00b894",fontWeight:700,marginTop:4}}>{gcLookup}</div>}
                    {!issue && code && <a href={gcCodeUrl(code)} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#74b9ff",fontWeight:700,marginTop:4,display:"inline-block"}}>↗ Ouvrir {code} sur geocaching.com</a>}
                  </Fld>
                  <Fld lbl="Poseur">
                    <input value={src.gc_owner??''} onChange={e=>set({gc_owner:e.target.value})}
                      placeholder="Pseudo geocaching.com du poseur" style={INP}/>
                  </Fld>
                  <Fld lbl="Type de cache">
                    <select value={src.gc_cache_type??''} onChange={e=>set({gc_cache_type:e.target.value||null})} style={SEL}>
                      <option value="">— Non renseigné —</option>
                      {GEOCACHE_TYPE_GROUPS.map(g=>(
                        <optgroup key={g} label={g}>
                          {GEOCACHE_TYPES.filter(t=>t.group===g).map(t=>(
                            <option key={t.code} value={t.code}>{t.icon} {t.label.fr}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </Fld>
                  <Fld lbl="Date de publication de la cache (geocaching.com)">
                    <input type="date" value={src.gc_placed_date??''} onChange={e=>set({gc_placed_date:e.target.value||null})} style={INP}/>
                  </Fld>
                  {/* Pays : saisi en FRANÇAIS, traduit à l'affichage et dans les
                      questions générées. L'API canonise ce qu'elle reconnaît
                      (« Germany » → « Allemagne ») et garde tel quel le reste. */}
                  <Fld lbl="Pays">
                    <input value={src.gc_country??''} onChange={e=>set({gc_country:e.target.value})}
                      placeholder="Allemagne, États-Unis…" style={INP}/>
                  </Fld>
                </div>
              );
            })()}
            <Fld lbl="Rareté (définit les couleurs)"><select value={editCard?editCard.rarity:nc.rarity} onChange={e=>{editCard?setEditCard({...editCard,rarity:e.target.value}):setNc({...nc,rarity:e.target.value});}} style={SEL}>{["commun","rare","épique","légendaire"].map(r=><option key={r} value={r}>{RC[r].label}</option>)}</select><div style={{marginTop:5,height:6,borderRadius:3,background:`linear-gradient(90deg,${c1p},${c2p})`,transition:"background .3s"}}/></Fld>
            <Fld lbl="Image PNG"><div onClick={()=>(editCard?editFileRef:fileRef).current.click()} style={{border:"2px dashed #ffffff33",borderRadius:9,padding:"13px",textAlign:"center",cursor:"pointer",background:"#ffffff08"}} onMouseEnter={e=>e.currentTarget.style.borderColor="#f9ca2466"} onMouseLeave={e=>e.currentTarget.style.borderColor="#ffffff33"}>{(editCard?editCard.image:nc.image)?<img src={editCard?editCard.image:nc.image} style={{maxWidth:"100%",maxHeight:80,objectFit:"contain",borderRadius:5}} alt="prev"/>:<div style={{color:"#8daacc",fontSize:12}}>📁 Choisir un PNG<br/><span style={{fontSize:10,color:"#a8bfcf"}}>Carré, fond transparent recommandé{!editCard&&<><br/>Le nom du fichier remplit le titre s'il est vide</>}</span></div>}</div><input ref={editCard?editFileRef:fileRef} type="file" accept=".png,image/png" onChange={handleCardImage} style={{display:"none"}}/></Fld>
            <Fld lbl="Saison (optionnel)"><select value={(editCard?editCard.season_id:nc.season_id)??''} onChange={e=>{const v=e.target.value===''?null:+e.target.value;editCard?setEditCard({...editCard,season_id:v}):setNc({...nc,season_id:v});}} style={SEL}><option value="">Aucune saison (disponible en permanence)</option>{seasons.map(s=><option key={s.id} value={s.id}>{s.name} ({s.start_date} → {s.end_date})</option>)}</select></Fld>
            {(editCard?editCard.season_id:nc.season_id)&&(
              <Fld lbl="Coût hors saison (override)">
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{color:"#f9ca24",fontSize:12}}>Or :</span>
                  <input type="text" inputMode="numeric" placeholder="défaut"
                    value={editCard?(editCard.offseason_gold_cost??''):(nc.offseason_gold_cost??'')}
                    onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,'');const val=v===''?null:+v;editCard?setEditCard({...editCard,offseason_gold_cost:val}):setNc({...nc,offseason_gold_cost:val});}}
                    style={{...INP,width:80}}/>
                  <span style={{color:"#aaa",fontSize:12}}>G</span>
                  <span style={{color:"#a29bfe",fontSize:12,marginLeft:6}}>PF :</span>
                  <input type="text" inputMode="numeric" placeholder="défaut"
                    value={editCard?(editCard.offseason_pf_cost??''):(nc.offseason_pf_cost??'')}
                    onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,'');const val=v===''?null:+v;editCard?setEditCard({...editCard,offseason_pf_cost:val}):setNc({...nc,offseason_pf_cost:val});}}
                    style={{...INP,width:80}}/>
                  <span style={{color:"#aaa",fontSize:12}}>pts</span>
                </div>
                <div style={{color:"#8daacc",fontSize:11,marginTop:3}}>Une fois la saison terminée, ce geocoin est proposé au marché « Hors saison » contre Or + PF. Vide = défaut par rareté (Saisons → réglages hors saison).</div>
              </Fld>
            )}
            <Fld lbl="Options de vente"><label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:7}}><input type="checkbox" checked={editCard?editCard.sellable!==false:nc.sellable} onChange={e=>{editCard?setEditCard({...editCard,sellable:e.target.checked}):setNc({...nc,sellable:e.target.checked});}} style={{width:16,height:16}}/><span style={{color:"#fff",fontSize:13,fontWeight:700}}>Carte vendable</span></label><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{color:"#aaa",fontSize:12}}>Prix minimum :</span><input type="text" inputMode="numeric" placeholder="Aucun" value={editCard?editCard.minPrice??'':nc.minPrice??''} onChange={e=>{const raw=e.target.value.replace(/[^0-9]/g,'');const v=raw===''?null:+raw;editCard?setEditCard({...editCard,minPrice:v??''}):setNc({...nc,minPrice:v??''});}} style={{...INP,width:80}}/><span style={{color:"#aaa",fontSize:12}}>G</span></div></Fld>
            <Fld lbl="Offrir aux joueurs"><label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}><input type="checkbox" checked={!!(editCard?editCard.is_offered:nc.is_offered)} onChange={e=>{editCard?setEditCard({...editCard,is_offered:e.target.checked}):setNc({...nc,is_offered:e.target.checked});}} style={{width:16,height:16}}/><span style={{color:"#f9ca24",fontSize:13,fontWeight:700}}>🎁 Offrir à tous les joueurs</span></label><div style={{color:"#8daacc",fontSize:11,marginTop:3}}>Si activé, chaque joueur reçoit cette carte s'il ne la possède pas encore.</div></Fld>
            <Fld lbl="Visibilité"><label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}><input type="checkbox" checked={!!(editCard?editCard.hidden:nc.hidden)} onChange={e=>{editCard?setEditCard({...editCard,hidden:e.target.checked,sellable:e.target.checked?false:editCard.sellable}):setNc({...nc,hidden:e.target.checked,sellable:e.target.checked?false:nc.sellable});}} style={{width:16,height:16}}/><span style={{color:"#e17055",fontSize:13,fontWeight:700}}>🚫 Carte cachée</span></label><div style={{color:"#8daacc",fontSize:11,marginTop:3}}>Invisible pour les joueurs · exclue de tous les totaux · jamais vendable. Reste gérable et attribuable côté admin.</div>{editCard?.hidden&&editCard.publish_at&&<div style={{display:"inline-block",fontSize:11,color:"#f9ca24",fontWeight:800,marginTop:5,background:"#f9ca2418",borderRadius:5,padding:"2px 8px"}}>📅 Publication programmée : {new Date(editCard.publish_at).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})} — modifiable dans l'onglet « 🚫 Cachées »</div>}</Fld>
            <Fld lbl="Forge">
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:6}}>
                <input type="checkbox" checked={!!(editCard?editCard.forgeable:nc.forgeable)}
                  onChange={e=>{editCard?setEditCard({...editCard,forgeable:e.target.checked,sellable:e.target.checked?false:editCard.sellable}):setNc({...nc,forgeable:e.target.checked,sellable:e.target.checked?false:nc.sellable});}}
                  style={{width:16,height:16}}/>
                <span style={{color:"#a29bfe",fontSize:13,fontWeight:700}}>🔨 Carte forgeable</span>
              </label>
              {(editCard?editCard.forgeable:nc.forgeable)&&(
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{color:"#aaa",fontSize:12}}>Coût de forge :</span>
                  <input type="text" inputMode="numeric" placeholder="ex: 50"
                    value={editCard?editCard.forgeCost??editCard.forge_cost??'':nc.forgeCost??''}
                    onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,'');editCard?setEditCard({...editCard,forgeCost:v,forge_cost:v===''?null:+v}):setNc({...nc,forgeCost:v,forge_cost:v===''?null:+v});}}
                    style={{...INP,width:80}}/>
                  <span style={{color:"#aaa",fontSize:12}}>pts</span>
                </div>
              )}
              <div style={{color:"#a8bfcf",fontSize:10,marginTop:4}}>Exclue du quiz · non vendable · craftable avec des points de forge</div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
                <span style={{color:"#f9ca24",fontSize:12}}>✨ Coût brillance :</span>
                <input type="text" inputMode="numeric" placeholder="ex: 50"
                  value={editCard?editCard.shiny_forge_cost??'':nc.shiny_forge_cost??''}
                  onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,'');editCard?setEditCard({...editCard,shiny_forge_cost:v===''?null:+v}):setNc({...nc,shiny_forge_cost:v===''?null:+v});}}
                  style={{...INP,width:80}}/>
                <span style={{color:"#aaa",fontSize:12}}>pts</span>
              </div>
            </Fld>
            <div style={{display:"flex",gap:8,marginTop:4}}>{editCard?(<><button onClick={async()=>{if(!editCard.name.trim()){setMsg("❌ Nom requis.");return;}const payload={...editCard, image_url: editCard.image, image_url_thumb: editCard.thumbnail, is_offered: !!editCard.is_offered, gc_code: gcCodeFromInput(editCard.gc_code), gc_owner: editCard.gc_owner?.trim()||null, gc_cache_type: editCard.gc_cache_type||null, gc_placed_date: editCard.gc_placed_date||null, gc_country: editCard.gc_country?.trim()||null, forgeable: !!editCard.forgeable, forge_cost: editCard.forgeable ? (editCard.forge_cost != null ? editCard.forge_cost : (editCard.forgeCost !== '' && editCard.forgeCost != null ? +editCard.forgeCost : null)) : null}; if(payload.minPrice!==undefined){payload.min_price=payload.minPrice; delete payload.minPrice;} delete payload.image; delete payload.thumbnail; delete payload.forgeCost; const err=await onEditCard(payload);if(err){setMsg("❌ "+err);return;}onUpdateCardInPool?.(payload);closeForm();setMsg(`✅ "${editCard.name}" mis à jour !`);}} style={{flex:1,...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"11px",borderRadius:10}}>Enregistrer ✏️</button><button onClick={closeForm} style={{...BTN("#ffffff18"),padding:"11px",borderRadius:10}}>Annuler</button><button onClick={async()=>{if(!window.confirm(`Supprimer définitivement "${editCard.name}" ?`)) return;const name=editCard.name;const err=await onDeleteCard(editCard.id);if(err){setMsg("❌ "+err);return;}closeForm();setMsg(`✅ "${name}" supprimée.`);}} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)","#fff"),padding:"11px",borderRadius:10}} title="Supprimer cette carte">🗑️</button></>):(<button onClick={async()=>{if(!nc.name.trim()){setMsg("❌ Nom requis.");return;}const payload={name:nc.name.trim(), type:nc.type||cardTypes[0]||"", rarity:nc.rarity, image_url:nc.image, image_url_thumb:nc.thumbnail, desc:nc.desc, sellable:(nc.forgeable||nc.hidden)?false:nc.sellable, min_price:nc.minPrice||null, forgeable:!!nc.forgeable, forge_cost:nc.forgeable?(nc.forge_cost??null):null, season_id:nc.season_id||null, offseason_gold_cost:nc.offseason_gold_cost??null, offseason_pf_cost:nc.offseason_pf_cost??null, hidden:!!nc.hidden, gc_code:gcCodeFromInput(nc.gc_code), gc_owner:nc.gc_owner?.trim()||null, gc_cache_type:nc.gc_cache_type||null, gc_placed_date:nc.gc_placed_date||null, gc_country:nc.gc_country?.trim()||null}; const err=await onAddCard(payload);if(err){setMsg("❌ "+err);return;}setMsg(`✅ "${nc.name}" créée !`);closeForm();}} style={{flex:1,...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"11px",borderRadius:10}}>{t("admin_create_card")}</button>)}</div>
          </div>
          <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:7}}><div style={{fontSize:10,color:"#8daacc",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Aperçu</div>{(()=>{const src=editCard||nc;const {c1,c2}=cardCC(src.rarity);const isLeg=src.rarity==="légendaire";return(<div style={{position:"relative",width:148,height:190,borderRadius:16,border:isLeg?`2px solid ${c1}`:`1.5px solid ${c1}66`,boxShadow:isLeg?`0 0 20px ${c1}66,0 4px 20px #0004`:"0 4px 14px #0003",overflow:"hidden",background:src.image?"transparent":`linear-gradient(145deg,${c1}44,${c2}66)`,fontFamily:"'Nunito',sans-serif"}}>{isLeg&&<div style={{position:"absolute",inset:0,borderRadius:16,zIndex:2,background:"linear-gradient(135deg,transparent 40%,#ffffff1a 50%,transparent 60%)",backgroundSize:"400px 100%",animation:"shimmer 2.5s linear infinite",pointerEvents:"none"}}/>}<div style={{position:"absolute",inset:0,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:6}}>{src.image?<img src={src.image} style={{width:"100%",height:"88%",objectFit:"contain"}} alt=""/>:<div style={{fontSize:52,opacity:.22,marginTop:40}}>🃏</div>}</div><div style={{position:"absolute",bottom:0,left:0,right:0,zIndex:3,background:`linear-gradient(to top,${c1}ee 0%,${c1}99 50%,transparent 100%)`,padding:"28px 8px 7px",textAlign:"center"}}><div style={{fontWeight:900,fontSize:13,color:"#fff",textShadow:"0 1px 4px #0008",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",letterSpacing:.3}}>{src.name||"Nom"}</div></div><div style={{position:"absolute",bottom:0,left:0,right:0,zIndex:4,height:4,background:`linear-gradient(90deg,${c1},${c2})`}}/>{src.forgeable&&<div style={{position:"absolute",top:5,left:5,zIndex:5,background:"#6c5ce7cc",color:"#fff",fontSize:8,fontWeight:800,borderRadius:4,padding:"2px 5px"}}>🔨 {src.forge_cost??src.forgeCost??'?'}pts</div>}{!src.forgeable&&!src.hidden&&src.sellable===false&&<div style={{position:"absolute",top:5,left:5,zIndex:5,background:"#e74c3ccc",color:"#fff",fontSize:8,fontWeight:800,borderRadius:4,padding:"2px 5px"}}>NON VENDABLE</div>}{src.hidden&&<div style={{position:"absolute",top:5,left:5,zIndex:5,background:"#e17055ee",color:"#fff",fontSize:8,fontWeight:800,borderRadius:4,padding:"2px 5px"}}>🚫 CACHÉE</div>}{!src.forgeable&&src.minPrice>0&&<div style={{position:"absolute",top:5,right:5,zIndex:5,background:"#f39c12cc",color:"#fff",fontSize:8,fontWeight:800,borderRadius:4,padding:"2px 5px"}}>MIN {src.minPrice}G</div>}</div>);})()}</div>
        </div>
      )}

      {/* ── Panneau traduction nom de carte ── */}
      {editCard && (
        <div style={{background:"#1a0a3a",border:"1.5px solid #6c5ce766",borderRadius:12,padding:16,marginTop:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontWeight:900,color:"#a29bfe",fontSize:13}}>🌐 Traduction du nom — <span style={{color:"#fff"}}>{editCard.name}</span></div>
          </div>
          <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
            {NAME_TRANS_LANGS.map(l=>(
              <button key={l.code} onClick={()=>setTransCardLang(l.code)}
                style={{background:transCardLang===l.code?"#6c5ce7":"#ffffff10",border:"none",color:transCardLang===l.code?"#fff":"#aaa",padding:"5px 12px",borderRadius:8,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:"pointer"}}>
                {l.label} {editCard.name_translations?.[l.code]?"✓":""}
              </button>
            ))}
          </div>
          {NAME_TRANS_LANGS.filter(l=>l.code===transCardLang).map(l=>(
            <Fld key={l.code} lbl={`Nom en ${l.label}`}>
              <input
                value={editCard.name_translations?.[l.code]||""}
                onChange={e=>setEditCard(c=>({...c,name_translations:{...c.name_translations,[l.code]:e.target.value}}))}
                style={INP} placeholder={`Nom en ${l.label}…`}/>
            </Fld>
          ))}
          <button onClick={async()=>{
            const {error}=await apiAdminSaveCardNameTrans(editCard.id, editCard.name_translations||{});
            if(error){setMsg("❌ Erreur sauvegarde");return;}
            onUpdateCardInPool?.({...editCard});
            setMsg("✅ Traductions du nom sauvegardées !");
          }} style={{...BTN("linear-gradient(135deg,#6c5ce7,#a29bfe)"),padding:"8px 18px",borderRadius:8,fontSize:12,marginTop:8}}>
            💾 Sauvegarder les traductions
          </button>
        </div>
      )}

      {/* ── Panneau traduction description de carte ── */}
      {editCard && (
        <div style={{background:"#1a0a3a",border:"1.5px solid #6c5ce766",borderRadius:12,padding:16,marginTop:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontWeight:900,color:"#a29bfe",fontSize:13}}>🌐 Traduction de la description — <span style={{color:"#fff"}}>{editCard.name}</span></div>
          </div>
          <div style={{fontSize:11,color:"#8887a8",marginBottom:10,fontStyle:"italic"}}>FR : "{editCard.desc||editCard.description||"(vide)"}"</div>
          <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
            {TRANS_LANGS.map(l=>(
              <button key={l.code} onClick={()=>setTransDescLang(l.code)}
                style={{background:transDescLang===l.code?"#6c5ce7":"#ffffff10",border:"none",color:transDescLang===l.code?"#fff":"#aaa",padding:"5px 12px",borderRadius:8,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:"pointer"}}>
                {l.label} {editCard.description_translations?.[l.code]?"✓":""}
              </button>
            ))}
          </div>
          {TRANS_LANGS.filter(l=>l.code===transDescLang).map(l=>(
            <Fld key={l.code} lbl={`Description en ${l.label}`}>
              <textarea
                value={editCard.description_translations?.[l.code]||""}
                onChange={e=>setEditCard(c=>({...c,description_translations:{...c.description_translations,[l.code]:e.target.value}}))}
                style={{...INP,minHeight:70,resize:"vertical"}} placeholder={`Description en ${l.label}…`}/>
            </Fld>
          ))}
          <button onClick={async()=>{
            const {error}=await apiAdminSaveCardDescTrans(editCard.id, editCard.description_translations||{});
            if(error){setMsg("❌ Erreur sauvegarde");return;}
            onUpdateCardInPool?.({...editCard});
            setMsg("✅ Traductions de la description sauvegardées !");
          }} style={{...BTN("linear-gradient(135deg,#6c5ce7,#a29bfe)"),padding:"8px 18px",borderRadius:8,fontSize:12,marginTop:8}}>
            💾 Sauvegarder les traductions
          </button>
        </div>
      )}

      {/* ── Description longue : contenu de la fiche publique (SEO) ── */}
      {editCard && (() => {
        const published  = PUBLISHED_TYPES.includes(editCard.type);
        const longFr     = editCard.description_long || "";
        // On compte le TEXTE, pas le balisage : sinon quelques `<p>` suffiraient
        // à franchir le seuil d'indexation sans rien raconter de plus.
        const textLen    = richTextLength(longFr);
        const indexable  = textLen >= MIN_INDEXABLE_DESCRIPTION;
        return (
          <div style={{background:"#0a2a1a",border:"1.5px solid #00b89466",borderRadius:12,padding:16,marginTop:12}}>
            <div style={{fontWeight:900,color:"#00b894",fontSize:13,marginBottom:6,display:"flex",flexWrap:"wrap",alignItems:"center",gap:8}}>
              <span>🌍 Description longue (page publique) — <span style={{color:"#fff"}}>{editCard.name}</span></span>
              {/* Lien vers la fiche telle qu'elle est SERVIE : c'est le seul moyen
                  de voir le rendu réel du texte saisi ici. En français, langue de
                  rédaction. ⚠️ La page publique est une photo prise au build : une
                  description tout juste enregistrée n'y apparaît qu'après le
                  déploiement du front (bouton de déploiement plus haut). */}
              {published && (
                <a href={abs(buildPath('geocoin', { lang: 'fr', param: geocoinSlug(editCard.id, editCard.name) }))}
                  target="_blank" rel="noopener noreferrer"
                  style={{color:"#00b894",fontSize:11,fontWeight:800,textDecoration:"none",border:"1px solid #00b89466",borderRadius:8,padding:"3px 9px"}}>
                  ↗ Voir la fiche publique
                </a>
              )}
            </div>
            <div style={{fontSize:11,color:"#8887a8",marginBottom:10,lineHeight:1.5}}>
              Texte de la page <code>/geocoins/…</code> visible par les moteurs de recherche.
              Distinct de la description courte, qui reste affichée sur la carte dans le jeu.
              Mise en forme et liens (🔗) disponibles ; pas d'images, elles seraient
              embarquées dans le pool de cartes de tous les joueurs.
              {published
                ? <> Cette page n'est <b>référencée</b> qu'à partir de <b>{MIN_INDEXABLE_DESCRIPTION} caractères</b> — en dessous elle reste consultable mais en <code>noindex</code>.</>
                : <> ⚠️ Seuls les geocoins de type <b>{PUBLISHED_TYPES.join(", ")}</b> ont une page publique : ce texte ne sera pas publié pour le type « {editCard.type} ».</>}
            </div>

            <Fld lbl="Description longue (français, texte source)">
              {/* Éditeur riche, comme les notes de version : titres, listes,
                  couleurs, tableaux et LIENS (bouton 🔗). Sans images : elles
                  seraient intégrées en base64 dans la colonne, donc renvoyées à
                  tous les joueurs avec le pool de cartes. */}
              <RichTextEditor
                value={richTextHtml(longFr)}
                onChange={html=>setEditCard(c=>({...c,description_long:html}))}
                allowImages={false}
                placeholder="Raconte l'histoire de ce geocoin : la cache ou la personne à qui il rend hommage, le lieu, l'anecdote…"/>
            </Fld>
            <div style={{fontSize:11,color:indexable?"#00b894":"#e17055",fontWeight:800,marginTop:-4,marginBottom:10}}>
              {textLen} caractères — {indexable ? "✅ référençable" : `encore ${MIN_INDEXABLE_DESCRIPTION - textLen} pour être référencée`}
            </div>

            <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
              {TRANS_LANGS.map(l=>(
                <button key={l.code} onClick={()=>setTransLongLang(l.code)}
                  style={{background:transLongLang===l.code?"#00b894":"#ffffff10",border:"none",color:transLongLang===l.code?"#fff":"#aaa",padding:"5px 12px",borderRadius:8,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:"pointer"}}>
                  {l.label} {editCard.description_long_translations?.[l.code]?"✓":""}
                </button>
              ))}
            </div>
            {TRANS_LANGS.filter(l=>l.code===transLongLang).map(l=>(
              <Fld key={l.code} lbl={`Description longue en ${l.label}`}>
                {/* Clé sur la langue : chaque onglet a SON éditeur, dont le
                    contenu ne peut pas déborder sur celui d'à côté. */}
                <RichTextEditor
                  key={l.code}
                  value={richTextHtml(editCard.description_long_translations?.[l.code]||"")}
                  onChange={html=>setEditCard(c=>({...c,description_long_translations:{...c.description_long_translations,[l.code]:html}}))}
                  allowImages={false}
                  placeholder={`Description longue en ${l.label}…`}/>
              </Fld>
            ))}

            <button onClick={async()=>{
              const {error}=await apiAdminSaveCardLongDesc(
                editCard.id,
                editCard.description_long||"",
                editCard.description_long_translations||{},
              );
              if(error){setMsg("❌ Erreur sauvegarde");return;}
              onUpdateCardInPool?.({...editCard});
              setMsg("✅ Description longue sauvegardée ! (visible en ligne au prochain déploiement)");
            }} style={{...BTN("linear-gradient(135deg,#00b894,#55efc4)"),padding:"8px 18px",borderRadius:8,fontSize:12,marginTop:8}}>
              💾 Sauvegarder la description longue
            </button>

            {/* La sauvegarde ne met à jour que la base : la page /geocoins/… est
                un fichier statique du dernier build, et aucun hook ne part tout
                seul pour les fiches geocoin (contrairement aux pages docs). */}
            <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid #ffffff14",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
              <button disabled={deploying} onClick={async()=>{
                if(!window.confirm("Lancer un déploiement du site ?\n\nIl republie les pages statiques (/geocoins/…, FAQ, notes de version) avec le contenu actuel. Compter quelques minutes.")) return;
                setDeploying(true);
                const {data,error}=await apiAdminDeployFrontend(`admin: fiche geocoin ${editCard.id}`);
                setDeploying(false);
                setMsg(error ? "❌ "+error : `🚀 Déploiement lancé (${data?.reasons||"manuel"}) — les pages publiques se mettront à jour à la fin du build.`);
              }} style={{...BTN(deploying?"#ffffff18":"linear-gradient(135deg,#6c5ce7,#a29bfe)"),padding:"8px 18px",borderRadius:8,fontSize:12,opacity:deploying?.6:1,cursor:deploying?"default":"pointer"}}>
                {deploying ? "⏳ Déploiement…" : "🚀 Déployer le site"}
              </button>
              <div style={{fontSize:11,color:"#8887a8",flex:1,minWidth:180,lineHeight:1.4}}>
                Nécessaire pour que le texte ci-dessus apparaisse sur la page publique et dans les aperçus de partage.
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}