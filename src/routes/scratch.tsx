import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Ticket, Star, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import confetti from "canvas-confetti";
import { MobileShell } from "@/components/game/MobileShell";
import { GameButton } from "@/components/game/GameButton";
import sparkIcon from "@/assets/icon-spark.png";
import { useGameStore } from "@/lib/gameStore";
import { useAudio } from "@/hooks/useAudio";

export const Route = createFileRoute("/scratch")({
  head: () => ({
    meta: [
      { title: "Golden Room — Gratta e Vinci" },
      { name: "description", content: "Gratta e scopri i tuoi premi segreti!" },
    ],
  }),
  component: ScratchPage,
});

// ─── Tipi ──────────────────────────────────────────────────────
type CardTier = "free" | "silver" | "gold" | "diamond";
interface ScratchCardConfig {
  tier: CardTier;
  label: string;
  cost: number;
  costType: "spark" | "ticket";
  color: string;
  border: string;
  emoji: string;
  prizes: Prize[];
  winChance: number; // 0-1
}
interface Prize {
  symbol: string;
  label: string;
  value: number;
  valueType: "spark" | "ticket";
  color: string;
  weight: number;
}

// ─── Config carte ──────────────────────────────────────────────
const FREE_PRIZES: Prize[] = [
  { symbol: "⭐", label: "+15 Spark", value: 15, valueType: "spark", color: "#f5b400", weight: 40 },
  { symbol: "🎫", label: "+1 Ticket", value: 1, valueType: "ticket", color: "#67e8f9", weight: 20 },
  { symbol: "⚡", label: "+20 Spark", value: 20, valueType: "spark", color: "#f5b400", weight: 30 },
  { symbol: "❌", label: "Niente", value: 0, valueType: "spark", color: "#666", weight: 60 },
];

const SILVER_PRIZES: Prize[] = [
  { symbol: "⚡", label: "+60 Spark", value: 60, valueType: "spark", color: "#f5b400", weight: 30 },
  { symbol: "🎫", label: "+2 Ticket", value: 2, valueType: "ticket", color: "#67e8f9", weight: 15 },
  { symbol: "⚡", label: "+80 Spark", value: 80, valueType: "spark", color: "#f5b400", weight: 25 },
  { symbol: "🎫", label: "+3 Ticket", value: 3, valueType: "ticket", color: "#67e8f9", weight: 10 },
  { symbol: "❌", label: "Niente", value: 0, valueType: "spark", color: "#666", weight: 50 },
];

const GOLD_PRIZES: Prize[] = [
  { symbol: "🌟", label: "+150 Spark", value: 150, valueType: "spark", color: "#f5b400", weight: 25 },
  { symbol: "🎟️", label: "+5 Ticket", value: 5, valueType: "ticket", color: "#67e8f9", weight: 15 },
  { symbol: "⚡", label: "+220 Spark", value: 220, valueType: "spark", color: "#f5b400", weight: 20 },
  { symbol: "👑", label: "+300 Spark JACKPOT", value: 300, valueType: "spark", color: "#ff3da6", weight: 5 },
  { symbol: "❌", label: "Niente", value: 0, valueType: "spark", color: "#666", weight: 35 },
];

const CARD_CONFIGS: ScratchCardConfig[] = [
  {
    tier: "free",
    label: "Gratta Free",
    cost: 0,
    costType: "spark",
    color: "from-emerald-900/60 to-emerald-800/40",
    border: "border-emerald-400/40",
    emoji: "🌿",
    prizes: FREE_PRIZES,
    winChance: 0.55,
  },
  {
    tier: "silver",
    label: "Gratta Silver",
    cost: 30,
    costType: "spark",
    color: "from-slate-700/60 to-slate-600/40",
    border: "border-slate-300/40",
    emoji: "🥈",
    prizes: SILVER_PRIZES,
    winChance: 0.65,
  },
  {
    tier: "gold",
    label: "Gratta Gold",
    cost: 1,
    costType: "ticket",
    color: "from-amber-800/60 to-yellow-700/40",
    border: "border-gold/60",
    emoji: "🏆",
    prizes: GOLD_PRIZES,
    winChance: 0.75,
  },
];

