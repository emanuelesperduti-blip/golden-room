import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Sparkles, Ticket, Lock, ArrowLeft, Crown, Zap } from "lucide-react";
import { MobileShell } from "@/components/game/MobileShell";
import { GameButton } from "@/components/game/GameButton";
import revealChest from "@/assets/reveal-chest.png";
import sparkIcon from "@/assets/icon-spark.png";
import { useGameStore } from "@/lib/gameStore";
import { useViewerGameState } from "@/hooks/useViewerGameState";
import { useAudio } from "@/hooks/useAudio";

export const Route = createFileRoute("/reveal")({
  head: () => ({
    meta: [
      { title: "GameSpark — Reveal" },
      { name: "description", content: "Apri il tuo reveal premium quotidiano e scopri ricompense magiche." },
    ],
  }),
  component: RevealPage,
});

type RewardKind = "spark" | "ticket" | "coin" | "gem" | "premium_reveal";

interface Reward {
  type: RewardKind;
  value: number;
  label: string;
  emoji: string;
  color: string;
}

const FREE_REWARDS: Reward[] = [
  { type: "spark", value: 8, label: "+8 Spark", emoji: "⚡", color: "oklch(0.85 0.18 90)" },
  { type: "spark", value: 12, label: "+12 Spark", emoji: "⚡", color: "oklch(0.85 0.18 90)" },
  { type: "ticket", value: 1, label: "+1 Ticket", emoji: "🎫", color: "oklch(0.78 0.16 220)" },
  { type: "coin", value: 120, label: "+120 Coin", emoji: "🪙", color: "oklch(0.7 0.25 25)" },
];

