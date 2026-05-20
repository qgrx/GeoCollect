import { useState, useRef, useMemo, useEffect } from 'react';
import { INP, SEL, BTN } from '../../utils/styles.js';
import { useT } from '../../i18n/translations.js';
import { RC, cardCC } from '../../data/cards.js';
import { supabase } from '../../lib/supabase.js';
import { apiAdminSaveCardNameTrans, apiGetAdminSeasons } from '../../services/api.js';
import Card from '../../components/Card.jsx';

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
  const [search, setSearch]           = useState('');
  const [filterType, setFilterType]   = useState('Tous');
  const [filterRarity, setFilterRarity] = useState('');
  const [gridPage, setGridPage]       = useState(0);
  const GRID_PAGE = 24;
  const [showAdv, setShowAdv]                     = useState(false);
  const [filterForgeable, setFilterForgeable]     = useState('');
  const [filterSellable, setFilterSellable]       = useState('');
  const [filterMinPrice, setFilterMinPrice]       = useState('');
  const [filterMinPriceVal, setFilterMinPriceVal] = useState('');
  const [filterShiny, setFilterShiny]             = useState('');
  const [filterShinyVal, setFilterShinyVal]       = useState('');
  const [filterForgeCost, setFilterForgeCost]     = useState('');
  const [filterForgeCostVal, setFilterForgeCostVal] = useState('');
  const advActiveCount = [filterForgeable, filterSellable, filterMinPrice, filterShiny, filterForgeCost].filter(Boolean).length;
  const [circulation, setCirculation] = useState(null);
  const [nc, setNc] = useState({ name: "", type: cardTypes[0] || "", rarity: "commun", image: null, thumbnail: null, desc: "", sellable: true, minPrice: "", forgeable: false, forgeCost: "", shiny_forge_cost: null, season_id: null });

  const displayCards = useMemo(() => {
    const RARITY_ORDER = { légendaire: 0, épique: 1, rare: 2, commun: 3 };
    let cards = cardPool.filter(c => !c.type?.toLowerCase().includes('achievement'));
    if (filterType !== 'Tous') cards = cards.filter(c => c.type === filterType);
    if (filterRarity) cards = cards.filter(c => c.rarity === filterRarity);
    if (search) cards = cards.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    if (filterForgeable === 'true')  cards = cards.filter(c => !!c.forgeable);
    if (filterForgeable === 'false') cards = cards.filter(c => !c.forgeable);
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
  }, [cardPool, filterType, filterRarity, search, filterForgeable, filterSellable, filterMinPrice, filterMinPriceVal, filterShiny, filterShinyVal, filterForgeCost, filterForgeCostVal]);

  const [seasons, setSeasons] = useState([]);
  const [transCard, setTransCard] = useState(null);
  const [transCardLang, setTransCardLang] = useState('en');
  const TRANS_LANGS = [{code:'en',label:'English'},{code:'de',label:'Deutsch'},{code:'es',label:'Español'}];

  const csvCardRef = useRef();
  const fileRef = useRef();
  const editFileRef = useRef();

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
    setEditCard(null); setNewCardMode(false);
    setNc({ name:"", type: filterType !== 'Tous' ? filterType : cardTypes[0]||"", rarity:"commun", image:null, thumbnail:null, desc:"", sellable:true, minPrice:"", forgeable:false, forgeCost:"", shiny_forge_cost:null, season_id:null });
    if (fileRef.current) fileRef.current.value = '';
    if (editFileRef.current) editFileRef.current.value = '';
  }

  return (
    <div>
      {/* ── Header ── */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{flex:1,fontWeight:800,color:"#e74c3c",fontSize:14}}>
          {editCard ? `✏️ ${editCard.name}` : newCardMode ? "➕ Nouvelle carte" : "🃏 Geocoins"}
        </div>
        {!editCard && !newCardMode && (
          <button onClick={()=>{ setNewCardMode(true); setNc({name:"",type:filterType!=='Tous'?filterType:cardTypes[0]||"",rarity:"commun",image:null,thumbnail:null,desc:"",sellable:true,minPrice:"",forgeable:false,forgeCost:"",shiny_forge_cost:null,season_id:null}); }}
            style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"6px 14px",fontSize:12,borderRadius:8}}>➕ Nouvelle carte</button>
        )}
        <button onClick={()=>csvCardRef.current.click()} style={{...BTN("#ffffff18"),padding:"6px 12px",fontSize:11,borderRadius:8}}>📥 Importer</button>
        <button onClick={exportCSVCards} style={{...BTN("#ffffff18"),padding:"6px 12px",fontSize:11,borderRadius:8}}>📤 Exporter</button>
        <input ref={csvCardRef} type="file" accept=".csv,.zip" onChange={handleCSVCards} style={{display:"none"}}/>
      </div>

      {/* ── Fil d'Ariane ── */}
      {(editCard || newCardMode) && (
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:14,fontSize:12,color:"#8daacc"}}>
          <button onClick={closeForm} style={{background:"none",border:"none",color:"#e74c3c",fontWeight:800,fontSize:12,cursor:"pointer",fontFamily:"'Nunito',sans-serif",padding:0}}>← Tous les geocoins</button>
          <span>›</span>
          <span style={{color:"#f9ca24",fontWeight:700}}>
            {editCard ? <>✏️ {editCard.name}{circulation!==null&&<span style={{color:"#aaa",fontSize:11,fontWeight:600,marginLeft:4}}>({circulation} en circulation)</span>}</> : "Nouvelle carte"}
          </span>
        </div>
      )}

      {/* ── Grille de geocoins ── */}
      {!editCard && !newCardMode && (
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
            <button onClick={()=>setShowAdv(v=>!v)}
              style={{background:showAdv||advActiveCount>0?'#6c5ce722':'#ffffff0a',border:`1px solid ${advActiveCount>0?'#6c5ce7':'#ffffff22'}`,color:advActiveCount>0?'#a29bfe':'#aaa',padding:"6px 10px",borderRadius:6,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:"pointer"}}>
              Filtres {advActiveCount>0?`(${advActiveCount}) `:''}▾
            </button>
          </div>
          {showAdv && (
            <div style={{background:"#ffffff08",border:"1px solid #ffffff14",borderRadius:8,padding:"10px 12px",marginBottom:8,display:"flex",flexDirection:"column",gap:7}}>
              {/* Forgeable / Vendable */}
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <select value={filterForgeable} onChange={e=>{setFilterForgeable(e.target.value);setGridPage(0);}} style={{...SEL,fontSize:11,padding:"4px 8px",flex:1}}>
                  <option value="">Forgeable : tous</option>
                  <option value="true">🔨 Forgeables</option>
                  <option value="false">Non forgeables</option>
                </select>
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
                <button onClick={()=>{setFilterForgeable('');setFilterSellable('');setFilterMinPrice('');setFilterMinPriceVal('');setFilterShiny('');setFilterShinyVal('');setFilterForgeCost('');setFilterForgeCostVal('');setGridPage(0);}}
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
                        <div key={c.id} onClick={()=>setEditCard({...c})} style={{cursor:"pointer"}} title={c.name}>
                          <Card card={c} small />
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
            <Fld lbl="Rareté (définit les couleurs)"><select value={editCard?editCard.rarity:nc.rarity} onChange={e=>{editCard?setEditCard({...editCard,rarity:e.target.value}):setNc({...nc,rarity:e.target.value});}} style={SEL}>{["commun","rare","épique","légendaire"].map(r=><option key={r} value={r}>{RC[r].label}</option>)}</select><div style={{marginTop:5,height:6,borderRadius:3,background:`linear-gradient(90deg,${c1p},${c2p})`,transition:"background .3s"}}/></Fld>
            <Fld lbl="Image PNG"><div onClick={()=>(editCard?editFileRef:fileRef).current.click()} style={{border:"2px dashed #ffffff33",borderRadius:9,padding:"13px",textAlign:"center",cursor:"pointer",background:"#ffffff08"}} onMouseEnter={e=>e.currentTarget.style.borderColor="#f9ca2466"} onMouseLeave={e=>e.currentTarget.style.borderColor="#ffffff33"}>{(editCard?editCard.image:nc.image)?<img src={editCard?editCard.image:nc.image} style={{maxWidth:"100%",maxHeight:80,objectFit:"contain",borderRadius:5}} alt="prev"/>:<div style={{color:"#8daacc",fontSize:12}}>📁 Choisir un PNG<br/><span style={{fontSize:10,color:"#a8bfcf"}}>Carré, fond transparent recommandé</span></div>}</div><input ref={editCard?editFileRef:fileRef} type="file" accept=".png,image/png" onChange={e=>{const src=editCard||nc;imgUpload(e,({imageBase64, thumbnailBase64})=>editCard?setEditCard({...editCard,image:imageBase64,thumbnail:thumbnailBase64}):setNc({...nc,image:imageBase64,thumbnail:thumbnailBase64}),{name:src.name||'',type:src.type||'',rarity:src.rarity||''});}} style={{display:"none"}}/></Fld>
            <Fld lbl="Saison (optionnel)"><select value={(editCard?editCard.season_id:nc.season_id)??''} onChange={e=>{const v=e.target.value===''?null:+e.target.value;editCard?setEditCard({...editCard,season_id:v}):setNc({...nc,season_id:v});}} style={SEL}><option value="">Aucune saison (disponible en permanence)</option>{seasons.map(s=><option key={s.id} value={s.id}>{s.name} ({s.start_date} → {s.end_date})</option>)}</select></Fld>
            <Fld lbl="Options de vente"><label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:7}}><input type="checkbox" checked={editCard?editCard.sellable!==false:nc.sellable} onChange={e=>{editCard?setEditCard({...editCard,sellable:e.target.checked}):setNc({...nc,sellable:e.target.checked});}} style={{width:16,height:16}}/><span style={{color:"#fff",fontSize:13,fontWeight:700}}>Carte vendable</span></label><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{color:"#aaa",fontSize:12}}>Prix minimum :</span><input type="text" inputMode="numeric" placeholder="Aucun" value={editCard?editCard.minPrice??'':nc.minPrice??''} onChange={e=>{const raw=e.target.value.replace(/[^0-9]/g,'');const v=raw===''?null:+raw;editCard?setEditCard({...editCard,minPrice:v??''}):setNc({...nc,minPrice:v??''});}} style={{...INP,width:80}}/><span style={{color:"#aaa",fontSize:12}}>G</span></div></Fld>
            <Fld lbl="Offrir aux joueurs"><label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}><input type="checkbox" checked={!!(editCard?editCard.is_offered:nc.is_offered)} onChange={e=>{editCard?setEditCard({...editCard,is_offered:e.target.checked}):setNc({...nc,is_offered:e.target.checked});}} style={{width:16,height:16}}/><span style={{color:"#f9ca24",fontSize:13,fontWeight:700}}>🎁 Offrir à tous les joueurs</span></label><div style={{color:"#8daacc",fontSize:11,marginTop:3}}>Si activé, chaque joueur reçoit cette carte s'il ne la possède pas encore.</div></Fld>
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
            <div style={{display:"flex",gap:8,marginTop:4}}>{editCard?(<><button onClick={async()=>{if(!editCard.name.trim()){setMsg("❌ Nom requis.");return;}const payload={...editCard, image_url: editCard.image, image_url_thumb: editCard.thumbnail, is_offered: !!editCard.is_offered, forgeable: !!editCard.forgeable, forge_cost: editCard.forgeable ? (editCard.forge_cost??editCard.forgeCost??null) : null}; if(payload.minPrice!==undefined){payload.min_price=payload.minPrice; delete payload.minPrice;} delete payload.image; delete payload.thumbnail; delete payload.forgeCost; const err=await onEditCard(payload);if(err){setMsg("❌ "+err);return;}onUpdateCardInPool?.(payload);closeForm();setMsg(`✅ "${editCard.name}" mis à jour !`);}} style={{flex:1,...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"11px",borderRadius:10}}>Enregistrer ✏️</button><button onClick={closeForm} style={{...BTN("#ffffff18"),padding:"11px",borderRadius:10}}>Annuler</button><button onClick={async()=>{if(!window.confirm(`Supprimer définitivement "${editCard.name}" ?`)) return;const name=editCard.name;const err=await onDeleteCard(editCard.id);if(err){setMsg("❌ "+err);return;}closeForm();setMsg(`✅ "${name}" supprimée.`);}} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)","#fff"),padding:"11px",borderRadius:10}} title="Supprimer cette carte">🗑️</button></>):(<button onClick={async()=>{if(!nc.name.trim()){setMsg("❌ Nom requis.");return;}const payload={name:nc.name.trim(), type:nc.type||cardTypes[0]||"", rarity:nc.rarity, image_url:nc.image, image_url_thumb:nc.thumbnail, desc:nc.desc, sellable:nc.forgeable?false:nc.sellable, min_price:nc.minPrice||null, forgeable:!!nc.forgeable, forge_cost:nc.forgeable?(nc.forge_cost??null):null, season_id:nc.season_id||null}; const err=await onAddCard(payload);if(err){setMsg("❌ "+err);return;}setMsg(`✅ "${nc.name}" créée !`);closeForm();}} style={{flex:1,...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"11px",borderRadius:10}}>{t("admin_create_card")}</button>)}</div>
          </div>
          <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:7}}><div style={{fontSize:10,color:"#8daacc",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Aperçu</div>{(()=>{const src=editCard||nc;const {c1,c2}=cardCC(src.rarity);const isLeg=src.rarity==="légendaire";return(<div style={{position:"relative",width:148,height:190,borderRadius:16,border:isLeg?`2px solid ${c1}`:`1.5px solid ${c1}66`,boxShadow:isLeg?`0 0 20px ${c1}66,0 4px 20px #0004`:"0 4px 14px #0003",overflow:"hidden",background:src.image?"transparent":`linear-gradient(145deg,${c1}44,${c2}66)`,fontFamily:"'Nunito',sans-serif"}}>{isLeg&&<div style={{position:"absolute",inset:0,borderRadius:16,zIndex:2,background:"linear-gradient(135deg,transparent 40%,#ffffff1a 50%,transparent 60%)",backgroundSize:"400px 100%",animation:"shimmer 2.5s linear infinite",pointerEvents:"none"}}/>}<div style={{position:"absolute",inset:0,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:6}}>{src.image?<img src={src.image} style={{width:"100%",height:"88%",objectFit:"contain"}} alt=""/>:<div style={{fontSize:52,opacity:.22,marginTop:40}}>🃏</div>}</div><div style={{position:"absolute",bottom:0,left:0,right:0,zIndex:3,background:`linear-gradient(to top,${c1}ee 0%,${c1}99 50%,transparent 100%)`,padding:"28px 8px 7px",textAlign:"center"}}><div style={{fontWeight:900,fontSize:13,color:"#fff",textShadow:"0 1px 4px #0008",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",letterSpacing:.3}}>{src.name||"Nom"}</div></div><div style={{position:"absolute",bottom:0,left:0,right:0,zIndex:4,height:4,background:`linear-gradient(90deg,${c1},${c2})`}}/>{src.forgeable&&<div style={{position:"absolute",top:5,left:5,zIndex:5,background:"#6c5ce7cc",color:"#fff",fontSize:8,fontWeight:800,borderRadius:4,padding:"2px 5px"}}>🔨 {src.forge_cost??src.forgeCost??'?'}pts</div>}{!src.forgeable&&src.sellable===false&&<div style={{position:"absolute",top:5,left:5,zIndex:5,background:"#e74c3ccc",color:"#fff",fontSize:8,fontWeight:800,borderRadius:4,padding:"2px 5px"}}>NON VENDABLE</div>}{!src.forgeable&&src.minPrice>0&&<div style={{position:"absolute",top:5,right:5,zIndex:5,background:"#f39c12cc",color:"#fff",fontSize:8,fontWeight:800,borderRadius:4,padding:"2px 5px"}}>MIN {src.minPrice}G</div>}</div>);})()}</div>
        </div>
      )}

      {/* ── Panneau traduction nom de carte ── */}
      {editCard && (
        <div style={{background:"#1a0a3a",border:"1.5px solid #6c5ce766",borderRadius:12,padding:16,marginTop:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontWeight:900,color:"#a29bfe",fontSize:13}}>🌐 Traduction du nom — <span style={{color:"#fff"}}>{editCard.name}</span></div>
          </div>
          <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
            {TRANS_LANGS.map(l=>(
              <button key={l.code} onClick={()=>setTransCardLang(l.code)}
                style={{background:transCardLang===l.code?"#6c5ce7":"#ffffff10",border:"none",color:transCardLang===l.code?"#fff":"#aaa",padding:"5px 12px",borderRadius:8,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:"pointer"}}>
                {l.label} {editCard.name_translations?.[l.code]?"✓":""}
              </button>
            ))}
          </div>
          {TRANS_LANGS.filter(l=>l.code===transCardLang).map(l=>(
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
    </div>
  );
}