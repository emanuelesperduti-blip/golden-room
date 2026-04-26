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
import { cardForRound, drawOrderForRound, getRoom, getRoomTimeline, maxCardsPerRoom, maxDrawsForRoom } from "@/lib/rooms";
import { useGameStore } from "@/lib/gameStore";
import { useAudio } from "@/hooks/useAudio";
import { setAuthRedirect } from "@/lib/authRedirect";
import { useAuth } from "@/hooks/useAuth";
import { useViewerGameState } from "@/hooks/useViewerGameState";
import { BOTS, BotChatEngine } from "@/lib/bots";
import { getBotConfigForRoom } from "@/lib/admin";
import { formatRealWin, recordRealWin, useRecentWinHistory } from "@/lib/winHistory";

const searchSchema = z.object({ roomId: z.string().optional() });

export const Route = createFileRoute("/bingo")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "GameSpark — Bingo Live" }],
  }),
  component: BingoPage,
});

function checkBingo(card: number[], marked: Set<number>): boolean {
  return card.every((n) => n === 0 || marked.has(n));
}

type RoundWinner = {
  name: string;
  avatar: string;
  kind: "player" | "bot";
  cardSlot: number | null;
  drawIndex: number;
};

type RoundOutcome = {
  drawIndex: number | null;
  winners: RoundWinner[];
};

function getCompletionDrawIndex(card: number[], drawOrder: number[], maxDraws: number): number | null {
  const positions = new Map<number, number>();
  drawOrder.slice(0, maxDraws).forEach((value, idx) => positions.set(value, idx));
  let maxPos = -1;
  for (const value of card) {
    if (value === 0) continue;
    const pos = positions.get(value);
    if (pos == null) return null;
    if (pos > maxPos) maxPos = pos;
  }
  return maxPos >= 0 ? maxPos : null;
}

function getRoundOutcome(params: {
  room: ReturnType<typeof getRoom>;
  roundIndex: number;
  playerSeed: number;
  playerName: string;
  playerCards: Array<{ slot: number }>;
  botCount: number;
}): RoundOutcome {
  const { room, roundIndex, playerSeed, playerName, playerCards, botCount } = params;
  const drawOrder = drawOrderForRound(room, roundIndex);
  const maxDraws = maxDrawsForRoom(room);
  const candidates: RoundWinner[] = [];

  for (const entry of playerCards) {
    const card = cardForRound(room, playerSeed, roundIndex, entry.slot);
    const drawIndex = getCompletionDrawIndex(card, drawOrder, maxDraws);
    if (drawIndex == null) continue;
    candidates.push({ name: playerName, avatar: "🧑", kind: "player", cardSlot: entry.slot, drawIndex });
  }

  for (let i = 0; i < botCount; i++) {
    const bot = BOTS[i % BOTS.length];
    const card = cardForRound(room, 100000 + i * 7919, roundIndex, 0);
    const drawIndex = getCompletionDrawIndex(card, drawOrder, maxDraws);
    if (drawIndex == null) continue;
    candidates.push({ name: bot.name, avatar: bot.avatar, kind: "bot", cardSlot: null, drawIndex });
  }

  if (candidates.length === 0) return { drawIndex: null, winners: [] };
  const earliest = Math.min(...candidates.map((entry) => entry.drawIndex));
  return {
    drawIndex: earliest,
    winners: candidates.filter((entry) => entry.drawIndex === earliest),
  };
}

type ChatItem = { user: string; text: string; color: string; avatar: string };
type PurchasedCardState = { roundIndex: number; slot: number; marked: number[] };
type DisplayCard = PurchasedCardState & { key: string; card: number[]; markedSet: Set<number> };
type CardInsight = DisplayCard & {
  bestMissing: number;
  bestLineIndices: number[];
  matchedInBestLine: number;
  completedLines: number;
  completedCells: number;
  markedPlayableCells: number;
  missingForBingo: number;
  totalPlayableCells: number;
};