// ─── Utility ───────────────────────────────────────────────────
function weightedRandom<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function generateGrid(prizes: Prize[], winChance: number): Prize[] {
  const isWin = Math.random() < winChance;
  const nonZero = prizes.filter((p) => p.value > 0);
  const zero = prizes.find((p) => p.value === 0)!;

  if (isWin) {
    const winner = weightedRandom(nonZero);
    // 3 matching winners + 6 losers
    const grid = [winner, winner, winner];
    for (let i = 0; i < 6; i++) grid.push(zero);
    return grid.sort(() => Math.random() - 0.5);
  } else {
    // Only 0 or 2 matching (never 3)
    const grid: Prize[] = [];
    for (let i = 0; i < 9; i++) grid.push(weightedRandom(prizes.filter((p) => p.value === 0 || nonZero.includes(p))));
    // Make sure no 3 are the same non-zero prize
    const counts: Record<string, number> = {};
    for (const p of grid) {
      counts[p.symbol] = (counts[p.symbol] || 0) + 1;
    }
    for (const [sym, cnt] of Object.entries(counts)) {
      if (sym !== "❌" && cnt >= 3) {
        // Replace some with zero
        let fixed = 0;
        for (let i = 0; i < grid.length && fixed < cnt - 2; i++) {
          if (grid[i].symbol === sym) { grid[i] = zero; fixed++; }
        }
      }
    }
    return grid;
  }
}

function detectWinner(grid: Prize[]): Prize | null {
  const counts: Record<string, Prize[]> = {};
  for (const p of grid) {
    if (p.value > 0) {
      counts[p.symbol] = counts[p.symbol] || [];
      counts[p.symbol].push(p);
    }
  }
  for (const [, items] of Object.entries(counts)) {
    if (items.length >= 3) return items[0];
  }
  return null;
}

// ─── Scratch Board (singolo canvas sopra tutta la griglia) ────
interface ScratchBoardProps {
  grid: Prize[];
  revealed: boolean[];
  onRevealCell: (index: number) => void;
  disabled: boolean;
}

