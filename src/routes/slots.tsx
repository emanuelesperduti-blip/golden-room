import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Zap, RefreshCw, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { MobileShell } from "@/components/game/MobileShell";
import { GameButton } from "@/components/game/GameButton";
import sparkIcon from "@/assets/icon-spark.png";
import coinIcon from "@/assets/icon-coin.png";
import { useGameStore } from "@/lib/gameStore";
import { useAudio } from "@/hooks/useAudio";

export const Route = createFileRoute("/slots")({
  head: () => ({
    meta: [
      { title: "Golden Room — Slot Machine" },
      { name: "description", content: "Gira i rulli e vinci premi fantastici!" },
    ],
  }),
  component: SlotsPage,
});

// ─── Simboli ───────────────────────────────────────────────────
const SYMBOLS = [
  { id: "lemon",   emoji: "🍋", label: "Limone",  mult: 1,   color: "#fde68a" },
  { id: "cherry",  emoji: "🍒", label: "Ciliegia", mult: 1.5, color: "#fca5a5" },
  { id: "grape",   emoji: "🍇", label: "Uva",      mult: 2,   color: "#c084fc" },
  { id: "bell",    emoji: "🔔", label: "Campana",  mult: 3,   color: "#fde047" },
  { id: "star",    emoji: "⭐", label: "Stella",   mult: 5,   color: "#f5b400" },
  { id: "diamond", emoji: "💎", label: "Diamante", mult: 10,  color: "#67e8f9" },
  { id: "crown",   emoji: "👑", label: "Corona",   mult: 20,  color: "#ff3da6" },
  { id: "seven",   emoji: "7️⃣", label: "Sette",    mult: 50,  color: "#ef4444" },
];

// Weighted list (more lemons/cherries, fewer crowns/sevens)
const REEL_POOL = [
  ...Array(8).fill(SYMBOLS[0]),
  ...Array(6).fill(SYMBOLS[1]),
  ...Array(5).fill(SYMBOLS[2]),
  ...Array(4).fill(SYMBOLS[3]),
  ...Array(3).fill(SYMBOLS[4]),
  ...Array(2).fill(SYMBOLS[5]),
  ...Array(2).fill(SYMBOLS[6]),
  ...Array(1).fill(SYMBOLS[7]),
];

type BetMode = "coin" | "spark";

interface BetConfig { label: string; value: number; }
const COIN_BETS: BetConfig[] = [
  { label: "50", value: 50 },
  { label: "100", value: 100 },
  { label: "200", value: 200 },
  { label: "500", value: 500 },
];
const SPARK_BETS: BetConfig[] = [
  { label: "5", value: 5 },
  { label: "10", value: 10 },
  { label: "25", value: 25 },
];

// ─── Reel Component ────────────────────────────────────────────
interface ReelProps {
  spinning: boolean;
  finalSymbol: typeof SYMBOLS[0] | null;
  onStop: () => void;
  delay: number;
  stopped: boolean;
}