function readPersistedCards(storageKey: string, currentRoundIndex: number): PurchasedCardState[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => typeof entry?.roundIndex === "number" && typeof entry?.slot === "number" && Array.isArray(entry?.marked))
      .map((entry) => ({
        roundIndex: entry.roundIndex,
        slot: entry.slot,
        marked: entry.marked.filter((value: unknown) => typeof value === "number"),
      }))
      .filter((entry) => entry.roundIndex >= currentRoundIndex);
  } catch {
    return [];
  }
}

function syncCardsWithDraws(
  cards: PurchasedCardState[],
  room: ReturnType<typeof getRoom>,
  playerSeed: number,
  activeRoundIndex: number,
  drawnNumbers: number[],
) {
  if (drawnNumbers.length === 0) return cards;
  const drawnSet = new Set(drawnNumbers);
  let changed = false;

  const nextCards = cards.map((entry) => {
    if (entry.roundIndex !== activeRoundIndex) return entry;
    const card = cardForRound(room, playerSeed, entry.roundIndex, entry.slot);
    const autoMarked = card.filter((value) => value !== 0 && drawnSet.has(value));
    const merged = Array.from(new Set([...entry.marked, ...autoMarked])).sort((a, b) => a - b);
    if (merged.length === entry.marked.length && merged.every((value, idx) => value === entry.marked[idx])) {
      return entry;
    }
    changed = true;
    return { ...entry, marked: merged };
  });

  return changed ? nextCards : cards;
}

function getBingoStorageKey(roomId: string, userId: string | null) {
  return `gamespark-bingo-room-state:${roomId}:${userId ?? "guest"}`;
}

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
  const totalPlayableCells = card.filter((value) => value !== 0).length;
  const markedPlayableCells = card.filter((value) => value !== 0 && marked.has(value)).length;
  const completedCells = card.filter((value) => value === 0 || marked.has(value)).length;

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

  const missingForBingo = Math.max(0, totalPlayableCells - markedPlayableCells);

  return {
    bestMissing: Number.isFinite(bestMissing) ? bestMissing : size,
    bestLineIndices,
    matchedInBestLine,
    completedLines,
    completedCells,
    markedPlayableCells,
    missingForBingo,
    totalPlayableCells,
  };
}

function bingoProgressLabel(missingForBingo: number): string {
  if (missingForBingo <= 0) return "BINGO completo";
  if (missingForBingo === 1) return "1 numero al BINGO";
  return `${missingForBingo} numeri al BINGO`;
}