const PREMIUM_REWARDS: Reward[] = [
  { type: "spark", value: 35, label: "+35 Spark", emoji: "⚡", color: "oklch(0.85 0.18 90)" },
  { type: "spark", value: 60, label: "+60 Spark", emoji: "🌟", color: "oklch(0.85 0.18 90)" },
  { type: "ticket", value: 2, label: "+2 Ticket", emoji: "🎫", color: "oklch(0.78 0.16 220)" },
  { type: "ticket", value: 3, label: "+3 Ticket", emoji: "🎟️", color: "oklch(0.78 0.16 220)" },
  { type: "gem", value: 1, label: "+1 Gemma", emoji: "💎", color: "oklch(0.72 0.28 250)" },
  { type: "coin", value: 250, label: "+250 Coin", emoji: "🪙", color: "oklch(0.7 0.25 25)" },
  { type: "premium_reveal", value: 1, label: "+1 Reveal Extra", emoji: "🎁", color: "oklch(0.7 0.28 350)" },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function RevealPage() {
  const { sfx } = useAudio();
  const { tickets, premiumRevealsLeft, vip } = useViewerGameState();
  const dailyRevealUsed = useGameStore((s) => s.dailyRevealUsed);
  const useFreeReveal = useGameStore((s) => s.useFreeReveal);
  const usePremiumReveal = useGameStore((s) => s.usePremiumReveal);
  const addSparks = useGameStore((s) => s.addSparks);
  const addTickets = useGameStore((s) => s.addTickets);
  const addCoins = useGameStore((s) => s.addCoins);
  const addGems = useGameStore((s) => s.addGems);
  const addPremiumReveals = useGameStore((s) => s.addPremiumReveals);
  const incrementRevealsOpened = useGameStore((s) => s.incrementRevealsOpened);

  const [phase, setPhase] = useState<"idle" | "opening" | "result">("idle");
  const [reward, setReward] = useState<Reward | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [totalOpened, setTotalOpened] = useState(0);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function applyReward(r: Reward) {
    switch (r.type) {
      case "spark": addSparks(r.value); break;
      case "ticket": addTickets(r.value); break;
      case "coin": addCoins(r.value); break;
      case "gem": addGems(r.value); break;
      case "premium_reveal": addPremiumReveals(r.value); break;
    }
    incrementRevealsOpened();
  }

  function doReveal(premium: boolean) {
    if (premium) {
      if (!usePremiumReveal()) {
        sfx("error");
        showToast(`Servono 2 Ticket o Reveal Premium disponibili (hai ${tickets} ticket, ${premiumRevealsLeft} premium)`);
        return;
      }
    } else {
      if (!useFreeReveal()) {
        sfx("error");
        showToast("Reveal gratuito già usato oggi! Torna domani.");
        return;
      }
    }
    setIsPremium(premium);
    setPhase("opening");
    sfx("reveal");
    setTimeout(() => {
      const r = premium ? pick(PREMIUM_REWARDS) : pick(FREE_REWARDS);
      setReward(r);
      applyReward(r);
      setPhase("result");
      setTotalOpened((n) => n + 1);
      sfx(premium ? "win" : "coin");
      confetti({
        particleCount: premium ? 260 : 140,
        spread: premium ? 120 : 90,
        origin: { y: 0.45 },
        colors: premium
          ? ["#ff3da6", "#f5b400", "#7c3aed", "#22d3ee", "#34d399"]
          : ["#f5b400", "#7c3aed", "#22d3ee"],
      });
      if (premium) {
        setTimeout(() => {
          confetti({ particleCount: 100, spread: 80, origin: { x: 0.1, y: 0.6 } });
          confetti({ particleCount: 100, spread: 80, origin: { x: 0.9, y: 0.6 } });
        }, 250);
      }
    }, 1200);
  }

  function reset() {
    setPhase("idle");
    setReward(null);
  }

  const canPremium = premiumRevealsLeft > 0 || tickets >= 2 || vip;
  const canFree = !dailyRevealUsed;

  return (
    <MobileShell>

      {/* Back */}
      <div className="flex items-center gap-3 px-4 pb-2">
        <Link to="/">
          <button className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white active:scale-90">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <div>
          <h1 className="text-stroke-game text-2xl font-extrabold text-gold">Reveal Chamber</h1>
          <p className="text-xs font-bold text-white/60">Il tuo rituale quotidiano</p>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mx-4 mb-2 rounded-2xl border border-red-400/30 bg-red-900/40 px-4 py-2.5 text-center text-sm font-bold text-red-200"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats row */}
      <div className="mx-4 mb-4 flex gap-2">
        <div className="flex-1 rounded-2xl border border-white/10 bg-card-game p-2.5 text-center">
          <div className="text-lg font-extrabold text-gold">{totalOpened}</div>
          <div className="text-[10px] font-bold text-white/50">Aperti oggi</div>
        </div>
        <div className={`flex-1 rounded-2xl border p-2.5 text-center ${canFree ? "border-emerald-400/40 bg-emerald-900/20" : "border-white/10 bg-card-game opacity-60"}`}>
          <div className="text-lg font-extrabold text-emerald-300">{canFree ? "1" : "0"}</div>
          <div className="text-[10px] font-bold text-white/50">Free oggi</div>
        </div>
        <div className={`flex-1 rounded-2xl border p-2.5 text-center ${premiumRevealsLeft > 0 ? "border-gold/40 bg-yellow-900/20" : "border-white/10 bg-card-game"}`}>
          <div className="text-lg font-extrabold text-gold">{premiumRevealsLeft}</div>
          <div className="text-[10px] font-bold text-white/50">Premium</div>
        </div>
      </div>

      {/* Main chest area */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-4">
        <div className="relative">
          {/* Glow ring */}
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-full"
            animate={{ scale: phase === "opening" ? [1, 1.3, 1] : [1, 1.05, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: phase === "opening" ? 0.6 : 2, repeat: Infinity }}
            style={{ background: `radial-gradient(circle, ${isPremium ? "oklch(0.7 0.28 350 / 0.5)" : "oklch(0.85 0.18 90 / 0.4)"}, transparent 60%)`, filter: "blur(15px)" }}
          />

          <AnimatePresence mode="wait">
            {phase === "result" && reward ? (
              <motion.div
                key="result"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 14 }}
                className="relative flex h-52 w-52 flex-col items-center justify-center rounded-[3rem] border-4 border-white/20 shadow-card-game"
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${reward.color.replace(")", " / 0.3)")}, oklch(0.2 0.08 300))`,
                  borderColor: reward.color,
                }}
              >
                <span className="text-7xl">{reward.emoji}</span>
                <p className="mt-3 text-stroke-game text-2xl font-extrabold text-white">{reward.label}</p>
                {isPremium && <span className="mt-1 rounded-full bg-gold-shine px-3 py-0.5 text-xs font-extrabold text-purple-deep">PREMIUM</span>}
              </motion.div>
            ) : (
              <motion.div
                key="chest"
                animate={phase === "opening" ? { scale: [1, 1.15, 0.95, 1.05, 1], rotate: [-5, 5, -3, 3, 0] } : { y: [0, -6, 0] }}
                transition={phase === "opening" ? { duration: 1.2 } : { duration: 3, repeat: Infinity }}
                className="relative"
              >
                <img
                  src={revealChest} alt="Chest" width={512} height={512}
                  className="h-52 w-52 drop-shadow-[0_16px_32px_oklch(0_0_0/0.5)]"
                />
                {phase === "opening" && (
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    animate={{ opacity: [0, 1, 0], scale: [0.8, 1.4, 0.8] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    style={{ background: "radial-gradient(circle, oklch(0.85 0.18 90 / 0.6), transparent 60%)" }}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Buttons */}
        <div className="mt-8 w-full max-w-xs space-y-3">
          {phase === "result" ? (
            <GameButton variant="gold" size="lg" block glow onClick={reset}>
              <Sparkles className="h-5 w-5" /> Apri un altro!
            </GameButton>
          ) : (
            <>
              {/* Free reveal */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => doReveal(false)}
                disabled={!canFree || phase === "opening"}
                className={`relative w-full overflow-hidden rounded-2xl border-2 py-4 text-center font-extrabold transition ${
                  canFree && phase !== "opening"
                    ? "border-emerald-400/60 bg-[linear-gradient(135deg,oklch(0.25_0.12_160),oklch(0.18_0.08_300))] text-emerald-200 active:scale-95"
                    : "border-white/20 bg-white/5 text-white/30 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  <span>{canFree ? "Reveal Gratuito (1/giorno)" : "✓ Gratuito Usato"}</span>
                </div>
              </motion.button>

              {/* Premium reveal */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => doReveal(true)}
                disabled={!canPremium || phase === "opening"}
                className={`relative w-full overflow-hidden rounded-2xl border-2 py-4 text-center font-extrabold transition ${
                  canPremium && phase !== "opening"
                    ? "border-gold/60 bg-[linear-gradient(135deg,oklch(0.35_0.2_60),oklch(0.22_0.1_300))] text-gold active:scale-95"
                    : "border-white/20 bg-white/5 text-white/30 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Crown className="h-5 w-5" />
                  <span>
                    Reveal Premium
                    {premiumRevealsLeft > 0 ? ` (${premiumRevealsLeft} disponibili)` : " (2 Ticket)"}
                  </span>
                </div>
              </motion.button>

              {!canPremium && (
                <div className="flex items-center justify-center gap-2 text-xs text-white/50">
                  <Lock className="h-3.5 w-3.5" />
                  <span>Hai {tickets} ticket · Compra dal shop o ottieni reveal dal daily claim</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* VIP upsell */}
        {!vip && (
          <div className="mt-6 w-full max-w-xs rounded-2xl border border-gold/30 bg-[linear-gradient(135deg,oklch(0.25_0.1_60/0.6),oklch(0.18_0.08_300/0.6))] p-3 text-center">
            <p className="text-xs font-bold text-gold/80">
              <Crown className="mr-1 inline h-3.5 w-3.5" />
              VIP Pass — reveal premium illimitati al prezzo ridotto!
            </p>
            <Link to="/shop">
              <button className="mt-2 rounded-xl bg-gold-shine px-4 py-1.5 text-xs font-extrabold text-purple-deep">
                Attiva VIP →
              </button>
            </Link>
          </div>
        )}
      </section>
    </MobileShell>
  );
}
