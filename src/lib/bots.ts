/**
 * GOLDEN ROOM — Bot Community Engine
 * Simulates a live community of Italian players in chat, lobby and bingo rooms.
 * Bots have names, personalities, and react to game events.
 */

export interface BotMessage {
  user: string;
  text: string;
  color: string;
  avatar: string;
  isBot: true;
}

// Italian bot players with personality
export const BOTS = [
  { name: "Marco_B", color: "oklch(0.78 0.16 220)", avatar: "🦁", personality: "excited" },
  { name: "Giulia92", color: "oklch(0.74 0.18 150)", avatar: "🌸", personality: "lucky" },
  { name: "AlessioPro", color: "oklch(0.7 0.25 25)", avatar: "🎯", personality: "strategic" },
  { name: "NicolaGold", color: "oklch(0.85 0.18 90)", avatar: "⚡", personality: "fast" },
  { name: "LauraVIP", color: "oklch(0.62 0.28 350)", avatar: "👑", personality: "vip" },
  { name: "Roberto77", color: "oklch(0.78 0.18 150)", avatar: "🎰", personality: "veteran" },
  { name: "SofiaLuck", color: "oklch(0.72 0.28 250)", avatar: "💎", personality: "lucky" },
  { name: "FrancoBingo", color: "oklch(0.7 0.2 300)", avatar: "🎱", personality: "excited" },
  { name: "CarloKing", color: "oklch(0.65 0.27 300)", avatar: "🔥", personality: "strategic" },
  { name: "AnnaGr", color: "oklch(0.88 0.18 90)", avatar: "🌟", personality: "friendly" },
  { name: "DavideX", color: "oklch(0.7 0.25 350)", avatar: "🎭", personality: "funny" },
  { name: "MiriamVIP", color: "oklch(0.78 0.16 240)", avatar: "✨", personality: "vip" },
  { name: "Piero_99", color: "oklch(0.74 0.2 180)", avatar: "🎪", personality: "veteran" },
  { name: "ErikaTop", color: "oklch(0.7 0.28 30)", avatar: "🦊", personality: "fast" },
  { name: "SimoneBig", color: "oklch(0.68 0.22 270)", avatar: "🐯", personality: "excited" },
];

// Chat messages per game event
const MESSAGES = {
  general: [
    "Forza dai! 🔥",
    "Questa è la mia notte!",
    "Ho quasi fatto bingo!!!",
    "Che partita ragazzi 🎯",
    "Ci sono 4 numeri che mi mancano ancora",
    "Qualcuno ha già fatto bingo?",
    "La room è calda stasera 🌡️",
    "Iniziamo forza!",
    "Stasera vinco, lo sento 😤",
    "Chi è già pronto con la cartella?",
    "Bella partita fino ad ora",
    "Quanto mi piace questa room",
    "Sto sudando freddo 😅",
    "Manca poco mancano poco!",
    "Oh mio dio ho quasi fatto!! 😱",
  ],
  draw: [
    "Eccolo! 🎱",
    "Quel numero no!! 😩",
    "Sì sì sì! Ce l'ho! ✅",
    "Non ce l'ho… prossimo!",
    "Dai ancora uno e ho la riga!",
    "Numero perfetto! 👌",
    "Aspettavo proprio questo!",
    "Nooooo non ce l'ho 😤",
    "Ce l'ho ce l'ho!! 🎉",
    "Ancora uno e faccio BINGO",
  ],
  bingo: [
    "BINGOOOO!!! 🎉🎉🎉",
    "Mannaggia qualcuno ha fatto bingo!",
    "Complimenti!! 👏",
    "Nooooo ero così vicino 😭",
    "Wow bravissimo!! 🏆",
    "Argh quasi quasi!! Prossima!",
    "CONGRATULAZIONI!!! 🥇",
    "Quanto sei fortunato!!! 😂",
  ],
  waiting: [
    "Pronti per la prossima? 🎯",
    "Prendo la cartella subito!",
    "Avanti con la prossima partita!",
    "Mi sono preso altri ticket 🎫",
    "Non mollo! Riprovo subito",
    "Ci vediamo alla prossima round",
    "Un altro giro e poi mi fermo (forse) 😄",
    "Questa è la mia room preferita",
    "Già in fila per la prossima! ✋",
  ],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickBot() {
  return pickRandom(BOTS);
}

/** Generate a random bot chat message for a given event */
export function botMessage(event: "general" | "draw" | "bingo" | "waiting"): BotMessage {
  const bot = pickBot();
  const msgs = MESSAGES[event];
  return {
    user: bot.name,
    text: pickRandom(msgs),
    color: bot.color,
    avatar: bot.avatar,
    isBot: true,
  };
}

/** Simulate bot win announcements in a room (for display in lobby) */
export function recentBotWins(roomName: string): string[] {
  const wins = [];
  for (let i = 0; i < 3; i++) {
    const bot = pickRandom(BOTS);
    const sparks = [60, 120, 180, 250, 600][Math.floor(Math.random() * 5)];
    wins.push(`${bot.avatar} ${bot.name} ha vinto +${sparks} Spark in ${roomName}!`);
  }
  return wins;
}

/** Generate fake player count for a room, fluctuating realistically */
export function simulatedPlayerCount(baseCount: number, seed: number): number {
  const t = Date.now();
  const wave = Math.sin(t / 30000 + seed) * 0.15;
  const noise = (Math.sin(t / 7000 + seed * 3) * 0.05);
  return Math.max(10, Math.round(baseCount * (1 + wave + noise)));
}

/**
 * BotChatEngine class — manages timed bot messages for a room
 * Call start() to begin, stop() to cleanup.
 */
export class BotChatEngine {
  private timers: ReturnType<typeof setTimeout>[] = [];
  private cb: (msg: BotMessage) => void;
  private running = false;

  constructor(onMessage: (msg: BotMessage) => void) {
    this.cb = onMessage;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.scheduleNext();
  }

  private scheduleNext() {
    if (!this.running) return;
    // Random interval 3-12 seconds between bot messages
    const delay = 3000 + Math.random() * 9000;
    const t = setTimeout(() => {
      this.cb(botMessage("general"));
      this.scheduleNext();
    }, delay);
    this.timers.push(t);
  }

  onDraw() {
    if (!this.running) return;
    // 40% chance a bot reacts to the draw
    if (Math.random() < 0.4) {
      const t = setTimeout(() => this.cb(botMessage("draw")), 800 + Math.random() * 1200);
      this.timers.push(t);
    }
  }

  onBingo() {
    if (!this.running) return;
    // 2-3 bots react to bingo
    const count = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const t = setTimeout(() => this.cb(botMessage("bingo")), 300 + i * 600);
      this.timers.push(t);
    }
  }

  onWaiting() {
    if (!this.running) return;
    const t = setTimeout(() => this.cb(botMessage("waiting")), 1500);
    this.timers.push(t);
  }

  stop() {
    this.running = false;
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