function intermediateLabel(completedLines: number): string {
  if (completedLines <= 0) return "Nessun premio intermedio";
  if (completedLines === 1) return "1 linea completata";
  return `${completedLines} linee completate`;
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
  const [showAllCards, setShowAllCards] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [winnerNames, setWinnerNames] = useState<string[]>([]);
  const [winnerCardSlot, setWinnerCardSlot] = useState<number | null>(null);
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
  const winnerModalRoundRef = useRef<number | null>(null);
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const timeline = getRoomTimeline(room, now);
  const currentRoundIndex = timeline.activeRoundIndex;
  const upcomingRoundIndex = timeline.upcomingRoundIndex;
  const maxCards = maxCardsPerRoom(room);
  const effectiveCardSize = room.cardSize;
  const isGuest = !user;
  const storageKey = useMemo(() => getBingoStorageKey(room.id, user?.id ?? null), [room.id, user?.id]);
  const botConfig = useMemo(() => getBotConfigForRoom(room.id), [room.id]);
  const roomRealWins = useRecentWinHistory(5, room.id);
  const botCount = botConfig.enabled ? botConfig.botCount : 0;

  const drawOrder = useMemo(() => drawOrderForRound(room, currentRoundIndex), [room, currentRoundIndex]);

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
      visibleCards
        .map((entry) => ({
          ...entry,
          ...analyzeCard(entry.card, entry.markedSet, effectiveCardSize),
        }))
        .sort((a, b) =>
          a.missingForBingo - b.missingForBingo ||
          a.bestMissing - b.bestMissing ||
          b.matchedInBestLine - a.matchedInBestLine ||
          b.completedLines - a.completedLines ||
          a.slot - b.slot,
        ),
    [visibleCards, effectiveCardSize],
  );
  const isLateEntry = timeline.phase === "playing" && currentCards.length === 0;
  const currentRoundOutcome = useMemo(() => getRoundOutcome({
    room,
    roundIndex: currentRoundIndex,
    playerSeed,
    playerName: username,
    playerCards: currentReservations.map((entry) => ({ slot: entry.slot })),
    botCount,
  }), [room, currentRoundIndex, playerSeed, username, currentReservations, botCount]);
  const recentResults = useMemo(() => {
    const settledRound = timeline.phase === "finished" ? currentRoundIndex : currentRoundIndex - 1;
    return Array.from({ length: 3 }, (_, idx) => settledRound - idx)
      .filter((roundIndex) => roundIndex >= 0)
      .map((roundIndex) => ({
        roundIndex,
        winners: getRoundOutcome({
          room,
          roundIndex,
          playerSeed,
          playerName: username,
          playerCards: [],
          botCount: botCount,
        }).winners,
      }))
      .filter((entry) => entry.winners.length > 0);
  }, [timeline.phase, currentRoundIndex, room, playerSeed, username, botCount]);

  const displayedWinnerNames = Array.from(new Set(
    (winnerNames.length > 0 ? winnerNames : currentRoundOutcome.winners.map((entry) => entry.name)).filter(Boolean),
  ));
  const finishedWinner = displayedWinnerNames.length > 0 ? displayedWinnerNames.join(", ") : null;
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
  const phasePillLabel = timeline.phase === "waiting" ? secondsLabel : timeline.phase === "playing" ? "PARTITA IN CORSO" : "VALIDAZIONE";
  const phaseDuration =
    timeline.phase === "waiting" ? room.waitingSec : timeline.phase === "playing" ? 1 : room.finishedSec;
  const phaseProgress = timeline.phase === "playing" ? 100 : Math.min(100, Math.max(0, (timeline.phaseElapsedSec / Math.max(1, phaseDuration)) * 100));

  const rawDrawCount =
    timeline.phase === "playing"
      ? Math.min(maxDrawsForRoom(room), Math.max(0, Math.floor((timeline.phaseElapsedSec * 1000) / room.drawIntervalMs)))
      : 0;
  const winningDrawCount = currentRoundOutcome.drawIndex != null ? currentRoundOutcome.drawIndex + 1 : null;
  const drawCount = winningDrawCount != null ? Math.min(rawDrawCount, winningDrawCount) : rawDrawCount;
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
  const bestCardIndex = bestCard ? deckCards.findIndex((entry) => entry.key === bestCard.key) : -1;

  useEffect(() => {
    if (bestCardIndex < 0) return;
    const container = cardsScrollRef.current;
    const target = container?.children?.[bestCardIndex] as HTMLElement | undefined;
    if (!container || !target) return;

    target.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [bestCardIndex, drawCount, timeline.phase]);

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
    const engine = new BotChatEngine((msg) => setChat((c) => [...c.slice(-35), msg]), { enabled: botConfig.enabled && botCount > 0, chatPace: botConfig.chatPace, reactionSpeed: botConfig.reactionSpeed });
    botEngineRef.current = engine;
    engine.start();
    return () => engine.stop();
  }, [botConfig.enabled, botConfig.chatPace, botConfig.reactionSpeed, botCount]);

  useEffect(() => {
    if (isGuest) {
      setPurchasedCards([]);
      return;
    }
    setPurchasedCards(readPersistedCards(storageKey, currentRoundIndex));
  }, [storageKey, currentRoundIndex, isGuest]);

  useEffect(() => {
    if (typeof window === "undefined" || isGuest) return;
    const persistedCards = purchasedCards.filter((entry) => entry.roundIndex >= currentRoundIndex);
    window.localStorage.setItem(storageKey, JSON.stringify(persistedCards));
  }, [storageKey, purchasedCards, currentRoundIndex, isGuest]);

  useEffect(() => {
    if (isGuest || timeline.phase !== "playing" || drawnNumbers.length === 0) return;
    setPurchasedCards((prev) => syncCardsWithDraws(prev, room, playerSeed, currentRoundIndex, drawnNumbers));
  }, [isGuest, timeline.phase, drawnNumbers, room, playerSeed, currentRoundIndex]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  useEffect(() => {
    if (cleanupRoundRef.current === currentRoundIndex) return;
    cleanupRoundRef.current = currentRoundIndex;
    spokenDrawRef.current = null;
    setWinnerNames([]);
    setWinnerCardSlot(null);
    setShowWin(false);
    winnerModalRoundRef.current = null;
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
    if (currentRoundOutcome.drawIndex == null) return;
    if (drawCount - 1 < currentRoundOutcome.drawIndex) return;
    if (winnerModalRoundRef.current === currentRoundIndex) return;

    winnerModalRoundRef.current = currentRoundIndex;
    bingoRewardedRoundRef.current = currentRoundIndex;
    const localWinner = currentRoundOutcome.winners.find((entry) => entry.kind === "player");
    setWinnerNames(Array.from(new Set(currentRoundOutcome.winners.map((entry) => entry.name).filter(Boolean))));
    setWinnerCardSlot(localWinner?.cardSlot ?? null);
    setShowWin(true);
    sfx("win");
    botEngineRef.current?.onBingo();
    if (localWinner) {
      // Apply event multipliers (Step 11)
      let sparkReward = room.sparkReward;
      let ticketReward = room.ticketReward;
      
      try {
        const adminData = JSON.parse(window.localStorage.getItem("golden-room-admin-v1") || "{}");
        const multipliers = adminData.state?.eventMultipliers || [];
        const now = Date.now();
        const activeEvents = multipliers.filter((e: any) => 
          e.isActive && 
          e.startTime <= now && 
          now < e.endTime &&
          (!e.targetRoomId || e.targetRoomId === room.id)
        );
        
        for (const event of activeEvents) {
          sparkReward *= event.sparkMultiplier;
          ticketReward *= event.ticketMultiplier;
        }
      } catch (e) {}

      addSparks(Math.floor(sparkReward));
      addTickets(Math.floor(ticketReward));
      incrementBingosWon();
      void recordRealWin({ user, username, roomId: room.id, roomName: room.name, gameType: "bingo", prizeLabel: `+${Math.floor(sparkReward)} Spark · +${Math.floor(ticketReward)} Ticket`, sparkReward: Math.floor(sparkReward), ticketReward: Math.floor(ticketReward) });
    }
    confetti({
      particleCount: 240,
      spread: 110,
      origin: { y: 0.55 },
      colors: ["#ff3da6", "#f5b400", "#7c3aed", "#22d3ee", "#34d399"],
    });
  }, [currentRoundOutcome, drawCount, currentRoundIndex, sfx, addSparks, addTickets, incrementBingosWon, room.sparkReward, room.ticketReward]);

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

    // Check for free room event (Step 11)
    let isFreeRoom = room.ticketCost === 0;
    try {
      const adminData = JSON.parse(window.localStorage.getItem("golden-room-admin-v1") || "{}");
      const multipliers = adminData.state?.eventMultipliers || [];
      const now = Date.now();
      isFreeRoom = isFreeRoom || multipliers.some((e: any) => 
        e.isActive && 
        e.freeRoomEnabled && 
        e.startTime <= now && 
        now < e.endTime &&
        (!e.targetRoomId || e.targetRoomId === room.id)
      );
    } catch (e) {}

    const qty = isFreeRoom ? Math.min(purchaseQty, availableSlots) : Math.min(purchaseQty, affordableSlots);
    if (qty <= 0) return;
    const totalTickets = isFreeRoom ? 0 : qty * room.ticketCost;

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
                <Clock className="h-3 w-3" /> Prossima partita tra {secondsLabel}
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

      <section data-tour="bingo-live-ball" className="relative z-10 mt-2 flex items-center justify-center">
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
                  fontSize: timeline.phase === "waiting" ? "2rem" : timeline.phase === "finished" ? "2.4rem" : "2rem",
                }}
              >
                {timeline.phase === "waiting" && secondsLabel}
                {timeline.phase === "playing" && (drawnNumber ?? "LIVE")}
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
            "Partita bingo in corso. Il tempo non indica la durata del match: durante questa fase vedi solo lo stato live e, se arrivi tardi, prepari il turno successivo."}
          {timeline.phase === "finished" && `Vincitori del turno: ${finishedWinner ?? "in validazione"}. Tra poco riparte una nuova prevendita.`}
        </p>

        {timeline.phase === "playing" && (
          <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full border border-red-300/25 bg-red-500/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-red-100">
            <span className="h-2 w-2 rounded-full bg-red-300" /> PARTITA IN CORSO
          </div>
        )}
        {timeline.phase === "finished" && (
          <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80">
            <span className="h-2 w-2 rounded-full bg-gold" /> Validazione vincita in corso
          </div>
        )}

        <div className="mx-auto mt-3 max-w-sm rounded-2xl border border-white/10 bg-black/25 px-3 py-3 shadow-card-game">
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/65">
            <span>{timeline.phase === "waiting" ? "Countdown pre-partita" : timeline.phase === "playing" ? "Partita in corso" : "Chiusura turno"}</span>
            <span>{phasePillLabel}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className={`h-full rounded-full ${timeline.phase === "playing" ? "bg-red-400" : "bg-gold-shine"}`}
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

      <section data-tour="bingo-main-card" className="relative z-10 mt-4 px-4">
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
                      : `Hai ${deckCards.length} cartelle. Scorri a destra e sinistra oppure apri la vista completa.`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {deckCards.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setShowAllCards(true)}
                      className="rounded-full border border-gold/35 bg-gold/10 px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-gold transition active:scale-95"
                    >
                      <span data-tour="bingo-view-all-cards">Vedi tutte le cartelle</span>
                    </button>
                  ) : null}
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
                      bingoLabel={bingoProgressLabel(entry.missingForBingo)}
                      intermediateStatus={intermediateLabel(entry.completedLines)}
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
          <StatusCard icon={<Trophy className="h-4 w-4" />} title="Premio finale" value={`+${room.sparkReward} Spark · +${room.ticketReward} Ticket`} />
          <StatusCard icon={<Clock className="h-4 w-4" />} title="Stato" value={timeline.phase === "waiting" ? "Prevendita" : timeline.phase === "playing" ? "Live" : "Chiusura"} />
          <StatusCard icon={<TimerReset className="h-4 w-4" />} title="Max cartelle" value={`${maxCards} per round`} />
        </div>
      </section>
      <section data-tour="bingo-drawn-numbers" className="relative z-10 mt-3 px-4">
        <div className="rounded-3xl border border-white/10 bg-card-game p-4 shadow-card-game">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-black/25 text-gold">
              <Trophy className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-white">Gerarchia premi trasparente</p>
              <p className="mt-1 text-xs font-bold text-white/65">Linea, più linee e altri avanzamenti sono eventi intermedi della corsa. Il vero BINGO e il premio finale arrivano solo quando tutte le caselle della cartella sono uscite.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mt-3 px-4">
        <div className="rounded-3xl border border-white/10 bg-card-game p-4 shadow-card-game">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-extrabold text-white">Ultimi esiti room</p>
              <p className="mt-1 text-[11px] font-bold text-white/55">Il BINGO vero arriva solo a cartella completata. Linee e multi-linee restano eventi intermedi della corsa al premio finale.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/55">Storico live</span>
          </div>

          <div className="mt-3 space-y-2">
            {roomRealWins.slice(0, 5).map((win) => (
              <div key={win.id} className="flex items-center justify-between gap-3 rounded-2xl border border-gold/25 bg-gold/10 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏆</span>
                  <div>
                    <p className="text-xs font-extrabold text-white">{win.username}</p>
                    <p className="text-[11px] font-bold text-white/55">{formatRealWin(win)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-extrabold text-gold">{win.prize_label || "Vincita reale"}</p>
                  <p className="text-[11px] font-bold text-white/55">live</p>
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
                    : `Turno chiuso. Vincitori: ${finishedWinner ?? "in validazione"}`}
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
        <div data-tour="bingo-drawn-numbers" className="relative z-10 mt-3 flex flex-wrap justify-center gap-1.5 px-4">
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
                  {timeline.phase === "playing" && (currentReservations.length > 0 ? "Partita in corso" : "Prenota il turno successivo")}
                  {timeline.phase === "finished" && "Turno in chiusura"}
                </p>
                <p className="mt-1 text-xs font-bold text-white/60">
                  {timeline.phase === "waiting" &&
                    `Il countdown indica solo quando parte la prossima partita. Limite stanza: ${maxCards} cartelle.`}
                  {timeline.phase === "playing" &&
                    `La partita è già iniziata: ora puoi solo prenotare il round successivo. Puoi arrivare fino a ${maxCards} cartelle per round.`}
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
        {showAllCards && deckCards.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99] bg-black/75 backdrop-blur-md"
          >
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.97 }}
              className="absolute inset-x-3 bottom-4 top-4 overflow-hidden rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,oklch(0.28_0.14_305/0.98),oklch(0.16_0.09_300/0.99))] shadow-[0_30px_80px_oklch(0.08_0.08_300/0.8)]"
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-gold">Vedi tutte le cartelle</p>
                  <p className="mt-1 text-[11px] font-bold text-white/60">Miniature compatte per confrontare tutte le cartelle acquistate in un colpo d'occhio.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllCards(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/20 text-white active:scale-95"
                  aria-label="Chiudi vista completa cartelle"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="no-scrollbar h-[calc(100%-5rem)] overflow-y-auto px-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  {deckCards.map((entry, idx) => (
                    <MiniBingoCardPanel
                      key={`mini-${entry.key}`}
                      entry={entry}
                      index={idx}
                      total={deckCards.length}
                      size={effectiveCardSize}
                      bingoLabel={bingoProgressLabel(entry.missingForBingo)}
                      intermediateStatus={intermediateLabel(entry.completedLines)}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 16 }}
              className="relative overflow-hidden rounded-[2.25rem] border border-gold/35 bg-[linear-gradient(180deg,rgba(82,16,122,0.96),rgba(31,8,58,0.98))] px-8 py-10 shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
            >
              <motion.div
                className="absolute inset-x-6 top-0 h-24 rounded-b-full opacity-60"
                animate={{ opacity: [0.35, 0.8, 0.35] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                style={{ background: "radial-gradient(circle at top, rgba(255,215,64,0.85), transparent 70%)" }}
              />
              <div className="relative flex flex-col items-center text-center">
                <div className="mb-4 text-8xl">🏆</div>
                <p className="text-[12px] font-extrabold uppercase tracking-[0.28em] text-gold/80">Premio finale</p>
                <h2 className="mt-2 text-stroke-game text-5xl font-extrabold text-gold">BINGO!</h2>
                <p className="mt-4 max-w-sm text-2xl font-black text-white">{displayedWinnerNames.length > 1 ? `Hanno fatto BINGO: ${displayedWinnerNames.join(", ")}` : `Il giocatore ${displayedWinnerNames[0] ?? username} ha fatto BINGO!`}</p>
                <p className="mt-3 text-xl font-bold text-white">+{room.sparkReward} Spark · +{room.ticketReward} Ticket</p>
                <p className="mt-2 max-w-sm text-center text-sm font-bold text-white/72">Cartella completata al 100%. Le linee restano eventi intermedi, ma il vero BINGO scatta solo quando tutta la cartella è chiusa.</p>
                {winnerCardSlot != null ? <p className="mt-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-cyan-100">Cartella vincente #{winnerCardSlot + 1}</p> : null}
              </div>
            </motion.div>
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
  bingoLabel,
  intermediateStatus,
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
  bingoLabel: string;
  intermediateStatus: string;
  isBest: boolean;
  bestLineIndices: number[];
  onMark: (slot: number, n: number) => void;
}) {
  const bestLineSet = new Set(bestLineIndices);
  const hasMarkedProgress = entry.markedPlayableCells > 0;
  const cardMaxWidth = size === 5 ? 400 : size === 4 ? 348 : 270;
  const letters = ["B", "I", "N", "G", "O"].slice(0, size);
  const letterColors = [
    "linear-gradient(180deg, #ff8b1f 0%, #f25c05 100%)",
    "linear-gradient(180deg, #ffd84d 0%, #f2b705 100%)",
    "linear-gradient(180deg, #8cd63f 0%, #59b925 100%)",
    "linear-gradient(180deg, #25b9ff 0%, #1675ff 100%)",
    "linear-gradient(180deg, #b59eff 0%, #8f73ff 100%)",
  ];
  const shellThemes = [
    {
      border: "rgba(236, 72, 153, 0.55)",
      glow: "0 18px 48px rgba(219, 39, 119, 0.22)",
      panel: "linear-gradient(180deg, rgba(132, 33, 188, 0.98) 0%, rgba(82, 16, 122, 0.98) 100%)",
      inner: "linear-gradient(180deg, rgba(94, 22, 136, 0.96) 0%, rgba(60, 11, 91, 0.96) 100%)",
    },
    {
      border: "rgba(59, 130, 246, 0.58)",
      glow: "0 18px 48px rgba(37, 99, 235, 0.24)",
      panel: "linear-gradient(180deg, rgba(28, 102, 198, 0.98) 0%, rgba(20, 59, 133, 0.98) 100%)",
      inner: "linear-gradient(180deg, rgba(22, 79, 154, 0.96) 0%, rgba(16, 45, 98, 0.96) 100%)",
    },
    {
      border: "rgba(34, 197, 94, 0.58)",
      glow: "0 18px 48px rgba(21, 128, 61, 0.24)",
      panel: "linear-gradient(180deg, rgba(53, 161, 53, 0.98) 0%, rgba(27, 100, 40, 0.98) 100%)",
      inner: "linear-gradient(180deg, rgba(41, 122, 41, 0.96) 0%, rgba(22, 74, 30, 0.96) 100%)",
    },
    {
      border: "rgba(249, 115, 22, 0.62)",
      glow: "0 18px 48px rgba(234, 88, 12, 0.22)",
      panel: "linear-gradient(180deg, rgba(225, 119, 12, 0.98) 0%, rgba(163, 74, 9, 0.98) 100%)",
      inner: "linear-gradient(180deg, rgba(173, 89, 10, 0.96) 0%, rgba(115, 52, 9, 0.96) 100%)",
    },
  ];
  const theme = shellThemes[index % shellThemes.length];
  const cellSizeClass = size === 5 ? "min-h-[54px] text-[18px]" : size === 4 ? "min-h-[64px] text-[21px]" : "min-h-[74px] text-[24px]";

  return (
    <div
      className="rounded-[2rem] border p-3 shadow-card-game"
      style={{
        borderColor: theme.border,
        background: theme.panel,
        boxShadow: theme.glow,
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-white">Cartella {index + 1}</p>
            {isBest ? (
              <span className="rounded-full border border-cyan-200/50 bg-cyan-300/18 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-white">
                Best focus
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] font-bold text-white/75">{subtitle}</p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <span className="rounded-full border border-yellow-200/45 bg-yellow-300/15 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-yellow-100">
            {bingoLabel}
          </span>
          <span className="rounded-full border border-white/12 bg-black/18 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-white/72">
            {intermediateStatus}
          </span>
          {total > 1 ? <span className="text-[10px] font-extrabold text-white/70">{index + 1}/{total}</span> : null}
        </div>
      </div>

      <div
        className="rounded-[1.7rem] border px-3 pb-3 pt-2"
        style={{
          maxWidth: `${cardMaxWidth}px`,
          marginInline: "auto",
          background: theme.inner,
          borderColor: "rgba(255,255,255,0.12)",
        }}
      >
        <div
          className="mb-3"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
            gap: size === 5 ? "8px" : "10px",
          }}
        >
          {letters.map((letter, idx) => (
            <div
              key={`${entry.key}-letter-${letter}`}
              className="flex h-12 items-center justify-center rounded-full border border-white/30 text-[28px] font-black uppercase leading-none text-white shadow-[inset_0_3px_10px_rgba(255,255,255,0.25)]"
              style={{ background: letterColors[idx] }}
            >
              {letter}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
            gap: size === 5 ? "10px" : "12px",
          }}
        >
          {entry.card.map((n, i) => {
            const isMarked = n !== 0 && entry.markedSet.has(n);
            const isFreeCell = n === 0;
            const isPriority = hasMarkedProgress && bestLineSet.has(i);

            return (
              <motion.button
                key={`${entry.key}-${i}`}
                whileTap={{ scale: isInteractive ? 0.96 : 1 }}
                onClick={() => onMark(entry.slot, n)}
                className={`relative flex aspect-square ${cellSizeClass} items-center justify-center overflow-hidden rounded-[16px] border border-[#b7c8d1] bg-[#f5f6f2] font-black text-[#212226] shadow-[inset_0_2px_0_rgba(255,255,255,0.85),0_2px_4px_rgba(0,0,0,0.18)] transition-transform select-none ${isInteractive ? "active:scale-95" : ""}`}
                style={
                  isPriority && !isMarked
                    ? { boxShadow: `inset 0 2px 0 rgba(255,255,255,0.85), 0 0 0 2px ${glowColor}, 0 2px 4px rgba(0,0,0,0.18)` }
                    : undefined
                }
              >
                {isMarked ? (
                  <span
                    className="absolute inset-[6px] rounded-full"
                    style={{
                      background: "radial-gradient(circle at 35% 30%, #ff8f8f 0%, #ff3535 30%, #d90909 60%, #960505 100%)",
                      boxShadow: "inset -6px -8px 14px rgba(90, 0, 0, 0.4), inset 6px 6px 10px rgba(255, 255, 255, 0.24), 0 4px 12px rgba(122, 0, 0, 0.35)",
                    }}
                  >
                    <span className="absolute left-[22%] top-[18%] h-[28%] w-[28%] rounded-full bg-white/35 blur-[1px]" />
                  </span>
                ) : null}
                {isFreeCell ? (
                  <span className="absolute inset-[3px] rounded-[12px] border border-[#f2d15c] bg-[linear-gradient(180deg,#ffe680_0%,#ffd24d_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_2px_8px_rgba(255,198,41,0.28)]" />
                ) : null}
                {isFreeCell ? (
                  <span className="relative text-[12px] font-black uppercase tracking-[0.16em] text-[#1f1a12]">FREE</span>
                ) : (
                  <span className={`relative leading-none ${isMarked ? "opacity-0" : "opacity-100"}`}>{n}</span>
                )}
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


function MiniBingoCardPanel({
  entry,
  index,
  total,
  size,
  bingoLabel,
  intermediateStatus,
}: {
  entry: CardInsight;
  index: number;
  total: number;
  size: 3 | 4 | 5;
  bingoLabel: string;
  intermediateStatus: string;
}) {
  const headerLetters = ["B", "I", "N", "G", "O"].slice(0, size);
  return (
    <div className="overflow-hidden rounded-[1.4rem] border border-white/12 bg-[linear-gradient(180deg,rgba(108,38,170,0.96),rgba(54,14,92,0.98))] shadow-card-game">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-gold">Cartella {index + 1}</p>
          {total > 1 ? <p className="text-[10px] font-bold text-white/55">{index + 1}/{total}</p> : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full border border-white/12 bg-black/20 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-white/75">{bingoLabel}</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.12em] text-white/55">{intermediateStatus}</span>
        </div>
      </div>

      <div className="p-2.5">
        <div
          className="mb-2 grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        >
          {headerLetters.map((letter) => (
            <div key={`${entry.key}-mini-head-${letter}`} className="flex h-6 items-center justify-center rounded-full bg-gold-shine text-[11px] font-black text-purple-deep">
              {letter}
            </div>
          ))}
        </div>

        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        >
          {entry.card.map((n, i) => {
            const isMarked = n !== 0 && entry.markedSet.has(n);
            const isFreeCell = n === 0;
            return (
              <div
                key={`${entry.key}-mini-${i}`}
                className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-[12px] border text-[13px] font-black ${isMarked ? "border-red-300/60 bg-[radial-gradient(circle_at_35%_30%,#ff9f9f_0%,#ff4444_32%,#cb0909_68%,#7f0404_100%)] text-white shadow-[inset_0_2px_6px_rgba(255,255,255,0.24),0_4px_10px_rgba(122,0,0,0.35)]" : isFreeCell ? "border-[#f2d15c] bg-[linear-gradient(180deg,#ffe680_0%,#ffd24d_100%)] text-[#1f1a12] shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_2px_8px_rgba(255,198,41,0.22)]" : "border-[#c7d3dc] bg-[#f6f7f4] text-[#212226]"}`}
              >
                <span className="leading-none">{isFreeCell ? "FREE" : n}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
