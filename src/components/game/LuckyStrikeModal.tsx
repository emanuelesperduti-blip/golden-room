import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, RefreshCw } from "lucide-react";
import { useEffect, useRef, useCallback, useState } from "react";
import confetti from "canvas-confetti";
import { useGameStore } from "@/lib/gameStore";
import { useAudio } from "@/hooks/useAudio";
import sparkIcon from "@/assets/icon-spark.png";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Prize {
  symbol: string;
  emoji: string;
  label: string;
  value: number;
  weight: number;
  color: string;
  bg: string;
}

// ─── Prize table – strongly house-favoured (~30% edge) ────────────────────────
//  Win chance: 22%
//  When winning: weighted toward cheap prizes
//  EV ≈ 3.5 spark per 5 spark play
const PRIZES: Prize[] = [
  { symbol: "star",    emoji: "⭐", label: "+8 Spark",   value: 8,  weight: 40, color: "#f5b400", bg: "rgba(245,180,0,0.18)" },
  { symbol: "coin",    emoji: "🪙", label: "+12 Spark",  value: 12, weight: 30, color: "#fde68a", bg: "rgba(253,230,138,0.15)" },
  { symbol: "diamond", emoji: "💎", label: "+25 Spark",  value: 25, weight: 20, color: "#67e8f9", bg: "rgba(103,232,249,0.15)" },
  { symbol: "ruby",    emoji: "🔴", label: "+60 Spark",  value: 60, weight: 10, color: "#f43f5e", bg: "rgba(244,63,94,0.15)" },
];

const COST_SPARKS = 5;

