import goldenCity from "@/assets/room-golden-city.png";
import nightBingo from "@/assets/room-night-bingo.png";
import vipCrown from "@/assets/room-vip-crown.png";

export type RoomTier = "free" | "standard" | "premium" | "vip" | "jackpot";
export type RoomPhase = "waiting" | "playing" | "finished";

export interface RoomConfig {
  id: string;
  name: string;
  subtitle: string;
  img: string;
  tier: RoomTier;
  /** full room cycle length in seconds */
  cycleSec: number;
  /** countdown / presale window before the round actually starts */
  waitingSec: number;
  /** visible playing window */
  playingSec: number;
  /** brief settlement / winner validation window */
  finishedSec: number;
  /** ms between draws inside a round */
  drawIntervalMs: number;
  /** ticket cost to play one round */
  ticketCost: number;
  /** spark reward on win */
  sparkReward: number;
  /** ticket reward on win */
  ticketReward: number;
  /** numbers pool max (1..max) */
  maxNumber: number;
  /** card size NxN */
  cardSize: 3 | 4 | 5;
  /** visible badges in lobby card */
  badges: ("live" | "vip" | "hot" | "free" | "new")[];
  accent: string;
  /** color for live indicators */
  glow: string;
}

export interface RoomTimeline {
  phase: RoomPhase;
  cycleIndex: number;
  inCycleSec: number;
  phaseElapsedSec: number;
  phaseRemainingSec: number;
  secondsToNextRound: number;
  activeRoundIndex: number;
  upcomingRoundIndex: number;
}

export const ROOMS: RoomConfig[] = [
  {
    id: "neon-newcomer",
    name: "Neon Newcomer",
    subtitle: "Free room — perfetta per iniziare",
    img: nightBingo,
    tier: "free",
    cycleSec: 60,
    waitingSec: 24,
    playingSec: 30,
    finishedSec: 6,
    drawIntervalMs: 2200,
    ticketCost: 0,
    sparkReward: 20,
    ticketReward: 1,
    maxNumber: 60,
    cardSize: 3,
    badges: ["new", "free"],
    accent: "from-[oklch(0.74_0.18_150)] to-[oklch(0.45_0.18_160)]",
    glow: "oklch(0.74 0.18 150)",
  },
  {
    id: "night-rush",
    name: "Night Bingo Rush",
    subtitle: "Veloce, divertente, infinito",
    img: nightBingo,
    tier: "standard",
    cycleSec: 90,
    waitingSec: 32,
    playingSec: 50,
    finishedSec: 8,
    drawIntervalMs: 1800,
    ticketCost: 1,
    sparkReward: 60,
    ticketReward: 1,
    maxNumber: 75,
    cardSize: 5,
    badges: ["live", "hot"],
    accent: "from-[oklch(0.62_0.28_350)] to-[oklch(0.4_0.22_320)]",
    glow: "oklch(0.62 0.28 350)",
  },
  {
    id: "golden-city",
    name: "Golden City",
    subtitle: "La room dei big winners",
    img: goldenCity,
    tier: "premium",
    cycleSec: 180,
    waitingSec: 68,
    playingSec: 100,
    finishedSec: 12,
    drawIntervalMs: 2500,
    ticketCost: 2,
    sparkReward: 180,
    ticketReward: 2,
    maxNumber: 90,
    cardSize: 4,
    badges: ["live", "hot"],
    accent: "from-[oklch(0.7_0.25_25)] to-[oklch(0.5_0.25_15)]",
    glow: "oklch(0.85 0.18 90)",
  },
  {
    id: "royal-vip",
    name: "Royal VIP Hall",
    subtitle: "Solo per i veri Re — reward x3",
    img: vipCrown,
    tier: "vip",
    cycleSec: 300,
    waitingSec: 108,
    playingSec: 178,
    finishedSec: 14,
    drawIntervalMs: 3000,
    ticketCost: 5,
    sparkReward: 600,
    ticketReward: 5,
    maxNumber: 90,
    cardSize: 5,
    badges: ["live", "vip"],
    accent: "from-[oklch(0.78_0.16_220)] to-[oklch(0.5_0.18_240)]",
    glow: "oklch(0.78 0.16 220)",
  },
  {
    id: "mega-jackpot",
    name: "Mega Jackpot",
    subtitle: "Una partita ogni 10 minuti, jackpot enorme",
    img: vipCrown,
    tier: "jackpot",
    cycleSec: 600,
    waitingSec: 210,
    playingSec: 374,
    finishedSec: 16,
    drawIntervalMs: 3500,
    ticketCost: 10,
    sparkReward: 2500,
    ticketReward: 10,
    maxNumber: 90,
    cardSize: 5,
    badges: ["vip", "hot"],
    accent: "from-[oklch(0.65_0.27_300)] to-[oklch(0.35_0.22_280)]",
    glow: "oklch(0.85 0.18 90)",
  },
];

