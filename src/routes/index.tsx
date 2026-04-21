import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Ticket, Sparkles, ChevronRight, Zap, Trophy, CheckCircle2, ShoppingBag, Star } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { MobileShell } from "@/components/game/MobileShell";
import { GameButton } from "@/components/game/GameButton";
import { Badge } from "@/components/game/Badge";
import heroOrb from "@/assets/hero-orb.png";
import goldenCity from "@/assets/room-golden-city.png";
import nightBingo from "@/assets/room-night-bingo.png";
import shopTickets from "@/assets/shop-tickets.png";
import shopVault from "@/assets/shop-spark-vault.png";
import shopVip from "@/assets/shop-vip-pass.png";
import sparkIcon from "@/assets/icon-spark.png";
import { useGameStore, MISSIONS_CONFIG } from "@/lib/gameStore";
import { useAuth } from "@/hooks/useAuth";
import { BOTS, recentBotWins, ROOMS as BOT_ROOMS } from "@/lib/bots";
import { useAudio } from "@/hooks/useAudio";

export const Route = createFileRoute("/")(
  {
    head: () => ({
      meta: [
        { title: "Golden Room — Home" },
        { name: "description", content: "Reveal premium, bingo live, missioni e Spark ogni giorno." },
      ],
    }),
    component: HomePage,
  },
);