function weightedRandom(items: Prize[]): Prize {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

// Generate a 6-cell grid (2 rows × 3 cols).
// Win = exactly 3 matching symbols (never guaranteed until all revealed).
function buildGrid(winChance = 0.22): { prizes: Prize[]; winnerSymbol: string | null } {
  const isWin = Math.random() < winChance;

  if (isWin) {
    const winner = weightedRandom(PRIZES);
    const others = PRIZES.filter((p) => p.symbol !== winner.symbol);
    // 3 winners + 3 random different symbols
    const grid: Prize[] = [winner, winner, winner];
    for (let i = 0; i < 3; i++) grid.push(others[i % others.length]);
    return { prizes: grid.sort(() => Math.random() - 0.5), winnerSymbol: winner.symbol };
  }

  // No win: fill 6 cells ensuring no symbol appears 3+ times
  const grid: Prize[] = [];
  const counts: Record<string, number> = {};
  for (let i = 0; i < 6; i++) {
    const allowed = PRIZES.filter((p) => (counts[p.symbol] ?? 0) < 2);
    const pick = weightedRandom(allowed.length ? allowed : PRIZES);
    counts[pick.symbol] = (counts[pick.symbol] ?? 0) + 1;
    grid.push(pick);
  }
  return { prizes: grid, winnerSymbol: null };
}

// ─── Single Scratch Cell (canvas-based) ───────────────────────────────────────
interface CellProps {
  prize: Prize;
  revealed: boolean;
  onReveal: () => void;
  disabled: boolean;
}

function ScratchCell({ prize, revealed, onReveal, disabled }: CellProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  // Draw scratch layer on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Silver-grey scratch texture
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#9ca3af");
    grad.addColorStop(0.5, "#d1d5db");
    grad.addColorStop(1, "#9ca3af");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Noise
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }

    // "?" text
    ctx.fillStyle = "rgba(60,30,0,0.55)";
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", canvas.width / 2, canvas.height / 2);
  }, []);

  // Clear canvas when revealed
  useEffect(() => {
    if (!revealed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [revealed]);

  const scratch = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled || revealed) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * canvas.width;
      const y = ((clientY - rect.top) / rect.height) * canvas.height;
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, 24, 0, Math.PI * 2);
      ctx.fill();

      // Coverage check
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let transparent = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] < 128) transparent++;
      if (transparent / (canvas.width * canvas.height) > 0.45) onReveal();
    },
    [disabled, revealed, onReveal],
  );

  return (
    <div
      className="relative select-none overflow-hidden rounded-2xl"
      style={{ aspectRatio: "1", background: prize.bg, border: `2px solid ${prize.color}33` }}
    >
      {/* Prize underneath */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="text-4xl leading-none drop-shadow-lg">{prize.emoji}</span>
        <span className="text-[10px] font-extrabold tracking-wide" style={{ color: prize.color }}>
          {prize.label}
        </span>
      </div>

      {/* Scratch canvas overlay */}
      <canvas
        ref={canvasRef}
        width={110}
        height={110}
        className="absolute inset-0 h-full w-full cursor-crosshair rounded-2xl touch-none"
        onMouseDown={() => { drawing.current = true; }}
        onMouseUp={() => { drawing.current = false; }}
        onMouseLeave={() => { drawing.current = false; }}
        onMouseMove={(e) => { if (drawing.current) scratch(e.clientX, e.clientY); }}
        onTouchStart={(e) => { drawing.current = true; scratch(e.touches[0].clientX, e.touches[0].clientY); }}
        onTouchMove={(e) => { e.preventDefault(); scratch(e.touches[0].clientX, e.touches[0].clientY); }}
        onTouchEnd={() => { drawing.current = false; }}
      />
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
}

type Phase = "idle" | "playing" | "result";

export function LuckyStrikeModal({ open, onClose }: Props) {
  const { sfx } = useAudio();
  const sparks = useGameStore((s) => s.sparks);
  const spendSparks = useGameStore((s) => s.spendSparks);
  const addSparks = useGameStore((s) => s.addSparks);

  const [phase, setPhase] = useState<Phase>("idle");
  const [grid, setGrid] = useState<Prize[]>([]);
  const [winnerSymbol, setWinnerSymbol] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [winner, setWinner] = useState<Prize | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lives] = useState(3);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  function handlePlay() {
    sfx("tap");
    if (sparks < COST_SPARKS) { sfx("error"); showToast("Spark insufficienti!"); return; }
    spendSparks(COST_SPARKS);
    const { prizes, winnerSymbol: ws } = buildGrid(0.22);
    setGrid(prizes);
    setWinnerSymbol(ws);
    setRevealed(new Array(6).fill(false));
    setWinner(null);
    setPhase("playing");
  }

  function handleReveal(index: number) {
    if (revealed[index]) return;
    sfx("tap");
    const next = [...revealed];
    next[index] = true;
    setRevealed(next);

    if (next.filter(Boolean).length >= 3 && winnerSymbol) {
      const revealedPrizes = grid.filter((_, i) => next[i]);
      const matchCount = revealedPrizes.filter((p) => p.symbol === winnerSymbol).length;
      if (matchCount >= 3 && !winner) {
        const w = grid.find((p) => p.symbol === winnerSymbol)!;
        setWinner(w);
        addSparks(w.value);
        sfx("claim");
        confetti({ particleCount: 200, spread: 80, origin: { y: 0.55 }, colors: ["#f5b400", "#ff3da6", "#7c3aed", "#67e8f9"] });
      }
    }
    if (next.every(Boolean)) setPhase("result");
  }

  function revealAll() {
    sfx("tap");
    const next = new Array(6).fill(true);
    setRevealed(next);
    if (winnerSymbol && !winner) {
      const w = grid.find((p) => p.symbol === winnerSymbol)!;
      setWinner(w);
      addSparks(w.value);
      sfx("claim");
      confetti({ particleCount: 200, spread: 80, origin: { y: 0.55 }, colors: ["#f5b400", "#ff3da6", "#7c3aed", "#67e8f9"] });
    }
    setPhase("result");
  }

  function reset() {
    setPhase("idle");
    setGrid([]);
    setRevealed([]);
    setWinner(null);
    setWinnerSymbol(null);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 40 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed inset-x-4 bottom-24 z-50 max-w-sm mx-auto rounded-[2rem] overflow-hidden shadow-2xl"
            style={{
              background: "linear-gradient(160deg, #4a1c8a 0%, #2d0e6e 50%, #1a0844 100%)",
              border: "2.5px solid rgba(180,120,255,0.5)",
              boxShadow: "0 0 60px rgba(138,43,226,0.5), 0 0 120px rgba(100,0,200,0.3)",
            }}
          >
            {/* Confetti sparkles bg */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              {Array.from({ length: 18 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute rounded-sm"
                  style={{
                    left: `${(i * 7.3) % 100}%`,
                    top: `${(i * 11.7) % 100}%`,
                    width: 5 + (i % 5) * 2,
                    height: 5 + (i % 5) * 2,
                    background: ["#f5b400", "#ff3da6", "#67e8f9", "#a855f7", "#22c55e"][i % 5],
                    opacity: 0.25,
                    transform: `rotate(${(i * 43) % 360}deg)`,
                  }}
                />
              ))}
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20 transition-colors"
            >
              <X className="h-4 w-4 text-white" />
            </button>

            {/* Hearts */}
            <div className="relative flex justify-center gap-1.5 pt-5 pb-1">
              {Array.from({ length: lives }).map((_, i) => (
                <span key={i} className="text-xl drop-shadow" style={{ filter: "drop-shadow(0 0 6px #ef4444)" }}>❤️</span>
              ))}
            </div>

            {/* Title */}
            <div className="relative text-center px-4 pb-3">
              <h2
                className="text-4xl font-extrabold leading-none tracking-wide"
                style={{
                  color: "#f5b400",
                  textShadow: "0 2px 0 #7c2d00, 0 4px 12px rgba(245,180,0,0.5), 0 0 30px rgba(245,180,0,0.3)",
                  WebkitTextStroke: "1px #b8620a",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                LUCKY
              </h2>
              <h2
                className="text-4xl font-extrabold leading-none tracking-wide"
                style={{
                  color: "#f5b400",
                  textShadow: "0 2px 0 #7c2d00, 0 4px 12px rgba(245,180,0,0.5), 0 0 30px rgba(245,180,0,0.3)",
                  WebkitTextStroke: "1px #b8620a",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                STRIKE
              </h2>
              <p className="mt-1 text-xs font-bold text-white/50">
                Costo: <span className="text-gold font-extrabold">{COST_SPARKS}</span>
                <img src={sparkIcon} alt="spark" className="inline h-3 w-3 mx-0.5" />
                per grattata
              </p>
            </div>

            {/* Toast */}
            <AnimatePresence>
              {toast && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mx-4 mb-2 rounded-xl bg-red-500/20 border border-red-400/30 px-3 py-2 text-center text-sm font-bold text-red-200"
                >
                  {toast}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Spark balance */}
            <div className="flex justify-center mb-2">
              <div className="flex items-center gap-1.5 rounded-full bg-black/30 px-4 py-1.5 border border-white/10">
                <img src={sparkIcon} alt="spark" className="h-4 w-4" />
                <span className="text-sm font-extrabold text-gold">{sparks} Spark</span>
              </div>
            </div>

            {/* ─── IDLE phase ─── */}
            {phase === "idle" && (
              <div className="px-4 pb-5 space-y-3">
                {/* Scratch area placeholder */}
                <div
                  className="rounded-2xl border border-white/15 p-3"
                  style={{ background: "rgba(0,0,0,0.3)" }}
                >
                  <div className="text-center mb-2">
                    <span
                      className="inline-block rounded-full px-4 py-1 text-xs font-extrabold uppercase tracking-widest text-white"
                      style={{ background: "rgba(100,20,180,0.6)", border: "1px solid rgba(180,120,255,0.4)" }}
                    >
                      SCRATCH AREA
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {PRIZES.slice(0, 6).concat(PRIZES.slice(0, 2)).slice(0, 6).map((p, i) => (
                      <div
                        key={i}
                        className="aspect-square rounded-xl flex items-center justify-center text-3xl"
                        style={{ background: "rgba(150,150,150,0.15)", border: "1px solid rgba(255,255,255,0.1)" }}
                      >
                        <span className="text-white/30 text-2xl font-bold">?</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-center mt-2">
                    <span className="text-xs font-extrabold text-gold/70 tracking-widest">MATCH 3 TO WIN!</span>
                  </div>
                </div>

                {/* Prize table */}
                <div className="grid grid-cols-2 gap-1.5">
                  {PRIZES.map((p) => (
                    <div
                      key={p.symbol}
                      className="rounded-xl px-2 py-1.5 flex items-center gap-2"
                      style={{ background: p.bg, border: `1px solid ${p.color}33` }}
                    >
                      <span className="text-xl">{p.emoji}</span>
                      <div>
                        <p className="text-[10px] font-extrabold" style={{ color: p.color }}>{p.label}</p>
                        <p className="text-[9px] text-white/40">3× uguali</p>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handlePlay}
                  disabled={sparks < COST_SPARKS}
                  className="w-full h-14 rounded-2xl font-extrabold text-lg uppercase tracking-wide text-purple-900 transition-opacity disabled:opacity-40"
                  style={{
                    background: "linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)",
                    boxShadow: "0 4px 20px rgba(245,180,0,0.4), 0 2px 0 #92400e, inset 0 1px 0 rgba(255,255,255,0.4)",
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    PLAY · {COST_SPARKS} Spark
                  </div>
                </button>
              </div>
            )}

            {/* ─── PLAYING phase ─── */}
            {phase === "playing" && (
              <div className="px-4 pb-5 space-y-3">
                {/* Win banner */}
                <AnimatePresence>
                  {winner && (
                    <motion.div
                      initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="rounded-2xl border-2 border-gold/60 bg-gradient-to-br from-amber-700/40 to-yellow-600/20 p-3 text-center"
                    >
                      <p className="text-3xl">{winner.emoji}</p>
                      <p className="font-extrabold text-gold text-lg">HAI VINTO! {winner.label}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Scratch area */}
                <div className="rounded-2xl border border-white/15 p-3" style={{ background: "rgba(0,0,0,0.3)" }}>
                  <div className="text-center mb-2">
                    <span
                      className="inline-block rounded-full px-4 py-1 text-xs font-extrabold uppercase tracking-widest text-white"
                      style={{ background: "rgba(100,20,180,0.6)", border: "1px solid rgba(180,120,255,0.4)" }}
                    >
                      SCRATCH AREA
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {grid.map((prize, i) => (
                      <ScratchCell
                        key={i}
                        prize={prize}
                        revealed={revealed[i]}
                        onReveal={() => handleReveal(i)}
                        disabled={phase !== "playing"}
                      />
                    ))}
                  </div>
                  <div className="text-center mt-2">
                    <span className="text-xs font-extrabold text-gold/80 tracking-widest animate-pulse">MATCH 3 TO WIN!</span>
                  </div>
                </div>

                {/* Reveal all */}
                <button
                  onClick={revealAll}
                  className="w-full h-12 rounded-2xl font-extrabold text-base uppercase tracking-wide text-white transition-opacity"
                  style={{
                    background: "linear-gradient(135deg, #d946ef, #a855f7)",
                    boxShadow: "0 4px 15px rgba(217,70,239,0.35), 0 2px 0 #7e22ce",
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Sparkles className="h-4 w-4" /> Rivela tutto
                  </div>
                </button>
              </div>
            )}

            {/* ─── RESULT phase ─── */}
            {phase === "result" && (
              <div className="px-4 pb-5 space-y-3">
                <div className="rounded-3xl border border-white/15 p-5 text-center" style={{ background: "rgba(0,0,0,0.3)" }}>
                  {winner ? (
                    <>
                      <motion.span
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 15 }}
                        className="text-6xl block"
                      >
                        {winner.emoji}
                      </motion.span>
                      <h3 className="mt-2 text-2xl font-extrabold text-gold" style={{ textShadow: "0 0 20px rgba(245,180,0,0.5)" }}>
                        VINCITORE!
                      </h3>
                      <p className="text-sm font-bold text-white/80 mt-1">{winner.label} aggiunto!</p>
                    </>
                  ) : (
                    <>
                      <span className="text-5xl block">😔</span>
                      <h3 className="mt-2 text-xl font-extrabold text-white/70">Nessun premio</h3>
                      <p className="text-xs text-white/40 mt-1">Ritenta! La fortuna è dietro l'angolo.</p>
                    </>
                  )}

                  {/* Final grid preview */}
                  <div className="mt-4 grid grid-cols-3 gap-1.5">
                    {grid.map((prize, i) => (
                      <div
                        key={i}
                        className="rounded-xl py-1.5 flex flex-col items-center"
                        style={{
                          background: winner && prize.symbol === winner.symbol ? prize.bg : "rgba(255,255,255,0.05)",
                          border: winner && prize.symbol === winner.symbol ? `1px solid ${prize.color}66` : "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <span className="text-xl">{prize.emoji}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="flex-1 h-12 rounded-2xl font-extrabold text-sm uppercase tracking-wide text-white"
                    style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}
                  >
                    Chiudi
                  </button>
                  <button
                    onClick={reset}
                    disabled={sparks < COST_SPARKS}
                    className="flex-1 h-12 rounded-2xl font-extrabold text-sm uppercase tracking-wide text-purple-900 flex items-center justify-center gap-1.5 disabled:opacity-40"
                    style={{
                      background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
                      boxShadow: "0 4px 15px rgba(245,180,0,0.35)",
                    }}
                  >
                    <RefreshCw className="h-4 w-4" /> Ancora!
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
