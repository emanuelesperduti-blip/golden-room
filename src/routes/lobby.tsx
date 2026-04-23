import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Ticket, Flame, ChevronRight, Clock, Trophy, TimerReset } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MobileShell } from "@/components/game/MobileShell";
import { Badge } from "@/components/game/Badge";
import sparkIcon from "@/assets/icon-spark.png";
import { ROOMS, getRoomTimeline, getRoomPopulation, type RoomConfig } from "@/lib/rooms";
import { useAudio } from "@/hooks/useAudio";
import { useGameStore } from "@/lib/gameStore";
import { recentBotWins, BOTS } from "@/lib/bots";

export const Route = createFileRoute("/lobby")({
  head: () => ({
    meta: [
      { title: "GameSpark — Lobby" },
      { name: "description", content: "Scegli la tua bingo room: VIP, Hot, Free e nuove room ogni giorno." },
    ],
  }),
  component: LobbyPage,
});

interface ActivityItem {
  id: number;
  text: string;
  avatar: string;
  ts: number;
}

let activityId = 0;

function LobbyPage() {
  const progressMission = useGameStore((s) => s.progressMission);
  const [now, setNow] = useState(() => Date.now());
  const [activity, setActivity] = useState<ActivityItem[]>(() => {
    return ROOMS.slice(0, 3)
      .flatMap((r) =>
        recentBotWins(r.name).map((text) => ({
          id: activityId++,
          text,
          avatar: BOTS[Math.floor(Math.random() * BOTS.length)].avatar,
          ts: Date.now(),
        })),
      )
      .slice(0, 4);
  });

  useEffect(() => {
    progressMission("enter_lobby");
    const clock = setInterval(() => setNow(Date.now()), 1000);

    function pushActivity() {
      const room = ROOMS[Math.floor(Math.random() * ROOMS.length)];
      const wins = recentBotWins(room.name);
      const text = wins[Math.floor(Math.random() * wins.length)];
      const avatar = BOTS[Math.floor(Math.random() * BOTS.length)].avatar;
      setActivity((prev) => [{ id: activityId++, text, avatar, ts: Date.now() }, ...prev.slice(0, 5)]);
    }

    const schedule = () => {
      const delay = 8000 + Math.random() * 12000;
      return setTimeout(() => {
        pushActivity();
        timer = schedule();
      }, delay);
    };

    let timer = schedule();
    return () => {
      clearTimeout(timer);
      clearInterval(clock);
    };
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
            {activity.map((item) => (
              <motion.div
                key={item.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-xs font-bold text-white/70"
              >
                <span className="shrink-0 text-base">{item.avatar}</span>
                <span className="truncate">{item.text}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>

      <section data-tour="lobby-room-list" className="space-y-3 px-4">
        {ROOMS.map((room, i) => (
          <RoomCard key={room.id} room={room} delay={i * 0.05} index={i} />
        ))}
      </section>

      <div className="h-6" />
    </MobileShell>
  );
}

function RoomCard({ room, delay, index }: { room: RoomConfig; delay: number; index: number }) {
  const { sfx } = useAudio();
  const progressMission = useGameStore((s) => s.progressMission);
  const [now, setNow] = useState(() => Date.now());
  const [players, setPlayers] = useState(() => getRoomPopulation(room).total);
  const [recentWin, setRecentWin] = useState(() => recentBotWins(room.name)[0]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      setPlayers(getRoomPopulation(room).total);
    }, 1000);

    const winTimer = setInterval(() => {
      setRecentWin(recentBotWins(room.name)[0]);
    }, 15000);

    return () => {
      clearInterval(timer);
      clearInterval(winTimer);
    };
  }, [room.name, index]);

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

              <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] font-extrabold text-white/90">
                <span className="flex items-center gap-0.5 rounded-full bg-black/30 px-1.5 py-0.5">
                  <Users className="h-3 w-3" /> {players} in sala
                </span>
                <span className="flex items-center gap-0.5 rounded-full bg-black/30 px-1.5 py-0.5">
                  <Ticket className="h-3 w-3" /> {canReserve}
                </span>
                <span className="flex items-center gap-0.5 rounded-full bg-black/30 px-1.5 py-0.5">
                  <Flame className="h-3 w-3 text-gold" /> +{room.sparkReward}
                  <img src={sparkIcon} alt="" className="h-3 w-3" width={12} height={12} />
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
                    {recentWin}
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
