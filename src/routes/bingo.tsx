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
import { cardForRound, drawOrderForRound, getRoom, getRoomTimeline, maxCardsPerRoom } from "@/lib/rooms";
import { useGameStore } from "@/lib/gameStore";
import { useAudio } from "@/hooks/useAudio";
import { setAuthRedirect } from "@/lib/authRedirect";
import { useAuth } from "@/hooks/useAuth";
import { useViewerGameState } from "@/hooks/useViewerGameState";
import { BOTS, BotChatEngine } from "@/lib/bots";

const searchSchema = z.object({ roomId: z.string().optional() });

export const Route = createFileRoute("/bingo")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "GameSpark — Bingo Live" }],
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


type ChatItem = { user: string; text: string; color: string; avatar: string };
type PurchasedCardState = { roundIndex: number; slot: number; marked: number[] };
type DisplayCard = PurchasedCardState & { key: string; card: number[]; markedSet: Set<number> };
type CardInsight = DisplayCard & {
  bestMissing: number;
  bestLineIndices: number[];
  matchedInBestLine: number;
  completedLines: number;
};

function cardKey(roundIndex: number, slot: number) {
  return `${roundIndex}-${slot}`;
}

function analyzeCard(card: number[], marked: Set<number>, size: number): Omit<CardInsight, keyof DisplayCard> {
  const lines: number[][] = [];

  for (let r = 0; r < size; r++) {
    lines.push(Array.from({ length: size }, (_, i) => r * size + i));
  }

  for (let c = 0; c < size; c++) {
    lines.push(Array.from({ length: size }, (_, i) => i * size + c));
  }

  lines.push(Array.from({ length: size }, (_, i) => i * size + i));
  lines.push(Array.from({ length: size }, (_, i) => i * size + (size - 1 - i)));

  let bestMissing = Number.POSITIVE_INFINITY;
  let bestLineIndices: number[] = [];
  let matchedInBestLine = 0;
  let completedLines = 0;

  for (const indices of lines) {
    let missing = 0;
    let matched = 0;

    for (const idx of indices) {
      const value = card[idx];
      if (value === 0 || marked.has(value)) {
        matched += 1;
      } else {
        missing += 1;
      }
    }

    if (missing === 0) completedLines += 1;

    if (missing < bestMissing || (missing === bestMissing && matched > matchedInBestLine)) {
      bestMissing = missing;
      bestLineIndices = indices;
      matchedInBestLine = matched;
    }
  }

  return {
    bestMissing: Number.isFinite(bestMissing) ? bestMissing : size,
    bestLineIndices,
    matchedInBestLine,
    completedLines,
  };
}

function missingLabel(bestMissing: number, completedLines: number): string {
  if (completedLines > 0 || bestMissing <= 0) return 'Bingo pronto';
  if (bestMissing === 1) return '1 mancante';
  if (bestMissing === 2) return '2 mancanti';
  return `${bestMissing} mancanti`;
}

