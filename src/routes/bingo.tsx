import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import {
  Trophy,
  MessageCircle,
  Send,
  ArrowLeft,
  Clock,
  ShoppingCart,
  X,
  TimerReset,
  Ticket,
  Info,
  Minus,
  Plus,
} from "lucide-react";
import { z } from "zod";
import { MobileShell } from "@/components/game/MobileShell";
import bingoBall from "@/assets/bingo-ball-empty.png";
import sideHearts from "@/assets/side-hearts.png";
import sideGift from "@/assets/side-gift.png";
import sideTrophy from "@/assets/side-trophy.png";
import sideGiftBlue from "@/assets/side-gift-blue.png";
import { cardForRound, drawOrderForRound, getRoom, getRoomTimeline, maxCardsPerRoom } from "@/lib/rooms";
import { useGameStore } from "@/lib/gameStore";
import { useAudio } from "@/hooks/useAudio";
import { BOTS, BotChatEngine } from "@/lib/bots";

const searchSchema = z.object({ roomId: z.string().optional() });

export const Route = createFileRoute("/bingo")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Golden Room — Bingo Live" }],
  }),
  component: BingoPage,
});

function checkBingo(card: number[], marked: Set<number>, size: number): boolean {
  for (let r = 0; r < size; r++) {
    const row = card.slice(r * size, (r + 1) * size);
    if (row.every((n) => n === 0 || marked.has(n))) return true;
  }

  for (let c = 0; c < size; c++) {
    let full = true;
    for (let r = 0; r < size; r++) {
      const n = card[r * size + c];
      if (n !== 0 && !marked.has(n)) {
        full = false;
        break;
      }
    }
    if (full) return true;
  }

  if (Array.from({ length: size }, (_, i) => card[i * size + i]).every((n) => n === 0 || marked.has(n))) return true;
  if (Array.from({ length: size }, (_, i) => card[i * size + (size - 1 - i)]).every((n) => n === 0 || marked.has(n))) return true;
  return false;
}

const CELL_PALETTE = [
  "from-[oklch(0.78_0.16_230)] to-[oklch(0.62_0.18_240)] text-white",
  "from-[oklch(0.7_0.2_300)] to-[oklch(0.55_0.22_310)] text-white",
  "from-[oklch(0.88_0.18_90)] to-[oklch(0.78_0.2_75)] text-[oklch(0.25_0.05_60)]",
  "from-white to-[oklch(0.96_0.01_300)] text-[oklch(0.15_0.02_280)]",
  "from-white to-[oklch(0.96_0.01_300)] text-[oklch(0.15_0.02_280)]",
  "from-white to-[oklch(0.96_0.01_300)] text-[oklch(0.15_0.02_280)]",
  "from-white to-[oklch(0.96_0.01_300)] text-[oklch(0.15_0.02_280)]",
  "from-[oklch(0.88_0.18_90)] to-[oklch(0.78_0.2_75)] text-[oklch(0.25_0.05_60)]",
  "from-[oklch(0.78_0.18_150)] to-[oklch(0.6_0.2_150)] text-white",
  "from-white to-[oklch(0.96_0.01_300)] text-[oklch(0.15_0.02_280)]",
  "from-white to-[oklch(0.96_0.01_300)] text-[oklch(0.15_0.02_280)]",
  "from-[oklch(0.78_0.16_230)] to-[oklch(0.62_0.18_240)] text-white",
  "from-white to-[oklch(0.96_0.01_300)] text-[oklch(0.15_0.02_280)]",
  "from-white to-[oklch(0.96_0.01_300)] text-[oklch(0.15_0.02_280)]",
  "from-white to-[oklch(0.96_0.01_300)] text-[oklch(0.15_0.02_280)]",
];

type ChatItem = { user: string; text: string; color: string; avatar: string };
type PurchasedCardState = { roundIndex: number; slot: number; marked: number[] };
type DisplayCard = PurchasedCardState & { key: string; card: number[]; markedSet: Set<number> };

function cardKey(roundIndex: number, slot: number) {
  return `${roundIndex}-${slot}`;
}

