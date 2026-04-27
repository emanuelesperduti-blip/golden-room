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
  /** playing window calculated from maxNumber × drawIntervalMs; not manually configurable */
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



export interface RoomPopulation {
  total: number;
  botCount: number;
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

// ─────────────────────────────────────────────────────────────────────────────
// NOTA: il Bingo non ha una “durata partita” amministrabile.
// La fase di gioco copre le estrazioni necessarie e il round si conclude quando
// una cartella completa una combinazione vincente reale. L’admin può cambiare
// solo il ritmo di estrazione tramite drawIntervalMs.
// ─────────────────────────────────────────────────────────────────────────────
export const ROOMS: RoomConfig[] = [
  {
    id: "neon-newcomer",
    name: "Neon Newcomer",
    subtitle: "Free room — perfetta per iniziare",
    img: nightBingo,
    tier: "free",
    cycleSec: 329,      // 180 + 144 + 5
    waitingSec: 180,
    playingSec: 144,    // 60 numeri × 2 400ms = 144 000ms esatti
    finishedSec: 5,
    drawIntervalMs: 2400,
    ticketCost: 0,
    sparkReward: 6,
    ticketReward: 0,
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
    cycleSec: 358,      // 180 + 173 + 5
    waitingSec: 180,
    playingSec: 173,    // 75 numeri × 2 300ms = 172 500ms → ceil → 173
    finishedSec: 5,
    drawIntervalMs: 2300,
    ticketCost: 1,
    sparkReward: 14,
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
    cycleSec: 419,      // 180 + 234 + 5
    waitingSec: 180,
    playingSec: 234,    // 90 numeri × 2 600ms = 234 000ms esatti
    finishedSec: 5,
    drawIntervalMs: 2600,
    ticketCost: 2,
    sparkReward: 36,
    ticketReward: 1,
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
    cycleSec: 437,      // 180 + 252 + 5
    waitingSec: 180,
    playingSec: 252,    // 90 numeri × 2 800ms = 252 000ms esatti
    finishedSec: 5,
    drawIntervalMs: 2800,
    ticketCost: 5,
    sparkReward: 90,
    ticketReward: 2,
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
    cycleSec: 449,      // 210 + 234 + 5
    waitingSec: 210,
    playingSec: 234,    // 90 numeri × 2 600ms = 234 000ms esatti
    finishedSec: 5,
    drawIntervalMs: 2600,
    ticketCost: 10,
    sparkReward: 300,
    ticketReward: 3,
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
  const baseRoom = ROOMS.find((r) => r.id === id) ?? ROOMS[1];
  
  // Inject admin overrides if available in localStorage
  if (typeof window !== "undefined") {
    try {
      const adminData = JSON.parse(window.localStorage.getItem("golden-room-admin-v1") || "{}");
      const overrides = adminData.state?.roomConfigs?.[baseRoom.id];
      if (overrides) {
        const waitingSec = overrides.countdownDuration ?? baseRoom.waitingSec;
        const drawIntervalMs = overrides.drawSpeed ?? baseRoom.drawIntervalMs;
        const playingSec = Math.ceil((baseRoom.maxNumber * drawIntervalMs) / 1000);

        return {
          ...baseRoom,
          waitingSec,
          playingSec,
          ticketCost: overrides.ticketCost ?? baseRoom.ticketCost,
          sparkReward: overrides.sparkReward ?? baseRoom.sparkReward,
          ticketReward: overrides.ticketReward ?? baseRoom.ticketReward,
          drawIntervalMs,
          // La durata gioco non è configurabile: deriva dal ritmo di estrazione.
          cycleSec: waitingSec + playingSec + baseRoom.finishedSec,
        };
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  return baseRoom;
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

/**
 * Numero massimo di estrazioni per una partita.
 * Non è un timer di chiusura: serve solo a definire il pool massimo di numeri.
 * Il round termina quando una cartella completa una combinazione vincente reale.
 */
export function maxDrawsForRoom(room: RoomConfig): number {
  return room.maxNumber;
}

export function getRoomPopulation(room: RoomConfig, now = Date.now()): RoomPopulation {
  const timeline = getRoomTimeline(room, now);
  const ranges: Record<RoomTier, [number, number]> = {
    free: [9, 16],
    standard: [7, 14],
    premium: [6, 12],
    vip: [4, 9],
    jackpot: [3, 7],
  };
  const [min, max] = ranges[room.tier];
  const rng = createDeterministicRng('population', room.id, timeline.activeRoundIndex);
  const total = min + Math.floor(rng() * (max - min + 1));
  const botCount = Math.max(0, total - 1);
  return { total, botCount };
}

/**
 * Stronger deterministic RNG.
 *
 * We keep the extraction stable for the same room + round so every player in the
 * same sala sees the same sequence, but the sequence is now derived from a richer
 * hash instead of a simple arithmetic seed. This makes rooms diverge more clearly
 * and avoids visibly repetitive patterns across nearby rounds.
 */
function hashStringToSeedParts(value: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;

  for (let i = 0; i < value.length; i++) {
    const k = value.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);

  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

function sfc32(a: number, b: number, c: number, d: number) {
  return function () {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (a + b + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + t) >>> 0;
    return t / 4294967296;
  };
}

function createDeterministicRng(...parts: Array<string | number>) {
  const [a, b, c, d] = hashStringToSeedParts(parts.join('|'));
  return sfc32(a, b, c, d);
}

/** Generate the full draw order for a specific round (shared across players in that room). */
export function drawOrderForRound(room: RoomConfig, roundIndex: number): number[] {
  const rng = createDeterministicRng('draw-order', room.id, room.maxNumber, room.cardSize, roundIndex);
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
  // Check for admin override
  if (typeof window !== "undefined") {
    try {
      const adminData = JSON.parse(window.localStorage.getItem("golden-room-admin-v1") || "{}");
      const overrides = adminData.state?.roomConfigs?.[room.id];
      if (overrides?.maxCardsPerUser) {
        return overrides.maxCardsPerUser;
      }
    } catch (e) {}
  }

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
  const rng = createDeterministicRng('card', room.id, playerSeed, roundIndex, slot, room.maxNumber, room.cardSize);
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