function BingoPage() {
  const { roomId } = Route.useSearch();
  const room = getRoom(roomId);
  const navigate = useNavigate();
  const { sfx, speakNumber, startMusic, stopMusic, stopAll } = useAudio();
  const { user } = useAuth();

  const playerSeed = useGameStore((s) => s.playerSeed);
  const { username, tickets } = useViewerGameState();
  const musicMuted = useGameStore((s) => s.musicMuted);
  const muted = useGameStore((s) => s.muted);
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
  const [guestNotice, setGuestNotice] = useState<string | null>(null);
  const [pageVisible, setPageVisible] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");
  const [chat, setChat] = useState<ChatItem[]>([
    { user: "AlessioPro", text: "Chi è pronto? 🔥", color: "oklch(0.7 0.25 25)", avatar: "🎯" },
    { user: "Giulia92", text: "Stasera vinco!! 🌸", color: "oklch(0.74 0.18 150)", avatar: "🌸" },
    { user: "NicolaGold", text: "Buona fortuna! ⚡", color: "oklch(0.85 0.18 90)", avatar: "⚡" },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const cardsScrollRef = useRef<HTMLDivElement>(null);
  const botEngineRef = useRef<BotChatEngine | null>(null);
  const spokenDrawRef = useRef<string | null>(null);
  const playedRoundRef = useRef<number | null>(null);
  const cleanupRoundRef = useRef<number | null>(null);
  const bingoRewardedRoundRef = useRef<number | null>(null);
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const timeline = getRoomTimeline(room, now);
  const currentRoundIndex = timeline.activeRoundIndex;
  const upcomingRoundIndex = timeline.upcomingRoundIndex;
  const maxCards = maxCardsPerRoom(room);
  const effectiveCardSize = room.id === "golden-city" ? 4 : effectiveCardSize;
  const isGuest = !user;

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
  const deckCards = useMemo<CardInsight[]>(
    () =>
      visibleCards.map((entry) => ({
        ...entry,
        ...analyzeCard(entry.card, entry.markedSet, effectiveCardSize),
      })),
    [visibleCards, effectiveCardSize],
  );
  const isLateEntry = timeline.phase === "playing" && currentCards.length === 0;
  const finishedWinner = winnerName ?? botWinner.name;
  const recentResults = useMemo(() => {
    const settledRound = timeline.phase === "finished" ? currentRoundIndex : currentRoundIndex - 1;
    return Array.from({ length: 3 }, (_, idx) => settledRound - idx)
      .filter((roundIndex) => roundIndex >= 0)
      .map((roundIndex) => ({
        roundIndex,
        winner: BOTS[(roundIndex + room.id.length) % BOTS.length],
      }));
  }, [timeline.phase, currentRoundIndex, room.id]);

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
  const phasePillLabel = timeline.phase === "waiting" ? secondsLabel : timeline.phase === "playing" ? "LIVE" : "VALIDAZIONE";
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
  const bestCard = deckCards.length > 0 ? [...deckCards].sort((a, b) => a.bestMissing - b.bestMissing || b.matchedInBestLine - a.matchedInBestLine || a.slot - b.slot)[0] : null;


  useEffect(() => {
    if (!guestNotice) return;
    const timeout = setTimeout(() => setGuestNotice(null), 3200);
    return () => clearTimeout(timeout);
  }, [guestNotice]);

  useEffect(() => {
    if (!pageVisible) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pageVisible]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibility = () => {
      const visible = document.visibilityState === "visible";
      setPageVisible(visible);
      if (!visible) {
        if (speakTimeoutRef.current) {
          clearTimeout(speakTimeoutRef.current);
          speakTimeoutRef.current = null;
        }
        if (markTimeoutRef.current) {
          clearTimeout(markTimeoutRef.current);
          markTimeoutRef.current = null;
        }
        stopAll();
      } else {
        setNow(Date.now());
      }
    };

    const handleBlur = () => {
      setPageVisible(false);
      if (speakTimeoutRef.current) {
        clearTimeout(speakTimeoutRef.current);
        speakTimeoutRef.current = null;
      }
      if (markTimeoutRef.current) {
        clearTimeout(markTimeoutRef.current);
        markTimeoutRef.current = null;
      }
      stopAll();
    };

    const handleFocus = () => {
      setPageVisible(true);
      setNow(Date.now());
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handleVisibility);
    window.addEventListener("pageshow", handleFocus);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("beforeunload", handleBlur);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("freeze", handleBlur as EventListener);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handleVisibility);
      window.removeEventListener("pageshow", handleFocus);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("beforeunload", handleBlur);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("freeze", handleBlur as EventListener);
      stopAll();
    };
  }, [stopAll]);

  useEffect(() => {
    if (!pageVisible) {
      stopMusic();
      return;
    }
    if (!musicMuted && !muted) startMusic();
    return () => stopMusic();
  }, [musicMuted, muted, pageVisible, startMusic, stopMusic]);

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
    if (!pageVisible || drawnNumber == null) return;
    const drawKey = `${currentRoundIndex}-${drawnNumber}`;
    if (spokenDrawRef.current === drawKey) return;
    spokenDrawRef.current = drawKey;

    sfx("draw");
    speakTimeoutRef.current = setTimeout(() => {
      speakNumber(drawnNumber);
      speakTimeoutRef.current = null;
    }, 150);
    botEngineRef.current?.onDraw();

    if (currentReservations.length === 0) {
      return () => {
        if (speakTimeoutRef.current) {
          clearTimeout(speakTimeoutRef.current);
          speakTimeoutRef.current = null;
        }
      };
    }

    markTimeoutRef.current = setTimeout(() => {
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
      markTimeoutRef.current = null;
    }, 500);

    return () => {
      if (speakTimeoutRef.current) {
        clearTimeout(speakTimeoutRef.current);
        speakTimeoutRef.current = null;
      }
      if (markTimeoutRef.current) {
        clearTimeout(markTimeoutRef.current);
        markTimeoutRef.current = null;
      }
    };
  }, [pageVisible, drawnNumber, currentRoundIndex, currentReservations.length, room, playerSeed, sfx, speakNumber]);

  useEffect(() => {
    if (timeline.phase !== "playing" || drawCount < effectiveCardSize) return;
    if (bingoRewardedRoundRef.current === currentRoundIndex) return;

    const winnerCard = currentCards.find((entry) => checkBingo(entry.card, entry.markedSet, effectiveCardSize));
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
  }, [currentCards, timeline.phase, drawCount, effectiveCardSize, currentRoundIndex, username, sfx, addSparks, addTickets, incrementBingosWon, room.sparkReward, room.ticketReward]);

  useEffect(() => {
    if (timeline.phase === "finished" && winnerName == null) {
      setWinnerName(botWinner.name);
    }
  }, [timeline.phase, botWinner.name, winnerName]);

  useEffect(() => {
    return () => {
      if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
      if (markTimeoutRef.current) clearTimeout(markTimeoutRef.current);
      stopAll();
    };
  }, [stopAll]);

  useEffect(() => {
    const nextMax = Math.max(1, affordableSlots || (room.ticketCost === 0 ? Math.max(1, availableSlots) : 1));
    setPurchaseQty((prev) => Math.max(1, Math.min(prev, nextMax)));
  }, [affordableSlots, availableSlots, room.ticketCost]);

  function scrollCards(direction: "left" | "right") {
    const el = cardsScrollRef.current;
    if (!el) return;
    const amount = Math.max(220, Math.floor(el.clientWidth * 0.88));
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  }

  function handleMark(cardSlot: number, n: number) {
    if (isGuest) {
      setGuestNotice("Accedi o registrati per giocare davvero il turno e marcare le cartelle.");
      sfx("error");
      return;
    }
    if (timeline.phase !== "playing" || n === 0) return;
    if (!drawnNumbers.includes(n)) {
      setGuestNotice("Puoi marcare solo i numeri già estratti in questo turno.");
      sfx("error");
      return;
    }
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

  function navigateWithStop(path: "/lobby" | "/shop" | "/auth" | "/missions" | "/reveal") {
    stopAll();
    void navigate({ to: path });
  }

  function goToAuth() {
    stopAll();
    setAuthRedirect(window.location.pathname + window.location.search);
    void navigate({ to: "/auth" });
  }

  function reserveCards() {
    if (isGuest) {
      setGuestNotice("Modalità osservatore attiva: accedi per comprare cartelle e partecipare ai round.");
      sfx("error");
      goToAuth();
      return;
    }
    if (timeline.phase === "finished") return;
    if (!canBuyAny || availableSlots <= 0) {
      if (room.ticketCost > 0 && tickets < room.ticketCost) {
        sfx("tap");
        navigateWithStop("/shop");
      }
      return;
    }

    const qty = room.ticketCost === 0 ? Math.min(purchaseQty, availableSlots) : Math.min(purchaseQty, affordableSlots);
    if (qty <= 0) return;
    const totalTickets = qty * room.ticketCost;

    if (totalTickets > 0 && !spendTickets(totalTickets)) {
      sfx("tap");
      navigateWithStop("/shop");
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
    if (isGuest) {
      setGuestNotice("Accedi per scrivere in chat e partecipare come giocatore registrato.");
      sfx("error");
      goToAuth();
      return;
    }
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
            navigateWithStop("/lobby");
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

      {isGuest && (
        <section className="relative z-20 px-4 pb-2">
          <div className="rounded-3xl border border-gold/30 bg-[linear-gradient(180deg,oklch(0.24_0.11_305/0.96),oklch(0.16_0.08_300/0.98))] px-4 py-3 shadow-card-game">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-gold">Modalità osservatore</p>
                <p className="mt-1 text-xs font-bold text-white/70">
                  Puoi vedere countdown, estrazioni e lobby della room, ma per comprare cartelle, marcare e scrivere in chat devi accedere.
                </p>
              </div>
              <button
                type="button"
                onClick={() => goToAuth()}
                className="shrink-0 rounded-2xl bg-gold-shine px-3 py-2 text-xs font-extrabold text-purple-deep shadow-button-gold"
              >
                Accedi
              </button>
            </div>
            {guestNotice && <p className="mt-2 text-[11px] font-bold text-rose-200">{guestNotice}</p>}
          </div>
        </section>
      )}

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

        {timeline.phase === "playing" && (
          <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full border border-red-300/25 bg-red-400/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-red-100">
            <span className="h-2 w-2 rounded-full bg-red-300" /> Vendita cartelle turno live chiusa
          </div>
        )}
        {timeline.phase === "finished" && (
          <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80">
            <span className="h-2 w-2 rounded-full bg-gold" /> Validazione vincita in corso
          </div>
        )}

        <div className="mx-auto mt-3 max-w-sm rounded-2xl border border-white/10 bg-black/25 px-3 py-3 shadow-card-game">
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/65">
            <span>{timeline.phase === "waiting" ? "Prevendita attiva" : timeline.phase === "playing" ? "Round live" : "Chiusura turno"}</span>
            <span>{phasePillLabel}</span>
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
        <div className="overflow-hidden rounded-[1.75rem] border border-white/12 bg-[linear-gradient(180deg,oklch(0.28_0.14_305/0.95),oklch(0.18_0.1_300/0.98))] p-4 shadow-card-game">
          {deckCards.length > 0 ? (
            <>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-gold">
                    {activeCards.length > 0 ? "Cartelle attive" : timeline.phase === "waiting" ? "Cartelle prenotate" : "Cartelle del prossimo turno"}
                  </p>
                  <p className="text-[11px] font-bold text-white/60">
                    {deckCards.length === 1
                      ? "La tua cartella del round è qui sotto."
                      : `Hai ${deckCards.length} cartelle. Scorri a destra e sinistra per vederle tutte.`}
                  </p>
                </div>
                {deckCards.length > 1 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => scrollCards("left")}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/20 text-white active:scale-95"
                      aria-label="Scorri cartelle a sinistra"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollCards("right")}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/20 text-white active:scale-95"
                      aria-label="Scorri cartelle a destra"
                    >
                      <ArrowLeft className="h-4 w-4 rotate-180" />
                    </button>
                  </div>
                ) : null}
              </div>

              <div
                ref={cardsScrollRef}
                className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1"
              >
                {deckCards.map((entry, idx) => (
                  <div key={entry.key} className="min-w-full snap-center">
                    <BingoCardPanel
                      entry={entry}
                      index={idx}
                      total={deckCards.length}
                      size={effectiveCardSize}
                      glowColor={glowColor}
                      isInteractive={timeline.phase === "playing" && entry.roundIndex === currentRoundIndex}
                      subtitle={
                        timeline.phase === "playing" && entry.roundIndex === currentRoundIndex
                          ? "Cartella in focus per la partita in corso"
                          : entry.roundIndex === currentRoundIndex
                            ? "Sarà attiva allo start del round"
                            : "Valida per il prossimo turno"
                      }
                      bestLabel={missingLabel(entry.bestMissing, entry.completedLines)}
                      isBest={bestCard?.key === entry.key}
                      bestLineIndices={entry.bestLineIndices}
                      onMark={handleMark}
                    />
                  </div>
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
                {isGuest
                  ? "Stai osservando la room come ospite. Accedi per comprare cartelle e partecipare davvero al prossimo turno."
                  : timeline.phase === "waiting"
                    ? "Durante il countdown la vendita è aperta: scegli quante cartelle vuoi e partecipi appena inizia la partita."
                    : timeline.phase === "playing"
                      ? "Sei entrato a partita iniziata. Puoi già prenotare più cartelle valide per il prossimo turno."
                      : "Il turno è in chiusura. Attendi il nuovo countdown per comprare la prossima cartella."}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="relative z-10 mt-4 px-4">
        <div className="grid grid-cols-2 gap-2">
          <StatusCard icon={<Ticket className="h-4 w-4" />} title="Costo/cartella" value={room.ticketCost === 0 ? "Gratis" : `${room.ticketCost} Ticket`} />
          <StatusCard icon={<Trophy className="h-4 w-4" />} title="Premio" value={`+${room.sparkReward} Spark`} />
          <StatusCard icon={<Clock className="h-4 w-4" />} title="Stato" value={timeline.phase === "waiting" ? "Prevendita" : timeline.phase === "playing" ? "Live" : "Chiusura"} />
          <StatusCard icon={<TimerReset className="h-4 w-4" />} title="Max cartelle" value={`${maxCards} per round`} />
        </div>
      </section>

      <section className="relative z-10 mt-3 px-4">
        <div className="rounded-3xl border border-white/10 bg-card-game p-4 shadow-card-game">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-extrabold text-white">Ultimi esiti room</p>
              <p className="mt-1 text-[11px] font-bold text-white/55">Stile sala online: countdown solo per il prossimo avvio, vincita validata a parte.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/55">Storico live</span>
          </div>

          <div className="mt-3 space-y-2">
            {recentResults.map(({ roundIndex, winner }) => (
              <div key={roundIndex} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{winner.avatar}</span>
                  <div>
                    <p className="text-xs font-extrabold text-white">Round #{roundIndex + 1}</p>
                    <p className="text-[11px] font-bold text-white/55">Vincitore validato: {winner.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-extrabold text-gold">+{room.sparkReward} Spark</p>
                  <p className="text-[11px] font-bold text-white/55">+{room.ticketReward} Ticket</p>
                </div>
              </div>
            ))}
          </div>
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
                    disabled={purchaseQty <= 1}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Diminuisci cartelle"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-8 text-center text-xl font-extrabold text-gold">{purchaseQty}</span>
                  <button
                    type="button"
                    onClick={() => setPurchaseQty((prev) => Math.min(prev + 1, Math.max(1, room.ticketCost === 0 ? availableSlots : affordableSlots || prev + 1)))}
                    disabled={availableSlots === 0 || purchaseQty >= Math.max(1, room.ticketCost === 0 ? availableSlots : affordableSlots || purchaseQty)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
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

            <p className="-mt-1 text-[11px] font-bold text-white/55">
              Scegli qui quante cartelle bloccare con i pulsanti − / +. Massimo room: {maxCards}.
            </p>

            <button
              type="button"
              onClick={isGuest ? () => goToAuth() : reserveCards}
              disabled={timeline.phase === "finished" || (!isGuest && availableSlots === 0) || (!isGuest && room.ticketCost > 0 && !canBuyAny)}
              className="rounded-2xl bg-gold-shine px-4 py-3 text-sm font-extrabold text-purple-deep shadow-button-gold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGuest
                ? `Accedi per giocare · ${purchaseQty} ${purchaseQty === 1 ? "cartella" : "cartelle"}`
                : timeline.phase === "finished"
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
              onClick={() => navigateWithStop("/shop")}
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
                onClick={() => navigateWithStop("/lobby")}
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
                    placeholder={isGuest ? "Accedi per scrivere in chat..." : "Scrivi un messaggio..."}
                    disabled={isGuest}
                    className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/35 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                  <button type="button" onClick={sendChat} disabled={!isGuest && !chatInput.trim()} className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-shine text-purple-deep shadow-button-gold active:scale-90 disabled:cursor-not-allowed disabled:opacity-50">
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
  bestLabel,
  isBest,
  bestLineIndices,
  onMark,
}: {
  entry: CardInsight;
  index: number;
  total: number;
  size: 3 | 4 | 5;
  glowColor: string;
  isInteractive: boolean;
  subtitle: string;
  bestLabel: string;
  isBest: boolean;
  bestLineIndices: number[];
  onMark: (slot: number, n: number) => void;
}) {
  const bestLineSet = new Set(bestLineIndices);
  const cardMaxWidth = size === 4 ? 320 : size === 5 ? 300 : 246;

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-3 shadow-card-game">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-gold">Cartella #{index + 1}</p>
            {isBest ? (
              <span className="rounded-full border border-cyan-300/35 bg-cyan-400/12 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-cyan-100">
                Best focus
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] font-bold text-white/55">{subtitle}</p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <span className="rounded-full border border-gold/35 bg-gold/10 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-gold">
            {bestLabel}
          </span>
          {total > 1 ? <span className="text-[10px] font-extrabold text-white/55">{index + 1}/{total}</span> : null}
        </div>
      </div>

      <div className="mx-auto" style={{ maxWidth: `${cardMaxWidth}px` }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
            gap: size === 4 ? "8px" : "6px",
          }}
        >
          {entry.card.map((n, i) => {
            const isMarked = n !== 0 && entry.markedSet.has(n);
            const isPriority = bestLineSet.has(i);
            void isPriority;

            return (
              <motion.button
                key={`${entry.key}-${i}`}
                whileTap={{ scale: isInteractive ? 0.96 : 1 }}
                onClick={() => onMark(entry.slot, n)}
                className={`relative flex aspect-square min-h-[64px] items-center justify-center rounded-[16px] border text-[16px] font-extrabold transition-all select-none ${
                  isMarked
                    ? "border-gold/80 bg-gold-shine text-purple-deep shadow-[0_0_14px_oklch(0.85_0.18_90/0.45)]"
                    : "border-white/45 bg-white text-[oklch(0.2_0.02_280)]"
                } ${isInteractive ? "active:scale-95" : ""}`}
                style={isMarked ? { boxShadow: `0 0 14px ${glowColor}` } : undefined}
              >
                <span className="leading-none">{n}</span>
              </motion.button>
            );
          })}
        </div>
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

