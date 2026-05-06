import { useState } from 'react';
import { useT } from '../../i18n/translations.js';
import { RC, cardCC, RARITY_CONFIG as RC2, rarityLabel } from '../../data/cards.js';
import { PACK_PRICE_LABEL } from '../../data/constants.js';
import { drawPackCards } from '../../utils/gameUtils.js';

export default function ShopModal({onClose, cardPool, onPurchase}){ const {t}=useT();
  const [step, setStep] = useState("shop"); // shop | confirm | processing | reveal | done
  const [drawnCards, setDrawnCards] = useState([]);
  const [revealedIdx, setRevealedIdx] = useState(-1);
  const [payMethod, setPayMethod] = useState(null);

  function handleBuy(method){
    setPayMethod(method);
    setStep("confirm");
  }

  function handleConfirm(){
    setStep("processing");
    // Simulate payment processing delay
    setTimeout(()=>{
      const cards = drawPackCards(cardPool);
      setDrawnCards(cards);
      setStep("reveal");
      // Reveal cards one by one
      cards.forEach((_,i)=>{ setTimeout(()=>setRevealedIdx(i), i*350+400); });
      setTimeout(()=>setStep("done"), cards.length*350+800);
    }, 1800);
  }

  const PACK_PRICE = "2,99 €";
  const RARITY_ORDER = {légendaire:0,épique:1,rare:2,commun:3};

  return (
    <div style={{position:"fixed",inset:0,background:"#000d",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,backdropFilter:"blur(10px)"}}>
      <div style={{background:"linear-gradient(145deg,#1a1a2e,#16213e)",borderRadius:24,padding:"0",width:"min(96vw,640px)",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 32px 80px #000c",border:"2px solid #f9ca2444",fontFamily:"'Nunito',sans-serif",overflow:"hidden"}}>

        {/* Header */}
        <div style={{background:"linear-gradient(90deg,#e84393,#f9ca24,#e17055)",backgroundSize:"200% 100%",animation:"shimmer 3s linear infinite",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontFamily:"'Fredoka One',sans-serif",fontSize:22,color:"#fff",textShadow:"0 2px 8px #0005"}}>{t("shop_title")}</div>
            <div style={{fontSize:11,color:"#ffffff99",marginTop:2}}>{t("shop_subtitle")}</div>
          </div>
          {step!=="processing"&&<button onClick={onClose} style={{background:"#00000033",border:"none",color:"#fff",width:32,height:32,borderRadius:"50%",fontSize:16,cursor:"pointer",fontWeight:900}}>✕</button>}
        </div>

        {/* SHOP step */}
        {step==="shop"&&<div style={{padding:"24px 22px"}}>
          {/* Pack card */}
          <div style={{background:"linear-gradient(145deg,#1e1e3a,#2d1b4e)",borderRadius:18,padding:"20px",marginBottom:20,border:"1.5px solid #f9ca2433",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:-20,right:-20,fontSize:80,opacity:.07}}>🎁</div>
            <div style={{display:"flex",gap:18,alignItems:"center"}}>
              <div style={{flexShrink:0,textAlign:"center"}}>
                <div style={{fontSize:52,filter:"drop-shadow(0 4px 12px #f9ca2466)"}}>🎁</div>
                <div style={{fontFamily:"'Fredoka One',sans-serif",fontSize:28,color:"#f9ca24",marginTop:4}}>{PACK_PRICE}</div>
                <div style={{fontSize:11,color:"#888"}}>paiement unique</div>
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:900,fontSize:17,color:"#fff",marginBottom:10}}>{t("shop_pack_title")}</div>
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  {[
                    {icon:"⚪",label:"6 cartes Communes",       color:"#78909c"},
                    {icon:"🔵",label:"2 cartes Rares garanties", color:"#1565c0"},
                    {icon:"🟣",label:"1 carte Épique ou Rare",   color:"#6a1b9a", note:"(50 % / 50 %)"},
                    {icon:"🟠",label:"1 carte Légendaire ou Rare",color:"#e65100",note:"(20 % / 80 %)"},
                  ].map(({icon,label,color,note})=>(
                    <div key={label} style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:14}}>{icon}</span>
                      <span style={{fontSize:13,color:"#fff",fontWeight:700}}>{label}</span>
                      {note&&<span style={{fontSize:11,color:"#888",fontStyle:"italic"}}>{note}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Donation note */}
          <div style={{background:"#00b89412",border:"1px solid #00b89433",borderRadius:12,padding:"10px 14px",marginBottom:20,display:"flex",gap:10,alignItems:"flex-start"}}>
            <span style={{fontSize:18,flexShrink:0}}>💚</span>
            <div style={{fontSize:12,color:"#aaa",lineHeight:1.5}}>{t("shop_donation_note")}</div>
          </div>

          {/* Payment buttons */}
          <div style={{fontSize:12,color:"#888",marginBottom:10,textAlign:"center"}}>{t("shop_payment_label")}</div>
          <div style={{display:"flex",flexDirection:"column",gap:9}}>
            <button onClick={()=>handleBuy("card")} style={{display:"flex",alignItems:"center",gap:12,background:"#fff",border:"none",padding:"13px 18px",borderRadius:12,cursor:"pointer",fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:14,color:"#1a1a2e",transition:"opacity .15s"}}
              onMouseEnter={e=>e.currentTarget.style.opacity=".9"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
              <span style={{fontSize:22}}>💳</span>
              <span style={{flex:1,textAlign:"left"}}>{t("shop_card")}</span>
              <span style={{color:"#888",fontSize:12,fontWeight:600}}>Visa / Mastercard</span>
            </button>
            <button onClick={()=>handleBuy("paypal")} style={{display:"flex",alignItems:"center",gap:12,background:"#003087",border:"none",padding:"13px 18px",borderRadius:12,cursor:"pointer",fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:14,color:"#fff",transition:"opacity .15s"}}
              onMouseEnter={e=>e.currentTarget.style.opacity=".9"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
              <span style={{fontSize:22}}>🅿️</span>
              <span style={{flex:1,textAlign:"left"}}>{t("shop_paypal")}</span>
              <span style={{color:"#ffffff66",fontSize:12,fontWeight:600}}>paypal.com</span>
            </button>

          </div>

          <div style={{marginTop:14,fontSize:10,color:"#444",textAlign:"center",lineHeight:1.5}}>
            Paiement sécurisé via Stripe · Aucun abonnement · Aucune donnée bancaire stockée
          </div>
        </div>}

        {/* CONFIRM step */}
        {step==="confirm"&&<div style={{padding:"28px 24px",textAlign:"center"}}>
          <div style={{fontSize:52,marginBottom:12}}>
            {payMethod==="paypal"?"🅿️":"💳"}
          </div>
          <div style={{fontWeight:900,fontSize:20,color:"#fff",marginBottom:6}}>{t("shop_confirm_title")}</div>
          <div style={{color:"#aaa",fontSize:13,marginBottom:20}}>{t("shop_confirm_desc")}</div>
          <div style={{fontFamily:"'Fredoka One',sans-serif",fontSize:44,color:"#f9ca24",marginBottom:4}}>{PACK_PRICE}</div>
          <div style={{color:"#888",fontSize:12,marginBottom:24}}>{t("shop_confirm_cards")}</div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setStep("shop")} style={{flex:1,background:"#ffffff18",border:"1px solid #ffffff22",color:"#aaa",padding:"13px",borderRadius:12,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:14,cursor:"pointer"}}>{t("shop_cancel")}</button>
            <button onClick={handleConfirm} style={{flex:2,background:"linear-gradient(135deg,#f9ca24,#e17055)",border:"none",color:"#1a1a2e",padding:"13px",borderRadius:12,fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:15,cursor:"pointer",boxShadow:"0 4px 20px #f9ca2444"}}>
              Confirmer — {PACK_PRICE}
            </button>
          </div>
          <div style={{marginTop:12,fontSize:10,color:"#444"}}><span style={{fontSize:10,color:"#444"}}>{t("shop_redirect").replace("{method}",payMethod==="paypal"?t("shop_paypal"):"Stripe")}</span></div>
        </div>}

        {/* PROCESSING step */}
        {step==="processing"&&<div style={{padding:"60px 24px",textAlign:"center"}}>
          <div style={{fontSize:52,animation:"float 1s ease-in-out infinite",display:"inline-block"}}>⏳</div>
          <div style={{fontWeight:900,fontSize:18,color:"#fff",marginTop:16,marginBottom:8}}>{t("shop_processing_title")}</div>
          <div style={{color:"#888",fontSize:13}}>{t("shop_processing_desc")} {payMethod==="paypal"?t("shop_paypal"):"Stripe"}</div>
          <div style={{marginTop:20,background:"#ffffff18",borderRadius:50,height:6,overflow:"hidden",width:200,margin:"20px auto 0"}}>
            <div style={{height:"100%",background:"linear-gradient(90deg,#f9ca24,#e17055)",borderRadius:50,animation:"shimmer 1.5s linear infinite",backgroundSize:"200% 100%"}}/>
          </div>
        </div>}

        {/* REVEAL step — card reveal one by one */}
        {(step==="reveal"||step==="done")&&<div style={{padding:"22px"}}>
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{fontFamily:"'Fredoka One',sans-serif",fontSize:22,color:"#f9ca24"}}>
              {step==="done" ? t("shop_done_title") : t("shop_reveal_title")}
            </div>
            {step==="done"&&<div style={{fontSize:12,color:"#aaa",marginTop:3}}>{t("shop_thanks")}</div>}
          </div>

          <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginBottom:16}}>
            {drawnCards.map((card,i)=>{
              const revealed = i<=revealedIdx;
              const rc = RC[card.rarity]||RC.commun;
              const {c1,c2} = cardCC(card.rarity);
              return (
                <div key={i} style={{
                  width:90,borderRadius:14,overflow:"hidden",
                  background:revealed?`linear-gradient(145deg,${c1}33,${c2}55)`:"linear-gradient(145deg,#2a1a4e,#1a0f3a)",
                  border:revealed?`2px solid ${c1}`:"2px solid #6c5ce744",
                  transition:"all .3s",
                  transform:revealed?"scale(1) translateY(0)":"scale(0.85) translateY(8px)",
                  opacity:revealed?1:0.3,
                  boxShadow:revealed&&card.rarity==="légendaire"?`0 4px 20px ${c1}99`:"none",
                }}>
                  {revealed?(
                    <>
                      <div style={{background:`linear-gradient(90deg,${c1},${c2})`,padding:"4px 7px",fontSize:9,fontWeight:900,color:"#fff"}}>{card.type.toUpperCase()}</div>
                      <div style={{height:50,background:`linear-gradient(135deg,${c1}22,${c2}44)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontWeight:800}}>{card.name[0]}</div>
                      <div style={{textAlign:"center",fontWeight:900,fontSize:10,color:"#1a1a2e",padding:"2px 4px",background:"#ffffff88"}}>{card.name}</div>
                      <div style={{background:rc.bg,color:rc.color,fontSize:7,fontWeight:800,textAlign:"center",padding:"2px 0",letterSpacing:.5}}>{rarityLabel(card.rarity,t).toUpperCase()}</div>
                    </>
                  ):(
                    <div style={{height:98,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>❓</div>
                  )}
                </div>
              );
            })}
          </div>

          {step==="done"&&(
            <div>
              {/* Summary by rarity */}
              <div style={{background:"#ffffff08",borderRadius:12,padding:"12px 14px",marginBottom:14}}>
                <div style={{fontSize:11,color:"#888",marginBottom:8,fontWeight:700}}>{t("shop_summary")}</div>
                {["légendaire","épique","rare","commun"].map(r=>{
                  const cnt=drawnCards.filter(c=>c.rarity===r).length;
                  if(!cnt)return null;
                  const rc=RC[r]; const {c1}=cardCC(r);
                  return <div key={r} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:c1,flexShrink:0}}/>
                    <span style={{fontSize:12,color:rc.color,fontWeight:800}}>{rarityLabel(r,t)}</span>
                    <span style={{fontSize:12,color:"#aaa"}}>× {cnt}</span>
                  </div>;
                })}
              </div>
              <div style={{display:"flex",gap:9}}>
                <button onClick={()=>{onPurchase(drawnCards);onClose();}} style={{flex:1,background:"linear-gradient(135deg,#00b894,#00cec9)",border:"none",color:"#fff",padding:"13px",borderRadius:12,fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:15,cursor:"pointer",boxShadow:"0 4px 16px #00b89444"}}>
                  Ajouter à ma collection !
                </button>
              </div>
            </div>
          )}
        </div>}
      </div>
    </div>
  );
}
