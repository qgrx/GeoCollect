import { useState, useRef, useMemo } from 'react';
import { INP, SEL, BTN } from '../../utils/styles.js';
import { RC } from '../../data/cards.js';
import { cardNameFromFile, MAX_CARD_NAME } from '../../utils/cardFileName.js';

// ─── Création de geocoins par lot ─────────────────────────────────────────────
// On dépose N images d'un coup : chaque image devient un geocoin dont le nom est
// tiré du nom du fichier (cf. cardNameFromFile). Le lot est créé **caché** (hidden=true,
// donc non vendable et invisible pour les joueurs) : la publication se fait
// ensuite depuis l'onglet « 🚫 Cachées » (immédiate ou programmée).
// Catégorie / rareté / saison sont choisies une fois pour tout le lot.

const MAX_NAME  = MAX_CARD_NAME;
const MAX_FILES = 200;  // garde-fou : au-delà, le traitement navigateur devient très long

export default function AdminCardBatch({ cardPool, cardTypes, defaultType, seasons = [], onAddCard, setMsg, onClose }) {
  const [type, setType]         = useState(defaultType || cardTypes[0] || '');
  const [rarity, setRarity]     = useState('commun');
  const [seasonId, setSeasonId] = useState(null);
  const [items, setItems]       = useState([]);   // { key, fileName, name, medium, small, status, error }
  const [reading, setReading]   = useState(null); // { done, total } pendant le traitement des images
  const [creating, setCreating] = useState(false);
  const filesRef = useRef();
  const keySeq   = useRef(0);   // clés React uniques même si le même fichier est redéposé

  // Noms déjà pris (tout le pool admin, cartes cachées incluses).
  const knownNames = useMemo(
    () => new Set((cardPool || []).map(c => c.name?.trim().toLowerCase()).filter(Boolean)),
    [cardPool]
  );

  // Statut de validation de chaque ligne : nom vide, doublon dans le pool ou
  // doublon interne au lot (deux fichiers de même nom).
  const checks = useMemo(() => {
    const seen = new Set();
    return items.map(it => {
      const key = it.name.trim().toLowerCase();
      let issue = null;
      if (!key)                    issue = 'Nom vide';
      else if (knownNames.has(key)) issue = 'Nom déjà utilisé';
      else if (seen.has(key))       issue = 'Doublon dans le lot';
      if (key) seen.add(key);
      return issue;
    });
  }, [items, knownNames]);

  // Une ligne est créable si elle n'est pas déjà créée, sans problème de nom, et
  // que son image a bien été traitée (échec de traitement → medium null).
  const creatable = (it, issue) => it.status !== 'created' && !issue && !!it.medium;

  const pending  = items.filter((it, i) => creatable(it, checks[i])).length;
  const skipped  = items.filter((it, i) => it.status !== 'created' && !creatable(it, checks[i])).length;
  const created  = items.filter(it => it.status === 'created').length;
  const failed   = items.filter(it => it.status === 'error').length;

  async function handleFiles(e) {
    const files = [...(e.target.files || [])];
    e.target.value = null;
    if (!files.length) return;

    const images = files.filter(f => f.type.startsWith('image/'));
    const rejected = files.length - images.length;
    if (!images.length) { setMsg('❌ Aucun fichier image valide.'); return; }
    if (images.length > MAX_FILES) { setMsg(`❌ ${images.length} images : maximum ${MAX_FILES} par lot.`); return; }

    // Tri alphabétique : l'ordre de sélection du navigateur n'est pas garanti.
    images.sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));

    const { processCardImage } = await import('../../utils/imageProcessor.js');
    setReading({ done: 0, total: images.length });
    const next = [];
    for (let i = 0; i < images.length; i++) {
      const f = images[i];
      const name = cardNameFromFile(f.name);
      const base = { key: `b${++keySeq.current}`, fileName: f.name, file: f, name, meta: { name, type, rarity } };
      try {
        const { medium, small } = await processCardImage(f, { name, type, rarity });
        next.push({ ...base, medium, small, status: 'ready', error: null });
      } catch (err) {
        next.push({ ...base, medium: null, small: null, status: 'error', error: err.message });
      }
      setReading({ done: i + 1, total: images.length });
    }
    setReading(null);
    setItems(prev => [...prev, ...next]);
    setMsg(`✅ ${next.length} image(s) préparée(s)${rejected > 0 ? ` (${rejected} fichier(s) non image ignoré(s))` : ''}.`);
  }

  async function createBatch() {
    const todo = items.map((it, i) => ({ it, i })).filter(({ it, i }) => creatable(it, checks[i]));
    if (!todo.length) { setMsg('❌ Rien à créer.'); return; }
    if (!type) { setMsg('❌ Choisissez une catégorie.'); return; }
    if (!window.confirm(`Créer ${todo.length} geocoin(s) cachés dans « ${type} » (${RC[rarity]?.label || rarity}) ?\n\nIls resteront invisibles pour les joueurs jusqu'à publication depuis l'onglet « 🚫 Cachées ».`)) return;

    setCreating(true);
    // Les métadonnées PNG (nom/type/rareté) sont gravées dans l'image au moment du
    // dépôt : si le nom a été édité ou la catégorie/rareté changée depuis, on
    // regénère l'image à partir du fichier d'origine pour rester cohérent.
    const { processCardImage } = await import('../../utils/imageProcessor.js');
    let okCount = 0, errCount = 0;
    for (const { it, i } of todo) {
      setItems(prev => prev.map((p, j) => j === i ? { ...p, status: 'creating', error: null } : p));
      const name = it.name.trim();
      let { medium, small } = it;
      if (it.file && (it.meta?.name !== name || it.meta?.type !== type || it.meta?.rarity !== rarity)) {
        try {
          ({ medium, small } = await processCardImage(it.file, { name, type, rarity }));
        } catch { /* on garde l'image déjà traitée : seules les métadonnées PNG seront périmées */ }
      }
      const err = await onAddCard({
        name,
        type,
        rarity,
        image_url: medium,
        image_url_thumb: small,
        desc: '',
        sellable: false,   // une carte cachée n'est jamais vendable
        hidden: true,
        season_id: seasonId || null,
      });
      if (err) { errCount++; setItems(prev => prev.map((p, j) => j === i ? { ...p, status: 'error', error: err } : p)); }
      else     { okCount++;  setItems(prev => prev.map((p, j) => j === i ? { ...p, status: 'created', error: null } : p)); }
      setMsg(`⏳ Création… ${okCount + errCount}/${todo.length}`);
    }
    setCreating(false);
    setMsg(`✅ ${okCount} geocoin(s) caché(s) créé(s)${errCount > 0 ? ` — ❌ ${errCount} en erreur` : ''}. Publication depuis l'onglet « 🚫 Cachées ».`);
  }

  const busy = creating || !!reading;

  return (
    <div>
      <div style={{background:"#2d1810",border:"1.5px solid #e1705566",borderRadius:12,padding:14,marginBottom:14}}>
        <div style={{fontWeight:900,color:"#e17055",fontSize:13,marginBottom:6}}>📦 Création par lot</div>
        <div style={{fontSize:11,color:"#a8bfcf",lineHeight:1.5}}>
          Sélectionnez plusieurs images : chacune devient un geocoin dont le <b>nom est celui du fichier</b> (sans
          extension). Tout le lot est créé <b style={{color:"#e17055"}}>caché</b> — invisible pour les joueurs, exclu des
          totaux, non vendable — puis publiable (immédiatement ou à une date) depuis l'onglet « 🚫 Cachées ».
        </div>
      </div>

      {/* ── Réglages communs au lot ── */}
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>
        <div style={{flex:"1 1 200px"}}>
          <div style={{fontSize:10,color:"#aaa",fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>Catégorie du lot</div>
          <select value={type} onChange={e=>setType(e.target.value)} disabled={busy} style={SEL}>
            {cardTypes.map(tp=><option key={tp} value={tp}>{tp}</option>)}
          </select>
        </div>
        <div style={{flex:"1 1 150px"}}>
          <div style={{fontSize:10,color:"#aaa",fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>Rareté du lot</div>
          <select value={rarity} onChange={e=>setRarity(e.target.value)} disabled={busy} style={SEL}>
            {["commun","rare","épique","légendaire"].map(r=><option key={r} value={r}>{RC[r]?.label||r}</option>)}
          </select>
        </div>
        <div style={{flex:"1 1 220px"}}>
          <div style={{fontSize:10,color:"#aaa",fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>Saison (optionnel)</div>
          <select value={seasonId??''} onChange={e=>setSeasonId(e.target.value===''?null:+e.target.value)} disabled={busy} style={SEL}>
            <option value="">Aucune saison</option>
            {seasons.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── Dépôt des images ── */}
      <div onClick={()=>{ if(!busy) filesRef.current.click(); }}
        style={{border:"2px dashed #ffffff33",borderRadius:9,padding:"18px",textAlign:"center",cursor:busy?"default":"pointer",background:"#ffffff08",marginBottom:12,opacity:busy?.5:1}}
        onMouseEnter={e=>{ if(!busy) e.currentTarget.style.borderColor="#e1705566"; }}
        onMouseLeave={e=>e.currentTarget.style.borderColor="#ffffff33"}>
        <div style={{color:"#8daacc",fontSize:13,fontWeight:700}}>📁 Choisir plusieurs images</div>
        <div style={{fontSize:10,color:"#a8bfcf",marginTop:3}}>PNG carré à fond transparent recommandé · {MAX_FILES} max par lot · le nom du fichier devient le nom du geocoin</div>
      </div>
      <input ref={filesRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{display:"none"}}/>

      {reading && (
        <div style={{fontSize:12,color:"#f9ca24",fontWeight:800,marginBottom:10}}>
          ⏳ Traitement des images… {reading.done}/{reading.total}
        </div>
      )}

      {/* ── Lot en préparation ── */}
      {items.length > 0 && (
        <>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:8}}>
            <div style={{fontSize:11,color:"#a8bfcf",flex:1}}>
              {items.length} image{items.length>1?"s":""} · <b style={{color:"#2ecc71"}}>{pending} à créer</b>
              {skipped>0&&<> · <b style={{color:"#e74c3c"}}>{skipped} ignorée{skipped>1?"s":""}</b></>}
              {created>0&&<> · <b style={{color:"#2ecc71"}}>{created} créée{created>1?"s":""}</b></>}
              {failed>0&&<> · <b style={{color:"#e74c3c"}}>{failed} en erreur</b></>}
            </div>
            <button onClick={()=>{ if(!busy) setItems([]); }} disabled={busy}
              style={{...BTN("#ffffff18"),padding:"5px 12px",fontSize:11,borderRadius:8,opacity:busy?.5:1}}>Vider la liste</button>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:12,maxHeight:340,overflowY:"auto"}}>
            {items.map((it,i)=>{
              const issue = checks[i];
              const done  = it.status === 'created';
              return (
                <div key={it.key} style={{display:"flex",alignItems:"center",gap:8,background:done?"#2ecc7112":issue?"#e74c3c12":"#ffffff08",border:`1px solid ${done?"#2ecc7133":issue?"#e74c3c33":"#ffffff14"}`,borderRadius:8,padding:"5px 8px"}}>
                  <div style={{width:34,height:34,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#0003",borderRadius:6,overflow:"hidden"}}>
                    {it.small ? <img src={it.small} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}}/> : <span style={{fontSize:16,opacity:.4}}>🃏</span>}
                  </div>
                  <input value={it.name} disabled={busy||done} maxLength={MAX_NAME}
                    onChange={e=>setItems(prev=>prev.map((p,j)=>j===i?{...p,name:e.target.value}:p))}
                    style={{...INP,flex:1,minWidth:100,fontSize:12,padding:"5px 8px",opacity:done?.6:1}}/>
                  <div style={{fontSize:10,minWidth:96,textAlign:"right",fontWeight:800,color:done?"#2ecc71":it.status==='error'?"#e74c3c":issue?"#e74c3c":it.status==='creating'?"#f9ca24":"#8daacc"}}
                    title={it.error || issue || it.fileName}>
                    {done ? "✅ créé"
                      : it.status==='creating' ? "⏳ …"
                      : it.status==='error' ? "❌ erreur"
                      : issue ? `⚠️ ${issue}`
                      : "prêt"}
                  </div>
                  {!done && (
                    <button onClick={()=>{ if(!busy) setItems(prev=>prev.filter((_,j)=>j!==i)); }} disabled={busy}
                      title="Retirer du lot"
                      style={{background:"none",border:"none",color:"#e74c3c",cursor:busy?"default":"pointer",fontWeight:900,fontSize:13,padding:"0 2px"}}>✕</button>
                  )}
                </div>
              );
            })}
          </div>

          {items.some((it,i)=>it.status==='error'&&it.error) && (
            <div style={{fontSize:11,color:"#e74c3c",marginBottom:10}}>
              Erreurs : {items.filter(it=>it.status==='error'&&it.error).map(it=>`${it.name} (${it.error})`).join(' · ')}
            </div>
          )}

          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button onClick={createBatch} disabled={busy||pending===0}
              style={{flex:1,minWidth:200,...BTN(busy||pending===0?"#ffffff18":"linear-gradient(135deg,#e17055,#d63031)"),padding:"11px",borderRadius:10,cursor:busy||pending===0?"default":"pointer"}}>
              {creating ? "⏳ Création en cours…" : `🚫 Créer ${pending} geocoin${pending>1?"s":""} caché${pending>1?"s":""}`}
            </button>
            <button onClick={onClose} disabled={creating}
              style={{...BTN("#ffffff18"),padding:"11px",borderRadius:10,opacity:creating?.5:1}}>Fermer</button>
          </div>
        </>
      )}

      {items.length === 0 && (
        <button onClick={onClose} style={{...BTN("#ffffff18"),padding:"9px 18px",borderRadius:10}}>Fermer</button>
      )}
    </div>
  );
}
