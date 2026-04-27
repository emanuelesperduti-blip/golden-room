import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Ticket, Flame, ChevronRight, Clock, Trophy, TimerReset } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MobileShell } from "@/components/game/MobileShell";
import { Badge } from "@/components/game/Badge";
import sparkIcon from "@/assets/icon-spark.png";
import { ROOMS, getRoomTimeline, type RoomConfig } from "@/lib/rooms";
import { useAudio } from "@/hooks/useAudio";
import { useGameStore } from "@/lib/gameStore";
import { formatRealWin, useRecentWinHistory } from "@/lib/winHistory";
import { getControlledRoomPopulation } from "@/lib/admin";
import { LuckyStrikeModal } from "@/components/game/LuckyStrikeModal";
import lsFab from "@/assets/ls-fab.png";

export const Route = createFileRoute("/lobby")({
  head: () => ({
    meta: [
      { title: "GameSpark — Lobby" },
      { name: "description", content: "Scegli la tua bingo room: VIP, Hot, Free e nuove room ogni giorno." },
    ],
  }),
  component: LobbyPage,
});

function LobbyPage() {
  const realWins = useRecentWinHistory(6);
  const progressMission = useGameStore((s) => s.progressMission);
  const [now, setNow] = useState(() => Date.now());
  const [luckyOpen, setLuckyOpen] = useState(false);
  const [fabVisible, setFabVisible] = useState(true);
  useEffect(() => {
    progressMission("enter_lobby");
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, [progressMission]);

  const roomSummary = useMemo(() => {
    return ROOMS.reduce(
      (acc, room) => {
        const phase = getRoomTimeline(room, now).phase;
        acc[phase] += 1;
        return acc;
      },
      { waiting: 0, playing: 0, finished: 0 },
    );
  }, [now]);

  return (
    <MobileShell>
      <header className="px-4 pb-2">
        <h1 className="text-stroke-game text-3xl font-extrabold text-gold">Lobby</h1>
        <p className="text-sm font-bold text-white/70">Ogni room mostra ora stato reale: countdown, partita in corso o fine turno.</p>
      </header>


      <section data-tour="lobby-summary" className="mx-4 mb-4 grid grid-cols-3 gap-2">
        <SummaryPill label="Prevendita" value={roomSummary.waiting} tone="gold" />
        <SummaryPill label="Live" value={roomSummary.playing} tone="red" />
        <SummaryPill label="Chiusura" value={roomSummary.finished} tone="cyan" />
      </section>
      <section className="mx-4 mb-4 overflow-hidden rounded-2xl border border-white/10 bg-card-game p-3 shadow-card-game">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">Attività live</span>
        </div>
        <div className="max-h-24 space-y-1.5 overflow-hidden">
          <AnimatePresence initial={false}>
            {realWins.map((win) => (
              <motion.div key={win.id} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-xs font-bold text-white/70">
                <span className="shrink-0 text-base">🏆</span>
                <span className="truncate"><span className="text-gold">{win.username}</span> ha vinto {win.prize_label || formatRealWin(win)}</span>
              </motion.div>
            ))}
            {realWins.length === 0 && (
              <motion.div
                key="empty-db-history"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-xs font-bold text-white/45"
              >
                <span className="shrink-0 text-base">🏆</span>
                <span className="truncate">Le ultime vincite appariranno appena vengono salvate nel database.</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <section data-tour="lobby-room-list" className="space-y-3 px-4">
        {ROOMS.map((room, i) => (
          <RoomCard key={room.id} room={room} delay={i * 0.05} index={i} />
        ))}
      </section>

      <div className="h-6" />

      {/* ── Lucky Strike FAB – app-style premium button ── */}
      <AnimatePresence>
        {fabVisible && (
          <motion.div
            initial={{ scale: 0, opacity: 0, x: -24 }}
            animate={{ scale: 1, opacity: 1, x: 0 }}
            exit={{ scale: 0, opacity: 0, x: -24 }}
            transition={{ type: "spring", stiffness: 340, damping: 21 }}
            className="fixed bottom-28 left-3 z-40"
            style={{ filter: "drop-shadow(0 18px 28px rgba(0,0,0,0.58))" }}
          >
            {/* Close X button */}
            <motion.button
              whileTap={{ scale: 0.84 }}
              onClick={() => setFabVisible(false)}
              aria-label="Chiudi Lucky Strike"
              className="absolute -top-2 -right-2 z-20 flex h-7 w-7 items-center justify-center rounded-full text-white"
              style={{
                background: "linear-gradient(180deg, rgba(42,0,72,0.98), rgba(16,0,30,0.95))",
                border: "1.5px solid rgba(255,255,255,0.55)",
                fontSize: 12,
                fontWeight: 950,
                lineHeight: 1,
                boxShadow: "0 7px 18px rgba(0,0,0,0.65), 0 0 14px rgba(245,180,0,0.35)",
              }}
            >
              ✕
            </motion.button>

            {/* Halo premium */}
            <div
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                width: 104,
                height: 104,
                left: -7,
                top: -7,
                background: "radial-gradient(circle, rgba(255,219,92,0.42) 0%, rgba(236,72,153,0.28) 42%, transparent 70%)",
                animation: "ls-fab-halo 1.8s ease-in-out infinite",
                filter: "blur(2px)",
              }}
            />

            {/* Icon button */}
            <motion.button
              whileTap={{ scale: 0.9, y: 3 }}
              whileHover={{ scale: 1.04 }}
              animate={{ y: [0, -7, 0], rotate: [-1.5, 1.5, -1.5] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              onClick={() => setLuckyOpen(true)}
              aria-label="Lucky Strike – Gratta e Vinci"
              style={{
                position: "relative",
                display: "grid",
                placeItems: "center",
                width: 94,
                height: 94,
                borderRadius: 28,
                border: "2px solid rgba(255,236,150,0.78)",
                padding: 0,
                cursor: "pointer",
                overflow: "visible",
                background: "linear-gradient(145deg, rgba(87,20,155,0.92), rgba(255,63,171,0.70) 48%, rgba(245,180,0,0.78))",
                boxShadow: [
                  "0 10px 0 rgba(91,33,12,0.92)",
                  "0 18px 34px rgba(0,0,0,0.55)",
                  "0 0 34px rgba(245,180,0,0.72)",
                  "inset 0 3px 0 rgba(255,255,255,0.35)",
                  "inset 0 -8px 18px rgba(45,0,80,0.38)",
                ].join(", "),
              }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: 7,
                  left: 15,
                  right: 15,
                  height: 18,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.36)",
                  filter: "blur(3px)",
                }}
              />
              <img
                src={lsFab}
                alt="Lucky Strike Gratta e Vinci"
                style={{
                  position: "relative",
                  zIndex: 2,
                  width: 88,
                  height: 88,
                  objectFit: "contain",
                  filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.58)) drop-shadow(0 0 18px rgba(255,224,102,0.95))",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: -11,
                  transform: "translateX(-50%)",
                  zIndex: 3,
                  padding: "3px 10px 4px",
                  borderRadius: 999,
                  background: "linear-gradient(180deg,#fde047,#f59e0b)",
                  border: "1px solid rgba(255,255,255,0.7)",
                  color: "#431407",
                  fontSize: 10,
                  fontWeight: 950,
                  letterSpacing: "0.06em",
                  whiteSpace: "nowrap",
                  boxShadow: "0 5px 12px rgba(0,0,0,0.45), 0 0 16px rgba(245,180,0,0.7)",
                }}
              >
                GRATTA 5 SPARK
              </span>
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: -8,
                  left: -7,
                  zIndex: 4,
                  display: "grid",
                  placeItems: "center",
                  width: 29,
                  height: 29,
                  borderRadius: "50%",
                  background: "linear-gradient(180deg,#ef4444,#b91c1c)",
                  border: "2px solid #fff",
                  color: "white",
                  fontSize: 16,
                  fontWeight: 950,
                  boxShadow: "0 7px 14px rgba(0,0,0,0.45), 0 0 13px rgba(239,68,68,0.8)",
                }}
              >
                !
              </span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <LuckyStrikeModal open={luckyOpen} onClose={() => setLuckyOpen(false)} />
    </MobileShell>
  );
}

