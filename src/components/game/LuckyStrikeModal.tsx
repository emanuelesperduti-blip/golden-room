import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, useCallback, useState } from "react";
import confetti from "canvas-confetti";
import { useGameStore } from "@/lib/gameStore";
import { useAudio } from "@/hooks/useAudio";
import sparkIcon from "@/assets/icon-spark.png";

// ── Real assets ──────────────────────────────────────────────────────────────
import lsBg      from "@/assets/ls-bg.png";
import lsScratch from "@/assets/ls-scratch.png";
import lsStar    from "@/assets/ls-star.png";
import lsCoins   from "@/assets/ls-coins.png";
import lsTitle   from "@/assets/ls-title.png";

// ── CSS keyframes (injected once) ────────────────────────────────────────────
let _injected = false;
function injectStyles() {
  if (_injected || typeof document === "undefined") return;
  _injected = true;
  const s = document.createElement("style");
  s.textContent = `
    @keyframes ls-hb{0%,100%{transform:scale(1)}14%{transform:scale(1.38)}28%{transform:scale(1)}42%{transform:scale(1.22)}70%{transform:scale(1)}}
    @keyframes ls-shimmer{0%{left:-70%}100%{left:130%}}
    @keyframes ls-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}
    @keyframes ls-gplay{0%,100%{box-shadow:0 5px 0 #78350f,0 8px 24px rgba(245,180,0,0.5)}50%{box-shadow:0 5px 0 #78350f,0 8px 55px rgba(245,180,0,1),0 0 80px rgba(245,180,0,0.45)}}
    @keyframes ls-mglow{0%,100%{box-shadow:0 0 8px rgba(245,180,0,0.3),0 0 0 2px rgba(245,180,0,0.35)}50%{box-shadow:0 0 30px rgba(245,180,0,0.85),0 0 0 2.5px rgba(245,180,0,0.75),0 0 55px rgba(245,180,0,0.35)}}
    @keyframes ls-bglow{0%,100%{box-shadow:0 0 0 1.5px rgba(245,180,0,0.55),0 0 40px rgba(245,180,0,0.25)}50%{box-shadow:0 0 0 1.5px rgba(245,180,0,0.9),0 0 60px rgba(245,180,0,0.5)}}
    @keyframes ls-ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
    @keyframes ls-pop{0%{transform:scale(0.25);opacity:0}55%{transform:scale(1.22);opacity:1}78%{transform:scale(0.93)}100%{transform:scale(1);opacity:1}}
    @keyframes ls-near{0%,100%{transform:scale(1)}20%{transform:scale(1.06) rotate(-1.2deg)}40%{transform:scale(1.09) rotate(1.2deg)}60%{transform:scale(1.05) rotate(-0.6deg)}80%{transform:scale(1.02) rotate(0.6deg)}}
    @keyframes ls-spulse{0%,100%{opacity:0.25;transform:scale(0.75)}50%{opacity:0.9;transform:scale(1.3)}}
    @keyframes ls-flash{0%{opacity:0}35%{opacity:0.7}100%{opacity:0}}
  `;
  document.head.appendChild(s);
}

// ── Prizes ───────────────────────────────────────────────────────────────────
interface Prize { symbol: string; img?: string; emoji: string; label: string; value: number; weight: number; color: string; }

const PRIZES: Prize[] = [
  { symbol:"star",    img: lsStar,   emoji:"⭐", label:"+8 Spark",  value:8,  weight:40, color:"#fde047" },
  { symbol:"coin",    img: lsCoins,  emoji:"🪙", label:"+12 Spark", value:12, weight:28, color:"#fde68a" },
  { symbol:"diamond", img: undefined, emoji:"💎", label:"+25 Spark", value:25, weight:22, color:"#67e8f9" },
  { symbol:"ruby",    img: undefined, emoji:"🔴", label:"+55 Spark", value:55, weight:10, color:"#fca5a5" },
];

const COST = 5;

function wRandom(items: Prize[]) {
  const t = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * t;
  for (const x of items) { r -= x.weight; if (r <= 0) return x; }
  return items[items.length - 1];
}