function Reel({ spinning, finalSymbol, onStop, delay, stopped }: ReelProps) {
  const [displaySymbols, setDisplaySymbols] = useState(() => [
    REEL_POOL[Math.floor(Math.random() * REEL_POOL.length)],
    REEL_POOL[Math.floor(Math.random() * REEL_POOL.length)],
    REEL_POOL[Math.floor(Math.random() * REEL_POOL.length)],
  ]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (spinning && !stopped) {
      stoppedRef.current = false;
      intervalRef.current = setInterval(() => {
        if (!stoppedRef.current) {
          setDisplaySymbols([
            REEL_POOL[Math.floor(Math.random() * REEL_POOL.length)],
            REEL_POOL[Math.floor(Math.random() * REEL_POOL.length)],
            REEL_POOL[Math.floor(Math.random() * REEL_POOL.length)],
          ]);
        }
      }, 80);

      const stopTimer = setTimeout(() => {
        stoppedRef.current = true;
        clearInterval(intervalRef.current!);
        if (finalSymbol) {
          const above = REEL_POOL[Math.floor(Math.random() * REEL_POOL.length)];
          const below = REEL_POOL[Math.floor(Math.random() * REEL_POOL.length)];
          setDisplaySymbols([above, finalSymbol, below]);
        }
        onStop();
      }, delay);

      return () => {
        clearInterval(intervalRef.current!);
        clearTimeout(stopTimer);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning]);

  const centerSymbol = displaySymbols[1];

  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-black/50 shadow-inner"
      style={{ height: 120, width: "100%" }}>
      {/* Top faded */}
      <div className="absolute top-0 left-0 right-0 h-1/3 flex items-center justify-center opacity-25 pointer-events-none select-none">
        <span className="text-3xl">{displaySymbols[0].emoji}</span>
      </div>
      {/* Center - active row */}
      <motion.div
        className="flex items-center justify-center z-10"
        animate={spinning && !stopped ? { y: [0, -4, 4, 0] } : {}}
        transition={{ duration: 0.15, repeat: spinning && !stopped ? Infinity : 0 }}
      >
        <span className="text-5xl drop-shadow-[0_0_14px_rgba(245,180,0,0.8)]">
          {centerSymbol.emoji}
        </span>
      </motion.div>
      {/* Bottom faded */}
      <div className="absolute bottom-0 left-0 right-0 h-1/3 flex items-center justify-center opacity-25 pointer-events-none select-none">
        <span className="text-3xl">{displaySymbols[2].emoji}</span>
      </div>
      {/* Center line */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-gold/30" />
    </div>
  );
}

// ─── Win Table ─────────────────────────────────────────────────
function PayTable({ betMode, bet }: { betMode: BetMode; bet: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card-game p-3 space-y-1">
      <p className="text-center text-[11px] font-extrabold uppercase tracking-widest text-gold mb-2">Tabella premi</p>
      {SYMBOLS.slice().reverse().map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-2">
          <span className="text-base">{s.emoji} {s.emoji} {s.emoji}</span>
          <span className="text-xs font-extrabold" style={{ color: s.color }}>
            ×{s.mult} → {bet * s.mult} {betMode === "coin" ? "🪙" : "⚡"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────
function SlotsPage() {
  const { sfx } = useAudio();
  const coins = useGameStore((s) => s.coins);
  const sparks = useGameStore((s) => s.sparks);
  const spendSparks = useGameStore((s) => s.spendSparks);
  const addSparks = useGameStore((s) => s.addSparks);
  const addCoins = useGameStore((s) => s.addCoins);
  const spendCoins = useCallback(
    (n: number) => {
      if (coins < n) return false;
      useGameStore.setState((s) => ({ coins: Math.max(0, s.coins - n) }));
      return true;
    },
    [coins],
  );

  const [betMode, setBetMode] = useState<BetMode>("coin");
  const [betIdx, setBetIdx] = useState(0);
  const betList = betMode === "coin" ? COIN_BETS : SPARK_BETS;
  const bet = betList[betIdx].value;

  const [spinning, setSpinning] = useState(false);
  const [finalSymbols, setFinalSymbols] = useState<(typeof SYMBOLS[0])[]>([SYMBOLS[0], SYMBOLS[0], SYMBOLS[0]]);
  // Use a ref so the evaluateResult callback always sees the current symbols
  const finalSymbolsRef = useRef<(typeof SYMBOLS[0])[]>([SYMBOLS[0], SYMBOLS[0], SYMBOLS[0]]);
  const [stoppedCount, setStoppedCount] = useState(0);
  const stoppedCountRef = useRef(0);
  const [result, setResult] = useState<{ win: boolean; amount: number; symbol?: typeof SYMBOLS[0] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [totalWon, setTotalWon] = useState(0);
  const [spinsPlayed, setSpinsPlayed] = useState(0);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function spin() {
    if (spinning) return;
    sfx("tap");

    // Spend resources
    if (betMode === "coin" && !spendCoins(bet)) { sfx("error"); showToast("Coin insufficienti!"); return; }
    if (betMode === "spark" && !spendSparks(bet)) { sfx("error"); showToast("Spark insufficienti!"); return; }

    // Generate result
    const r1 = REEL_POOL[Math.floor(Math.random() * REEL_POOL.length)];
    let r2: typeof SYMBOLS[0];
    let r3: typeof SYMBOLS[0];

    // Small win chance bump
    const winRoll = Math.random();
    if (winRoll < 0.2) {
      // three of a kind
      r2 = r1; r3 = r1;
    } else if (winRoll < 0.45) {
      // two of a kind (minor pattern)
      r2 = r1;
      r3 = REEL_POOL[Math.floor(Math.random() * REEL_POOL.length)];
    } else {
      r2 = REEL_POOL[Math.floor(Math.random() * REEL_POOL.length)];
      r3 = REEL_POOL[Math.floor(Math.random() * REEL_POOL.length)];
    }

    setFinalSymbols([r1, r2, r3]);
    finalSymbolsRef.current = [r1, r2, r3];
    setStoppedCount(0);
    stoppedCountRef.current = 0;
    setResult(null);
    setSpinning(true);
    setSpinsPlayed((n) => n + 1);
  }

  function handleReelStop() {
    stoppedCountRef.current += 1;
    setStoppedCount(stoppedCountRef.current);
    if (stoppedCountRef.current >= 3) {
      // All stopped → evaluate using the ref (not stale state)
      setSpinning(false);
      evaluateResult(finalSymbolsRef.current);
    }
  }

  function evaluateResult(symbols: typeof SYMBOLS[0][]) {
    const [a, b, c] = symbols;
    if (a.id === b.id && b.id === c.id) {
      const winAmount = bet * a.mult;
      if (betMode === "coin") addCoins(winAmount);
      else addSparks(winAmount);
      setResult({ win: true, amount: winAmount, symbol: a });
      setTotalWon((t) => t + winAmount);
      sfx("claim");
      const intensity = a.mult >= 10 ? 200 : 80;
      confetti({ particleCount: intensity, spread: 80, origin: { y: 0.5 }, colors: ["#f5b400", "#ff3da6", "#7c3aed", "#67e8f9"] });
    } else {
      setResult({ win: false, amount: 0 });
      sfx("error");
    }
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

      <header className="flex items-center gap-3 px-4 pb-3">
        <Link to="/lobby">
          <motion.button whileTap={{ scale: 0.9 }} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <ArrowLeft className="h-4 w-4 text-white" />
          </motion.button>
        </Link>
        <div>
          <h1 className="text-stroke-game text-2xl font-extrabold text-gold">🎰 Slot Machine</h1>
          <p className="text-xs font-bold text-white/60">Gira i rulli — 3 uguali per vincere!</p>
        </div>
      </header>

      <div className="px-4 space-y-4">

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-white/10 bg-card-game px-3 py-2 text-center">
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Giri</p>
            <p className="text-lg font-extrabold text-white">{spinsPlayed}</p>
          </div>
          <div className="rounded-2xl border border-gold/30 bg-gold/10 px-3 py-2 text-center">
            <p className="text-[10px] font-bold text-gold/70 uppercase tracking-wider">Vinto</p>
            <p className="text-lg font-extrabold text-gold">{totalWon}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-card-game px-3 py-2 text-center">
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider">{betMode === "coin" ? "Coin" : "Spark"}</p>
            <p className="text-lg font-extrabold text-white">{betMode === "coin" ? coins.toLocaleString("it-IT") : sparks}</p>
          </div>
        </div>

        {/* Slot Machine Cabinet */}
        <div className="relative overflow-hidden rounded-3xl border-2 border-gold/40 bg-gradient-to-b from-purple-900/80 to-purple-deep/90 p-5 shadow-card-game">
          {/* Decorative lights */}
          <div className="absolute top-0 left-0 right-0 flex justify-around py-1.5 pointer-events-none">
            {["🔴", "🟡", "🟢", "🟡", "🔴"].map((c, i) => (
              <span key={i} className="text-[8px] animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}>{c}</span>
            ))}
          </div>

          <p className="text-center text-[10px] font-extrabold uppercase tracking-widest text-gold/60 mb-3 mt-1">★ GOLDEN ROOM SLOTS ★</p>

          {/* Reels */}
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <Reel
                key={`reel-${i}-${spinsPlayed}`}
                spinning={spinning}
                finalSymbol={finalSymbols[i]}
                onStop={handleReelStop}
                delay={900 + i * 500}
                stopped={stoppedCount > i}
              />
            ))}
          </div>

          {/* Win result */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className={`mt-3 rounded-2xl border-2 py-3 text-center ${
                  result.win ? "border-gold/70 bg-gold/10" : "border-white/10 bg-white/5"
                }`}
              >
                {result.win ? (
                  <>
                    <p className="text-2xl font-extrabold text-gold text-stroke-thin animate-bounce">
                      🎉 {result.symbol?.emoji} × {result.symbol?.mult} = +{result.amount}
                    </p>
                    <p className="text-xs text-white/70">{betMode === "coin" ? "Coin" : "Spark"} aggiunti!</p>
                  </>
                ) : (
                  <p className="text-sm font-bold text-white/50">Nessuna combinazione… ritenta!</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Spin button */}
          <div className="mt-4">
            <GameButton variant="gold" size="lg" block glow onClick={spin} disabled={spinning}>
              {spinning ? (
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}>
                  <RefreshCw className="h-6 w-6" />
                </motion.span>
              ) : (
                <><Zap className="h-6 w-6" /> GIRA! — {bet} {betMode === "coin" ? "🪙" : "⚡"}</>
              )}
            </GameButton>
          </div>
        </div>

        {/* Bet controls */}
        <div className="rounded-2xl border border-white/10 bg-card-game p-3 space-y-3">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setBetMode("coin"); setBetIdx(0); }}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold transition ${
                betMode === "coin" ? "bg-gold-shine text-purple-deep shadow-button-gold" : "bg-white/5 text-white/50"
              }`}
            >
              <img src={coinIcon} alt="" className="h-4 w-4" /> Coin
            </button>
            <button
              type="button"
              onClick={() => { setBetMode("spark"); setBetIdx(0); }}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold transition ${
                betMode === "spark" ? "bg-magenta-grad text-white shadow-button-game" : "bg-white/5 text-white/50"
              }`}
            >
              <img src={sparkIcon} alt="" className="h-4 w-4" /> Spark
            </button>
          </div>

          {/* Bet amount */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-white/60">Puntata:</span>
            <div className="flex gap-1">
              {betList.map((b, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setBetIdx(i)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                    betIdx === i ? "bg-gold-shine text-purple-deep shadow-button-gold" : "bg-white/10 text-white/70"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pay table (collapsible) */}
        <PayTable betMode={betMode} bet={bet} />

        <div className="flex justify-center">
          <Link to="/lobby">
            <motion.button whileTap={{ scale: 0.95 }} className="flex items-center gap-2 rounded-full border border-white/15 bg-card-game px-5 py-2.5 text-sm font-bold text-white/70">
              <ArrowLeft className="h-4 w-4" /> Torna alla Lobby
            </motion.button>
          </Link>
        </div>
      </div>

      <div className="h-8" />
    </MobileShell>
  );
}