function RoomCard({ room, delay, index }: { room: RoomConfig; delay: number; index: number }) {
  const roomRealWins = useRecentWinHistory(1, room.id);
  const { sfx } = useAudio();
  const progressMission = useGameStore((s) => s.progressMission);
  const [now, setNow] = useState(() => Date.now());
  const [players, setPlayers] = useState(() => getControlledRoomPopulation(room).total);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      setPlayers(getControlledRoomPopulation(room).total);
    }, 1000);

    return () => clearInterval(timer);
  }, [room]);

  const timeline = getRoomTimeline(room, now);
  const countdown = `${Math.floor(timeline.phaseRemainingSec / 60)
    .toString()
    .padStart(2, "0")}:${(timeline.phaseRemainingSec % 60).toString().padStart(2, "0")}`;
  const canReserve = room.ticketCost === 0 ? "Gratis" : `${room.ticketCost} Ticket / cartella`;

  return (
    <motion.div
      initial={{ y: 18, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 24 }}
    >
      <Link
        to="/bingo"
        search={{ roomId: room.id }}
        onClick={() => {
          sfx("tap");
          progressMission("enter_lobby");
        }}
      >
        <motion.div
          whileTap={{ scale: 0.98 }}
          className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br ${room.accent} p-3.5 shadow-card-game border-white/15`}
        >
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/15 blur-2xl" />

          <div className="flex items-center gap-3">
            <motion.img
              src={room.img}
              alt=""
              loading="lazy"
              width={768}
              height={768}
              className="h-20 w-20 shrink-0 drop-shadow-[0_8px_20px_oklch(0_0_0/0.5)]"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-1">
                {room.badges.map((badge) => (
                  <Badge key={badge} variant={badge}>
                    {badge.toUpperCase()}
                  </Badge>
                ))}
              </div>
              <h3 className="text-stroke-game mt-1 truncate text-lg font-extrabold leading-tight text-white">{room.name}</h3>
              <p className="truncate text-[11px] font-bold text-white/80">{room.subtitle}</p>

              <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] font-extrabold text-white/90 sm:text-[11px]">
                <span className="flex items-center gap-0.5 rounded-full bg-black/30 px-1.5 py-0.5">
                  <Users className="h-3 w-3" /> {players} in sala
                </span>
                <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-black/30 px-2 py-0.5 whitespace-nowrap">
                  <Ticket className="h-3 w-3" /> {canReserve}
                </span>
                <span className="flex min-w-0 shrink-0 items-center gap-0.5 rounded-full bg-black/30 px-2 py-0.5 whitespace-nowrap leading-none">
                  <Flame className="h-3 w-3 text-gold" /> +{room.sparkReward}
                  <img src={sparkIcon} alt="" className="h-3 w-3" width={12} height={12} />
                  {room.ticketReward > 0 && (
                    <>
                      <span className="text-white/60">·</span>
                      <Ticket className="h-3 w-3 text-gold" /> +{room.ticketReward}
                    </>
                  )}
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {timeline.phase === "waiting" && (
                  <span className="flex items-center gap-1 rounded-full border border-white/30 bg-black/40 px-2 py-0.5 text-[11px] font-extrabold text-gold">
                    <Clock className="h-3 w-3" /> Prossima partita tra {countdown}
                  </span>
                )}
                {timeline.phase === "playing" && (
                  <span className="rounded-full border border-red-300/40 bg-red-500/20 px-2 py-0.5 text-[11px] font-extrabold text-red-200 animate-pulse">
                    🔴 PARTITA IN CORSO
                  </span>
                )}
                {timeline.phase === "finished" && (
                  <span className="flex items-center gap-1 rounded-full border border-cyan-300/35 bg-cyan-400/15 px-2 py-0.5 text-[11px] font-extrabold text-cyan-100">
                    <TimerReset className="h-3 w-3" /> Chiusura turno e validazione vincita
                  </span>
                )}
              </div>

              <div className="mt-1.5 truncate text-[10px] font-bold text-white/55">
                {timeline.phase === "waiting" && "Compra ora la cartella del prossimo turno direttamente dalla room."}
                {timeline.phase === "playing" && "Chi entra adesso attende il turno successivo o prenota la prossima cartella."}
                {timeline.phase === "finished" && (
                  <>
                    <Trophy className="mr-0.5 inline h-3 w-3 text-gold" />
                    {roomRealWins[0] ? formatRealWin(roomRealWins[0]) : "In attesa dei prossimi risultati salvati"}
                  </>
                )}
              </div>
            </div>

            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gold-shine text-purple-deep shadow-button-gold">
              <ChevronRight className="h-5 w-5" strokeWidth={3} />
            </span>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}


function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "gold" | "red" | "cyan";
}) {
  const toneClass =
    tone === "gold"
      ? "border-gold/30 bg-gold/10 text-gold"
      : tone === "red"
        ? "border-red-300/30 bg-red-400/10 text-red-200"
        : "border-cyan-300/30 bg-cyan-400/10 text-cyan-100";

  return (
    <div className={`rounded-2xl border px-3 py-3 text-center shadow-card-game ${toneClass}`}>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
    </div>
  );
}