function BingoPage() {
  const { roomId } = Route.useSearch();
  const room = getRoom(roomId);
  const navigate = useNavigate();
  const { sfx, speakNumber, startMusic, stopMusic } = useAudio();

  const playerSeed = useGameStore((s) => s.playerSeed);
  const username = useGameStore((s) => s.username);
  const musicMuted = useGameStore((s) => s.musicMuted);
  const muted = useGameStore((s) => s.muted);
  const tickets = useGameStore((s) => s.tickets);
  const spendTickets = useGameStore((s) => s.spendTickets);
  const addSparks = useGameStore((s) => s.addSparks);
  const addTickets = useGameStore((s) => s.addTickets);
  const incrementBingosWon = useGameStore((s) => s.incrementBingosWon);
  const incrementRoundsPlayed = useGameStore((s) => s.incrementRoundsPlayed);

  const [now, setNow] = useState(() => Date.now());
  const [purchasedCards, setPurchasedCards] = useState<PurchasedCardState[]>([]);
  const [purchaseQty, setPurchaseQty] = useState(1);
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatItem[]>([
    { user: "AlessioPro", text: "Chi è pronto? 🔥", color: "oklch(0.7 0.25 25)", avatar: "🎯" },
    { user: "Giulia92", text: "Stasera vinco!! 🌸", color: "oklch(0.74 0.18 150)", avatar: "🌸" },
    { user: "NicolaGold", text: "Buona fortuna! ⚡", color: "oklch(0.85 0.18 90)", avatar: "⚡" },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const botEngineRef = useRef<BotChatEngine | null>(null);
  const spokenDrawRef = useRef<string | null>(null);
  const playedRoundRef = useRef<number | null>(null);
  const cleanupRoundRef = useRef<number | null>(null);
  const bingoRewardedRoundRef = useRef<number | null>(null);

  const timeline = getRoomTimeline(room, now);
  const currentRoundIndex = timeline.activeRoundIndex;
  const upcomingRoundIndex = timeline.upcomingRoundIndex;
  const maxCards = maxCardsPerRoom(room);

  const drawOrder = useMemo(() => drawOrderForRound(room, currentRoundIndex), [room, currentRoundIndex]);
  const botWinner = useMemo(() => BOTS[(currentRoundIndex + room.id.length) % BOTS.length], [currentRoundIndex, room.id]);

  const currentReservations = useMemo(
    () => purchasedCards.filter((entry) => entry.roundIndex === currentRoundIndex).sort((a, b) => a.slot - b.slot),
    [purchasedCards, currentRoundIndex],
  );
  const upcomingReservations = useMemo(
    () => purchasedCards.filter((entry) => entry.roundIndex === upcomingRoundIndex).sort((a, b) => a.slot - b.slot),
    [purchasedCards, upcomingRoundIndex],
  );

  const currentCards = useMemo<DisplayCard[]>(
    () =>
      currentReservations.map((entry) => ({
        ...entry,
        key: cardKey(entry.roundIndex, entry.slot),
        card: cardForRound(room, playerSeed, entry.roundIndex, entry.slot),
        markedSet: new Set(entry.marked),
      })),
    [currentReservations, room, playerSeed],
  );
  const upcomingCards = useMemo<DisplayCard[]>(
    () =>
      upcomingReservations.map((entry) => ({
        ...entry,
        key: cardKey(entry.roundIndex, entry.slot),
        card: cardForRound(room, playerSeed, entry.roundIndex, entry.slot),
        markedSet: new Set(entry.marked),
      })),
    [upcomingReservations, room, playerSeed],
  );

  const activeCards = timeline.phase === "playing" ? currentCards : [];
  const previewCards = timeline.phase === "waiting" ? currentCards : upcomingCards;
  const visibleCards = activeCards.length > 0 ? activeCards : previewCards;
  const isLateEntry = timeline.phase === "playing" && currentCards.length === 0;
  const finishedWinner = winnerName ?? botWinner.name;

  const targetRound = timeline.phase === "waiting" ? currentRoundIndex : upcomingRoundIndex;
  const reservedCountForTarget = purchasedCards.filter((entry) => entry.roundIndex === targetRound).length;
  const availableSlots = Math.max(0, maxCards - reservedCountForTarget);
  const affordableSlots = room.ticketCost === 0 ? availableSlots : Math.min(availableSlots, Math.floor(tickets / room.ticketCost));
  const effectiveQty = Math.max(0, Math.min(purchaseQty, affordableSlots || (room.ticketCost === 0 ? availableSlots : 0)));
  const totalCost = effectiveQty * room.ticketCost;
  const canBuyAny = room.ticketCost === 0 ? availableSlots > 0 : affordableSlots > 0;

  const secondsLabel = `${Math.floor(timeline.phaseRemainingSec / 60)
    .toString()
    .padStart(2, "0")}:${(timeline.phaseRemainingSec % 60).toString().padStart(2, "0")}`;
  const phaseDuration =
    timeline.phase === "waiting" ? room.waitingSec : timeline.phase === "playing" ? room.playingSec : room.finishedSec;
  const phaseProgress = Math.min(100, Math.max(0, (timeline.phaseElapsedSec / Math.max(1, phaseDuration)) * 100));

  const drawCount =
    timeline.phase === "playing"
      ? Math.min(drawOrder.length, Math.max(0, Math.floor((timeline.phaseElapsedSec * 1000) / room.drawIntervalMs)))
      : 0;
  const drawnNumbers = drawOrder.slice(0, drawCount);
  const drawnNumber = drawCount > 0 ? drawnNumbers[drawCount - 1] : null;

  const glowColor = room.glow;
  const heroTitle =
    timeline.phase === "waiting"
      ? "Prossima partita"
      : timeline.phase === "playing"
        ? "PARTITA IN CORSO"
        : "FINE PARTITA";

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!musicMuted && !muted) startMusic();
    return () => stopMusic();
  }, [musicMuted, muted, startMusic, stopMusic]);

  useEffect(() => {
    const engine = new BotChatEngine((msg) => setChat((c) => [...c.slice(-35), msg]));
    botEngineRef.current = engine;
    engine.start();
    return () => engine.stop();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  useEffect(() => {
    if (cleanupRoundRef.current === currentRoundIndex) return;
    cleanupRoundRef.current = currentRoundIndex;
    spokenDrawRef.current = null;
    setWinnerName(null);
    setShowWin(false);
    setPurchasedCards((prev) => prev.filter((entry) => entry.roundIndex >= currentRoundIndex));
  }, [currentRoundIndex]);

  useEffect(() => {
    if (timeline.phase !== "playing") return;
    if (playedRoundRef.current === currentRoundIndex) return;
    playedRoundRef.current = currentRoundIndex;
    if (currentReservations.length > 0) incrementRoundsPlayed();
  }, [timeline.phase, currentRoundIndex, currentReservations.length, incrementRoundsPlayed]);

  useEffect(() => {
    if (timeline.phase === "waiting") {
      botEngineRef.current?.onWaiting();
    }
  }, [timeline.phase, currentRoundIndex]);

  useEffect(() => {
    if (drawnNumber == null) return;
    const drawKey = `${currentRoundIndex}-${drawnNumber}`;
    if (spokenDrawRef.current === drawKey) return;
    spokenDrawRef.current = drawKey;

    sfx("draw");
    setTimeout(() => speakNumber(drawnNumber), 150);
    botEngineRef.current?.onDraw();

    if (currentReservations.length === 0) return;

    setTimeout(() => {
      let changed = false;
      setPurchasedCards((prev) =>
        prev.map((entry) => {
          if (entry.roundIndex !== currentRoundIndex) return entry;
          const card = cardForRound(room, playerSeed, entry.roundIndex, entry.slot);
          if (!card.includes(drawnNumber) || entry.marked.includes(drawnNumber)) return entry;
          changed = true;
          return { ...entry, marked: [...entry.marked, drawnNumber] };
        }),
      );
      if (changed) sfx("mark");
    }, 500);
  }, [drawnNumber, currentRoundIndex, currentReservations.length, room, playerSeed, sfx, speakNumber]);

  useEffect(() => {
    if (timeline.phase !== "playing" || drawCount < room.cardSize) return;
    if (bingoRewardedRoundRef.current === currentRoundIndex) return;

    const winnerCard = currentCards.find((entry) => checkBingo(entry.card, entry.markedSet, room.cardSize));
    if (!winnerCard) return;

    bingoRewardedRoundRef.current = currentRoundIndex;
    setWinnerName(username);
    setShowWin(true);
    sfx("win");
    botEngineRef.current?.onBingo();
    addSparks(room.sparkReward);
    addTickets(room.ticketReward);
    incrementBingosWon();
    confetti({
      particleCount: 240,
      spread: 110,
      origin: { y: 0.55 },
      colors: ["#ff3da6", "#f5b400", "#7c3aed", "#22d3ee", "#34d399"],
    });
  }, [currentCards, timeline.phase, drawCount, room.cardSize, currentRoundIndex, username, sfx, addSparks, addTickets, incrementBingosWon, room.sparkReward, room.ticketReward]);

  useEffect(() => {
    if (timeline.phase === "finished" && winnerName == null) {
      setWinnerName(botWinner.name);
    }
  }, [timeline.phase, botWinner.name, winnerName]);

  useEffect(() => {
    const nextMax = Math.max(1, affordableSlots || (room.ticketCost === 0 ? Math.max(1, availableSlots) : 1));
    setPurchaseQty((prev) => Math.max(1, Math.min(prev, nextMax)));
  }, [affordableSlots, availableSlots, room.ticketCost]);

  function handleMark(cardSlot: number, n: number) {
    if (timeline.phase !== "playing" || n === 0) return;
    const currentCard = currentCards.find((entry) => entry.slot === cardSlot);
    if (!currentCard || !currentCard.card.includes(n)) return;

    sfx("tap");
    setPurchasedCards((prev) =>
      prev.map((entry) => {
        if (entry.roundIndex !== currentRoundIndex || entry.slot !== cardSlot) return entry;
        const nextMarked = entry.marked.includes(n)
          ? entry.marked.filter((value) => value !== n)
          : [...entry.marked, n];
        return { ...entry, marked: nextMarked };
      }),
    );
  }

  function reserveCards() {
    if (timeline.phase === "finished") return;
    if (!canBuyAny || availableSlots <= 0) {
      if (room.ticketCost > 0 && tickets < room.ticketCost) {
        sfx("tap");
        void navigate({ to: "/shop" });
      }
      return;
    }

    const qty = room.ticketCost === 0 ? Math.min(purchaseQty, availableSlots) : Math.min(purchaseQty, affordableSlots);
    if (qty <= 0) return;
    const totalTickets = qty * room.ticketCost;

    if (totalTickets > 0 && !spendTickets(totalTickets)) {
      sfx("tap");
      void navigate({ to: "/shop" });
      return;
    }

    const usedSlots = new Set(purchasedCards.filter((entry) => entry.roundIndex === targetRound).map((entry) => entry.slot));
    const additions: PurchasedCardState[] = [];
    let slot = 0;
    while (additions.length < qty && slot < maxCards + qty + 2) {
      if (!usedSlots.has(slot)) {
        usedSlots.add(slot);
        additions.push({ roundIndex: targetRound, slot, marked: [] });
      }
      slot += 1;
    }

    if (additions.length === 0) return;

    sfx("coin");
    setPurchasedCards((prev) => [...prev, ...additions]);
  }

  function sendChat() {
    if (!chatInput.trim()) return;
    sfx("tap");
    setChat((c) => [...c, { user: "Tu", text: chatInput, color: "oklch(0.85 0.18 90)", avatar: "⭐" }]);
    setChatInput("");
  }

  const drawHighlights = (n: number) => currentCards.some((entry) => entry.card.includes(n));

  return (
    <MobileShell>
      <div className="flex items-center justify-between px-4 pb-2">
        <button
          onClick={() => {
            sfx("tap");
            void navigate({ to: "/lobby" });
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white active:scale-90"
          aria-label="Indietro"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-col items-center text-center">
          <h2 className="text-stroke-thin text-base font-extrabold uppercase text-gold">{room.name}</h2>
          <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-white/70">
            {timeline.phase === "waiting" && (
              <>
                <Clock className="h-3 w-3" /> Inizio tra {secondsLabel}
              </>
            )}
            {timeline.phase === "playing" && <>🔴 Partita in corso</>}
            {timeline.phase === "finished" && (
              <>
                <TimerReset className="h-3 w-3" /> Validazione vincita
              </>
            )}
          </span>
        </div>
        <div className="w-9" />
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 top-16 h-72 opacity-40"
        style={{ background: `radial-gradient(ellipse 70% 50% at 50% 20%, ${glowColor}, transparent 70%)` }}
      />

      <section className="relative z-10 mt-2 flex items-center justify-center">
        <div className="relative flex h-36 w-36 items-center justify-center">
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ background: `radial-gradient(circle, ${glowColor}, transparent 60%)`, filter: "blur(18px)" }}
          />
          <img src={bingoBall} alt="" className="h-full w-full drop-shadow-[0_8px_20px_oklch(0_0_0/0.5)]" width={512} height={512} />
          <div className="absolute inset-0 flex items-center justify-center">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={`${timeline.phase}-${drawnNumber ?? secondsLabel}`}
                initial={{ scale: 0, rotate: -120, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                className="select-none font-display text-center font-extrabold"
                style={{
                  background: "linear-gradient(180deg, oklch(0.97 0.14 95) 0%, oklch(0.78 0.2 70) 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  WebkitTextStroke: "3px oklch(0.22 0.15 305)",
                  paintOrder: "stroke fill",
                  fontSize: timeline.phase === "waiting" ? "2rem" : timeline.phase === "finished" ? "2.4rem" : "3.2rem",
                }}
              >
                {timeline.phase === "waiting" && secondsLabel}
                {timeline.phase === "playing" && (drawnNumber ?? "...")}
                {timeline.phase === "finished" && "🏆"}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </section>

      <div className="relative z-10 mt-1 px-4 text-center">
        <span className="text-stroke-thin text-xl font-extrabold italic text-white/90">{heroTitle}</span>
        <p className="mt-1 text-sm font-bold text-white/70">
          {timeline.phase === "waiting" &&
            "Il countdown indica solo quando parte il prossimo turno. Ora puoi scegliere quante cartelle comprare e bloccarle subito."}
          {timeline.phase === "playing" &&
            "Le cartelle del turno attuale sono chiuse. Se hai più cartelle attive vengono marcate tutte; se entri tardi prepari il turno successivo."}
          {timeline.phase === "finished" && `Vincitore del turno: ${finishedWinner}. Tra poco riparte una nuova prevendita.`}
        </p>

        <div className="mx-auto mt-3 max-w-sm rounded-2xl border border-white/10 bg-black/25 px-3 py-3 shadow-card-game">
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/65">
            <span>{timeline.phase === "waiting" ? "Prevendita attiva" : timeline.phase === "playing" ? "Round live" : "Chiusura turno"}</span>
            <span>{secondsLabel}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gold-shine"
              animate={{ width: `${phaseProgress}%` }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-bold text-white/65">
            {currentReservations.length > 0 && (
              <span className="rounded-full border border-gold/35 bg-gold/10 px-2 py-1 text-gold">
                {currentReservations.length} {currentReservations.length === 1 ? "cartella" : "cartelle"} {timeline.phase === "playing" ? "attive" : "pronte"}
              </span>
            )}
            {upcomingReservations.length > 0 && (
              <span className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-2 py-1 text-cyan-100">
                {upcomingReservations.length} già prenotate per il prossimo round
              </span>
            )}
            {isLateEntry && (
              <span className="rounded-full border border-red-300/30 bg-red-400/10 px-2 py-1 text-red-100">Ingresso tardivo: giochi dal prossimo round</span>
            )}
          </div>
        </div>
      </div>

      <section className="relative z-10 mt-4 px-4">
        <div className="grid grid-cols-2 gap-2">
          <StatusCard icon={<Ticket className="h-4 w-4" />} title="Costo/cartella" value={room.ticketCost === 0 ? "Gratis" : `${room.ticketCost} Ticket`} />
          <StatusCard icon={<Trophy className="h-4 w-4" />} title="Premio" value={`+${room.sparkReward} Spark`} />
          <StatusCard icon={<Clock className="h-4 w-4" />} title="Stato" value={timeline.phase === "waiting" ? "Prevendita" : timeline.phase === "playing" ? "Live" : "Chiusura"} />
          <StatusCard icon={<TimerReset className="h-4 w-4" />} title="Max cartelle" value={`${maxCards} per round`} />
        </div>
      </section>

      {(timeline.phase === "playing" && currentReservations.length === 0) || timeline.phase === "finished" ? (
        <section className="relative z-10 mt-3 px-4">
          <div className="rounded-3xl border border-white/10 bg-card-game p-4 shadow-card-game">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-black/25 text-gold">
                <Info className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-white">
                  {timeline.phase === "playing"
                    ? "Partita in corso, attendi la fine della partita per partecipare al prossimo turno"
                    : `Turno chiuso. Vincitore: ${finishedWinner}`}
                </p>
                <p className="mt-1 text-xs font-bold text-white/60">
                  {timeline.phase === "playing"
                    ? "Non vedrai né riceverai cartelle per questa partita. Puoi però prenotare subito più cartelle per il turno successivo."
                    : "Tra pochi secondi comparirà di nuovo il countdown utile per acquistare le cartelle del turno successivo."}
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="relative z-10 mt-4 flex items-start gap-2 px-2">
        <div className="flex flex-col gap-2 pt-2">
          <SideBtn img={sideHearts} onClick={() => { sfx("coin"); addSparks(5); }} label="+5" />
          <SideBtn img={sideGift} onClick={() => { sfx("coin"); addSparks(10); }} label="+10" />
        </div>

        <div className="flex-1 overflow-hidden rounded-[1.75rem] border border-white/12 bg-[linear-gradient(180deg,oklch(0.28_0.14_305/0.95),oklch(0.18_0.1_300/0.98))] p-3 shadow-card-game">
          {visibleCards.length > 0 ? (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-gold">
                    {activeCards.length > 0 ? "Multi-cartella live" : timeline.phase === "waiting" ? "Cartelle pronte" : "Cartelle prenotate"}
                  </p>
                  <p className="text-[11px] font-bold text-white/60">
                    {activeCards.length > 0
                      ? `Stai giocando con ${activeCards.length} ${activeCards.length === 1 ? "cartella" : "cartelle"}`
                      : `Hai ${visibleCards.length} ${visibleCards.length === 1 ? "cartella" : "cartelle"} bloccate per il prossimo via`}
                  </p>
                </div>
                <span className="rounded-full bg-white/8 px-2 py-1 text-[10px] font-extrabold text-white/70">
                  Round #{(activeCards.length > 0 ? currentRoundIndex : targetRound) + 1}
                </span>
              </div>

              <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
                {visibleCards.map((entry, idx) => (
                  <BingoCardPanel
                    key={entry.key}
                    entry={entry}
                    index={idx}
                    total={visibleCards.length}
                    size={room.cardSize}
                    glowColor={glowColor}
                    isInteractive={timeline.phase === "playing" && entry.roundIndex === currentRoundIndex}
                    subtitle={
                      timeline.phase === "playing" && entry.roundIndex === currentRoundIndex
                        ? "Valida per la partita in corso"
                        : entry.roundIndex === currentRoundIndex
                          ? "Sarà attiva allo start del round"
                          : "Valida per il prossimo turno"
                    }
                    onMark={handleMark}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="flex min-h-[240px] flex-col items-center justify-center px-4 text-center">
              <span className="mb-3 text-5xl">🎫</span>
              <p className="text-lg font-extrabold text-white">
                {timeline.phase === "waiting" ? "Acquista una o più cartelle per il prossimo turno" : "Nessuna cartella attiva in questa partita"}
              </p>
              <p className="mt-1 text-sm font-bold text-white/60">
                {timeline.phase === "waiting"
                  ? "Durante il countdown la vendita è aperta: scegli quante cartelle vuoi e partecipi appena inizia la partita."
                  : timeline.phase === "playing"
                    ? "Sei entrato a partita iniziata. Puoi già prenotare più cartelle valide per il prossimo turno."
                    : "Il turno è in chiusura. Attendi il nuovo countdown per comprare la prossima cartella."}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <SideBtn img={sideTrophy} onClick={() => { sfx("coin"); addSparks(15); }} label="+15" />
          <SideBtn img={sideGiftBlue} onClick={() => { sfx("coin"); addTickets(1); }} label="+1🎫" />
        </div>
      </section>

      {timeline.phase === "playing" && drawnNumbers.length > 0 && (
        <div className="relative z-10 mt-3 flex flex-wrap justify-center gap-1.5 px-4">
          {drawnNumbers.slice(-10).map((n) => (
            <span
              key={`${currentRoundIndex}-${n}`}
              className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-extrabold ${
                drawHighlights(n) ? "border-gold/60 bg-gold-shine text-purple-deep" : "border-white/15 bg-white/10 text-white/60"
              }`}
            >
              {n}
            </span>
          ))}
        </div>
      )}

      <section className="relative z-10 mt-4 px-4">
        <div className="rounded-3xl border border-white/10 bg-card-game p-4 shadow-card-game">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-white">
                  {timeline.phase === "waiting" && (currentReservations.length > 0 ? "Prevendita aperta: puoi aggiungere altre cartelle" : "Prevendita aperta")}
                  {timeline.phase === "playing" && (currentReservations.length > 0 ? "Stai giocando questo turno" : "Prenota il turno successivo")}
                  {timeline.phase === "finished" && "Turno in chiusura"}
                </p>
                <p className="mt-1 text-xs font-bold text-white/60">
                  {timeline.phase === "waiting" &&
                    `Il countdown indica solo quando parte la prossima partita. Limite stanza: ${maxCards} cartelle.`}
                  {timeline.phase === "playing" &&
                    `L'acquisto ora vale solo per la partita successiva. Puoi arrivare fino a ${maxCards} cartelle per round.`}
                  {timeline.phase === "finished" && "Aspetta il nuovo countdown per il prossimo round."}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/45">Disponibili</p>
                <p className="text-base font-extrabold text-white">{availableSlots}/{maxCards}</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/45">Quantità</p>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPurchaseQty((prev) => Math.max(1, prev - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white active:scale-95"
                    aria-label="Diminuisci cartelle"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-8 text-center text-xl font-extrabold text-gold">{purchaseQty}</span>
                  <button
                    type="button"
                    onClick={() => setPurchaseQty((prev) => Math.min(prev + 1, Math.max(1, room.ticketCost === 0 ? availableSlots : affordableSlots || prev + 1)))}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white active:scale-95"
                    aria-label="Aumenta cartelle"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/45">Totale</p>
                <p className="mt-1 text-lg font-extrabold text-white">{room.ticketCost === 0 ? "Gratis" : `${totalCost} Ticket`}</p>
                <p className="text-[11px] font-bold text-white/50">Target: round #{targetRound + 1}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={reserveCards}
              disabled={timeline.phase === "finished" || availableSlots === 0 || (room.ticketCost > 0 && !canBuyAny)}
              className="rounded-2xl bg-gold-shine px-4 py-3 text-sm font-extrabold text-purple-deep shadow-button-gold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {timeline.phase === "finished"
                ? "Turno in chiusura"
                : availableSlots === 0
                  ? "Limite cartelle raggiunto"
                  : room.ticketCost === 0
                    ? `Blocca ${purchaseQty} ${purchaseQty === 1 ? "cartella" : "cartelle"} gratis`
                    : `${timeline.phase === "waiting" ? "Acquista" : "Prenota"} ${purchaseQty} ${purchaseQty === 1 ? "cartella" : "cartelle"} · ${totalCost}T`}
            </button>
          </div>

          {room.ticketCost > 0 && tickets < room.ticketCost && (
            <button
              type="button"
              onClick={() => void navigate({ to: "/shop" })}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 py-3 text-sm font-bold text-white/75"
            >
              <ShoppingCart className="h-4 w-4" /> Ticket insufficienti? Vai allo shop
            </button>
          )}
        </div>
      </section>

      <AnimatePresence>
        {showWin && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/75 backdrop-blur-md"
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1], rotate: [-2, 2, -2] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="mb-4 text-8xl"
            >
              🏆
            </motion.div>
            <h2 className="text-stroke-game text-5xl font-extrabold text-gold">BINGO!</h2>
            <p className="mt-3 text-xl font-bold text-white">+{room.sparkReward} Spark · +{room.ticketReward} Ticket</p>
            <p className="mt-2 max-w-xs text-center text-sm font-bold text-white/70">
              La vincita è stata validata. Le tue cartelle multiple hanno partecipato tutte, ma il premio viene assegnato una sola volta per round.
            </p>
            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setShowWin(false)}
                className="rounded-2xl border border-white/20 bg-white/10 px-6 py-3 font-bold text-white active:scale-95"
              >
                Continua
              </button>
              <button
                onClick={() => void navigate({ to: "/lobby" })}
                className="rounded-2xl bg-gold-shine px-6 py-3 font-extrabold text-purple-deep shadow-button-gold active:scale-95"
              >
                Torna alla Lobby
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {chatOpen && (
          <motion.section
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-40 right-3 z-[95] w-[calc(100vw-1.5rem)] max-w-sm"
          >
            <div className="overflow-hidden rounded-[1.75rem] border border-white/12 bg-[linear-gradient(180deg,oklch(0.3_0.16_305/0.96),oklch(0.18_0.11_300/0.98))] shadow-[0_22px_52px_oklch(0.08_0.08_300/0.7)] backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gold-shine text-purple-deep shadow-button-gold">
                    <MessageCircle className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-wider text-gold">Bingo live</p>
                    <p className="text-[11px] font-bold text-white/60">Chat della room</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/70 active:scale-90"
                  aria-label="Chiudi chat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="no-scrollbar h-72 overflow-y-auto px-3 py-3">
                <div className="space-y-2">
                  {chat.map((item, idx) => (
                    <div key={`${item.user}-${idx}`} className="flex items-start gap-2">
                      <span className="mt-0.5 text-lg">{item.avatar}</span>
                      <div className="min-w-0 rounded-2xl border border-white/8 bg-white/5 px-3 py-2">
                        <p className="text-xs font-extrabold" style={{ color: item.color }}>{item.user}</p>
                        <p className="text-xs font-bold text-white/75">{item.text}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </div>
              <div className="border-t border-white/10 px-3 py-3">
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendChat()}
                    placeholder="Scrivi un messaggio..."
                    className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/35"
                  />
                  <button type="button" onClick={sendChat} className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-shine text-purple-deep shadow-button-gold active:scale-90">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setChatOpen((v) => !v)}
        className="fixed bottom-24 right-3 z-[96] flex h-16 w-16 items-center justify-center rounded-full bg-gold-shine text-purple-deep shadow-button-gold active:scale-95"
        aria-label={chatOpen ? "Chiudi chat" : "Apri chat"}
      >
        {chatOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </MobileShell>
  );
}

function BingoCardPanel({
  entry,
  index,
  total,
  size,
  glowColor,
  isInteractive,
  subtitle,
  onMark,
}: {
  entry: DisplayCard;
  index: number;
  total: number;
  size: 3 | 5;
  glowColor: string;
  isInteractive: boolean;
  subtitle: string;
  onMark: (slot: number, n: number) => void;
}) {
  return (
    <div className="min-w-[85%] snap-center rounded-3xl border border-white/10 bg-black/20 p-3 shadow-card-game">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-gold">Cartella #{index + 1}</p>
          <p className="text-[11px] font-bold text-white/55">{subtitle}</p>
        </div>
        {total > 1 && <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-extrabold text-white/65">{index + 1}/{total}</span>}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${size}, 1fr)`,
          gap: "4px",
        }}
      >
        {entry.card.map((n, i) => {
          const isFree = n === 0;
          const isMarked = isFree || entry.markedSet.has(n);
          const palette = CELL_PALETTE[i % CELL_PALETTE.length];

          return (
            <motion.button
              key={`${entry.key}-${i}`}
              whileTap={{ scale: isInteractive ? 0.92 : 1 }}
              onClick={() => onMark(entry.slot, n)}
              className={`relative flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br text-sm font-extrabold shadow-md transition-all select-none ${
                isFree ? "from-gold to-[oklch(0.7_0.25_25)] text-white" : palette
              } ${isInteractive ? (isMarked ? "opacity-100 ring-2 ring-white/60 scale-105" : "opacity-75") : "opacity-90"}`}
              style={
                isInteractive && isMarked && !isFree
                  ? {
                      boxShadow: `0 0 12px ${glowColor}`,
                      filter: "brightness(1.15)",
                    }
                  : undefined
              }
            >
              {isFree ? "⭐" : n}
              {isInteractive && isMarked && !isFree && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="h-full w-full rounded-xl bg-white/20" />
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function StatusCard({ icon, title, value }: { icon: ReactNode; title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card-game p-3 shadow-card-game">
      <div className="mb-1 flex items-center gap-1 text-gold">
        {icon}
        <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-white/55">{title}</span>
      </div>
      <p className="text-sm font-extrabold text-white">{value}</p>
    </div>
  );
}

function SideBtn({ img, onClick, label }: { img: string; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-14 flex-col items-center gap-1 rounded-2xl border border-white/10 bg-card-game px-2 py-2 shadow-card-game active:scale-95"
    >
      <img src={img} alt="" className="h-10 w-10 object-contain" />
      <span className="text-[10px] font-extrabold text-white/75">{label}</span>
    </button>
  );
}
