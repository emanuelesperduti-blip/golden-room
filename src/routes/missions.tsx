import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import confetti from "canvas-confetti";
import { ArrowLeft, Trophy } from "lucide-react";
import { MobileShell } from "@/components/game/MobileShell";
import sparkIcon from "@/assets/icon-spark.png";
import { useGameStore, MISSIONS_CONFIG } from "@/lib/gameStore";
import { useAudio } from "@/hooks/useAudio";

export const Route = createFileRoute("/missions")({
  head: () => ({
    meta: [
      { title: "GameSpark — Missioni" },
      { name: "description", content: "Completa missioni giornaliere e guadagna Spark e Ticket." },
    ],
  }),
  component: MissionsPage,
});

function MissionsPage() {
  const { sfx } = useAudio();
  const missions = useGameStore((s) => s.missions);
  const claimMission = useGameStore((s) => s.claimMission);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function handleClaim(id: Parameters<typeof claimMission>[0]) {
    const result = claimMission(id);
    if (!result.ok) { sfx("error"); return; }
    sfx("claim");
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.4 }, colors: ["#f5b400", "#ff3da6", "#7c3aed"] });
    const parts = [];
    if (result.sparks) parts.push(`+${result.sparks} Spark`);
    if (result.tickets) parts.push(`+${result.tickets} Ticket`);
    showToast(`🏆 Missione completata! ${parts.join(" · ")}`);
  }

  const completed = MISSIONS_CONFIG.filter((m) => (missions[m.id]?.claimed ?? false)).length;

  return (
    <MobileShell>

      <div className="flex items-center gap-3 px-4 pb-2">
        <Link to="/">
          <button className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white active:scale-90">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <div>
          <h1 className="text-stroke-game text-2xl font-extrabold text-gold">Missioni</h1>
          <p className="text-xs font-bold text-white/60">{completed}/{MISSIONS_CONFIG.length} completate</p>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mx-4 mb-2 rounded-2xl border border-emerald-400/30 bg-emerald-900/30 px-4 py-2.5 text-center text-sm font-bold text-emerald-200"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress overview */}
      <section className="mx-4 mb-4 rounded-2xl border border-white/10 bg-card-game p-4">
        <div className="flex items-center justify-between gap-2 text-sm font-bold text-white/70">
          <span>Progresso missioni</span>
          <span className="text-gold font-extrabold">{completed}/{MISSIONS_CONFIG.length}</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/40">
          <motion.div
            className="h-full rounded-full bg-rainbow"
            initial={{ width: 0 }}
            animate={{ width: `${(completed / MISSIONS_CONFIG.length) * 100}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </section>

      <section className="space-y-3 px-4">
        {MISSIONS_CONFIG.map((cfg, i) => {
          const prog = missions[cfg.id] ?? { progress: 0, claimed: false, resetDate: "" };
          const isComplete = prog.progress >= cfg.total;
          const isClaimed = prog.claimed;
          const pct = Math.min(100, (prog.progress / cfg.total) * 100);

          return (
            <motion.div
              key={cfg.id}
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`relative overflow-hidden rounded-2xl border p-4 shadow-card-game ${
                isClaimed
                  ? "border-emerald-500/30 bg-emerald-900/20"
                  : isComplete
                  ? "border-gold/40 bg-[linear-gradient(135deg,oklch(0.25_0.12_60/0.6),oklch(0.18_0.08_300/0.6))]"
                  : "border-white/10 bg-card-game"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-magenta-grad text-2xl shadow-glow-magenta">
                  {cfg.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-extrabold text-white">{cfg.title}</h3>
                    <div className="flex items-center gap-1 shrink-0">
                      {cfg.reward_sparks > 0 && (
                        <span className="flex items-center gap-0.5 rounded-full bg-gold-shine px-2 py-0.5 text-xs font-extrabold text-purple-deep">
                          <img src={sparkIcon} alt="" className="h-3 w-3" />
                          +{cfg.reward_sparks}
                        </span>
                      )}
                      {cfg.reward_tickets > 0 && (
                        <span className="rounded-full border border-cyan-400/50 bg-cyan-900/30 px-2 py-0.5 text-xs font-extrabold text-cyan-300">
                          +{cfg.reward_tickets}🎫
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-0.5 text-xs text-white/60">{cfg.description}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-2 overflow-hidden rounded-full bg-black/40">
                      <div
                        className="h-full rounded-full bg-rainbow transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-white/50 shrink-0">
                      {Math.min(prog.progress, cfg.total)}/{cfg.total}
                    </span>
                  </div>
                </div>
              </div>

              {/* Claim button */}
              {isComplete && !isClaimed && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleClaim(cfg.id)}
                  className="mt-3 w-full rounded-xl bg-gold-shine py-2.5 text-center text-sm font-extrabold text-purple-deep shadow-button-gold active:opacity-90"
                >
                  🎁 Ritira Ricompensa
                </motion.button>
              )}
              {isClaimed && (
                <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-emerald-400/10 py-2 text-sm font-bold text-emerald-400">
                  <Trophy className="h-4 w-4" /> Completata
                </div>
              )}
            </motion.div>
          );
        })}
      </section>

      <div className="h-6" />
    </MobileShell>
  );
}
