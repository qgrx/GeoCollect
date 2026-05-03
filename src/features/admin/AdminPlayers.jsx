import { useState } from 'react';
import { INP, BTN } from '../../utils/styles.js';
import { useT } from '../../i18n/translations.js';
import { PAGE_SIZE } from '../../data/constants.js';
import { 
  apiAdminSetCanSell, apiAdminReactivate, apiAdminSetGold, 
  apiAdminGetPlayerCollection, apiAdminGiveCard, apiAdminTakeCard 
} from '../../services/api.js';

export default function AdminPlayers({ players, cardPool, limEdit, onTogglePlayer, onBanIP, setTab, setMsg }) {
  const { t } = useT();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [playerView, setPlayerView] = useState(null);
  const [canSellOverrides, setCanSellOverrides] = useState({});
  const [playerGoldEdit, setPlayerGoldEdit] = useState('');
  const [playerCollection, setPlayerCollection] = useState(null);
  const [cardSearch2, setCardSearch2] = useState('');

  const filtered = players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.ip.includes(search));
  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  const pagPl = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      {playerView?(
        <div>
          <button onClick={()=>{setPlayerView(null);setPlayerGoldEdit('');setPlayerCollection(null);setCardSearch2('');}} style={{background:"none",border:"none",color:"#888",fontSize:12,cursor:"pointer",fontFamily:"'Nunito',sans-serif",marginBottom:12}}>← Retour</button>
          <div style={{fontWeight:900,color:"#e74c3c",fontSize:15,marginBottom:14}}>Fiche de {playerView.name}</div>
          {[["Email",playerView.email],["IP",playerView.ip],["UA",playerView.ua],["Inscrit",playerView.joined],["Dernière co.",playerView.lastSeen],["Statut",playerView.status]].map(([lbl,val])=>(
            <div key={lbl} style={{display:"flex",gap:12,marginBottom:8}}><div style={{fontSize:11,color:"#888",width:100,flexShrink:0}}>{lbl}</div><div style={{fontSize:12,color:"#fff",fontWeight:700,fontFamily:lbl==="IP"||lbl==="UA"?"monospace":"inherit",wordBreak:"break-all"}}>{val}</div></div>
          ))}
          <div style={{marginTop:14,display:"flex",gap:8,flexWrap:"wrap"}}>
            <button onClick={async()=>{
              const current=canSellOverrides[playerView.id]??playerView.can_sell; const next=current===false;
              const{error}=await apiAdminSetCanSell(playerView.id,next);
              if(!error){ setCanSellOverrides(prev=>({...prev,[playerView.id]:next})); setPlayerView({...playerView,can_sell:next}); setMsg(next?"✅ Vente autorisée.":"⛔ Vente interdite."); } else setMsg("❌ "+error);
            }} style={{...BTN((canSellOverrides[playerView.id]??playerView.can_sell)===false?"linear-gradient(135deg,#00b894,#00cec9)":"linear-gradient(135deg,#e17055,#d63031)"),padding:"8px 14px",borderRadius:9,fontSize:12}}>
              {(canSellOverrides[playerView.id]??playerView.can_sell)===false?"✅ Autoriser la vente":"⛔ Interdire la vente"}
            </button>
            {(playerView.status==="supprimé"||playerView.deleted_at)&&(
              <button onClick={async()=>{
                const{error}=await apiAdminReactivate(playerView.id);
                if(!error){setPlayerView({...playerView,status:"actif",deleted_at:null});setMsg("✅ Compte réactivé.");} else setMsg("❌ "+error);
              }} style={{...BTN("linear-gradient(135deg,#00b894,#00cec9)"),padding:"8px 14px",borderRadius:9,fontSize:12}}>🔄 Réactiver le compte</button>
            )}
            {playerView.status!=="supprimé"&&!playerView.deleted_at&&(<div style={{fontSize:10,color:"#444",alignSelf:"center"}}>Compte actif — le joueur peut se désactiver depuis ses paramètres</div>)}
          </div>
          
          <div style={{marginTop:16,background:"#ffffff08",borderRadius:10,padding:"12px 14px",border:"1px solid #ffffff10"}}>
            <div style={{fontWeight:800,color:"#f9ca24",fontSize:12,marginBottom:8}}>💰 Or actuel : {playerView.gold??'—'}G</div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input type="text" inputMode="numeric" placeholder="Nouveau montant" value={playerGoldEdit} onChange={e=>setPlayerGoldEdit(e.target.value.replace(/[^0-9]/g,''))} style={{...INP,width:120}}/><span style={{color:"#aaa",fontSize:12}}>G</span>
              <button onClick={async()=>{
                const g=+playerGoldEdit; if(isNaN(g)||g<0){setMsg("❌ Montant invalide.");return;}
                const{error}=await apiAdminSetGold(playerView.id,g); if(error){setMsg("❌ "+error);return;}
                setPlayerView({...playerView,gold:g}); setPlayerGoldEdit(''); setMsg(`✅ Or de ${playerView.pseudo} → ${g}G`);
              }} style={{...BTN("linear-gradient(135deg,#f9ca24,#e17055)","#1a1a2e"),padding:"7px 14px",borderRadius:8,fontSize:12}}>Appliquer</button>
            </div>
          </div>

          <div style={{marginTop:12,background:"#ffffff08",borderRadius:10,padding:"12px 14px",border:"1px solid #ffffff10"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontWeight:800,color:"#a29bfe",fontSize:12}}>🃏 Collection</div>
              {!playerCollection&&(<button onClick={async()=>{const{data}=await apiAdminGetPlayerCollection(playerView.id);if(data?.collection) setPlayerCollection(data.collection);}} style={{...BTN("#ffffff18"),padding:"5px 11px",borderRadius:7,fontSize:11}}>Charger</button>)}
            </div>
            {playerCollection&&(
              <>
                <input value={cardSearch2} onChange={e=>setCardSearch2(e.target.value)} placeholder="Rechercher une carte à ajouter…" style={{...INP,marginBottom:8,fontSize:11}}/>
                {cardSearch2.trim()&&(
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
                    {cardPool.filter(c=>c.type!=='Achievement'&&c.name.toLowerCase().includes(cardSearch2.toLowerCase())).slice(0,12).map(c=>{
                      const inCol=playerCollection.find(x=>x.card_id===c.id);
                      return(
                        <div key={c.id} style={{display:"flex",alignItems:"center",gap:5,background:"#ffffff0a",border:"1px solid #ffffff14",borderRadius:7,padding:"4px 8px"}}>
                          <span style={{fontSize:11,color:"#fff",fontWeight:700}}>{c.name}</span>{inCol&&<span style={{fontSize:9,color:"#aaa"}}>×{inCol.quantity}</span>}
                          <button onClick={async()=>{
                            const{error}=await apiAdminGiveCard(playerView.id,c.id); if(error){setMsg("❌ "+error);return;}
                            setPlayerCollection(prev=>{const ex=prev.find(x=>x.card_id===c.id);return ex?prev.map(x=>x.card_id===c.id?{...x,quantity:x.quantity+1}:x):[...prev,{card_id:c.id,quantity:1,cards:c}];});
                            setMsg(`✅ ${c.name} ajoutée à ${playerView.pseudo}`);
                          }} style={{background:"#00b89422",border:"1px solid #00b89444",color:"#00b894",padding:"2px 7px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"'Nunito',sans-serif",fontWeight:800}}>+1</button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{display:"flex",flexWrap:"wrap",gap:5,maxHeight:140,overflowY:"auto"}}>
                  {playerCollection.length===0&&<div style={{fontSize:11,color:"#555"}}>Collection vide.</div>}
                  {playerCollection.map(x=>(
                    <div key={x.card_id} style={{display:"flex",alignItems:"center",gap:4,background:"#ffffff0a",border:"1px solid #ffffff12",borderRadius:7,padding:"3px 8px"}}>
                      <span style={{fontSize:11,color:"#ccc",fontWeight:700}}>{x.cards?.name||`#${x.card_id}`}</span><span style={{fontSize:10,color:"#888"}}>×{x.quantity}</span>
                      <button onClick={async()=>{
                        const{error}=await apiAdminTakeCard(playerView.id,x.card_id); if(error){setMsg("❌ "+error);return;}
                        setPlayerCollection(prev=>{const ex=prev.find(p=>p.card_id===x.card_id);if(ex?.quantity<=1) return prev.filter(p=>p.card_id!==x.card_id);return prev.map(p=>p.card_id===x.card_id?{...p,quantity:p.quantity-1}:p);});
                      }} style={{background:"#e74c3c22",border:"none",color:"#e74c3c",padding:"1px 5px",borderRadius:4,fontSize:10,cursor:"pointer",fontFamily:"'Nunito',sans-serif",fontWeight:900}}>−</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      ):(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:11,flexWrap:"wrap",gap:8}}><div style={{fontWeight:900,color:"#e74c3c",fontSize:14}}>👤 Joueurs ({players.length})</div><input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="Nom ou IP…" style={{...INP,width:200}}/></div>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {pagPl.map(p=>{const banned=p.status==="banni";return(<div key={p.name} style={{display:"flex",alignItems:"center",gap:7,background:banned?"#e74c3c0a":"#ffffff07",border:banned?"1px solid #e74c3c33":"1px solid #ffffff0e",borderRadius:9,padding:"8px 12px",flexWrap:"wrap"}}><button onClick={()=>setPlayerView(p)} style={{width:30,height:30,borderRadius:"50%",background:banned?"#444":"linear-gradient(135deg,#6c5ce7,#a29bfe)",border:"none",color:"#fff",fontSize:12,fontWeight:900,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{p.name[0]}</button><div style={{flex:1,minWidth:100}}><button onClick={()=>setPlayerView(p)} style={{background:"none",border:"none",color:banned?"#666":"#fff",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"'Nunito',sans-serif",textDecoration:banned?"line-through":"none",padding:0}}>{p.name}</button><div style={{display:"flex",gap:6,alignItems:"center",marginTop:1,flexWrap:"wrap"}}>{p.score!=null&&(()=>{const ranks=limEdit.playerRanks||[];const rank=[...ranks].sort((a,b)=>b.min-a.min).find(r=>p.score>=r.min)||ranks[0];return rank?<span style={{fontSize:9,color:rank.color,fontWeight:800}}>{rank.icon} {rank.label} · {p.score}pts</span>:null;})()}{p.gold!=null&&<span style={{fontSize:9,color:"#f9ca24",fontWeight:700}}>{p.gold}G</span>}{(p.can_sell)===false&&<span style={{fontSize:9,background:"#e74c3c22",color:"#e74c3c",borderRadius:50,padding:"1px 6px",fontWeight:700}}>vente interdite</span>}</div><div style={{fontSize:9,color:"#333",fontFamily:"monospace",marginTop:1}}>{p.ip} · {p.lastSeen}</div></div><div style={{fontSize:10,color:banned?"#e74c3c":"#00b894",fontWeight:700}}>{banned?"🔴":"🟢"}</div><div style={{display:"flex",gap:5}}><button onClick={()=>onTogglePlayer(p.name)} style={{background:banned?"#00b89422":"#e74c3c22",border:`1px solid ${banned?"#00b89444":"#e74c3c44"}`,color:banned?"#00b894":"#e74c3c",padding:"4px 10px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:10,cursor:"pointer"}}>{banned?"Réactiver":"Désactiver"}</button>{!banned&&<button onClick={()=>{onBanIP(p.ip);setMsg(`IP ${p.ip} bannie.`);setTab("ips");}} style={{background:"#e74c3c22",border:"1px solid #e74c3c44",color:"#e74c3c",padding:"4px 10px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:10,cursor:"pointer"}}>🌐 IP</button>}</div></div>);})}
            {pagPl.length===0&&<div style={{color:"#666",textAlign:"center",padding:"16px 0"}}>{t("admin_no_player")}</div>}
          </div>
          {pages>1&&<div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:8,marginTop:11}}><button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{background:page===0?"#222":"#ffffff22",border:"none",color:page===0?"#444":"#fff",padding:"5px 12px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:page===0?"default":"pointer"}}>{t("lb_prev")}</button><span style={{fontSize:11,color:"#888"}}>Page {page+1}/{pages}</span><button onClick={()=>setPage(p=>Math.min(pages-1,p+1))} disabled={page===pages-1} style={{background:page===pages-1?"#222":"#ffffff22",border:"none",color:page===pages-1?"#444":"#fff",padding:"5px 12px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:page===pages-1?"default":"pointer"}}>{t("lb_next")}</button></div>}
        </div>
      )}
    </div>
  );
}