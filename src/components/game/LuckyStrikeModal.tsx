import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, useCallback, useState } from "react";
import confetti from "canvas-confetti";
import { useGameStore } from "@/lib/gameStore";
import { useAudio } from "@/hooks/useAudio";
import sparkIcon from "@/assets/icon-spark.png";
import lsBg      from "@/assets/ls-bg.png";
import lsScratch from "@/assets/ls-scratch.png";
import lsStar    from "@/assets/ls-star.png";
import lsCoins   from "@/assets/ls-coins.png";
import lsTitle   from "@/assets/ls-title.png";

// ── CSS keyframes injected once ───────────────────────────────────────────────
let _css = false;
function injectStyles() {
  if (_css || typeof document === "undefined") return;
  _css = true;
  const s = document.createElement("style");
  s.textContent = `
    @keyframes ls-spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes ls-hb     { 0%,100%{transform:scale(1)} 14%{transform:scale(1.35)} 28%{transform:scale(1)} 42%{transform:scale(1.2)} }
    @keyframes ls-shimmer{ 0%{left:-70%} 100%{left:130%} }
    @keyframes ls-breathe{ 0%,100%{transform:scale(1)} 50%{transform:scale(1.03)} }
    @keyframes ls-gplay  { 0%,100%{box-shadow:0 4px 0 #78350f,0 6px 20px rgba(245,180,0,0.5)} 50%{box-shadow:0 4px 0 #78350f,0 6px 45px rgba(245,180,0,1),0 0 60px rgba(245,180,0,0.4)} }
    @keyframes ls-mglow  { 0%,100%{box-shadow:0 0 8px rgba(245,180,0,0.3)} 50%{box-shadow:0 0 24px rgba(245,180,0,0.85),0 0 0 2px rgba(245,180,0,0.7)} }
    @keyframes ls-pop    { 0%{transform:scale(0.3);opacity:0} 55%{transform:scale(1.2)} 78%{transform:scale(0.94)} 100%{transform:scale(1);opacity:1} }
    @keyframes ls-near   { 0%,100%{transform:scale(1)} 25%{transform:scale(1.07) rotate(-1deg)} 75%{transform:scale(1.07) rotate(1deg)} }
    @keyframes ls-ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
    @keyframes ls-spulse { 0%,100%{opacity:0.2;transform:scale(0.75)} 50%{opacity:0.85;transform:scale(1.3)} }
  `;
  document.head.appendChild(s);
}

// ── Prizes ────────────────────────────────────────────────────────────────────
interface Prize { symbol:string; img?:string; emoji:string; label:string; value:number; weight:number; color:string; }
const PRIZES: Prize[] = [
  { symbol:"star",    img:lsStar,  emoji:"⭐", label:"+8 Spark",  value:8,  weight:40, color:"#fde047" },
  { symbol:"coin",    img:lsCoins, emoji:"🪙", label:"+12 Spark", value:12, weight:28, color:"#fde68a" },
  { symbol:"diamond", img:undefined, emoji:"💎", label:"+25 Spark", value:25, weight:22, color:"#67e8f9" },
  { symbol:"ruby",    img:undefined, emoji:"🔴", label:"+55 Spark", value:55, weight:10, color:"#fca5a5" },
];
const COST = 5;