function HomePage() {
  const { sfx } = useAudio();
  const { user } = useAuth();
  const dailyClaim = useGameStore((s) => s.dailyClaim);
  const claimEarlyBird = useGameStore((s) => s.claimEarlyBird);
          const lastClaimDate = useGameStore((s) => s.lastClaimDate);
  const lastEarlyBirdDate = useGameStore((s) => s.lastEarlyBirdDate);
  const streak = useGameStore((s) => s.streak);
  const level = useGameStore((s) => s.level);
  const xp = useGameStore((s) => s.xp);
  const missions = useGameStore((s) => s.missions);
  const progressMission = useGameStore((s) => s.progressMission);

  const [toast, setToast] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const claimedToday = lastClaimDate === today;
  const earlyBirdUsed = lastEarlyBirdDate === today;

  const xpInLevel = xp % 100;
  const xpPct = xpInLevel;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  function handleDailyClaim() {
    const result = dailyClaim();
    if (!result.ok) {
      sfx("error");
      showToast("Ricompensa già riscattata oggi!");
      return;
    }
    sfx("claim");
    confetti({ particleCount: 160, spread: 90, origin: { y: 0.4 }, colors: ["#f5b400", "#ff3da6", "#7c3aed"] });
    showToast(result.streakBonus
      ? `🎉 Streak ${result.streak}! +${result.sparks} Spark +${result.tickets} Ticket BONUS!`
      : `🔥 Streak ${result.streak} · +${result.sparks} Spark +${result.tickets} Ticket`
    );
  }

  function handleEarlyBird() {
    const result = claimEarlyBird();
    if (!result.ok) { sfx("error"); showToast("Early Bird già riscattato oggi!"); return; }
    sfx("claim");
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.5 }, colors: ["#f5b400", "#ff3da6"] });
    showToast("⚡ Early Bird! +50 Spark +200 Coin +1 Reveal Premium");
  }

  // Shop items now go through proper purchase flow in /shop
  function handleShopBuy(_item: "tickets" | "sparks" | "vip") {
    sfx("tap");
    // Navigate to shop for proper payment flow
    window.location.href = "/shop";
  }

  // Active missions (not yet claimed, not completed or in progress)
  const activeMissions = MISSIONS_CONFIG.slice(0, 3).map((cfg) => ({
    cfg,
    prog: missions[cfg.id] ?? { progress: 0, claimed: false, resetDate: today },
  }));

  return (
    <MobileShell>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="sticky top-[4.5rem] z-40 mx-4 rounded-2xl border border-white/20 bg-card-game px-4 py-3 text-center text-sm font-bold text-white shadow-card-game backdrop-blur"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* AUTH WELCOME / CTA */}
      {!user && (
        <section className="px-4 pt-2">
          <Link to="/auth">
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-[linear-gradient(135deg,oklch(0.25_0.1_60/0.5),oklch(0.18_0.08_300/0.5))] px-4 py-3 shadow-card-game"
            >
              <div>
                <p className="text-sm font-extrabold text-gold">🔐 Accedi e salva i progressi!</p>
                <p className="text-xs text-white/50">Google · Facebook · Email</p>
              </div>
              <ChevronRight className="h-5 w-5 text-gold shrink-0" />
            </motion.div>
          </Link>
        </section>
      )}
      {user && (
        <section className="px-4 pt-2">
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-900/20 px-4 py-2.5">
            <span className="text-base">👋</span>
            <p className="text-xs font-bold text-emerald-300">Bentornato, <span className="text-white">{user.name?.split(" ")[0] ?? "campione"}</span>!</p>
          </div>
        </section>
      )}

      {/* HERO */}
      <section className="px-4 pt-2">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          className="relative overflow-hidden rounded-3xl border border-white/15 bg-vip-grad p-5 shadow-card-game"
        >
          <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-magenta/40 blur-3xl" />
          <div className="pointer-events-none absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-gold/30 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex-1">
              <Badge variant="live">LIVE</Badge>
              <h1 className="mt-2 text-stroke-game text-3xl font-extrabold leading-tight text-gold">
                Reveal + VIP Night
              </h1>
              <p className="mt-1 text-sm font-bold text-white/90">Ricompense esclusive & big wins!</p>
            </div>
            <motion.img
              src={heroOrb} alt="" width={1024} height={1024}
              className="h-24 w-24 -mt-2 drop-shadow-[0_8px_20px_oklch(0.62_0.28_350/0.6)]"
              animate={{ y: [0, -6, 0], rotate: [-2, 2, -2] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          <div className="relative mt-4 grid gap-2">
            <Link to="/reveal">
              <GameButton variant="gold" size="lg" block glow>
                <Sparkles className="h-5 w-5" /> Apri Reveal Premium
              </GameButton>
            </Link>
            <Link to="/lobby">
              <GameButton variant="magenta" size="md" block>
                Entra in Lobby <ChevronRight className="h-5 w-5" />
              </GameButton>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* DAILY CLAIM */}
      <section className="mt-4 px-4">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleDailyClaim}
          className={`relative w-full overflow-hidden rounded-3xl border-2 p-4 shadow-card-game transition ${
            claimedToday
              ? "border-white/20 bg-card-game opacity-60"
              : "border-gold/60 bg-[linear-gradient(135deg,oklch(0.3_0.15_60),oklch(0.2_0.1_300))]"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎁</span>
                <div>
                  <h3 className="text-stroke-thin text-lg font-extrabold text-gold">
                    {claimedToday ? "Bonus Riscattato ✓" : "Bonus Giornaliero"}
                  </h3>
                  <p className="text-xs font-bold text-white/70">
                    🔥 Streak: {streak} giorni
                    {!claimedToday && ` · +${30 + (streak + 1) * 10} Spark`}
                  </p>
                </div>
              </div>
            </div>
            {!claimedToday && (
              <GameButton variant="gold" size="sm" glow>
                Claim
              </GameButton>
            )}
            {claimedToday && <CheckCircle2 className="h-8 w-8 text-emerald-400" />}
          </div>
        </motion.button>
      </section>

      {/* SEASON PROGRESS */}
      <section className="mt-4 px-4">
        <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-card-game p-4 shadow-card-game">
          <div className="flex items-center gap-3">
            <img src={goldenCity} alt="" width={768} height={768} loading="lazy" className="h-16 w-16 rounded-2xl shadow-glow-gold" />
            <div className="min-w-0 flex-1">
              <h3 className="text-stroke-thin truncate text-lg font-extrabold text-gold">
                Golden Pass · Livello {level}
              </h3>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-black/40 shadow-inset-glow">
                <motion.div
                  className="h-full rounded-full bg-rainbow"
                  initial={{ width: 0 }}
                  animate={{ width: `${xpPct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  style={{ boxShadow: "0 0 12px oklch(0.85 0.18 90 / 0.7)" }}
                />
              </div>
              <p className="mt-1 text-xs font-bold text-white/70">{xpPct}/100 XP · Lv {level}</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="rounded-full bg-cyan-pop/90 px-2.5 py-1 text-xs font-extrabold text-purple-deep shadow-inset-glow">
                +{level * 5}
              </span>
              <img src={sparkIcon} alt="Spark" className="h-5 w-5" width={20} height={20} />
            </div>
          </div>
        </div>
      </section>

      {/* RECOMMENDED SESSION */}
      <section className="mt-5 px-4">
        <SectionLabel>Sessione consigliata</SectionLabel>
        <Link to="/bingo" search={{ roomId: "night-rush" }}>
          <motion.div
            whileTap={{ scale: 0.98 }}
            className="relative mt-2 overflow-hidden rounded-3xl border border-white/15 bg-bingo-grad p-4 shadow-card-game"
          >
            <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-magenta-glow/30 blur-2xl" />
            <div className="flex items-center gap-3">
              <motion.img
                src={nightBingo} alt="" width={768} height={768} loading="lazy"
                className="h-24 w-24 drop-shadow-[0_8px_20px_oklch(0.72_0.3_350/0.6)]"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              <div className="flex-1">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="live">LIVE</Badge>
                  <Badge variant="hot">HOT</Badge>
                </div>
                <h3 className="text-stroke-game mt-1 text-2xl font-extrabold leading-tight text-white">
                  Night Bingo Rush
                </h3>
                <p className="text-sm font-bold text-white/80">Bingo veloce e divertente!</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 rounded-2xl bg-gold-shine px-3 py-2 text-center shadow-button-gold">
                <span className="text-stroke-thin text-sm font-extrabold text-purple-deep">
                  <Ticket className="mr-1 inline h-4 w-4" /> 1 Ticket
                </span>
              </div>
              <div className="flex-1 rounded-2xl bg-magenta-grad px-3 py-2 text-center shadow-button-game">
                <span className="text-stroke-thin text-sm font-extrabold text-white">
                  <Flame className="mr-1 inline h-4 w-4" /> +60 Spark
                </span>
              </div>
            </div>
          </motion.div>
        </Link>
      </section>

      {/* EARLY BIRD */}
      <section className="mt-5 px-4">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleEarlyBird}
          className={`relative w-full overflow-hidden rounded-3xl border-2 p-4 transition ${
            earlyBirdUsed
              ? "border-white/20 bg-card-game opacity-60"
              : "border-white/40 bg-gold-shine shadow-glow-gold"
          }`}
        >
          <div className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
               style={{ background: "radial-gradient(circle at 30% 30%, white, transparent 60%)" }} />
          <div className="relative flex items-center justify-between gap-3">
            <div>
              <h3 className="text-stroke-thin text-2xl font-extrabold text-purple-deep">Early Bird</h3>
              <p className="text-xs font-bold text-purple-deep/80">
                {earlyBirdUsed ? "Già riscattato oggi ✓" : "+50 Spark · +200 Coin · +1 Reveal"}
              </p>
            </div>
            {!earlyBirdUsed
              ? <GameButton variant="magenta" size="md" glow><Zap className="h-4 w-4" /> Claim</GameButton>
              : <CheckCircle2 className="h-8 w-8 text-purple-deep/60" />
            }
          </div>
        </motion.button>
      </section>

      {/* COMMUNITY LIVE FEED */}
      <section className="mt-5 px-4">
        <SectionLabel>Community Live</SectionLabel>
        <div className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-card-game shadow-card-game">
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">Giocatori attivi ora</span>
          </div>
          <CommunityFeed />
        </div>
      </section>

      {/* SHOP */}
      <section className="mt-6 px-3">
        <SectionLabel>Shop & Bundle</SectionLabel>
        <div className="mt-3 grid grid-cols-3 items-stretch gap-3">
          <ShopCard img={shopTickets} title="20 Ticket" price="€4.99" />
          <ShopCard img={shopVault} title="500 Spark" price="€6.99" />
          <ShopCard img={shopVip} title="VIP 30gg" price="€9.99" highlight />
        </div>
        <Link to="/shop">
          <motion.div whileTap={{ scale: 0.97 }} className="mt-2 flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-card-game py-3 text-sm font-bold text-white/70">
            <ShoppingBag className="h-4 w-4" /> Vedi tutto lo shop
          </motion.div>
        </Link>
      </section>

      {/* MISSIONS */}
      <section className="mt-6 px-4">
        <SectionLabel>Missioni del giorno</SectionLabel>
        <div className="mt-2 space-y-2">
          {activeMissions.map(({ cfg, prog }) => (
            <MissionRow
              key={cfg.id}
              icon={cfg.icon}
              title={cfg.title}
              reward={`+${cfg.reward_sparks}`}
              progress={prog.progress}
              total={cfg.total}
              claimed={prog.claimed}
            />
          ))}
        </div>
        <Link to="/missions">
          <motion.div whileTap={{ scale: 0.97 }} className="mt-2 flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-card-game py-3 text-sm font-bold text-white/70">
            <Trophy className="h-4 w-4" /> Tutte le missioni
          </motion.div>
        </Link>
      </section>

      <div className="h-6" />
    </MobileShell>
  );
}