function buildGrid(winChance = 0.22) {
  if (Math.random() < winChance) {
    const w = wRandom(PRIZES);
    const others = PRIZES.filter(p => p.symbol !== w.symbol);
    const g = [w, w, w, others[0], others[1 % others.length], others[2 % others.length]];
    return { prizes: g.sort(() => Math.random() - 0.5), winnerSymbol: w.symbol };
  }
  const g: Prize[] = [];
  const c: Record<string, number> = {};
  for (let i = 0; i < 6; i++) {
    const ok = PRIZES.filter(p => (c[p.symbol] ?? 0) < 2);
    const p = wRandom(ok.length ? ok : PRIZES);
    c[p.symbol] = (c[p.symbol] ?? 0) + 1;
    g.push(p);
  }
  return { prizes: g, winnerSymbol: null };
}

// ── Animated counter ─────────────────────────────────────────────────────────
function Counter({ target, color }: { target: number; color: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    const dur = 1400;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      setV(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target]);
  return <span style={{ color, textShadow: `0 0 18px ${color}` }}>+{v}</span>;
}

// ── Social ticker ─────────────────────────────────────────────────────────────
const TICKS = [
  "🔥 Luca_88 ha vinto 25 Spark!", "⭐ Sara_XO sta grattando...",
  "💎 GoldPlayer ha vinto il diamante!", "🎰 462 persone oggi",
  "🔥 Marco_VIP ha vinto 55 Spark!", "⭐ Lucky_Bea: 3 stelle!",
  "🪙 IlDiavolo ha vinto 12 Spark!", "🔥 Luca_88 ha vinto 25 Spark!",
  "⭐ Sara_XO sta grattando...", "💎 GoldPlayer ha vinto!", "🎰 462 persone oggi",
];
function Ticker() {
  const items = [...TICKS, ...TICKS];
  return (
    <div style={{ overflow: "hidden", height: 20, mask: "linear-gradient(90deg,transparent,black 8%,black 92%,transparent)" }}>
      <div style={{ display: "flex", gap: 28, whiteSpace: "nowrap", animation: "ls-ticker 20s linear infinite" }}>
        {items.map((m, i) => <span key={i} style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,220,150,0.9)" }}>{m}</span>)}
      </div>
    </div>
  );
}

// ── Gold button ───────────────────────────────────────────────────────────────
function GoldBtn({ children, onClick, disabled, flex1, variant = "gold" }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; flex1?: boolean; variant?: "gold" | "dim" | "magenta";
}) {
  const st: Record<string, React.CSSProperties> = {
    gold:    { background: "linear-gradient(180deg,#fde047,#f59e0b 45%,#d97706)", boxShadow: "0 5px 0 #78350f,0 8px 30px rgba(245,180,0,0.55),inset 0 2px 0 rgba(255,255,200,0.5)", color: "#431407" },
    magenta: { background: "linear-gradient(180deg,#f472b6,#ec4899 45%,#be185d)", boxShadow: "0 5px 0 #831843,0 8px 25px rgba(236,72,153,0.5)", color: "#fff" },
    dim:     { background: "linear-gradient(180deg,#ca8a04,#a16207 45%,#854d0e)", boxShadow: "0 5px 0 #713f12", color: "rgba(255,240,180,0.85)" },
  };
  return (
    <motion.button whileTap={{ scale: 0.93, y: 5 }} whileHover={{ y: -2 }} onClick={onClick} disabled={disabled}
      className={variant === "gold" ? "ls-play-btn" : ""}
      style={{
        flex: flex1 ? 1 : undefined, height: 58, borderRadius: 999,
        fontFamily: "Impact,'Arial Black',system-ui", fontSize: 21, fontWeight: 900,
        letterSpacing: "0.03em", textTransform: "uppercase",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
        border: "none", outline: "none", position: "relative", overflow: "hidden",
        animation: variant === "gold" ? "ls-gplay 1.8s ease-in-out infinite" : undefined,
        ...st[variant],
      }}>
      <span style={{ position:"absolute", top:5, left:"14%", right:"14%", height:"30%", borderRadius:999, background:"rgba(255,255,255,0.38)", filter:"blur(2px)", pointerEvents:"none" }} />
      <span style={{ position:"relative", zIndex:1 }}>{children}</span>
    </motion.button>
  );
}