function ScratchBoard({ grid, revealed, onRevealCell, disabled }: ScratchBoardProps) {
  const wrapRef   = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  // Ref sempre aggiornati — i listener nativi li vedono freschi senza re-crearsi
  const revealedRef   = useRef(revealed);
  const disabledRef   = useRef(disabled);
  const onRevealRef   = useRef(onRevealCell);
  useEffect(() => { revealedRef.current   = revealed;     }, [revealed]);
  useEffect(() => { disabledRef.current   = disabled;     }, [disabled]);
  useEffect(() => { onRevealRef.current   = onRevealCell; }, [onRevealCell]);

  // ── Disegna texture gold su tutto il canvas al mount ──────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap   = wrapRef.current;
    if (!canvas || !wrap) return;

    const dpr = window.devicePixelRatio || 1;
    const W   = wrap.offsetWidth;
    const H   = wrap.offsetHeight;

    // dimensioni fisiche canvas = CSS px × dpr (evita blur su retina)
    canvas.width        = W * dpr;
    canvas.height       = H * dpr;
    canvas.style.width  = W + "px";
    canvas.style.height = H + "px";

    const ctx = canvas.getContext("2d")!;

    // Gradiente oro su tutta la superficie
    const grad = ctx.createLinearGradient(0, 0, W * dpr, H * dpr);
    grad.addColorStop(0,   "#9a6e00");
    grad.addColorStop(0.3, "#ffd700");
    grad.addColorStop(0.6, "#f0b800");
    grad.addColorStop(1,   "#9a6e00");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W * dpr, H * dpr);

    // Rumore visivo
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
      ctx.fillRect(
        Math.random() * W * dpr,
        Math.random() * H * dpr,
        (1 + Math.random() * 2) * dpr,
        (1 + Math.random() * 2) * dpr,
      );
    }

    // Etichetta "GRATTA" centrata in ogni cella
    const cols = 3, rows = 3;
    const cellW = (W * dpr) / cols;
    const cellH = (H * dpr) / rows;
    ctx.fillStyle  = "rgba(60,30,0,0.55)";
    ctx.font       = `bold ${Math.round(cellW * 0.18)}px sans-serif`;
    ctx.textAlign  = "center";
    ctx.textBaseline = "middle";
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillText("GRATTA", c * cellW + cellW / 2, r * cellH + cellH / 2);
      }
    }
  }, []);

  // ── Quando una cella viene rivelata (anche da "Rivela tutto") ──
  // cancella la sua zona del canvas senza toccare React
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap   = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const W   = wrap.offsetWidth;
    const H   = wrap.offsetHeight;
    const cellW = (W * dpr) / 3;
    const cellH = (H * dpr) / 3;

    ctx.globalCompositeOperation = "destination-out";
    revealed.forEach((isRev, i) => {
      if (!isRev) return;
      const col = i % 3;
      const row = Math.floor(i / 3);
      ctx.fillRect(col * cellW, row * cellH, cellW, cellH);
    });
    ctx.globalCompositeOperation = "source-over";
  }, [revealed]);

  // ── Scratch: cancella cerchio grande, poi controlla zona ───────
  const scratchAt = useCallback((clientX: number, clientY: number) => {
    if (disabledRef.current) return;
    const canvas = canvasRef.current;
    const wrap   = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d")!;
    const dpr  = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();

    // posizione in pixel fisici del canvas
    const px = (clientX - rect.left)  * dpr;
    const py = (clientY - rect.top)   * dpr;

    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    // raggio 48 CSS-px → confortevole con il dito su mobile
    ctx.arc(px, py, 48 * dpr, 0, Math.PI * 2);
    ctx.fill();

    // Controlla quali celle non-rivelate sono ora abbastanza scoperte
    const W     = wrap.offsetWidth;
    const H     = wrap.offsetHeight;
    const cellW = (W * dpr) / 3;
    const cellH = (H * dpr) / 3;

    revealedRef.current.forEach((isRev, i) => {
      if (isRev) return;
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x0  = Math.floor(col * cellW);
      const y0  = Math.floor(row * cellH);
      const cw  = Math.floor(cellW);
      const ch  = Math.floor(cellH);

      const data = ctx.getImageData(x0, y0, cw, ch).data;
      let transparent = 0;
      for (let j = 3; j < data.length; j += 4) {
        if (data[j] < 128) transparent++;
      }
      if (transparent / (cw * ch) > 0.38) {
        onRevealRef.current(i);
      }
    });
  }, []);

  // ── Listener touch NON-PASSIVE (native, non React) ─────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTS = (e: TouchEvent) => {
      e.preventDefault();
      isDrawing.current = true;
      scratchAt(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTM = (e: TouchEvent) => {
      e.preventDefault();
      if (!isDrawing.current) return;
      scratchAt(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTE = () => { isDrawing.current = false; };

    canvas.addEventListener("touchstart", onTS, { passive: false });
    canvas.addEventListener("touchmove",  onTM, { passive: false });
    canvas.addEventListener("touchend",   onTE);
    return () => {
      canvas.removeEventListener("touchstart", onTS);
      canvas.removeEventListener("touchmove",  onTM);
      canvas.removeEventListener("touchend",   onTE);
    };
  }, [scratchAt]);

  return (
    <div ref={wrapRef} className="relative select-none" style={{ touchAction: "none" }}>
      {/* Premi visibili sotto */}
      <div className="grid grid-cols-3 gap-2 p-1">
        {grid.map((prize, i) => (
          <div
            key={i}
            className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/40"
            style={{ aspectRatio: "1" }}
          >
            <span className="text-3xl leading-none">{prize.symbol}</span>
            <span className="mt-1 text-[10px] font-extrabold" style={{ color: prize.color }}>
              {prize.label}
            </span>
          </div>
        ))}
      </div>

      {/* Canvas unico sopra tutta la griglia */}
      <canvas
        ref={canvasRef}
        style={{
          position:     "absolute",
          inset:        0,
          cursor:       "crosshair",
          borderRadius: "1rem",
          touchAction:  "none",
        }}
        onMouseDown={() => { isDrawing.current = true; }}
        onMouseUp={()   => { isDrawing.current = false; }}
        onMouseLeave={() => { isDrawing.current = false; }}
        onMouseMove={(e) => { if (isDrawing.current) scratchAt(e.clientX, e.clientY); }}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
function ScratchPage() {
  const { sfx } = useAudio();
  const sparks = useGameStore((s) => s.sparks);
  const tickets = useGameStore((s) => s.tickets);
  const spendSparks = useGameStore((s) => s.spendSparks);
  const spendTickets = useGameStore((s) => s.spendTickets);
  const addSparks = useGameStore((s) => s.addSparks);
  const addTickets = useGameStore((s) => s.addTickets);

  const [selectedTier, setSelectedTier] = useState<CardTier>("free");
  const [grid, setGrid] = useState<Prize[] | null>(null);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [winner, setWinner] = useState<Prize | null>(null);
  const [phase, setPhase] = useState<"select" | "playing" | "result">("select");
  const [toast, setToast] = useState<string | null>(null);
  const [freeUsed, setFreeUsed] = useState(false);

  const cfg = CARD_CONFIGS.find((c) => c.tier === selectedTier)!;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function startCard() {
    sfx("tap");
    if (cfg.tier === "free" && freeUsed) { showToast("Gratta Free già usato oggi!"); return; }
    if (cfg.cost > 0) {
      if (cfg.costType === "spark" && !spendSparks(cfg.cost)) { sfx("error"); showToast("Spark insufficienti!"); return; }
      if (cfg.costType === "ticket" && !spendTickets(cfg.cost)) { sfx("error"); showToast("Ticket insufficienti!"); return; }
    }
    if (cfg.tier === "free") setFreeUsed(true);
    const newGrid = generateGrid(cfg.prizes, cfg.winChance);
    setGrid(newGrid);
    setRevealed(new Array(9).fill(false));
    setWinner(null);
    setPhase("playing");
  }

  function handleReveal(index: number) {
    if (revealed[index]) return;
    sfx("tap");
    const next = [...revealed];
    next[index] = true;
    setRevealed(next);
    // Check win with newly revealed cells
    const revealedPrizes = grid!.filter((_, i) => next[i]);
    if (revealedPrizes.length >= 3) {
      const w = detectWinner(grid!);
      if (w && !winner) {
        setWinner(w);
        sfx("claim");
        confetti({ particleCount: 180, spread: 90, origin: { y: 0.45 }, colors: ["#f5b400", "#ff3da6", "#7c3aed"] });
        // Apply reward
        if (w.valueType === "spark") addSparks(w.value);
        else if (w.valueType === "ticket") addTickets(w.value);
      }
    }
    if (next.every(Boolean)) setPhase("result");
  }

  function revealAll() {
    if (!grid) return;
    sfx("tap");
    const next = new Array(9).fill(true);
    setRevealed(next);
    const w = detectWinner(grid);
    if (w && !winner) {
      setWinner(w);
      sfx("claim");
      confetti({ particleCount: 180, spread: 90, origin: { y: 0.45 }, colors: ["#f5b400", "#ff3da6", "#7c3aed"] });
      if (w.valueType === "spark") addSparks(w.value);
      else if (w.valueType === "ticket") addTickets(w.value);
    }
    setPhase("result");
  }

  function reset() {
    setGrid(null);
    setRevealed([]);
    setWinner(null);
    setPhase("select");
  }

  return (
    <MobileShell>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
            className="sticky top-[4.5rem] z-40 mx-4 rounded-2xl border border-white/20 bg-card-game px-4 py-3 text-center text-sm font-bold text-white shadow-card-game backdrop-blur"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex items-center gap-3 px-4 pb-2">
        <Link to="/lobby">
          <motion.button whileTap={{ scale: 0.9 }} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <ArrowLeft className="h-4 w-4 text-white" />
          </motion.button>
        </Link>
        <div>
          <h1 className="text-stroke-game text-2xl font-extrabold text-gold">🎰 Gratta & Vinci</h1>
          <p className="text-xs font-bold text-white/60">Gratta le caselle e scopri i premi!</p>
        </div>
      </header>

      {/* SELECT TIER */}
      {phase === "select" && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="px-4 space-y-3">
          <p className="text-center text-xs font-extrabold uppercase tracking-widest text-white/50">Scegli la tua carta</p>

          {CARD_CONFIGS.map((c) => {
            const active = selectedTier === c.tier;
            const disabled = c.tier === "free" && freeUsed;
            return (
              <motion.button
                key={c.tier}
                whileTap={{ scale: 0.97 }}
                onClick={() => { sfx("tap"); if (!disabled) setSelectedTier(c.tier); }}
                className={`relative w-full overflow-hidden rounded-3xl border-2 p-4 text-left transition-all ${
                  disabled ? "opacity-40" : ""
                } ${active ? `${c.border} bg-gradient-to-br ${c.color} shadow-card-game` : "border-white/10 bg-card-game"}`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-4xl drop-shadow">{c.emoji}</span>
                  <div className="flex-1">
                    <p className="font-extrabold text-white text-base">{c.label}</p>
                    <p className="text-xs text-white/60 mt-0.5">
                      {c.tier === "free" && freeUsed ? "Già usato oggi" :
                       c.cost === 0 ? "🎁 Gratis ogni giorno" :
                       c.costType === "spark" ? `${c.cost} Spark` : `${c.cost} Ticket`}
                    </p>
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {c.prizes.filter(p => p.value > 0).slice(0, 3).map((p, i) => (
                        <span key={i} className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-bold" style={{ color: p.color }}>
                          {p.symbol} {p.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  {active && <div className="h-3 w-3 rounded-full bg-gold shadow-glow-gold shrink-0" />}
                </div>
              </motion.button>
            );
          })}

          <div className="pt-2">
            <GameButton variant="gold" size="lg" block glow onClick={startCard}>
              <Sparkles className="h-5 w-5" />
              {cfg.cost === 0 ? "Gratta Gratis!" : cfg.costType === "spark" ? `Gratta · ${cfg.cost} Spark` : `Gratta · ${cfg.cost} Ticket`}
            </GameButton>
          </div>

          {/* Regole rapide */}
          <div className="rounded-2xl border border-white/10 bg-card-game p-3 text-center">
            <p className="text-xs font-bold text-white/50">
              ✨ Trova 3 simboli uguali per vincere! · Gratta le caselle col dito
            </p>
          </div>
        </motion.div>
      )}

      {/* PLAYING */}
      {phase === "playing" && grid && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="px-4 space-y-4">

          {/* Win banner */}
          <AnimatePresence>
            {winner && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="rounded-2xl border-2 border-gold/70 bg-gradient-to-br from-amber-700/50 to-yellow-600/30 p-4 text-center shadow-glow-gold"
              >
                <p className="text-3xl">{winner.symbol}</p>
                <p className="mt-1 text-stroke-thin text-xl font-extrabold text-gold">HAI VINTO!</p>
                <p className="text-sm font-bold text-white">{winner.label}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Card header */}
          <div className={`rounded-3xl border-2 bg-gradient-to-br ${cfg.color} ${cfg.border} p-4 shadow-card-game`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-extrabold text-white text-lg">{cfg.emoji} {cfg.label}</p>
                <p className="text-xs text-white/60">Gratta le 9 caselle • 3 uguali = VINCI</p>
              </div>
              <Star className="h-6 w-6 text-gold animate-pulse" />
            </div>

            {/* Griglia con canvas unico */}
            <ScratchBoard
              grid={grid}
              revealed={revealed}
              onRevealCell={handleReveal}
              disabled={phase !== "playing"}
            />
          </div>

          <div className="flex gap-2">
            <GameButton variant="magenta" size="md" block onClick={revealAll}>
              <Sparkles className="h-4 w-4" /> Rivela tutto
            </GameButton>
          </div>
        </motion.div>
      )}

      {/* RESULT */}
      {phase === "result" && grid && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="px-4 space-y-4">
          <div className="rounded-3xl border-2 border-white/20 bg-card-game p-6 text-center shadow-card-game">
            {winner ? (
              <>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}>
                  <span className="text-7xl block">{winner.symbol}</span>
                </motion.div>
                <h2 className="mt-3 text-stroke-game text-3xl font-extrabold text-gold">VINCITORE!</h2>
                <p className="mt-1 text-lg font-bold text-white">{winner.label} aggiunto!</p>
              </>
            ) : (
              <>
                <span className="text-5xl block">😔</span>
                <h2 className="mt-3 text-xl font-extrabold text-white/80">Nessun premio</h2>
                <p className="text-sm text-white/50">Ritenta, sei più vicino ogni grattata!</p>
              </>
            )}

            {/* Show full grid */}
            <div className="mt-4 grid grid-cols-3 gap-1.5">
              {grid.map((prize, i) => (
                <div key={i} className={`rounded-xl border p-2 text-center ${winner && prize.symbol === winner.symbol ? "border-gold/60 bg-gold/10" : "border-white/10 bg-black/20"}`}>
                  <span className="text-xl">{prize.symbol}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Link to="/lobby" className="flex-1">
              <GameButton variant="magenta" size="md" block>
                <ArrowLeft className="h-4 w-4" /> Lobby
              </GameButton>
            </Link>
            <div className="flex-1">
              <GameButton variant="gold" size="md" block glow onClick={reset}>
                <RefreshCw className="h-4 w-4" /> Gioca ancora
              </GameButton>
            </div>
          </div>
        </motion.div>
      )}

      <div className="h-6" />
    </MobileShell>
  );
}
