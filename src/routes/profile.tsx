import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { Crown, Flame, Trophy, Star, Award, Zap, Edit2, Check, LogOut, LogIn, Palette, Download } from "lucide-react";
import { MobileShell } from "@/components/game/MobileShell";
import { Badge } from "@/components/game/Badge";
import sparkIcon from "@/assets/icon-spark.png";
import coinIcon from "@/assets/icon-coin.png";
import { useGameStore } from "@/lib/gameStore";
import { useAuth } from "@/hooks/useAuth";
import { useViewerGameState } from "@/hooks/useViewerGameState";
import { resetPwaBannerDismissal } from "@/hooks/usePwaInstall";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "GameSpark — Profilo" },
      { name: "description", content: "Il tuo profilo, badge, streak e progressione in GameSpark." },
    ],
  }),
  component: ProfilePage,
});

const BADGES_CONFIG = [
  { name: "First Bingo", icon: Trophy, color: "oklch(0.85 0.18 90)", req: (s: any) => s.bingosWon >= 1 },
  { name: "Streak 3", icon: Flame, color: "oklch(0.7 0.25 25)", req: (s: any) => s.streak >= 3 },
  { name: "VIP", icon: Crown, color: "oklch(0.78 0.16 220)", req: (s: any) => s.vip },
  { name: "Lucky", icon: Star, color: "oklch(0.74 0.18 150)", req: (s: any) => s.revealsOpened >= 5 },
  { name: "Master", icon: Award, color: "oklch(0.7 0.25 350)", req: (s: any) => s.bingosWon >= 3 },
  { name: "Quick", icon: Zap, color: "oklch(0.85 0.18 90)", req: (s: any) => s.roundsPlayed >= 5 },
];

const AVATAR_OPTIONS = ["👑", "🎰", "🃏", "🦁", "🐯", "🦊", "🐸", "👾", "🤖", "🎭", "🎪", "🌟"];