function wRandom(items: Prize[]) {
  const t = items.reduce((s,i) => s+i.weight, 0);
  let r = Math.random()*t;
  for (const x of items) { r -= x.weight; if (r<=0) return x; }
  return items[items.length-1];
}
function buildGrid(winChance=0.22) {
  if (Math.random() < winChance) {
    const w = wRandom(PRIZES);
    const o = PRIZES.filter(p => p.symbol!==w.symbol);
    return { prizes: [w,w,w,o[0],o[1%o.length],o[2%o.length]].sort(()=>Math.random()-0.5), winnerSymbol: w.symbol };
  }
  const g:Prize[] = []; const c:Record<string,number>={};
  for (let i=0;i<6;i++) {
    const ok=PRIZES.filter(p=>(c[p.symbol]??0)<2);
    const p=wRandom(ok.length?ok:PRIZES);
    c[p.symbol]=(c[p.symbol]??0)+1; g.push(p);
  }
  return { prizes:g, winnerSymbol:null };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Counter({ target, color }:{ target:number; color:string }) {
  const [v,setV]=useState(0);
  useEffect(()=>{
    let start:number|null=null;
    const step=(ts:number)=>{ if(!start)start=ts; const p=Math.min((ts-start)/1400,1); setV(Math.round((1-Math.pow(1-p,3))*target)); if(p<1)requestAnimationFrame(step); };
    requestAnimationFrame(step);
  },[target]);
  return <span style={{color,textShadow:`0 0 16px ${color}`}}>+{v}</span>;
}

const TICKS=["🔥 Luca_88 ha vinto 25 Spark!","⭐ Sara_XO sta grattando...","💎 GoldPlayer ha vinto!","🎰 462 persone oggi","🔥 Marco_VIP: 55 Spark!","⭐ Lucky_Bea: 3 stelle!","🪙 IlDiavolo: 12 Spark!"];
function Ticker() {
  const items=[...TICKS,...TICKS];
  return (
    <div style={{overflow:"hidden",height:18,mask:"linear-gradient(90deg,transparent,black 8%,black 92%,transparent)"}}>
      <div style={{display:"flex",gap:24,whiteSpace:"nowrap",animation:"ls-ticker 20s linear infinite"}}>
        {items.map((m,i)=><span key={i} style={{fontSize:10,fontWeight:700,color:"rgba(255,220,150,0.88)"}}>{m}</span>)}
      </div>
    </div>
  );
}

function Stars() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {[{l:"11%",t:"18%",s:13,d:0},{l:"81%",t:"13%",s:15,d:.35},{l:"21%",t:"71%",s:12,d:.7},{l:"75%",t:"61%",s:17,d:.2},{l:"50%",t:"5%",s:10,d:.55},{l:"7%",t:"46%",s:12,d:.9},{l:"88%",t:"40%",s:11,d:.1}].map((p,i)=>(
        <span key={i} style={{position:"absolute",left:p.l,top:p.t,fontSize:p.s,color:"#f5b400",opacity:.55,animation:`ls-spulse ${2.2+i*.3}s ease-in-out infinite`,animationDelay:`${p.d}s`}}>✦</span>
      ))}
    </div>
  );
}

function PrizeIcon({ prize, size=32 }:{ prize:Prize; size?:number }) {
  return prize.img
    ? <img src={prize.img} alt={prize.symbol} style={{width:size,height:size,objectFit:"contain",filter:`drop-shadow(0 0 6px ${prize.color})`}} />
    : <span style={{fontSize:size*0.88,filter:`drop-shadow(0 0 6px ${prize.color})`}}>{prize.emoji}</span>;
}

function GoldBtn({ children,onClick,disabled,flex1,variant="gold" }:{
  children:React.ReactNode; onClick?:()=>void; disabled?:boolean; flex1?:boolean; variant?:"gold"|"dim"|"magenta";
}) {
  const st:Record<string,React.CSSProperties>={
    gold:    {background:"linear-gradient(180deg,#fde047,#f59e0b 45%,#d97706)",boxShadow:"0 4px 0 #78350f,0 6px 24px rgba(245,180,0,0.5),inset 0 2px 0 rgba(255,255,200,0.5)",color:"#431407"},
    magenta: {background:"linear-gradient(180deg,#f472b6,#ec4899 45%,#be185d)",boxShadow:"0 4px 0 #831843,0 6px 20px rgba(236,72,153,0.45)",color:"#fff"},
    dim:     {background:"linear-gradient(180deg,#ca8a04,#a16207 45%,#854d0e)",boxShadow:"0 4px 0 #713f12",color:"rgba(255,240,180,0.85)"},
  };
  return (
    <motion.button whileTap={{scale:0.93,y:4}} whileHover={{y:-2}} onClick={onClick} disabled={disabled}
      style={{
        flex:flex1?1:undefined,
        height:"clamp(44px,6svh,54px)",
        borderRadius:999,
        fontFamily:"Impact,'Arial Black',system-ui",
        fontSize:"clamp(16px,2.5svh,20px)",
        fontWeight:900,
        letterSpacing:"0.03em",
        textTransform:"uppercase",
        cursor:disabled?"not-allowed":"pointer",
        opacity:disabled?0.4:1,
        border:"none",outline:"none",
        position:"relative",overflow:"hidden",
        animation:variant==="gold"?"ls-gplay 1.8s ease-in-out infinite":undefined,
        ...st[variant],
      }}>
      <span style={{position:"absolute",top:4,left:"14%",right:"14%",height:"30%",borderRadius:999,background:"rgba(255,255,255,0.38)",filter:"blur(2px)",pointerEvents:"none"}} />
      <span style={{position:"relative",zIndex:1}}>{children}</span>
    </motion.button>
  );
}

