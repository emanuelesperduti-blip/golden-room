import { Crown, Volume2, VolumeX, Ticket, Palette, HelpCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import coinIcon from "@/assets/icon-coin.png";
import sparkIcon from "@/assets/icon-spark.png";
import { useGameStore } from "@/lib/gameStore";
import { useViewerGameState } from "@/hooks/useViewerGameState";
import { useAudio } from "@/hooks/useAudio";
import { useAppTour } from "@/components/tutorial/AppTour";

export function TopBar() {
  const { coins, sparks, tickets, vip, streak } = useViewerGameState();
  const muted = useGameStore((s) => s.muted);
  const theme = useGameStore((s) => s.theme);
  const toggleMute = useGameStore((s) => s.toggleMute);
  const setTheme = useGameStore((s) => s.setTheme);
  const { sfx } = useAudio();
  const { startTour } = useAppTour();

  const isOcean = theme === "ocean";

  return (
    <div
      className="w-full border-b border-white/10 backdrop-blur-xl"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 0px)",
        background: isOcean ? "oklch(0.16 0.06 240 / 0.97)" : "oklch(0.16 0.08 300 / 0.97)",
      }}
    >
      <div className="flex items-center gap-2 px-4 pt-2.5 pb-1" data-tour="topbar-wallet">
        <Link to="/shop" className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3 py-1 active:scale-95">
          <img src={coinIcon} alt="" className="h-4 w-4" />
          <span className="text-xs font-extrabold text-gold">{coins.toLocaleString("it-IT")}</span>
        </Link>

        <Link to="/shop" className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3 py-1 active:scale-95">
          <img src={sparkIcon} alt="" className="h-4 w-4" />
          <span className="text-xs font-extrabold text-white">{sparks}</span>
        </Link>

        <Link to="/shop" className="flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-900/20 px-3 py-1 active:scale-95">
          <Ticket className="h-3.5 w-3.5 text-cyan-300" />
          <span className="text-xs font-extrabold text-cyan-200">{tickets}</span>
        </Link>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => {
            sfx("tap");
            setTheme(isOcean ? "royale" : "ocean");
          }}
          className={`flex h-7 w-7 items-center justify-center rounded-full border transition active:scale-90 ${
            isOcean
              ? "border-cyan-300/35 bg-cyan-400/10 text-cyan-100"
              : "border-fuchsia-300/35 bg-fuchsia-400/10 text-fuchsia-100"
          }`}
          aria-label={isOcean ? "Passa a Royal Neon" : "Passa a Ocean Glow"}
        >
          <Palette className="h-3.5 w-3.5" />
        </button>

        {vip && (
          <div className="flex items-center gap-1 rounded-full bg-gold-shine px-2.5 py-1 shadow-glow-gold">
            <Crown className="h-3.5 w-3.5 text-purple-deep" fill="currentColor" />
            <span className="text-[11px] font-extrabold text-purple-deep">VIP</span>
          </div>
        )}

        {streak > 0 && (
          <div className="flex items-center gap-1 rounded-full border border-orange-400/30 bg-orange-900/20 px-2.5 py-1">
            <span className="text-sm leading-none">🔥</span>
            <span className="text-xs font-extrabold text-orange-300">{streak}</span>
          </div>
        )}


        <button
          type="button"
          onClick={() => {
            sfx("tap");
            startTour();
          }}
          aria-label="Apri guida interattiva"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/70 active:scale-90"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => {
            sfx("tap");
            toggleMute();
          }}
          aria-label={muted ? "Attiva effetti audio" : "Disattiva effetti audio"}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/70 active:scale-90"
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mt-1" />
    </div>
  );
}
