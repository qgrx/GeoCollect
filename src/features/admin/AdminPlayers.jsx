import { useState, useEffect } from 'react';
import { INP, BTN } from '../../utils/styles.js';
import { useT } from '../../i18n/translations.js';
import { PAGE_SIZE } from '../../data/constants.js';
import { supabase } from '../../lib/supabase.js';
import { 
  apiAdminSetCanSell, apiAdminReactivate, apiAdminSetGold, 
  apiAdminGetPlayerCollection, apiAdminGiveCard, apiAdminTakeCard 
} from '../../services/api.js';

export default function AdminPlayers({ cardPool, limEdit, onBanIP, setTab, setMsg }) {
  const { t } = useT();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [playerView, setPlayerView] = useState(null);
  const [canSellOverrides, setCanSellOverrides] = useState({});
  const [playerGoldEdit, setPlayerGoldEdit] = useState('');
  const [playerCollection, setPlayerCollection] = useState(null);
  const [cardSearch2, setCardSearch2] = useState('');
  const [playersData, setPlayersData] = useState({ players: [], total: 0, loading: false });

  useEffect(() => {
    let mounted = true;
    setPlayersData(prev => ({ ...prev, loading: true }));
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      fetch(`${import.meta.env.VITE_API_URL}/api/admin/players?page=${page}&q=${encodeURIComponent(search)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      .then(r => r.json())
      .then(d => {
        if (!mounted) return;
        if (d.players) {
          const mapped = d.players.map(p => ({
            ...p,
            name: p.pseudo || p.name || '?',
            joined: p.joined_at ? new Date(p.joined_at).toLocaleDateString('fr-FR') : '?',
            lastSeen: p.last_seen_at ? new Date(p.last_seen_at).toLocaleDateString('fr-FR') : '?',
            ip: p.ip || 'Inconnue',
            ua: p.ua || 'Inconnu'
          }));
          setPlayersData({ players: mapped, total: d.total || 0, loading: false });
        } else {
          setPlayersData(prev => ({ ...prev, loading: false }));
        }
      })
      .catch(() => {
        if (mounted) setPlayersData(prev => ({ ...prev, loading: false }));
      });
    });
    return () => { mounted = false; };
  }, [page, search]);

  const pages = Math.ceil(playersData.total / 10);
  const pagPl = playersData.players;

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
              setCanSellOverrides(prev=>({...prev,[playerView.id]:next}));
              setPlayerView({...playerView,can_sell:next});
              setPlayersData(prev => ({ ...prev, players: prev.players.map(x => x.id === playerView.id ? { ...x, can_sell: next } : x) }));
              const{data,error}=await apiAdminSetCanSell(playerView.id,next);
              if(error){
                setCanSellOverrides(prev=>({...prev,[playerView.id]:current}));
                setPlayerView({...playerView,can_sell:current});
                setPlayersData(prev => ({ ...prev, players: prev.players.map(x => x.id === playerView.id ? { ...x, can_sell: current } : x) }));
                setMsg("❌ "+error);return;
              }
              const actual=data?.can_sell??next;
              if(actual!==next){
                setCanSellOverrides(prev=>({...prev,[playerView.id]:actual}));
                setPlayerView({...playerView,can_sell:actual});
                setPlayersData(prev => ({ ...prev, players: prev.players.map(x => x.id === playerView.id ? { ...x, can_sell: actual } : x) }));
              }
              setMsg(actual?"✅ Vente autorisée.":"⛔ Vente interdite.");
            }} style={{...BTN((canSellOverrides[playerView.id]??playerView.can_sell)===false?"linear-gradient(135deg,#00b894,#00cec9)":"linear-gradient(135deg,#e17055,#d63031)"),padding:"8px 14px",borderRadius:9,fontSize:12}}>
              {(canSellOverrides[playerView.id]??playerView.can_sell)===false?"✅ Autoriser la vente":"⛔ Interdire la vente"}
            </button>
            {(playerView.status==="supprimé"||playerView.deleted_at)&&(
              <button onClick={async()=>{
                const{data,error}=await apiAdminReactivate(playerView.id);
                if(error){setMsg("❌ "+error);return;}
                setPlayerView({...playerView,status:data?.status??"actif",deleted_at:data?.deleted_at??null});
                setPlayersData(prev => ({ ...prev, players: prev.players.map(x => x.id === playerView.id ? { ...x, status: data?.status??"actif", deleted_at: data?.deleted_at??null } : x) }));
                setMsg("✅ Compte réactivé.");
              }} style={{...BTN("linear-gradient(135deg,#00b894,#00cec9)"),padding:"8px 14px",borderRadius:9,fontSize:12}}>🔄 Réactiver le compte</button>
            )}
            <button onClick={async()=>{
              if(!window.confirm(`Supprimer DÉFINITIVEMENT le joueur ${playerView.name} ?\nToutes ses annonces en cours, son or et sa collection seront effacés.`)) return;
              const { data: { session } } = await supabase.auth.getSession();
              const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/players/${playerView.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } });
              const d = await res.json();
              if (d.error) { setMsg("❌ " + d.error); return; }
              setPlayersData(prev => ({ ...prev, players: prev.players.filter(x => x.id !== playerView.id), total: prev.total - 1 }));
              setPlayerView(null);
              setMsg(`✅ Compte ${playerView.name} supprimé définitivement.`);
            }} style={{...BTN("linear-gradient(135deg,#e74c3c,#c0392b)"),padding:"8px 14px",borderRadius:9,fontSize:12}}>🗑️ Supprimer définitivement</button>
            {playerView.status!=="supprimé"&&!playerView.deleted_at&&(<div style={{fontSize:10,color:"#444",alignSelf:"center"}}>Compte actif — le joueur peut se désactiver depuis ses paramètres</div>)}
          </div>
          
          <div style={{marginTop:16,background:"#ffffff08",borderRadius:10,padding:"12px 14px",border:"1px solid #ffffff10"}}>
            <div style={{fontWeight:800,color:"#f9ca24",fontSize:12,marginBottom:8}}>💰 Or actuel : {playerView.gold??'—'}G</div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input type="text" inputMode="numeric" placeholder="Nouveau montant" value={playerGoldEdit} onChange={e=>setPlayerGoldEdit(e.target.value.replace(/[^0-9]/g,''))} style={{...INP,width:120}}/><span style={{color:"#aaa",fontSize:12}}>G</span>
              <button onClick={async()=>{
                const g=+playerGoldEdit; if(isNaN(g)||g<0){setMsg("❌ Montant invalide.");return;}
                const oldGold=playerView.gold;
                setPlayerView({...playerView,gold:g}); setPlayerGoldEdit('');
                const{data,error}=await apiAdminSetGold(playerView.id,g); 
                if(error){setPlayerView({...playerView,gold:oldGold});setPlayerGoldEdit(g.toString());setMsg("❌ "+error);return;}
                const actual=data?.gold??g;
                if(actual!==g) { setPlayerView({...playerView,gold:actual}); setPlayersData(prev => ({ ...prev, players: prev.players.map(x => x.id === playerView.id ? { ...x, gold: actual } : x) })); }
                else { setPlayersData(prev => ({ ...prev, players: prev.players.map(x => x.id === playerView.id ? { ...x, gold: actual } : x) })); }
                setMsg(`✅ Or de ${playerView.name} → ${actual}G`);
              }} style={{...BTN("linear-gradient(135deg,#f9ca24,#e17055)","#1e3045"),padding:"7px 14px",borderRadius:8,fontSize:12}}>Appliquer</button>
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
                            setPlayerCollection(prev=>{const ex=prev.find(x=>x.card_id===c.id);return ex?prev.map(x=>x.card_id===c.id?{...x,quantity:x.quantity+1}:x):[...prev,{card_id:c.id,quantity:1,cards:c}];});
                            const{error}=await apiAdminGiveCard(playerView.id,c.id); 
                            if(error){
                              setPlayerCollection(prev=>{const ex=prev.find(x=>x.card_id===c.id);if(ex?.quantity<=1)return prev.filter(x=>x.card_id!==c.id);return prev.map(x=>x.card_id===c.id?{...x,quantity:x.quantity-1}:x);});
                              setMsg("❌ "+error);return;
                            }
                            setMsg(`✅ ${c.name} ajoutée à ${playerView.name}`);
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
                        const ex=playerCollection.find(p=>p.card_id===x.card_id);
                        setPlayerCollection(prev=>{const ex=prev.find(p=>p.card_id===x.card_id);if(ex?.quantity<=1) return prev.filter(p=>p.card_id!==x.card_id);return prev.map(p=>p.card_id===x.card_id?{...p,quantity:p.quantity-1}:p);});
                        const{error}=await apiAdminTakeCard(playerView.id,x.card_id); 
                        if(error){
                          setPlayerCollection(prev=>{const p=prev.find(p=>p.card_id===x.card_id);return p?prev.map(p=>p.card_id===x.card_id?{...p,quantity:p.quantity+1}:p):[...prev,{...ex,quantity:1}];});
                          setMsg("❌ "+error);return;
                        }
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
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:11,flexWrap:"wrap",gap:8}}><div style={{fontWeight:900,color:"#e74c3c",fontSize:14}}>👤 Joueurs ({playersData.total})</div><input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="Nom ou IP…" style={{...INP,width:200}}/></div>
          {playersData.loading ? (
            <div style={{ textAlign: "center", color: "#888", padding: "16px 0" }}>Chargement…</div>
          ) : (
            <>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {pagPl.map(p=>{const banned=p.status==="banni";return(<div key={p.id} style={{display:"flex",alignItems:"center",gap:7,background:banned?"#e74c3c0a":"#ffffff07",border:banned?"1px solid #e74c3c33":"1px solid #ffffff0e",borderRadius:9,padding:"8px 12px",flexWrap:"wrap"}}><button onClick={()=>setPlayerView(p)} style={{width:30,height:30,borderRadius:"50%",background:banned?"#444":"linear-gradient(135deg,#6c5ce7,#a29bfe)",border:"none",color:"#fff",fontSize:12,fontWeight:900,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{p.name[0]}</button><div style={{flex:1,minWidth:100}}><button onClick={()=>setPlayerView(p)} style={{background:"none",border:"none",color:banned?"#666":"#fff",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"'Nunito',sans-serif",textDecoration:banned?"line-through":"none",padding:0}}>{p.name}</button><div style={{display:"flex",gap:6,alignItems:"center",marginTop:1,flexWrap:"wrap"}}>{p.score!=null&&(()=>{const ranks=limEdit.playerRanks||[];const rank=[...ranks].sort((a,b)=>b.min-a.min).find(r=>p.score>=r.min)||ranks[0];return rank?<span style={{fontSize:9,color:rank.color,fontWeight:800}}>{rank.icon} {rank.label} · {p.score}pts</span>:null;})()}{p.gold!=null&&<span style={{fontSize:9,color:"#f9ca24",fontWeight:700}}>{p.gold}G</span>}{(p.can_sell)===false&&<span style={{fontSize:9,background:"#e74c3c22",color:"#e74c3c",borderRadius:50,padding:"1px 6px",fontWeight:700}}>vente interdite</span>}</div><div style={{fontSize:9,color:"#333",fontFamily:"monospace",marginTop:1}}>{p.ip} · {p.lastSeen}</div></div><div style={{fontSize:10,color:banned?"#e74c3c":"#00b894",fontWeight:700}}>{banned?"🔴":"🟢"}</div><div style={{display:"flex",gap:5}}><button onClick={async()=>{
                  const newStatus = banned ? "actif" : "banni";
                  setPlayersData(prev => ({ ...prev, players: prev.players.map(x => x.id === p.id ? { ...x, status: newStatus } : x) }));
                  const { data: { session } } = await supabase.auth.getSession();
                  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/players/${p.id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({ status: newStatus })
                  });
                  const d = await res.json();
                  if (d.error) {
                    setPlayersData(prev => ({ ...prev, players: prev.players.map(x => x.id === p.id ? { ...x, status: p.status } : x) }));
                    setMsg("❌ " + d.error);
                  } else {
                    setMsg(banned ? "✅ Compte réactivé." : "⛔ Compte banni.");
                  }
                }} style={{background:banned?"#00b89422":"#e74c3c22",border:`1px solid ${banned?"#00b89444":"#e74c3c44"}`,color:banned?"#00b894":"#e74c3c",padding:"4px 10px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:10,cursor:"pointer"}}>{banned?"Réactiver":"Désactiver"}</button>{!banned&&<button onClick={()=>{onBanIP(p.ip);setMsg(`IP ${p.ip} bannie.`);setTab("ips");}} style={{background:"#e74c3c22",border:"1px solid #e74c3c44",color:"#e74c3c",padding:"4px 10px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:10,cursor:"pointer"}}>🌐 IP</button>}<button onClick={async()=>{if(!window.confirm(`Supprimer DÉFINITIVEMENT le joueur ${p.name} ?`)) return;const { data: { session } } = await supabase.auth.getSession();const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/players/${p.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } });const d = await res.json();if (d.error) { setMsg("❌ " + d.error); return; }setPlayersData(prev => ({ ...prev, players: prev.players.filter(x => x.id !== p.id), total: prev.total - 1 }));setMsg(`✅ Compte ${p.name} supprimé définitivement.`);}} style={{background:"#e74c3c22",border:"1px solid #e74c3c44",color:"#e74c3c",padding:"4px 10px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:10,cursor:"pointer"}} title="Supprimer définitivement">🗑️</button></div></div>);})}
                {pagPl.length===0&&<div style={{color:"#666",textAlign:"center",padding:"16px 0"}}>{t("admin_no_player")}</div>}
              </div>
              {pages>1&&<div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:8,marginTop:11}}><button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{background:page===0?"#222":"#ffffff22",border:"none",color:page===0?"#444":"#fff",padding:"5px 12px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:page===0?"default":"pointer"}}>{t("lb_prev")}</button><span style={{fontSize:11,color:"#888"}}>Page {page+1}/{pages}</span><button onClick={()=>setPage(p=>Math.min(pages-1,p+1))} disabled={page===pages-1} style={{background:page===pages-1?"#222":"#ffffff22",border:"none",color:page===pages-1?"#444":"#fff",padding:"5px 12px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,cursor:page===pages-1?"default":"pointer"}}>{t("lb_next")}</button></div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}