// ── Scratch Cell ──────────────────────────────────────────────────────────────
function ScratchCell({ prize,revealed,onReveal,disabled,isWinner,isNearWin,onScratchSfx }:{
  prize:Prize; revealed:boolean; onReveal:()=>void; disabled:boolean; isWinner:boolean; isNearWin:boolean; onScratchSfx:()=>void;
}) {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const drawing=useRef(false);
  const revealedOnce=useRef(false);
  const strokeCount=useRef(0);

  const paintCover=useCallback(()=>{
    const canvas=canvasRef.current; if(!canvas)return;
    const ctx=canvas.getContext("2d", { willReadFrequently:true }); if(!ctx)return;
    const W=canvas.width, H=canvas.height;
    ctx.globalCompositeOperation="source-over";
    ctx.clearRect(0,0,W,H);
    const img=new window.Image();
    img.src=lsScratch;
    img.onload=()=>{
      ctx.globalCompositeOperation="source-over";
      ctx.clearRect(0,0,W,H);
      ctx.drawImage(img,0,0,W,H);
      ctx.fillStyle="rgba(30,45,70,0.62)";
      ctx.font=`bold ${Math.round(W*0.24)}px system-ui`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText("?",W/2,H/2+2);
    };
    img.onerror=()=>{
      const g=ctx.createLinearGradient(0,0,W,H);
      g.addColorStop(0,"#f8fafc"); g.addColorStop(0.32,"#aeb7c3"); g.addColorStop(0.55,"#eef2f7"); g.addColorStop(1,"#8f9baa");
      ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
      ctx.fillStyle="rgba(30,45,70,0.62)";
      ctx.font=`bold ${Math.round(W*0.24)}px system-ui`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText("?",W/2,H/2+2);
    };
  },[]);

  useEffect(()=>{
    revealedOnce.current=false;
    strokeCount.current=0;
    if(revealed){
      const canvas=canvasRef.current; if(!canvas)return;
      const ctx=canvas.getContext("2d"); if(!ctx)return;
      ctx.clearRect(0,0,canvas.width,canvas.height);
    } else {
      paintCover();
    }
  },[revealed,paintCover]);

  const scratchAt=useCallback((clientX:number,clientY:number)=>{
    if(disabled||revealed||revealedOnce.current)return;
    const canvas=canvasRef.current; if(!canvas)return;
    const ctx=canvas.getContext("2d", { willReadFrequently:true }); if(!ctx)return;
    const rect=canvas.getBoundingClientRect();
    const x=((clientX-rect.left)/rect.width)*canvas.width;
    const y=((clientY-rect.top)/rect.height)*canvas.height;
    if(x<0||y<0||x>canvas.width||y>canvas.height)return;

    ctx.save();
    ctx.globalCompositeOperation="destination-out";
    ctx.beginPath();
    ctx.arc(x,y,22,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
    onScratchSfx();

    strokeCount.current += 1;
    if(strokeCount.current % 6 !== 0) return;

    const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let cleared=0;
    for(let i=3;i<data.length;i+=4) if(data[i]<80) cleared++;
    const ratio=cleared/(canvas.width*canvas.height);

    // SICUREZZA: questa cella può rivelare solo se stessa, una sola volta.
    // Niente reveal globale automatico mentre l'utente gratta.
    if(ratio>0.46){
      revealedOnce.current=true;
      drawing.current=false;
      onReveal();
    }
  },[disabled,revealed,onReveal,onScratchSfx]);

  const startDraw=(e:React.PointerEvent<HTMLCanvasElement>)=>{
    if(disabled||revealed||revealedOnce.current)return;
    e.preventDefault(); e.stopPropagation();
    drawing.current=true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    scratchAt(e.clientX,e.clientY);
  };
  const moveDraw=(e:React.PointerEvent<HTMLCanvasElement>)=>{
    if(!drawing.current)return;
    e.preventDefault(); e.stopPropagation();
    scratchAt(e.clientX,e.clientY);
  };
  const endDraw=(e:React.PointerEvent<HTMLCanvasElement>)=>{
    e.preventDefault(); e.stopPropagation();
    drawing.current=false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div style={{
      position:"relative", overflow:"hidden", borderRadius:14,
      background: isWinner&&revealed ? "radial-gradient(circle at 40% 35%,#4c1d9a,#2d0a70)" : "radial-gradient(circle at 40% 35%,#2e1268,#180840)",
      border: isWinner&&revealed ? `2px solid ${prize.color}` : "2px solid rgba(130,70,220,0.45)",
      animation: isWinner&&revealed ? "ls-mglow 1.2s ease-in-out infinite" : isNearWin ? "ls-near 0.6s ease-in-out infinite" : "ls-breathe 2.5s ease-in-out infinite",
    }}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5"
        style={revealed?{animation:"ls-pop 0.5s ease-out both"}:{}}>
        <PrizeIcon prize={prize} size={Math.min(40,32)} />
        <span style={{fontSize:"clamp(8px,1.2svh,11px)",fontWeight:800,color:prize.color}}>{prize.label}</span>
      </div>
      {!revealed && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{borderRadius:12}} aria-hidden>
          <div style={{position:"absolute",top:0,bottom:0,width:"45%",background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.32),transparent)",animation:`ls-shimmer 2.4s ease-in-out infinite`}} />
        </div>
      )}
      <canvas ref={canvasRef} width={120} height={120}
        className="absolute inset-0 h-full w-full touch-none"
        style={{borderRadius:12,cursor:disabled||revealed?"default":"crosshair",display:revealed?"none":"block",touchAction:"none"}}
        onPointerDown={startDraw}
        onPointerMove={moveDraw}
        onPointerUp={endDraw}
        onPointerCancel={endDraw}
        onPointerLeave={(e)=>{ if(drawing.current) endDraw(e); }}
      />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function LuckyStrikeModal({ open,onClose }:{ open:boolean; onClose:()=>void }) {
  const { sfx } = useAudio();
  const sparks      = useGameStore(s=>s.sparks);
  const spendSparks = useGameStore(s=>s.spendSparks);
  const addSparks   = useGameStore(s=>s.addSparks);

  const [phase,setPhase]           = useState<"idle"|"playing"|"result">("idle");
  const [grid,setGrid]             = useState<Prize[]>([]);
  const [winnerSymbol,setWinnerSym]= useState<string|null>(null);
  const [revealed,setRevealed]     = useState<boolean[]>([]);
  const [winner,setWinner]         = useState<Prize|null>(null);
  const [toast,setToast]           = useState<string|null>(null);
  const [winFlash,setWinFlash]     = useState(false);
  const [nearWin,setNearWin]       = useState<Set<number>>(new Set());

  const lastSfx=useRef(0);
  const scratchSfx=useCallback(()=>{
    const n=Date.now(); if(n-lastSfx.current>110){lastSfx.current=n;sfx("coin");}
  },[sfx]);

  useEffect(()=>{ injectStyles(); },[]);

  function showToast(msg:string){ setToast(msg); setTimeout(()=>setToast(null),2500); }

  function handlePlay(){
    sfx("tap");
    if(sparks<COST){ sfx("error"); showToast(`Servono ${COST} Spark!`); return; }
    spendSparks(COST); sfx("purchase");
    const {prizes,winnerSymbol:ws}=buildGrid(0.22);
    setGrid(prizes); setWinnerSym(ws);
    setRevealed(new Array(6).fill(false));
    setWinner(null); setNearWin(new Set()); setPhase("playing");
  }

  function handleReveal(i:number){
    if(revealed[i])return;
    sfx("reveal");
    const next=[...revealed]; next[i]=true; setRevealed(next);
    if(winnerSymbol&&!winner){
      const cnt=grid.filter((p,j)=>next[j]&&p.symbol===winnerSymbol).length;
      if(cnt===2){ const sh=new Set<number>(); grid.forEach((p,j)=>{if(!next[j]&&p.symbol===winnerSymbol)sh.add(j);}); setNearWin(sh); }
      if(cnt>=3){
        const w=grid.find(p=>p.symbol===winnerSymbol)!;
        setWinner(w); addSparks(w.value); sfx("win");
        setWinFlash(true); setTimeout(()=>setWinFlash(false),700);
        setTimeout(()=>{
          confetti({particleCount:260,spread:100,origin:{y:0.45},colors:["#f5b400","#ff3da6","#7c3aed","#67e8f9","#22c55e"]});
          setTimeout(()=>confetti({particleCount:90,spread:60,origin:{y:0.55,x:0.2},colors:["#f5b400","#fde68a"]}),300);
          setTimeout(()=>confetti({particleCount:90,spread:60,origin:{y:0.55,x:0.8},colors:["#ff3da6","#a855f7"]}),500);
        },100);
        setNearWin(new Set());
      }
    }
    if(next.every(Boolean)) setPhase("result");
  }

  function claimAll(){
    sfx("tap"); setRevealed(new Array(6).fill(true));
    if(winnerSymbol&&!winner){
      const w=grid.find(p=>p.symbol===winnerSymbol)!;
      setWinner(w); addSparks(w.value); sfx("win");
      setWinFlash(true); setTimeout(()=>setWinFlash(false),700);
      confetti({particleCount:260,spread:100,origin:{y:0.45},colors:["#f5b400","#ff3da6","#7c3aed","#67e8f9"]});
    }
    setNearWin(new Set()); setPhase("result");
  }

  function reset(){
    setPhase("idle"); setGrid([]); setRevealed([]); setWinner(null);
    setWinnerSym(null); setNearWin(new Set());
  }

  const idlePH=PRIZES.concat(PRIZES).slice(0,6);

  // Grid cells: same for all phases
  const GridCells = () => {
    if(phase==="playing") return (
      <>
        {grid.map((p,i)=>(
          <ScratchCell key={i} prize={p} revealed={revealed[i]??false}
            onReveal={()=>handleReveal(i)} disabled={false}
            isWinner={p.symbol===winnerSymbol} isNearWin={nearWin.has(i)}
            onScratchSfx={scratchSfx}/>
        ))}
      </>
    );
    if(phase==="result") return (
      <>
        {grid.map((p,i)=>(
          <div key={i} style={{
            position:"relative",overflow:"hidden",borderRadius:14,
            background:winner&&p.symbol===winner.symbol?"radial-gradient(circle at 40% 35%,#4c1d9a,#2d0a70)":"radial-gradient(circle at 40% 35%,#1e0a40,#100525)",
            border:winner&&p.symbol===winner.symbol?`2px solid ${p.color}`:"2px solid rgba(130,70,220,0.28)",
            animation:winner&&p.symbol===winner.symbol?"ls-mglow 1.2s ease-in-out infinite":undefined,
          }}>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
              <PrizeIcon prize={p} size={28}/>
              <span style={{fontSize:"clamp(8px,1.2svh,10px)",fontWeight:700,color:p.color}}>{p.label}</span>
            </div>
          </div>
        ))}
      </>
    );
    // idle
    return (
      <>
        {idlePH.map((p,i)=>(
          <div key={i} style={{
            position:"relative",overflow:"hidden",borderRadius:14,
            background:"radial-gradient(circle at 40% 35%,#2e1268,#180840)",
            border:"2px solid rgba(130,70,220,0.45)",
            animation:`ls-breathe 2.5s ease-in-out infinite`,
            animationDelay:`${i*.15}s`,
          }}>
            <div className="absolute inset-0 flex items-center justify-center opacity-30">
              <PrizeIcon prize={p} size={28}/>
            </div>
            <div className="absolute inset-0 overflow-hidden" style={{borderRadius:12}}>
              <div style={{position:"absolute",inset:0,backgroundImage:`url(${lsScratch})`,backgroundSize:"cover",backgroundPosition:"center",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:"clamp(18px,3svh,26px)",fontWeight:900,color:"rgba(45,60,85,0.65)"}}>?</span>
              </div>
              <div style={{position:"absolute",top:0,bottom:0,width:"45%",background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.32),transparent)",animation:`ls-shimmer ${2.2+i*.22}s ease-in-out infinite`,animationDelay:`${i*.3}s`}}/>
            </div>
          </div>
        ))}
      </>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            onClick={onClose}/>

          {/* Win flash */}
          <AnimatePresence>
            {winFlash && (
              <motion.div initial={{opacity:0}} animate={{opacity:0.6}} exit={{opacity:0}} transition={{duration:0.15}}
                className="fixed inset-0 z-[55] pointer-events-none"
                style={{background:"radial-gradient(circle,#fde047 0%,#f59e0b 40%,transparent 70%)"}}/>
            )}
          </AnimatePresence>

          {/* ── Modal wrapper: fixed height = full viewport, NO SCROLL ── */}
          <motion.div
            initial={{opacity:0,scale:0.78,y:60}}
            animate={{opacity:1,scale:1,y:0}}
            exit={{opacity:0,scale:0.78,y:60}}
            transition={{type:"spring",stiffness:310,damping:27}}
            onClick={e=>e.stopPropagation()}
            style={{
              position:"fixed",
              left:"clamp(8px, 2vw, 16px)",
              right:"clamp(8px, 2vw, 16px)",
              top:"clamp(10px, 1.5svh, 20px)",
              bottom:"clamp(10px, 1.5svh, 20px)",
              maxWidth:400,
              margin:"0 auto",
              zIndex:52,
              borderRadius:28,
              padding:"2.5px",
              overflow:"hidden",
              // max height safety
              maxHeight:720,
              // center vertically if shorter than screen
              display:"flex",
              flexDirection:"column",
            }}
          >
            {/* Rotating conic border */}
            <div aria-hidden style={{position:"absolute",inset:"-55%",width:"210%",height:"210%",background:"conic-gradient(from 0deg,#ff6ec7,#f5b400,#7c3aed,#67e8f9,#f5b400,#ff6ec7)",animation:"ls-spin 3s linear infinite",pointerEvents:"none"}}/>

            {/* Inner: fills wrapper height, NO overflow */}
            <div style={{
              position:"relative",
              borderRadius:26,
              overflow:"hidden",
              flex:1,
              display:"flex",
              flexDirection:"column",
              backgroundImage:`url(${lsBg})`,
              backgroundSize:"cover",
              backgroundPosition:"center",
            }}>
              <Stars/>

              {/* Close */}
              <button onClick={onClose} style={{position:"absolute",top:10,right:10,zIndex:20,width:32,height:32,borderRadius:"50%",background:"rgba(0,0,0,0.5)",border:"1px solid rgba(255,255,255,0.25)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                <X style={{width:14,height:14,color:"white"}}/>
              </button>

              {/* ── CONTENT: flex column, fills height, no scroll ── */}
              <div style={{flex:1,minHeight:0,display:"flex",flexDirection:"column",overflow:"hidden",padding:"0 0 clamp(8px,1.5svh,14px)"}}>

                {/* Hearts */}
                <div style={{flexShrink:0,display:"flex",justifyContent:"center",gap:10,paddingTop:"clamp(10px,1.8svh,18px)",paddingBottom:"clamp(2px,0.5svh,6px)"}}>
                  {[0,1,2].map(i=>(
                    <span key={i} style={{fontSize:"clamp(17px,3svh,22px)",display:"inline-block",animation:`ls-hb 1.4s ease-in-out infinite`,animationDelay:`${i*.22}s`,filter:"drop-shadow(0 0 8px #ef4444)"}}>❤️</span>
                  ))}
                </div>

                {/* Title image */}
                <div style={{flexShrink:0,display:"flex",justifyContent:"center",padding:"0 16px"}}>
                  <img src={lsTitle} alt="Lucky Strike" style={{
                    maxHeight:"clamp(55px,10svh,95px)",
                    width:"auto",
                    maxWidth:"92%",
                    objectFit:"contain",
                    filter:"drop-shadow(0 3px 16px rgba(245,180,0,0.5))",
                  }}/>
                </div>

                {/* Balance + Ticker row */}
                <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:"clamp(3px,0.6svh,6px)",padding:"clamp(3px,0.6svh,6px) 12px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,borderRadius:999,padding:"3px 12px",background:"rgba(0,0,0,0.45)",border:"1px solid rgba(255,255,255,0.12)"}}>
                    <img src={sparkIcon} alt="spark" style={{width:13,height:13}}/>
                    <span style={{fontSize:"clamp(10px,1.8svh,13px)",fontWeight:800,color:"#fde047"}}>{sparks}</span>
                    <span style={{fontSize:"clamp(9px,1.6svh,12px)",color:"rgba(255,255,255,0.4)"}}>· {COST} Spark/grattata</span>
                  </div>
                  {phase==="idle" && (
                    <div style={{width:"100%",borderRadius:999,padding:"3px 12px",background:"rgba(0,0,0,0.38)",border:"1px solid rgba(255,255,255,0.08)"}}>
                      <Ticker/>
                    </div>
                  )}
                </div>

                {/* Toast */}
                <AnimatePresence>
                  {toast && (
                    <motion.div initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                      style={{flexShrink:0,margin:"0 12px clamp(2px,0.4svh,4px)",borderRadius:12,padding:"6px 12px",textAlign:"center",fontSize:"clamp(10px,1.8svh,13px)",fontWeight:700,color:"#fca5a5",background:"rgba(220,50,50,0.22)",border:"1px solid rgba(220,80,80,0.38)"}}>
                      {toast}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Win banner */}
                <AnimatePresence>
                  {winner && (
                    <motion.div initial={{scale:0.5,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:"spring",stiffness:350,damping:18}}
                      style={{flexShrink:0,margin:"0 12px clamp(2px,0.4svh,6px)",borderRadius:16,padding:"clamp(4px,1svh,8px) 12px",textAlign:"center",background:"rgba(245,180,0,0.14)",border:"2px solid rgba(245,180,0,0.6)"}}>
                      <div style={{display:"flex",justifyContent:"center",marginBottom:2}}><PrizeIcon prize={winner} size={28}/></div>
                      <p style={{fontWeight:900,fontSize:"clamp(12px,2svh,16px)",color:"#fde047"}}>
                        HAI VINTO! <Counter target={winner.value} color="#fde047"/> Spark
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── INNER CARD: flex:1, fills remaining height ── */}
                <div style={{
                  flex:1, minHeight:0,
                  margin:"0 10px clamp(4px,0.8svh,8px)",
                  borderRadius:22,
                  overflow:"hidden",
                  background:"rgba(4,0,28,0.55)",
                  border:"2px solid rgba(220,100,255,0.35)",
                  boxShadow:"inset 0 0 28px rgba(100,20,200,0.28)",
                  display:"flex",
                  flexDirection:"column",
                }}>
                  {/* SCRATCH AREA label */}
                  <div style={{flexShrink:0,display:"flex",justifyContent:"center",padding:"clamp(6px,1.2svh,10px) 0 clamp(4px,0.8svh,8px)"}}>
                    <div style={{background:"linear-gradient(135deg,#3e1480,#250960)",borderRadius:999,border:"1.5px solid rgba(200,120,255,0.45)",padding:"4px 22px"}}>
                      <span style={{fontFamily:"Impact,system-ui",fontSize:"clamp(10px,1.8svh,13px)",letterSpacing:"0.2em",color:"white",textTransform:"uppercase"}}>SCRATCH AREA</span>
                    </div>
                  </div>

                  {/* ── 2×3 GRID: flex:1, cells fill all remaining space, SQUARE via gridTemplateRows ── */}
                  <div style={{
                    flex:1, minHeight:0,
                    display:"grid",
                    gridTemplateColumns:"repeat(3,minmax(0,1fr))",
                    gridTemplateRows:"repeat(2,minmax(0,1fr))",
                    gap:"clamp(5px,1svh,9px)",
                    padding:"0 clamp(8px,1.5svh,12px) clamp(4px,0.8svh,8px)",
                  }}>
                    <GridCells/>
                  </div>

                  {/* No prize */}
                  {phase==="result"&&!winner && (
                    <div style={{flexShrink:0,textAlign:"center",padding:"clamp(4px,0.8svh,8px) 0"}}>
                      <span style={{fontSize:"clamp(24px,4svh,36px)"}}>😔</span>
                      <p style={{fontSize:"clamp(11px,1.8svh,15px)",fontWeight:800,color:"rgba(255,255,255,0.65)"}}>Nessun premio</p>
                    </div>
                  )}

                  {/* MATCH 3 TO WIN */}
                  <div style={{flexShrink:0,display:"flex",justifyContent:"center",padding:"clamp(4px,0.8svh,8px) 0"}}>
                    <motion.div
                      style={{background:"linear-gradient(135deg,#2e0c5c,#1a0840)",borderRadius:999,border:"1.5px solid rgba(245,180,0,0.55)",padding:"4px 18px",color:"#fde047",fontFamily:"Impact,system-ui",fontSize:"clamp(10px,1.8svh,14px)",letterSpacing:"0.14em",textTransform:"uppercase"}}
                      animate={{boxShadow:["0 0 6px rgba(245,180,0,0.2)","0 0 18px rgba(245,180,0,0.65)","0 0 6px rgba(245,180,0,0.2)"]}}
                      transition={{duration:1.7,repeat:Infinity}}>
                      MATCH 3 TO WIN!
                    </motion.div>
                  </div>
                </div>

                {/* Prize table – only idle */}
                {phase==="idle" && (
                  <div style={{flexShrink:0,display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:"clamp(4px,0.8svh,6px)",padding:"0 10px clamp(4px,0.8svh,8px)"}}>
                    {PRIZES.map(p=>(
                      <div key={p.symbol} style={{borderRadius:10,padding:"clamp(4px,0.8svh,6px) 4px",background:"rgba(0,0,0,0.38)",border:`1px solid ${p.color}33`,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                        <PrizeIcon prize={p} size={20}/>
                        <span style={{fontSize:"clamp(8px,1.4svh,10px)",fontWeight:800,color:p.color,textAlign:"center",lineHeight:1.1}}>{p.label}</span>
                        <span style={{fontSize:"clamp(7px,1.2svh,9px)",color:"rgba(255,255,255,0.3)"}}>3×</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Buttons */}
                <div style={{flexShrink:0,display:"flex",gap:"clamp(8px,1.5svh,12px)",padding:`0 10px`}}>
                  {phase==="idle"    && (<><GoldBtn onClick={handlePlay} disabled={sparks<COST} flex1>🎰 PLAY</GoldBtn><GoldBtn onClick={onClose} flex1 variant="dim">CHIUDI</GoldBtn></>)}
                  {phase==="playing" && (<><GoldBtn onClick={onClose} flex1 variant="dim">CHIUDI</GoldBtn></>)}
                  {phase==="result"  && (<><GoldBtn onClick={reset} disabled={sparks<COST} flex1>🎰 RIGIOCA</GoldBtn><GoldBtn onClick={onClose} flex1 variant="dim">CHIUDI</GoldBtn></>)}
                </div>

              </div>{/* end content */}
            </div>{/* end inner */}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