for (const room of ROOMS) {
  if (room.waitingSec + room.playingSec + room.finishedSec !== room.cycleSec) {
    throw new Error(`Room ${room.id} has invalid timings`);
  }
}

export function getRoom(id: string | undefined): RoomConfig {
  return ROOMS.find((r) => r.id === id) ?? ROOMS[1];
}

/** Anchor: Jan 1 2024 UTC. Each room cycles deterministically so all players are in sync. */
const EPOCH = new Date("2024-01-01T00:00:00Z").getTime();

export function getRoomTimeline(room: RoomConfig, now = Date.now()): RoomTimeline {
  const elapsed = Math.floor((now - EPOCH) / 1000);
  const cycleIndex = Math.floor(elapsed / room.cycleSec);
  const inCycleSec = ((elapsed % room.cycleSec) + room.cycleSec) % room.cycleSec;

  if (inCycleSec < room.waitingSec) {
    return {
      phase: "waiting",
      cycleIndex,
      inCycleSec,
      phaseElapsedSec: inCycleSec,
      phaseRemainingSec: room.waitingSec - inCycleSec,
      secondsToNextRound: room.waitingSec - inCycleSec,
      activeRoundIndex: cycleIndex,
      upcomingRoundIndex: cycleIndex,
    };
  }

  if (inCycleSec < room.waitingSec + room.playingSec) {
    const phaseElapsedSec = inCycleSec - room.waitingSec;
    return {
      phase: "playing",
      cycleIndex,
      inCycleSec,
      phaseElapsedSec,
      phaseRemainingSec: room.playingSec - phaseElapsedSec,
      secondsToNextRound: 0,
      activeRoundIndex: cycleIndex,
      upcomingRoundIndex: cycleIndex + 1,
    };
  }

  const phaseElapsedSec = inCycleSec - room.waitingSec - room.playingSec;
  return {
    phase: "finished",
    cycleIndex,
    inCycleSec,
    phaseElapsedSec,
    phaseRemainingSec: room.finishedSec - phaseElapsedSec,
    secondsToNextRound: room.finishedSec - phaseElapsedSec + room.waitingSec,
    activeRoundIndex: cycleIndex,
    upcomingRoundIndex: cycleIndex + 1,
  };
}

/** Seconds until the next round starts in this room. */
export function secondsToNextRound(room: RoomConfig, now = Date.now()): number {
  return getRoomTimeline(room, now).secondsToNextRound;
}

/** Seeded RNG so every player in a room sees the same draws for the same round. */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate the full draw order for a specific round (shared across players). */
export function drawOrderForRound(room: RoomConfig, roundIndex: number): number[] {
  const seed = (room.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 7919 + roundIndex) >>> 0;
  const rng = mulberry32(seed);
  const pool = Array.from({ length: room.maxNumber }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

/** Backward-compatible helper for the active round. */
export function drawOrderForCurrentRound(room: RoomConfig, now = Date.now()): number[] {
  return drawOrderForRound(room, getRoomTimeline(room, now).activeRoundIndex);
}

/** Commercial-friendly cap so a player can buy multiple cards without breaking mobile UX. */
export function maxCardsPerRoom(room: RoomConfig): number {
  switch (room.tier) {
    case "vip":
    case "jackpot":
      return 6;
    default:
      return 4;
  }
}

/** Generate a deterministic card for the player in a specific round and slot. */
export function cardForRound(room: RoomConfig, playerSeed: number, roundIndex: number, slot = 0): number[] {
  const seed = (playerSeed * 31 + roundIndex * 1009 + slot * 65537) >>> 0;
  const rng = mulberry32(seed);
  const pool = Array.from({ length: room.maxNumber }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const total = room.cardSize * room.cardSize;
  const card = pool.slice(0, total);
  if (room.cardSize === 5) card[12] = 0;
  return card;
}

/** Backward-compatible helper for the active round. */
export function cardForPlayer(room: RoomConfig, playerSeed: number, now = Date.now()): number[] {
  return cardForRound(room, playerSeed, getRoomTimeline(room, now).activeRoundIndex, 0);
}