// ─── Community Feed ───────────────────────────────────────────
function CommunityFeed() {
  const ROOMS_NAMES = ["Night Bingo Rush", "Golden City", "Royal VIP Hall", "Neon Newcomer"];
  const [items, setItems] = useState(() =>
    BOTS.slice(0, 3).map((b, i) => ({
      id: i,
      bot: b,
      room: ROOMS_NAMES[i % ROOMS_NAMES.length],
      action: ["sta giocando in", "ha vinto in", "è entrato in"][i % 3],
    }))
  );
  const idRef = useRef(10);

  useEffect(() => {
    const schedule = () => {
      const delay = 5000 + Math.random() * 8000;
      return setTimeout(() => {
        const bot = BOTS[Math.floor(Math.random() * BOTS.length)];
        const room = ROOMS_NAMES[Math.floor(Math.random() * ROOMS_NAMES.length)];
        const actions = ["sta giocando in", "ha vinto in", "è entrato in", "ha aperto un Reveal in"];
        const action = actions[Math.floor(Math.random() * actions.length)];
        setItems((prev) => [
          { id: idRef.current++, bot, room, action },
          ...prev.slice(0, 4),
        ]);
        t = schedule();
      }, delay);
    };
    let t = schedule();
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-0 divide-y divide-white/5">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2.5 px-3 py-2.5">
          <span className="text-xl shrink-0">{item.bot.avatar}</span>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-extrabold" style={{ color: item.bot.color }}>{item.bot.name}</span>
            <span className="text-xs text-white/50"> {item.action} </span>
            <span className="text-xs font-bold text-white/80">{item.room}</span>
          </div>
          <span className="text-[10px] text-white/30 shrink-0">ora</span>
        </div>
      ))}
    </div>
  );
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/20" />
      <span className="text-stroke-thin text-xs font-extrabold uppercase tracking-[0.2em] text-white/90">
        · {children} ·
      </span>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/20" />
    </div>
  );
}