function ProfilePage() {
  const { user, signOut } = useAuth();
  const {
    username,
    avatar: avatarEmoji,
    level,
    xp,
    streak,
    sparks,
    coins,
    tickets,
    vip,
    rank,
  } = useViewerGameState();
  const missions = useGameStore((s) => s.missions);
  const theme = useGameStore((s) => s.theme);
  const setTheme = useGameStore((s) => s.setTheme);

  const storeState = useGameStore.getState();
  const unlockedCount = BADGES_CONFIG.filter((b) => b.req(storeState)).length;
  const completedMissions = Object.values(missions).filter((m) => m.claimed).length;
  const xpInLevel = xp % 100;

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(username);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const displayName = user?.name ?? username;
  const displayAvatar = user?.avatar_url ?? null;
  const providerLabel = user?.provider === "google" ? "Google" : user?.provider === "facebook" ? "Facebook" : user?.provider === "email" ? "Email" : null;

  function saveName() {
    if (nameInput.trim()) useGameStore.setState({ username: nameInput.trim() });
    setEditingName(false);
  }

  async function handleSignOut() {
    if (!confirmSignOut) { setConfirmSignOut(true); setTimeout(() => setConfirmSignOut(false), 3000); return; }
    await signOut();
    setConfirmSignOut(false);
  }

  return (
    <MobileShell>

      {/* Profile header */}
      <section className="px-4">
        <motion.div
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="relative overflow-hidden rounded-3xl border border-white/15 bg-vip-grad p-5 text-center shadow-card-game"
        >
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-gold/30 blur-3xl" />
          <div className="pointer-events-none absolute -left-8 -bottom-8 h-40 w-40 rounded-full bg-magenta/40 blur-3xl" />

          {/* Avatar */}
          <div className="relative mx-auto h-28 w-28">
            <div className="absolute inset-0 animate-glow-pulse rounded-full bg-gold-shine" />
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt="avatar"
                className="absolute inset-1.5 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <button
                onClick={() => setShowAvatarPicker((v) => !v)}
                className="absolute inset-1.5 flex items-center justify-center overflow-hidden rounded-full bg-purple-deep text-5xl active:opacity-80"
              >
                {avatarEmoji}
              </button>
            )}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-gold-shine px-3 py-0.5 shadow-glow-gold">
              <span className="text-stroke-thin text-xs font-extrabold text-purple-deep">LV {level}</span>
            </div>
          </div>

          {/* Avatar picker (guests only) */}
          {showAvatarPicker && !displayAvatar && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative mx-auto mt-3 grid grid-cols-6 gap-1 rounded-2xl border border-white/20 bg-black/50 p-3 backdrop-blur"
            >
              {AVATAR_OPTIONS.map((av) => (
                <button
                  key={av}
                  onClick={() => { useGameStore.setState({ avatar: av }); setShowAvatarPicker(false); }}
                  className={`h-10 w-10 rounded-xl text-2xl transition active:scale-90 ${av === avatarEmoji ? "bg-gold-shine" : "bg-white/10"}`}
                >
                  {av}
                </button>
              ))}
            </motion.div>
          )}

          {/* Username + provider */}
          <div className="relative mt-3 flex items-center justify-center gap-2">
            {editingName && !user ? (
              <>
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveName()}
                  className="rounded-xl border border-white/30 bg-black/40 px-3 py-1 text-center text-lg font-extrabold text-white outline-none"
                  maxLength={20}
                />
                <button onClick={saveName} className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-shine text-purple-deep active:scale-90">
                  <Check className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <h1 className="text-stroke-game text-2xl font-extrabold text-gold">
                  @{displayName.replace(/\s+/g, "_")}
                </h1>
                {!user && (
                  <button onClick={() => setEditingName(true)} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white/70 active:scale-90">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Auth provider badge */}
          {user && providerLabel && (
            <p className="mt-0.5 text-xs font-bold text-white/50">
              Accesso con {providerLabel} · {user.email}
            </p>
          )}

          <div className="mt-1 flex justify-center gap-1 flex-wrap">
            {vip && <Badge variant="vip">VIP</Badge>}
            <Badge variant="hot">RANK #{rank}</Badge>
            <Badge variant="live">🔥 {streak}gg</Badge>
            {user && <Badge variant="new">{providerLabel ?? "Loggato"}</Badge>}
          </div>

          {/* XP bar */}
          <div className="relative mt-4">
            <div className="flex justify-between text-[10px] font-bold text-white/60 mb-1">
              <span>XP {xpInLevel}/100</span>
              <span>Lv {level} → {level + 1}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-black/40 shadow-inset-glow">
              <motion.div
                className="h-full rounded-full bg-rainbow"
                initial={{ width: 0 }}
                animate={{ width: `${xpInLevel}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{ boxShadow: "0 0 12px oklch(0.85 0.18 90 / 0.7)" }}
              />
            </div>
          </div>

          {/* Auth actions */}
          <div className="mt-4 flex gap-2 justify-center">
            {user ? (
              <button
                onClick={handleSignOut}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  confirmSignOut
                    ? "bg-red-500/80 text-white"
                    : "border border-white/20 bg-black/30 text-white/60"
                }`}
              >
                <LogOut className="h-3.5 w-3.5" />
                {confirmSignOut ? "Conferma logout" : "Logout"}
              </button>
            ) : (
              <Link to="/auth">
                <button className="flex items-center gap-2 rounded-xl border border-gold/40 bg-gold-shine px-4 py-2 text-xs font-extrabold text-purple-deep shadow-glow-gold">
                  <LogIn className="h-3.5 w-3.5" />
                  Accedi / Registrati
                </button>
              </Link>
            )}
          </div>
        </motion.div>
      </section>

      {/* Stats grid */}
      <section className="mt-4 px-4">
        <div className="grid grid-cols-3 gap-2">
          <StatCard value={sparks} label="Spark" img={sparkIcon} />
          <StatCard value={tickets} label="Ticket" emoji="🎫" />
          <StatCard value={coins.toLocaleString("it-IT")} label="Coin" img={coinIcon} />
          <StatCard value={bingosWon} label="Bingo Vinti" emoji="🏆" />
          <StatCard value={revealsOpened} label="Reveal" emoji="✨" />
          <StatCard value={completedMissions} label="Missioni" emoji="🎯" />
        </div>
      </section>

      {/* Badges */}
      <section className="mt-5 px-4">
        <SectionLabel>Badge ({unlockedCount}/{BADGES_CONFIG.length})</SectionLabel>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {BADGES_CONFIG.map(({ name, icon: Icon, color, req }) => {
            const unlocked = req(storeState);
            return (
              <motion.div
                key={name}
                whileTap={{ scale: 0.95 }}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center ${
                  unlocked ? "border-white/20 bg-card-game shadow-card-game" : "border-white/5 bg-white/3 opacity-40 grayscale"
                }`}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl shadow-lg"
                  style={{ background: unlocked ? `linear-gradient(135deg, ${color}, oklch(0.2 0.05 300))` : "oklch(0.2 0.02 300)" }}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <span className={`text-[11px] font-extrabold ${unlocked ? "text-white" : "text-white/40"}`}>{name}</span>
                {!unlocked && <span className="text-[9px] text-white/30">🔒 Bloccato</span>}
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Guest upsell */}
      {!user && (
        <section className="mt-4 px-4">
          <div className="rounded-2xl border border-gold/30 bg-[linear-gradient(135deg,oklch(0.22_0.1_60/0.5),oklch(0.16_0.06_300/0.5))] p-4 text-center">
            <p className="text-sm font-extrabold text-gold">🔐 Salva i tuoi progressi!</p>
            <p className="mt-1 text-xs text-white/60">Accedi con Google o Facebook per non perdere Spark, Ticket e badge.</p>
            <Link to="/auth">
              <button className="mt-3 rounded-xl bg-gold-shine px-6 py-2.5 text-sm font-extrabold text-purple-deep shadow-button-gold">
                Accedi gratis →
              </button>
            </Link>
          </div>
        </section>
      )}

      {/* Theme toggle */}
      <section className="mt-4 px-4">
        <SectionLabel>Stile app</SectionLabel>
        <div className="mt-3 rounded-3xl border border-white/10 bg-card-game p-3 shadow-card-game">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/20 text-gold">
              <Palette className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-extrabold text-white">Tema lobby & bingo</p>
              <p className="text-[11px] font-bold text-white/55">Scegli tra layout viola/rosa o blu/celeste</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTheme("royale")}
              className={`rounded-2xl border p-3 text-left transition active:scale-[0.98] ${theme === "royale" ? "border-gold/60 bg-[linear-gradient(135deg,oklch(0.58_0.23_330),oklch(0.32_0.18_300))] shadow-glow-magenta" : "border-white/10 bg-black/20"}`}
            >
              <p className="text-sm font-extrabold text-white">Royal Neon</p>
              <p className="mt-1 text-[11px] font-bold text-white/65">Viola, rosa e gold</p>
            </button>
            <button
              type="button"
              onClick={() => setTheme("ocean")}
              className={`rounded-2xl border p-3 text-left transition active:scale-[0.98] ${theme === "ocean" ? "border-cyan-300/60 bg-[linear-gradient(135deg,oklch(0.5_0.16_220),oklch(0.26_0.1_240))] shadow-[0_0_24px_oklch(0.78_0.16_215/0.35)]" : "border-white/10 bg-black/20"}`}
            >
              <p className="text-sm font-extrabold text-white">Ocean Glow</p>
              <p className="mt-1 text-[11px] font-bold text-white/65">Blu, celeste e ice gold</p>
            </button>
          </div>
        </div>
      </section>

      {/* PWA install helper */}
      <section className="mt-4 px-4">
        <SectionLabel>App sul telefono</SectionLabel>
        <div className="mt-3 rounded-3xl border border-white/10 bg-card-game p-4 shadow-card-game">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-shine text-purple-deep shadow-button-gold">
              <Download className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-white">Installazione PWA</p>
              <p className="mt-1 text-[11px] font-bold leading-relaxed text-white/60">
                Se hai chiuso il banner o vuoi rivedere le istruzioni di installazione, lo puoi riaprire da qui.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              resetPwaBannerDismissal();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-gold/35 bg-[linear-gradient(135deg,oklch(0.26_0.1_60/0.42),oklch(0.18_0.08_300/0.42))] px-4 py-3 text-sm font-extrabold text-gold shadow-card-game active:scale-[0.98]"
          >
            <Download className="h-4 w-4" />
            Mostra di nuovo il banner installazione
          </button>
        </div>
      </section>

      {/* Quick links */}
      <section className="mt-4 px-4 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Link to="/missions">
            <motion.div whileTap={{ scale: 0.97 }} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-card-game p-3 shadow-card-game">
              <span className="text-2xl">🎯</span>
              <div>
                <div className="text-sm font-extrabold text-white">Missioni</div>
                <div className="text-[10px] text-white/50">{completedMissions} completate</div>
              </div>
            </motion.div>
          </Link>
          <Link to="/shop">
            <motion.div whileTap={{ scale: 0.97 }} className="flex items-center gap-2 rounded-2xl border border-gold/30 bg-[linear-gradient(135deg,oklch(0.25_0.1_60/0.5),oklch(0.18_0.08_300/0.5))] p-3 shadow-card-game">
              <span className="text-2xl">🛒</span>
              <div>
                <div className="text-sm font-extrabold text-gold">Shop</div>
                <div className="text-[10px] text-white/50">Ticket, Spark, VIP</div>
              </div>
            </motion.div>
          </Link>
        </div>
      </section>

      <div className="h-6" />
    </MobileShell>
  );
}

function StatCard({ value, label, img, emoji }: { value: string | number; label: string; img?: string; emoji?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-card-game p-3 shadow-card-game">
      <div className="flex items-center gap-1">
        {img && <img src={img} alt="" className="h-4 w-4" />}
        {emoji && <span className="text-base">{emoji}</span>}
        <span className="text-lg font-extrabold text-white">{value}</span>
      </div>
      <span className="text-[10px] font-bold text-white/50">{label}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/20" />
      <span className="text-stroke-thin text-xs font-extrabold uppercase tracking-[0.2em] text-white/90">· {children} ·</span>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/20" />
    </div>
  );
}