// ── Scratch cell ──────────────────────────────────────────────────────────────
function ScratchCell({ prize, revealed, onReveal, disabled, isWinner, isNearWin, onScratchSfx }: {
  prize: Prize; revealed: boolean; onReveal: () => void;
  disabled: boolean; isWinner: boolean; isNearWin: boolean; onScratchSfx: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing   = useRef(false);

  // Draw real scratch texture image on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;

    const img = new window.Image();
    img.src = lsScratch;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, W, H);
      // "?" overlay
      ctx.fillStyle = "rgba(40,55,80,0.62)";
      ctx.font = `bold 28px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", W / 2, H / 2 + 2);
    };
    img.onerror = () => {
      // Fallback gradient if image fails
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#b8c2cc"); g.addColorStop(0.5, "#e0e8f0"); g.addColorStop(1, "#a8b4c0");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(40,55,80,0.6)";
      ctx.font = "bold 28px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("?", W / 2, H / 2 + 2);
    };
  }, []);

  useEffect(() => {
    if (!revealed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [revealed]);

  const scratch = useCallback((cx: number, cy: number) => {
    if (disabled || revealed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((cx - rect.left) / rect.width) * canvas.width;
    const y = ((cy - rect.top)  / rect.height) * canvas.height;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fill();
    onScratchSfx();
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let t = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 128) t++;
    if (t / (canvas.width * canvas.height) > 0.4) onReveal();
  }, [disabled, revealed, onReveal, onScratchSfx]);

  const cellAnim = !revealed ? (isNearWin ? "ls-near 0.6s ease-in-out infinite" : "ls-breathe 2.5s ease-in-out infinite") : undefined;

  return (
    <div className="relative select-none overflow-hidden" style={{
      borderRadius: 16, aspectRatio: "1",
      background: revealed && isWinner
        ? "radial-gradient(circle at 40% 35%,#4c1d9a,#2d0a70)"
        : "radial-gradient(circle at 40% 35%,#2e1268,#180840)",
      border: revealed && isWinner ? `2.5px solid ${prize.color}` : "2px solid rgba(130,70,220,0.5)",
      animation: revealed && isWinner ? "ls-mglow 1.2s ease-in-out infinite" : cellAnim,
    }}>
      {/* Prize under scratch */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5"
        style={revealed ? { animation: "ls-pop 0.5s ease-out both" } : {}}>
        {prize.img
          ? <img src={prize.img} alt={prize.symbol} style={{ width: "65%", height: "65%", objectFit: "contain", filter: `drop-shadow(0 0 8px ${prize.color})` }} />
          : <span style={{ fontSize: 34, filter: `drop-shadow(0 0 8px ${prize.color})` }}>{prize.emoji}</span>
        }
        <span style={{ fontSize: 10, fontWeight: 800, color: prize.color, textShadow: `0 0 8px ${prize.color}` }}>
          {prize.label}
        </span>
      </div>

      {/* Shimmer sweep on unrevealed */}
      {!revealed && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ borderRadius: 14 }} aria-hidden>
          <div style={{ position:"absolute", top:0, bottom:0, width:"45%", background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.32),transparent)", animation:`ls-shimmer ${2.2 + Math.random()}s ease-in-out infinite`, animationDelay:`${Math.random()*2}s` }} />
        </div>
      )}

      {/* Canvas scratch overlay */}
      <canvas ref={canvasRef} width={130} height={130}
        className="absolute inset-0 h-full w-full touch-none"
        style={{ borderRadius: 14, cursor: disabled || revealed ? "default" : "crosshair" }}
        onMouseDown={() => { drawing.current = true; }}
        onMouseUp={() => { drawing.current = false; }}
        onMouseLeave={() => { drawing.current = false; }}
        onMouseMove={e => { if (drawing.current) scratch(e.clientX, e.clientY); }}
        onTouchStart={e => { drawing.current = true; scratch(e.touches[0].clientX, e.touches[0].clientY); }}
        onTouchMove={e => { e.preventDefault(); scratch(e.touches[0].clientX, e.touches[0].clientY); }}
        onTouchEnd={() => { drawing.current = false; }}
      />
    </div>
  );
}

// ── Sparkle stars overlay (keep some animation over static bg) ────────────────
function Stars() {
  const pts = [
    { l:"12%", t:"8%",  s:14, d:0    },
    { l:"80%", t:"15%", s:16, d:.35  },
    { l:"22%", t:"72%", s:13, d:.7   },
    { l:"74%", t:"60%", s:18, d:.2   },
    { l:"50%", t:"5%",  s:11, d:.5   },
    { l:"88%", t:"42%", s:12, d:.9   },
    { l:"6%",  t:"48%", s:14, d:.15  },
    { l:"60%", t:"85%", s:12, d:.6   },
  ];
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {pts.map((p, i) => (
        <span key={i} style={{ position:"absolute", left:p.l, top:p.t, fontSize:p.s, color:"#f5b400", opacity:.55, animation:`ls-spulse ${2.2+i*.3}s ease-in-out infinite`, animationDelay:`${p.d}s` }}>✦</span>
      ))}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export function LuckyStrikeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sfx } = useAudio();
  const sparks      = useGameStore(s => s.sparks);
  const spendSparks = useGameStore(s => s.spendSparks);
  const addSparks   = useGameStore(s => s.addSparks);

  const [phase, setPhase]             = useState<"idle"|"playing"|"result">("idle");
  const [grid,  setGrid]              = useState<Prize[]>([]);
  const [winnerSymbol, setWinnerSymbol] = useState<string|null>(null);
  const [revealed, setRevealed]       = useState<boolean[]>([]);
  const [winner,   setWinner]         = useState<Prize|null>(null);
  const [toast,    setToast]          = useState<string|null>(null);
  const [winFlash, setWinFlash]       = useState(false);
  const [nearWin,  setNearWin]        = useState<Set<number>>(new Set());

  const lastSfx = useRef(0);
  const scratchSfx = useCallback(() => {
    const n = Date.now();
    if (n - lastSfx.current > 110) { lastSfx.current = n; sfx("coin"); }
  }, [sfx]);

  useEffect(() => { injectStyles(); }, []);

  function toast2(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  function handlePlay() {
    sfx("tap");
    if (sparks < COST) { sfx("error"); toast2(`Servono ${COST} Spark!`); return; }
    spendSparks(COST);
    sfx("purchase");
    const { prizes, winnerSymbol: ws } = buildGrid(0.22);
    setGrid(prizes); setWinnerSymbol(ws);
    setRevealed(new Array(6).fill(false));
    setWinner(null); setNearWin(new Set());
    setPhase("playing");
  }

  function handleReveal(i: number) {
    if (revealed[i]) return;
    sfx("reveal");
    const next = [...revealed]; next[i] = true; setRevealed(next);
    if (winnerSymbol && !winner) {
      const cnt = grid.filter((p, j) => next[j] && p.symbol === winnerSymbol).length;
      if (cnt === 2) {
        const toShake = new Set<number>();
        grid.forEach((p, j) => { if (!next[j] && p.symbol === winnerSymbol) toShake.add(j); });
        setNearWin(toShake);
      }
      if (cnt >= 3) {
        const w = grid.find(p => p.symbol === winnerSymbol)!;
        setWinner(w); addSparks(w.value); sfx("win");
        setWinFlash(true); setTimeout(() => setWinFlash(false), 700);
        setTimeout(() => {
          confetti({ particleCount:280, spread:100, origin:{y:0.45}, colors:["#f5b400","#ff3da6","#7c3aed","#67e8f9","#22c55e"] });
          setTimeout(() => confetti({ particleCount:100, spread:60, origin:{y:0.55,x:0.2}, colors:["#f5b400","#fde68a"] }), 300);
          setTimeout(() => confetti({ particleCount:100, spread:60, origin:{y:0.55,x:0.8}, colors:["#ff3da6","#a855f7"] }), 500);
        }, 100);
        setNearWin(new Set());
      }
    }
    if (next.every(Boolean)) setPhase("result");
  }

  function claimAll() {
    sfx("tap");
    setRevealed(new Array(6).fill(true));
    if (winnerSymbol && !winner) {
      const w = grid.find(p => p.symbol === winnerSymbol)!;
      setWinner(w); addSparks(w.value); sfx("win");
      setWinFlash(true); setTimeout(() => setWinFlash(false), 700);
      confetti({ particleCount:280, spread:100, origin:{y:0.45}, colors:["#f5b400","#ff3da6","#7c3aed","#67e8f9"] });
    }
    setNearWin(new Set());
    setPhase("result");
  }

  function reset() {
    setPhase("idle"); setGrid([]); setRevealed([]); setWinner(null);
    setWinnerSymbol(null); setNearWin(new Set());
  }

  const idlePH = PRIZES.concat(PRIZES).slice(0, 6);

  const PrizeIcon = ({ prize, size = 34 }: { prize: Prize; size?: number }) =>
    prize.img
      ? <img src={prize.img} alt={prize.symbol} style={{ width: size, height: size, objectFit:"contain", filter:`drop-shadow(0 0 8px ${prize.color})` }} />
      : <span style={{ fontSize: size * 0.9, filter:`drop-shadow(0 0 8px ${prize.color})` }}>{prize.emoji}</span>;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            onClick={onClose} />

          {/* Win flash */}
          <AnimatePresence>
            {winFlash && (
              <motion.div initial={{opacity:0}} animate={{opacity:0.6}} exit={{opacity:0}} transition={{duration:0.15}}
                className="fixed inset-0 z-[55] pointer-events-none"
                style={{background:"radial-gradient(circle,#fde047 0%,#f59e0b 40%,transparent 70%)"}} />
            )}
          </AnimatePresence>

          {/* Modal */}
          <motion.div
            initial={{opacity:0, scale:0.78, y:65}}
            animate={{opacity:1, scale:1, y:0}}
            exit={{opacity:0, scale:0.78, y:65}}
            transition={{type:"spring", stiffness:310, damping:27}}
            onClick={e => e.stopPropagation()}
            className="fixed inset-x-3 z-[52] mx-auto overflow-hidden"
            style={{
              maxWidth: 395,
              top: "50%",
              transform: "translateY(-50%)",
              borderRadius: 28,
              // Real background asset
              backgroundImage: `url(${lsBg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <Stars />

            {/* Close */}
            <button onClick={onClose} className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full"
              style={{background:"rgba(0,0,0,0.45)", border:"1px solid rgba(255,255,255,0.25)", backdropFilter:"blur(6px)"}}>
              <X className="h-4 w-4 text-white" />
            </button>

            <div className="relative z-10">

              {/* Hearts */}
              <div className="flex justify-center gap-2.5 pt-5 pb-0.5">
                {[0,1,2].map(i => (
                  <span key={i} style={{fontSize:23, animation:`ls-hb 1.4s ease-in-out infinite`, animationDelay:`${i*.22}s`, display:"inline-block", filter:"drop-shadow(0 0 10px #ef4444)"}}>❤️</span>
                ))}
              </div>

              {/* Real LUCKY STRIKE title image */}
              <div className="flex justify-center px-4 pb-1 pt-0.5">
                <img
                  src={lsTitle}
                  alt="Lucky Strike"
                  style={{
                    width: "92%",
                    objectFit: "contain",
                    // Screen blend to handle possible grey background in the PNG
                    mixBlendMode: "screen",
                    filter: "drop-shadow(0 4px 20px rgba(245,180,0,0.5))",
                  }}
                />
              </div>

              {/* Spark balance */}
              <div className="flex justify-center mb-2">
                <div className="flex items-center gap-1.5 rounded-full px-3 py-1"
                  style={{background:"rgba(0,0,0,0.45)", border:"1px solid rgba(255,255,255,0.12)", backdropFilter:"blur(4px)"}}>
                  <img src={sparkIcon} alt="spark" className="h-3.5 w-3.5" />
                  <span style={{fontSize:12, fontWeight:800, color:"#fde047"}}>{sparks}</span>
                  <span style={{fontSize:11, color:"rgba(255,255,255,0.4)"}}>· {COST} Spark/grattata</span>
                </div>
              </div>

              {/* Ticker */}
              <div className="px-4 mb-2">
                <div className="rounded-full px-3 py-1" style={{background:"rgba(0,0,0,0.4)", border:"1px solid rgba(255,255,255,0.1)"}}>
                  <Ticker />
                </div>
              </div>

              {/* Toast */}
              <AnimatePresence>
                {toast && (
                  <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                    className="mx-4 mb-1 rounded-xl px-3 py-2 text-center text-sm font-bold text-red-200"
                    style={{background:"rgba(220,50,50,0.25)", border:"1px solid rgba(220,80,80,0.4)"}}>
                    {toast}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Win banner */}
              <AnimatePresence>
                {winner && (
                  <motion.div initial={{scale:0.5,opacity:0}} animate={{scale:1,opacity:1}}
                    transition={{type:"spring",stiffness:350,damping:18}}
                    className="mx-4 mb-1 rounded-2xl px-3 py-2 text-center"
                    style={{background:"rgba(245,180,0,0.14)", border:"2.5px solid rgba(245,180,0,0.6)", boxShadow:"0 0 28px rgba(245,180,0,0.3)"}}>
                    <div className="flex justify-center mb-0.5"><PrizeIcon prize={winner} size={36} /></div>
                    <p style={{fontWeight:900, fontSize:16, color:"#fde047"}}>
                      HAI VINTO! <Counter target={winner.value} color="#fde047" /> Spark
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Inner card */}
              <div className="mx-3 mb-3 rounded-3xl overflow-hidden"
                style={{background:"rgba(4,0,28,0.58)", border:"2px solid rgba(220,100,255,0.38)", boxShadow:"inset 0 0 32px rgba(100,20,200,0.32)"}}>

                {/* SCRATCH AREA */}
                <div className="flex justify-center pt-3 pb-2">
                  <div style={{background:"linear-gradient(135deg,#3e1480,#250960)", borderRadius:999, border:"1.5px solid rgba(200,120,255,0.48)", padding:"5px 28px"}}>
                    <span style={{fontFamily:"Impact,system-ui", fontSize:13, letterSpacing:"0.22em", color:"white", textTransform:"uppercase"}}>SCRATCH AREA</span>
                  </div>
                </div>

                {/* 2×3 grid */}
                <div className="grid grid-cols-3 gap-2.5 px-3 pb-2">
                  {phase === "playing"
                    ? grid.map((p, i) => (
                        <ScratchCell key={i} prize={p} revealed={revealed[i]??false}
                          onReveal={() => handleReveal(i)} disabled={false}
                          isWinner={p.symbol === winnerSymbol} isNearWin={nearWin.has(i)}
                          onScratchSfx={scratchSfx} />
                      ))
                    : phase === "result"
                    ? grid.map((p, i) => (
                        <div key={i} className="relative overflow-hidden" style={{
                          borderRadius:16, aspectRatio:"1",
                          background: winner && p.symbol === winner.symbol
                            ? "radial-gradient(circle at 40% 35%,#4c1d9a,#2d0a70)"
                            : "radial-gradient(circle at 40% 35%,#1e0a40,#100525)",
                          border: winner && p.symbol === winner.symbol
                            ? `2.5px solid ${p.color}` : "2px solid rgba(130,70,220,0.3)",
                          animation: winner && p.symbol === winner.symbol ? "ls-mglow 1.2s ease-in-out infinite" : undefined,
                        }}>
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                            <PrizeIcon prize={p} size={32} />
                            <span style={{fontSize:9, fontWeight:700, color:p.color}}>{p.label}</span>
                          </div>
                        </div>
                      ))
                    : idlePH.map((p, i) => (
                        <div key={i} className="relative overflow-hidden"
                          style={{borderRadius:16, aspectRatio:"1", background:"radial-gradient(circle at 40% 35%,#2e1268,#180840)", border:"2px solid rgba(130,70,220,0.45)", animation:`ls-breathe 2.5s ease-in-out infinite`, animationDelay:`${i*.15}s`}}>
                          <div className="absolute inset-0 flex items-center justify-center opacity-30">
                            <PrizeIcon prize={p} size={28} />
                          </div>
                          {/* Real scratch texture on idle cells */}
                          <div className="absolute inset-0 overflow-hidden" style={{borderRadius:14}}>
                            <div style={{
                              position:"absolute", inset:0,
                              backgroundImage:`url(${lsScratch})`, backgroundSize:"cover", backgroundPosition:"center",
                              display:"flex", alignItems:"center", justifyContent:"center",
                            }}>
                              <span style={{fontSize:26, fontWeight:900, color:"rgba(45,60,85,0.65)"}}>?</span>
                            </div>
                            <div style={{position:"absolute", top:0, bottom:0, width:"45%", background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.32),transparent)", animation:`ls-shimmer ${2.2+i*.22}s ease-in-out infinite`, animationDelay:`${i*.3}s`}} />
                          </div>
                        </div>
                      ))
                  }
                </div>

                {/* No prize result */}
                {phase === "result" && !winner && (
                  <div className="text-center py-2">
                    <span style={{fontSize:40}}>😔</span>
                    <p style={{fontSize:16, fontWeight:800, color:"rgba(255,255,255,0.65)", marginTop:4}}>Nessun premio</p>
                    <p style={{fontSize:11, color:"rgba(255,255,255,0.35)"}}>Ritenta! Sei più vicino ogni grattata.</p>
                  </div>
                )}

                {/* MATCH 3 TO WIN */}
                <div className="flex justify-center pb-3 pt-1">
                  <motion.div
                    style={{background:"linear-gradient(135deg,#2e0c5c,#1a0840)", borderRadius:999, border:"1.5px solid rgba(245,180,0,0.55)", padding:"5px 22px", color:"#fde047", fontFamily:"Impact,system-ui", fontSize:14, letterSpacing:"0.14em", textTransform:"uppercase"}}
                    animate={{boxShadow:["0 0 6px rgba(245,180,0,0.2)","0 0 20px rgba(245,180,0,0.65)","0 0 6px rgba(245,180,0,0.2)"]}}
                    transition={{duration:1.7, repeat:Infinity}}>
                    MATCH 3 TO WIN!
                  </motion.div>
                </div>
              </div>

              {/* Mini prize table */}
              {phase === "idle" && (
                <div className="grid grid-cols-4 gap-1.5 px-3 mb-3">
                  {PRIZES.map(p => (
                    <div key={p.symbol} className="rounded-xl px-1 py-2 flex flex-col items-center gap-1"
                      style={{background:"rgba(0,0,0,0.38)", border:`1px solid ${p.color}33`}}>
                      <PrizeIcon prize={p} size={24} />
                      <span style={{fontSize:10, fontWeight:800, color:p.color, textAlign:"center", lineHeight:1.1}}>{p.label}</span>
                      <span style={{fontSize:9, color:"rgba(255,255,255,0.3)"}}>3×</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 px-3 pb-5">
                {phase === "idle"    && (<><GoldBtn onClick={handlePlay} disabled={sparks < COST} flex1>🎰 PLAY</GoldBtn><GoldBtn onClick={onClose} flex1 variant="dim">CHIUDI</GoldBtn></>)}
                {phase === "playing" && (<><GoldBtn onClick={claimAll} flex1 variant="magenta">✨ CLAIM</GoldBtn><GoldBtn onClick={onClose} flex1 variant="dim">CHIUDI</GoldBtn></>)}
                {phase === "result"  && (<><GoldBtn onClick={reset} disabled={sparks < COST} flex1>🎰 RIGIOCA</GoldBtn><GoldBtn onClick={onClose} flex1 variant="dim">CHIUDI</GoldBtn></>)}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