function ShopCard({ img, title, price, highlight }: { img: string; title: string; price: string; highlight?: boolean }) {
  return (
    <Link to="/shop" className="block h-full">
      <motion.button
        whileTap={{ scale: 0.96 }}
        className={`relative flex h-full min-h-[182px] w-full flex-col items-center justify-between overflow-hidden rounded-[30px] border px-2.5 pb-2.5 pt-4 shadow-card-game ${
          highlight
            ? "border-gold/70 bg-[linear-gradient(180deg,oklch(0.34_0.17_330),oklch(0.22_0.11_300))]"
            : "border-white/15 bg-card-game"
        }`}
      >
        {highlight && (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-gold-shine px-1.5 py-0.5 text-[9px] font-extrabold leading-none text-purple-deep">
            BEST
          </span>
        )}
        <span className="min-h-[30px] text-center text-stroke-thin text-[13px] font-extrabold leading-[1.1] text-gold">
          {title}
        </span>
        <img
          src={img}
          alt=""
          className="h-16 w-16 shrink-0 drop-shadow-[0_6px_14px_oklch(0.62_0.28_350/0.5)]"
          loading="lazy"
          width={512}
          height={512}
        />
        <span className="text-stroke-thin text-lg font-extrabold leading-none text-white">{price}</span>
        <span className="mt-2 w-full rounded-full bg-gold-shine py-1.5 text-center text-[11px] font-extrabold uppercase tracking-[0.02em] text-purple-deep shadow-button-gold">
          Acquista
        </span>
      </motion.button>
    </Link>
  );
}

function MissionRow({ icon, title, reward, progress, total, claimed }: {
  icon: string; title: string; reward: string; progress: number; total: number; claimed: boolean;
}) {
  const pct = (progress / total) * 100;
  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-3 shadow-card-game ${claimed ? "border-emerald-500/30 bg-emerald-900/20" : "border-white/10 bg-card-game"}`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-magenta-grad text-xl shadow-glow-magenta">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-extrabold text-white">{title}</p>
          <span className="text-xs font-extrabold text-white/60">{Math.min(progress, total)}/{total}</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/40">
          <div className="h-full bg-rainbow transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold shadow-inset-glow ${claimed ? "bg-emerald-400/20 text-emerald-300" : "bg-gold-shine text-purple-deep"}`}>
        {claimed ? "✓" : (<><img src={sparkIcon} alt="" className="h-3.5 w-3.5" />{reward}</>)}
      </span>
    </div>
  );
}
