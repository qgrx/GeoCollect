import { useState, useRef, useMemo, useEffect } from 'react';
import { INP, SEL, BTN } from '../../utils/styles.js';
import { useT } from '../../i18n/translations.js';
import { RC, cardCC } from '../../data/cards.js';
import { supabase } from '../../lib/supabase.js';

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
  const [selectedType, setSelectedType] = useState(null);
  const [cardTypePage, setCardTypePage] = useState(0);
  const [editCard, setEditCard] = useState(null);
  const [circulation, setCirculation] = useState(null);
  const [nc, setNc] = useState({ name: "", type: cardTypes[0] || "", rarity: "commun", image: null, thumbnail: null, desc: "", sellable: true, minPrice: "" });

  const csvCardRef = useRef();
  const fileRef = useRef();
  const editFileRef = useRef();
  const CARDS_PER_PAGE = 20;

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
        if (mounted && d.data?.circulation !== undefined) setCirculation(d.data.circulation);
      }).catch(() => { if (mounted) setCirculation('?'); });
    });
    return () => { mounted = false; };
  }, [editCard?.id]);

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

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{flex:1,fontWeight:800,color:"#e74c3c",fontSize:14}}>{editCard?"✏️ Éditer une carte":selectedType?`➕ Créer dans « ${selectedType} »`:"🃏 Types de cartes"}</div>
        <button onClick={()=>csvCardRef.current.click()} style={{...BTN("#ffffff18"),padding:"6px 12px",fontSize:11,borderRadius:8}}>📥 Importer CSV/ZIP</button>
        <button onClick={exportCSVCards} style={{...BTN("#ffffff18"),padding:"6px 12px",fontSize:11,borderRadius:8}}>📤 Exporter ZIP</button>
        <input ref={csvCardRef} type="file" accept=".csv,.zip" onChange={handleCSVCards} style={{display:"none"}}/>
      </div>
      {(selectedType||editCard)&&(
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:14,fontSize:12,color:"#888"}}>
          <button onClick={()=>{setSelectedType(null);setEditCard(null);setNc({name:"",type:cardTypes[0]||"",rarity:"commun",image:null,thumbnail:null,desc:"",sellable:true,minPrice:""});if(fileRef.current)fileRef.current.value='';if(editFileRef.current)editFileRef.current.value='';}} style={{background:"none",border:"none",color:"#e74c3c",fontWeight:800,fontSize:12,cursor:"pointer",fontFamily:"'Nunito',sans-serif",padding:0}}>Tous les types</button>
          {selectedType&&<><span>›</span><button onClick={()=>{setEditCard(null);setNc({name:"",type:selectedType,rarity:"commun",image:null,thumbnail:null,desc:"",sellable:true,minPrice:""});if(fileRef.current)fileRef.current.value='';if(editFileRef.current)editFileRef.current.value='';}} disabled={!editCard} style={{background:"none",border:"none",color:"#fff",fontWeight:700,fontSize:12,cursor:editCard?"pointer":"default",fontFamily:"'Nunito',sans-serif",padding:0}}>{selectedType} ({cardPool.filter(c=>c.type===selectedType).length})</button></>}
          {editCard&&<><span>›</span><span style={{color:"#f9ca24",fontWeight:700}}>✏️ {editCard.name} {circulation!==null&&<span style={{color:"#aaa",fontSize:11,fontWeight:600,marginLeft:4}}>({circulation} en circulation)</span>}</span></>}
        </div>
      )}
      {!selectedType&&!editCard&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,marginBottom:16}}>
          {cardTypes.map(type=>{
            const count=cardPool.filter(c=>c.type===type).length;
            return(
              <button key={type} onClick={()=>{setSelectedType(type);setEditCard(null);setNc({name:"",type:type,rarity:"commun",image:null,thumbnail:null,desc:"",sellable:true,minPrice:""});if(fileRef.current)fileRef.current.value='';if(editFileRef.current)editFileRef.current.value='';}} style={{background:"#ffffff0a",border:"1.5px solid #ffffff18",borderRadius:12,padding:"14px 10px",cursor:"pointer",fontFamily:"'Nunito',sans-serif",textAlign:"center",transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.background="#e74c3c18";e.currentTarget.style.borderColor="#e74c3c66";}} onMouseLeave={e=>{e.currentTarget.style.background="#ffffff0a";e.currentTarget.style.borderColor="#ffffff18";}}>
                <div style={{fontSize:22,marginBottom:5}}>🃏</div>
                <div style={{fontWeight:900,color:"#fff",fontSize:13,marginBottom:3}}>{type}</div>
                <div style={{fontSize:11,color:"#888",fontWeight:700}}>{count} carte{count!==1?"s":""}</div>
              </button>
            );
          })}
        </div>
      )}
      {selectedType&&!editCard&&(()=>{
        const typeCards=cardPool.filter(c=>c.type===selectedType); const totalPages=Math.ceil(typeCards.length/CARDS_PER_PAGE); const pg=Math.min(cardTypePage,Math.max(0,totalPages-1)); const slice=typeCards.slice(pg*CARDS_PER_PAGE,(pg+1)*CARDS_PER_PAGE);
        return(
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:11,color:"#888"}}>{t("admin_click_to_edit")} · {typeCards.length} cartes</div>
              {totalPages>1&&(<div style={{display:"flex",alignItems:"center",gap:5}}><button onClick={()=>setCardTypePage(p=>Math.max(0,p-1))} disabled={pg===0} style={{background:pg===0?"#ffffff0a":"#ffffff18",border:"none",color:pg===0?"#444":"#fff",width:22,height:22,borderRadius:6,cursor:pg===0?"default":"pointer",fontWeight:900,fontSize:12}}>‹</button><span style={{fontSize:10,color:"#666",fontWeight:700}}>{pg+1}/{totalPages}</span><button onClick={()=>setCardTypePage(p=>Math.min(totalPages-1,p+1))} disabled={pg===totalPages-1} style={{background:pg===totalPages-1?"#ffffff0a":"#ffffff18",border:"none",color:pg===totalPages-1?"#444":"#fff",width:22,height:22,borderRadius:6,cursor:pg===totalPages-1?"default":"pointer",fontWeight:900,fontSize:12}}>›</button></div>)}
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
              {slice.map(c=>(<button key={c.id} onClick={()=>setEditCard({...c})} style={{background:"#ffffff12",border:"1px solid #ffffff22",color:"#fff",padding:"4px 10px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:700,fontSize:11,cursor:"pointer"}}>{c.name}</button>))}
              {typeCards.length===0&&<div style={{color:"#555",fontSize:12,fontStyle:"italic"}}>Aucune carte dans ce type.</div>}
            </div>
          </div>
        );
      })()}
      {(selectedType||editCard)&&(
        <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:240}}>
            {[["Nom de la carte","name","ex: Frostpike"],["Description","desc","Courte description…"]].map(([label,key,ph])=>(<Fld key={key} lbl={label}><input value={editCard?editCard[key]:nc[key]} onChange={e=>{editCard?setEditCard({...editCard,[key]:e.target.value}):setNc({...nc,[key]:e.target.value});}} placeholder={ph} style={INP}/></Fld>))}
            <Fld lbl="Type"><select value={editCard?editCard.type:nc.type} onChange={e=>{editCard?setEditCard({...editCard,type:e.target.value}):setNc({...nc,type:e.target.value});}} style={SEL}>{cardTypes.map(tp=><option key={tp} value={tp}>{tp}</option>)}</select></Fld>
            <Fld lbl="Rareté (définit les couleurs)"><select value={editCard?editCard.rarity:nc.rarity} onChange={e=>{editCard?setEditCard({...editCard,rarity:e.target.value}):setNc({...nc,rarity:e.target.value});}} style={SEL}>{["commun","rare","épique","légendaire"].map(r=><option key={r} value={r}>{RC[r].label}</option>)}</select><div style={{marginTop:5,height:6,borderRadius:3,background:`linear-gradient(90deg,${c1p},${c2p})`,transition:"background .3s"}}/></Fld>
            <Fld lbl="Image PNG"><div onClick={()=>(editCard?editFileRef:fileRef).current.click()} style={{border:"2px dashed #ffffff33",borderRadius:9,padding:"13px",textAlign:"center",cursor:"pointer",background:"#ffffff08"}} onMouseEnter={e=>e.currentTarget.style.borderColor="#f9ca2466"} onMouseLeave={e=>e.currentTarget.style.borderColor="#ffffff33"}>{(editCard?editCard.image:nc.image)?<img src={editCard?editCard.image:nc.image} style={{maxWidth:"100%",maxHeight:80,objectFit:"contain",borderRadius:5}} alt="prev"/>:<div style={{color:"#888",fontSize:12}}>📁 Choisir un PNG<br/><span style={{fontSize:10,color:"#555"}}>Carré, fond transparent recommandé</span></div>}</div><input ref={editCard?editFileRef:fileRef} type="file" accept=".png,image/png" onChange={e=>{const src=editCard||nc;imgUpload(e,({imageBase64, thumbnailBase64})=>editCard?setEditCard({...editCard,image:imageBase64,thumbnail:thumbnailBase64}):setNc({...nc,image:imageBase64,thumbnail:thumbnailBase64}),{name:src.name||'',type:src.type||'',rarity:src.rarity||''});}} style={{display:"none"}}/></Fld>
            <Fld lbl="Options de vente"><label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:7}}><input type="checkbox" checked={editCard?editCard.sellable!==false:nc.sellable} onChange={e=>{editCard?setEditCard({...editCard,sellable:e.target.checked}):setNc({...nc,sellable:e.target.checked});}} style={{width:16,height:16}}/><span style={{color:"#fff",fontSize:13,fontWeight:700}}>Carte vendable</span></label><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{color:"#aaa",fontSize:12}}>Prix minimum :</span><input type="text" inputMode="numeric" placeholder="Aucun" value={editCard?editCard.minPrice??'':nc.minPrice??''} onChange={e=>{const raw=e.target.value.replace(/[^0-9]/g,'');const v=raw===''?null:+raw;editCard?setEditCard({...editCard,minPrice:v??''}):setNc({...nc,minPrice:v??''});}} style={{...INP,width:80}}/><span style={{color:"#aaa",fontSize:12}}>G</span></div></Fld>
            <div style={{display:"flex",gap:8,marginTop:4}}>{editCard?(<><button onClick={async()=>{if(!editCard.name.trim()){setMsg("❌ Nom requis.");return;}const payload={...editCard, image_url: editCard.image, image_url_thumb: editCard.thumbnail}; if(payload.minPrice!==undefined){payload.min_price=payload.minPrice; delete payload.minPrice;} delete payload.image; delete payload.thumbnail; const err=await onEditCard(payload);if(err){setMsg("❌ "+err);return;}onUpdateCardInPool?.(payload);setEditCard(null);setSelectedType(payload.type);setNc({name:"",type:payload.type,rarity:"commun",image:null,thumbnail:null,desc:"",sellable:true,minPrice:""});if(editFileRef.current)editFileRef.current.value='';if(fileRef.current)fileRef.current.value='';setMsg(`✅ "${editCard.name}" mis à jour !`);}} style={{flex:1,...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"11px",borderRadius:10}}>Enregistrer ✏️</button><button onClick={()=>{setEditCard(null);setNc({name:"",type:selectedType||cardTypes[0]||"",rarity:"commun",image:null,thumbnail:null,desc:"",sellable:true,minPrice:""});if(editFileRef.current)editFileRef.current.value='';if(fileRef.current)fileRef.current.value='';}} style={{...BTN("#ffffff18"),padding:"11px",borderRadius:10}}>Annuler</button><button onClick={async()=>{if(!window.confirm(`Supprimer définitivement "${editCard.name}" ?`)) return;const name=editCard.name; const type=editCard.type;const err=await onDeleteCard(editCard.id);if(err){setMsg("❌ "+err);return;}setEditCard(null);setSelectedType(type);setNc({name:"",type:type,rarity:"commun",image:null,thumbnail:null,desc:"",sellable:true,minPrice:""});if(editFileRef.current)editFileRef.current.value='';if(fileRef.current)fileRef.current.value='';setMsg(`✅ "${name}" supprimée.`);}} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)","#fff"),padding:"11px",borderRadius:10}} title="Supprimer cette carte">🗑️</button></>):(<button onClick={async()=>{if(!nc.name.trim()){setMsg("❌ Nom requis.");return;}const payload={name:nc.name.trim(), type:nc.type||selectedType||cardTypes[0]||"", rarity:nc.rarity, image_url:nc.image, image_url_thumb:nc.thumbnail, desc:nc.desc, sellable:nc.sellable, min_price:nc.minPrice||null}; const err=await onAddCard(payload);if(err){setMsg("❌ "+err);return;}setMsg(`✅ "${nc.name}" créée !`);setSelectedType(payload.type);setNc({name:"",type:payload.type,rarity:"commun",image:null,thumbnail:null,desc:"",sellable:true,minPrice:""});if(fileRef.current)fileRef.current.value='';}} style={{flex:1,...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"11px",borderRadius:10}}>{t("admin_create_card")}</button>)}</div>
          </div>
          <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:7}}><div style={{fontSize:10,color:"#888",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Aperçu</div>{(()=>{const src=editCard||nc;const {c1,c2}=cardCC(src.rarity);const isLeg=src.rarity==="légendaire";return(<div style={{position:"relative",width:148,height:190,borderRadius:16,border:isLeg?`2px solid ${c1}`:`1.5px solid ${c1}66`,boxShadow:isLeg?`0 0 20px ${c1}66,0 4px 20px #0004`:"0 4px 14px #0003",overflow:"hidden",background:src.image?"transparent":`linear-gradient(145deg,${c1}44,${c2}66)`,fontFamily:"'Nunito',sans-serif"}}>{isLeg&&<div style={{position:"absolute",inset:0,borderRadius:16,zIndex:2,background:"linear-gradient(135deg,transparent 40%,#ffffff1a 50%,transparent 60%)",backgroundSize:"400px 100%",animation:"shimmer 2.5s linear infinite",pointerEvents:"none"}}/>}<div style={{position:"absolute",inset:0,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:6}}>{src.image?<img src={src.image} style={{width:"100%",height:"88%",objectFit:"contain"}} alt=""/>:<div style={{fontSize:52,opacity:.22,marginTop:40}}>🃏</div>}</div><div style={{position:"absolute",bottom:0,left:0,right:0,zIndex:3,background:`linear-gradient(to top,${c1}ee 0%,${c1}99 50%,transparent 100%)`,padding:"28px 8px 7px",textAlign:"center"}}><div style={{fontWeight:900,fontSize:13,color:"#fff",textShadow:"0 1px 4px #0008",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",letterSpacing:.3}}>{src.name||"Nom"}</div></div><div style={{position:"absolute",bottom:0,left:0,right:0,zIndex:4,height:4,background:`linear-gradient(90deg,${c1},${c2})`}}/>{src.sellable===false&&<div style={{position:"absolute",top:5,left:5,zIndex:5,background:"#e74c3ccc",color:"#fff",fontSize:8,fontWeight:800,borderRadius:4,padding:"2px 5px"}}>NON VENDABLE</div>}{src.minPrice>0&&<div style={{position:"absolute",top:5,right:5,zIndex:5,background:"#f39c12cc",color:"#fff",fontSize:8,fontWeight:800,borderRadius:4,padding:"2px 5px"}}>MIN {src.minPrice}G</div>}</div>);})()}</div>
        </div>
      )}
    </div>
  );
}