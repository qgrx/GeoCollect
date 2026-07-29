import { useState, useMemo, useEffect } from 'react';
import { INP, SEL, BTN } from '../../utils/styles.js';
import { RC } from '../../data/cards.js';
import { apiGetAdminSeasons, apiAdminPublishCards, apiAdminUnscheduleCards } from '../../services/api.js';
import Card from '../../components/Card.jsx';

// ─── Date locale ⇄ ISO pour <input type="datetime-local"> ────────────────────
// (dupliqués depuis AdminPanel pour garder ce panneau autonome)
function localInputToIso(s){
  if(!s) return null;
  const d=new Date(s); return isNaN(d.getTime())?null:d.toISOString();
}
const fmtDate  = iso => new Date(iso).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'});
// Version compacte pour la pastille posée sur une carte (100 px de large).
const fmtShort = iso => new Date(iso).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});

const RARITY_ORDER = { légendaire: 0, épique: 1, rare: 2, commun: 3 };

// ─── Gestion des cartes cachées (préparation de releases) ─────────────────────
// Vue dédiée : toutes les cartes hidden=true d'un coup, sélection par lots, puis
// publication immédiate ou programmée (cards.publish_at → cardPublishScheduler).
// Les cartes partageant la même date de publication sont regroupées : un groupe
// = une release à venir.
export default function AdminHiddenCards({ cardPool, cardTypes, onUpdateCardInPool, setMsg }) {
  const [search, setSearch]           = useState('');
  const [filterType, setFilterType]   = useState('Tous');
  const [filterRarity, setFilterRarity] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [seasons, setSeasons]         = useState([]);
  const [selected, setSelected]       = useState(() => new Set());
  const [dateInput, setDateInput]     = useState('');
  const [busy, setBusy]               = useState(false);

  useEffect(() => {
    apiGetAdminSeasons().then(({ data }) => { if (data?.seasons) setSeasons(data.seasons); });
  }, []);

  // Cartes cachées, hors achievements (gérés dans leur propre onglet).
  const hiddenCards = useMemo(
    () => (cardPool || []).filter(c => c.hidden && !c.type?.toLowerCase().includes('achievement')),
    [cardPool]
  );

  const filtered = useMemo(() => {
    let cards = hiddenCards;
    if (filterType !== 'Tous') cards = cards.filter(c => c.type === filterType);
    if (filterRarity) cards = cards.filter(c => c.rarity === filterRarity);
    if (filterSeason === '__none__') cards = cards.filter(c => !c.season_id);
    else if (filterSeason) cards = cards.filter(c => String(c.season_id) === filterSeason);
    if (search) cards = cards.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    return [...cards].sort((a,b) => (RARITY_ORDER[a.rarity] ?? 4) - (RARITY_ORDER[b.rarity] ?? 4) || a.name.localeCompare(b.name));
  }, [hiddenCards, filterType, filterRarity, filterSeason, search]);

  // Groupes = releases : une entrée par date de publication programmée, plus les
  // cartes sans date. Les dates les plus proches d'abord, non programmées en fin.
  const groups = useMemo(() => {
    const map = new Map();
    for (const c of filtered) {
      const key = c.publish_at || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    }
    return [...map.entries()].sort((a,b) => {
      if (!a[0]) return 1;
      if (!b[0]) return -1;
      return new Date(a[0]) - new Date(b[0]);
    });
  }, [filtered]);

  const selectedCards = useMemo(() => hiddenCards.filter(c => selected.has(c.id)), [hiddenCards, selected]);
  const selectedScheduled = selectedCards.filter(c => c.publish_at).length;
  const allFilteredSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id));

  const toggle = id => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll  = () => setSelected(new Set(filtered.map(c => c.id)));
  const selectNone = () => setSelected(new Set());
  const selectGroup = cards => setSelected(prev => { const n = new Set(prev); cards.forEach(c => n.add(c.id)); return n; });

  // ── Actions ────────────────────────────────────────────────────────────────
  async function publishNow() {
    const ids = selectedCards.map(c => c.id);
    if (!ids.length) return;
    if (!window.confirm(`Publier ${ids.length} geocoin(s) maintenant ? Ils deviendront visibles, comptés et jouables (et redeviennent vendables s'ils ne sont pas forgeables).`)) return;
    setBusy(true);
    const { data, error } = await apiAdminPublishCards(ids, null);
    setBusy(false);
    if (error) { setMsg('❌ ' + error); return; }
    selectedCards.forEach(c => onUpdateCardInPool?.({ ...c, hidden: false, publish_at: null, sellable: c.forgeable ? false : true }));
    setSelected(new Set());
    setMsg(`✅ ${data?.released ?? ids.length} geocoin(s) publié(s) !`);
  }

  async function schedule() {
    const iso = localInputToIso(dateInput);
    if (!iso) { setMsg('❌ Date invalide.'); return; }
    const ids = selectedCards.map(c => c.id);
    if (!ids.length) return;
    setBusy(true);
    const { data, error } = await apiAdminPublishCards(ids, iso);
    setBusy(false);
    if (error) { setMsg('❌ ' + error); return; }
    if (data?.released) {
      // Date déjà passée : l'API a publié tout de suite.
      selectedCards.forEach(c => onUpdateCardInPool?.({ ...c, hidden: false, publish_at: null, sellable: c.forgeable ? false : true }));
      setSelected(new Set()); setDateInput('');
      setMsg(`✅ Date déjà passée → ${data.released} geocoin(s) publié(s) immédiatement.`);
      return;
    }
    selectedCards.forEach(c => onUpdateCardInPool?.({ ...c, publish_at: iso }));
    setSelected(new Set()); setDateInput('');
    setMsg(`✅ ${data?.scheduled ?? ids.length} geocoin(s) programmé(s) pour le ${fmtDate(iso)}.`);
  }

  async function unschedule() {
    const ids = selectedCards.filter(c => c.publish_at).map(c => c.id);
    if (!ids.length) return;
    setBusy(true);
    const { data, error } = await apiAdminUnscheduleCards(ids);
    setBusy(false);
    if (error) { setMsg('❌ ' + error); return; }
    selectedCards.forEach(c => { if (c.publish_at) onUpdateCardInPool?.({ ...c, publish_at: null }); });
    setMsg(`✅ Programmation annulée pour ${data?.cleared ?? ids.length} geocoin(s) — ils restent cachés.`);
  }

  return (
    <div>
      {/* ── Header ── */}
      <div style={{display:"flex",gap:8,marginBottom:6,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{flex:1,fontWeight:900,color:"#e17055",fontSize:14}}>🚫 Cartes cachées ({hiddenCards.length})</div>
      </div>
      <div style={{fontSize:11,color:"#8daacc",marginBottom:12}}>
        Invisibles pour les joueurs et exclues de tous les totaux. Cochez celles à sortir, puis publiez-les
        tout de suite ou programmez leur date de sortie : la publication se fera automatiquement.
      </div>

      {hiddenCards.length === 0 ? (
        <div style={{color:"#a8bfcf",fontSize:13,textAlign:"center",padding:"36px 0",fontStyle:"italic"}}>
          Aucune carte cachée. Créez-en depuis l'onglet 🃏 Cartes (case « 🚫 Carte cachée »).
        </div>
      ) : (
      <>
        {/* ── Filtres ── */}
        <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher…"
            style={{...INP,flex:1,minWidth:120,fontSize:12,padding:"6px 10px"}}/>
          <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{...SEL,fontSize:12,padding:"6px 10px"}}>
            <option value="Tous">Tous les types</option>
            {cardTypes.map(tp=><option key={tp} value={tp}>{tp}</option>)}
          </select>
          <select value={filterRarity} onChange={e=>setFilterRarity(e.target.value)} style={{...SEL,fontSize:12,padding:"6px 10px"}}>
            <option value="">Toutes raretés</option>
            {["commun","rare","épique","légendaire"].map(r=><option key={r} value={r}>{RC[r]?.label||r}</option>)}
          </select>
          {seasons.length > 0 && (
            <select value={filterSeason} onChange={e=>setFilterSeason(e.target.value)} style={{...SEL,fontSize:12,padding:"6px 10px"}}>
              <option value="">Toutes saisons</option>
              <option value="__none__">Sans saison</option>
              {seasons.map(s=><option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </select>
          )}
        </div>

        {/* ── Sélection ── */}
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:10}}>
          <button onClick={allFilteredSelected?selectNone:selectAll}
            style={{...BTN("#ffffff14"),padding:"5px 11px",fontSize:11,borderRadius:7}}>
            {allFilteredSelected?"☐ Tout décocher":"☑ Tout cocher"}{filtered.length!==hiddenCards.length?` (${filtered.length} filtrée${filtered.length>1?"s":""})`:""}
          </button>
          {selected.size>0&&(
            <button onClick={selectNone} style={{...BTN("#ffffff0a"),padding:"5px 11px",fontSize:11,borderRadius:7}}>✕ Vider la sélection</button>
          )}
          <span style={{fontSize:11,color:selected.size?"#f9ca24":"#8daacc",fontWeight:800}}>
            {selected.size} sélectionnée{selected.size>1?"s":""} / {filtered.length} affichée{filtered.length>1?"s":""}
          </span>
        </div>

        {/* ── Barre d'actions (sélection) ── */}
        <div style={{background:selected.size?"#e1705514":"#ffffff06",border:`1px solid ${selected.size?"#e1705540":"#ffffff12"}`,borderRadius:11,padding:"11px 14px",marginBottom:14,opacity:selected.size?1:0.55}}>
          <div style={{fontWeight:800,color:"#e17055",fontSize:12,marginBottom:9}}>🚀 Publier la sélection</div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <button onClick={publishNow} disabled={!selected.size||busy}
              style={{...BTN("linear-gradient(135deg,#e17055,#d63031)"),padding:"7px 14px",fontSize:12,borderRadius:8,opacity:(!selected.size||busy)?0.5:1,cursor:(!selected.size||busy)?"default":"pointer"}}>
              🚀 Publier maintenant{selected.size?` (${selected.size})`:""}
            </button>
            <span style={{color:"#8daacc",fontSize:11}}>ou</span>
            <input type="datetime-local" value={dateInput} onChange={e=>setDateInput(e.target.value)} disabled={!selected.size}
              style={{...INP,width:210,fontSize:12,padding:"6px 10px"}}/>
            <button onClick={schedule} disabled={!selected.size||!dateInput||busy}
              style={{...BTN("linear-gradient(135deg,#6c5ce7,#a29bfe)"),padding:"7px 14px",fontSize:12,borderRadius:8,opacity:(!selected.size||!dateInput||busy)?0.5:1,cursor:(!selected.size||!dateInput||busy)?"default":"pointer"}}>
              📅 Programmer
            </button>
            {selectedScheduled>0&&(
              <button onClick={unschedule} disabled={busy}
                style={{...BTN("#ffffff12"),padding:"7px 12px",fontSize:11,borderRadius:8}}
                title="Retire la date : les cartes restent cachées">
                ✕ Annuler la programmation ({selectedScheduled})
              </button>
            )}
          </div>
          <div style={{color:"#8daacc",fontSize:11,marginTop:7}}>
            À la publication, les geocoins non forgeables redeviennent vendables au marché.
            La publication programmée est vérifiée toutes les minutes côté serveur.
          </div>
        </div>

        {/* ── Groupes (releases) ── */}
        {filtered.length===0
          ? <div style={{color:"#a8bfcf",fontSize:13,textAlign:"center",padding:"30px 0",fontStyle:"italic"}}>Aucune carte cachée ne correspond aux filtres.</div>
          : groups.map(([key,cards])=>(
            <div key={key||'none'} style={{marginBottom:18}}>
              <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:8,flexWrap:"wrap"}}>
                <div style={{fontWeight:800,fontSize:12,color:key?"#f9ca24":"#8daacc"}}>
                  {key?`📅 Release du ${fmtDate(key)}`:"⏸ Sans date de publication"} · {cards.length} geocoin{cards.length>1?"s":""}
                </div>
                <button onClick={()=>selectGroup(cards)}
                  style={{background:"#ffffff0a",border:"1px solid #ffffff22",color:"#a8bfcf",padding:"3px 9px",borderRadius:50,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:10,cursor:"pointer"}}>
                  ☑ Sélectionner ce lot
                </button>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {cards.map(c=>{
                  const on = selected.has(c.id);
                  return (
                    <div key={c.id} onClick={()=>toggle(c.id)} title={c.name}
                      style={{cursor:"pointer",position:"relative",borderRadius:12,padding:3,
                        border:`2px solid ${on?"#00b894":"transparent"}`,background:on?"#00b89418":"transparent",
                        opacity:on?1:0.72,transition:"all .12s"}}>
                      <Card card={c} small />
                      <div style={{position:"absolute",top:7,right:7,zIndex:6,width:18,height:18,borderRadius:5,
                        background:on?"#00b894":"#00000099",border:`1.5px solid ${on?"#00b894":"#ffffff55"}`,
                        display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11,fontWeight:900}}>
                        {on?"✓":""}
                      </div>
                      {c.publish_at&&(
                        <div title={fmtDate(c.publish_at)}
                          style={{position:"absolute",top:7,left:7,right:30,zIndex:6,background:"#f9ca24ee",color:"#2d1b00",
                          fontSize:8,fontWeight:900,borderRadius:4,padding:"2px 4px",textAlign:"center",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                          📅 {fmtShort(c.publish_at)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        }
      </>
      )}
    </div>
  );
}
