import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MissionId =
  | "play_bingo_1"
  | "open_reveal_1"
  | "streak_3"
  | "win_bingo_1"
  | "spend_sparks_50"
  | "enter_lobby"
  | "open_reveal_3"
  | "win_bingo_3";

export type ThemeMode = "royale" | "ocean";

export interface Mission {
  id: MissionId;
  title: string;
  description: string;
  reward_sparks: number;
  reward_tickets: number;
  total: number;
  icon: string;
}

export const MISSIONS_CONFIG: Mission[] = [
  { id: "play_bingo_1", title: "Giocatore", description: "Partecipa a 1 partita di Bingo", reward_sparks: 6, reward_tickets: 0, total: 1, icon: "🎯" },
  { id: "open_reveal_1", title: "Curioso", description: "Apri 1 Reveal", reward_sparks: 5, reward_tickets: 0, total: 1, icon: "✨" },
  { id: "streak_3", title: "Fedele", description: "Fai login 3 giorni di fila", reward_sparks: 15, reward_tickets: 1, total: 3, icon: "🔥" },
  { id: "win_bingo_1", title: "Vincitore", description: "Vinci 1 partita di Bingo", reward_sparks: 12, reward_tickets: 1, total: 1, icon: "🏆" },
  { id: "enter_lobby", title: "Esploratore", description: "Visita la Lobby", reward_sparks: 3, reward_tickets: 0, total: 1, icon: "🗺️" },
  { id: "open_reveal_3", title: "Collezionista", description: "Apri 3 Reveal in totale", reward_sparks: 10, reward_tickets: 1, total: 3, icon: "💎" },
  { id: "win_bingo_3", title: "Campione", description: "Vinci 3 partite di Bingo", reward_sparks: 24, reward_tickets: 1, total: 3, icon: "👑" },
  { id: "spend_sparks_50", title: "Big Spender", description: "Usa 50 Spark nelle room", reward_sparks: 9, reward_tickets: 0, total: 50, icon: "⚡" },
];

interface MissionProgress {
  progress: number;
  claimed: boolean;
  resetDate: string;
}

interface GameState {
  coins: number;
  sparks: number;
  tickets: number;
  hearts: number;
  gems: number;
  vip: boolean;
  vipExpiry: string | null;
  playerSeed: number;
  username: string;
  avatar: string;
  xp: number;
  level: number;
  bingosWon: number;
  revealsOpened: number;
  roundsPlayed: number;
  streak: number;
  lastClaimDate: string | null;
  dailyRevealUsed: boolean;
  premiumRevealsLeft: number;
  earlyBirdClaimed: boolean;
  lastEarlyBirdDate: string | null;
  muted: boolean;
  musicMuted: boolean;
  missions: Record<MissionId, MissionProgress>;
  rank: number;
  theme: ThemeMode;

  addSparks: (n: number) => void;
  spendSparks: (n: number) => boolean;
  addTickets: (n: number) => void;
  spendTickets: (n: number) => boolean;
  addCoins: (n: number) => void;
  addGems: (n: number) => void;
  spendGems: (n: number) => boolean;
  toggleMute: () => void;
  toggleMusic: () => void;
  setTheme: (theme: ThemeMode) => void;
  dailyClaim: () => { ok: boolean; sparks: number; tickets: number; streakBonus: boolean; streak: number };
  useFreeReveal: () => boolean;
  usePremiumReveal: () => boolean;
  claimEarlyBird: () => { ok: boolean };
  addPremiumReveals: (n: number) => void;
  addXp: (n: number) => void;
  incrementBingosWon: () => void;
  incrementRoundsPlayed: () => void;
  incrementRevealsOpened: () => void;
  activateVip: (days: number) => void;
  progressMission: (id: MissionId, amount?: number) => void;
  claimMission: (id: MissionId) => { ok: boolean; sparks: number; tickets: number };
}

const todayStr = () => new Date().toISOString().split("T")[0];
const XP_PER_LEVEL = 100;

const initialMissions = Object.fromEntries(
  MISSIONS_CONFIG.map((m) => [m.id, { progress: 0, claimed: false, resetDate: todayStr() }])
) as Record<MissionId, MissionProgress>;

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      coins: 2830,
      sparks: 124,
      tickets: 8,
      hearts: 3,
      gems: 5,
      vip: false,
      vipExpiry: null,
      playerSeed: Math.floor(Math.random() * 1_000_000) + 1,
      username: "GoldenPlayer",
      avatar: "👑",
      xp: 450,
      level: 5,
      bingosWon: 3,
      revealsOpened: 7,
      roundsPlayed: 12,
      streak: 2,
      lastClaimDate: null,
      dailyRevealUsed: false,
      premiumRevealsLeft: 2,
      earlyBirdClaimed: false,
      lastEarlyBirdDate: null,
      muted: false,
      musicMuted: true,
      missions: initialMissions,
      rank: 248,
      theme: "royale",

      addSparks: (n) => set((s) => ({ sparks: Math.max(0, s.sparks + n) })),
      spendSparks: (n) => {
        if (get().sparks < n) return false;
        set((s) => ({ sparks: s.sparks - n }));
        get().progressMission("spend_sparks_50", n);
        return true;
      },
      addTickets: (n) => set((s) => ({ tickets: Math.max(0, s.tickets + n) })),
      spendTickets: (n) => {
        if (get().tickets < n) return false;
        set((s) => ({ tickets: s.tickets - n }));
        return true;
      },
      addCoins: (n) => set((s) => ({ coins: Math.max(0, s.coins + n) })),
      addGems: (n) => set((s) => ({ gems: Math.max(0, s.gems + n) })),
      spendGems: (n) => {
        if (get().gems < n) return false;
        set((s) => ({ gems: s.gems - n }));
        return true;
      },
      toggleMute: () => set((s) => ({ muted: !s.muted })),
      toggleMusic: () => set((s) => ({ musicMuted: !s.musicMuted })),
      setTheme: (theme) => set({ theme }),

      dailyClaim: () => {
        const s = get();
        const t = todayStr();
        if (s.lastClaimDate === t) return { ok: false, sparks: 0, tickets: 0, streakBonus: false, streak: s.streak };

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().split("T")[0];
        const wasYesterday = s.lastClaimDate === yStr;
        const newStreak = wasYesterday ? s.streak + 1 : 1;
        const baseSparks = 6 + newStreak * 2;
        const baseTickets = newStreak >= 7 ? 2 : newStreak >= 5 ? 1 : 0;
        const streakBonus = newStreak % 7 === 0;
        const bonusSparks = streakBonus ? 20 : 0;

        set({
          lastClaimDate: t,
          streak: newStreak,
          sparks: s.sparks + baseSparks + bonusSparks,
          tickets: s.tickets + baseTickets,
          dailyRevealUsed: false,
          earlyBirdClaimed: false,
        });
        get().progressMission("streak_3", newStreak);

        return { ok: true, sparks: baseSparks + bonusSparks, tickets: baseTickets, streakBonus, streak: newStreak };
      },

      useFreeReveal: () => {
        if (get().dailyRevealUsed) return false;
        set({ dailyRevealUsed: true });
        return true;
      },

      usePremiumReveal: () => {
        const s = get();
        if (s.vip) {
          // VIP users get free premium reveals, no cost
          return true;
        }
        if (s.premiumRevealsLeft > 0) {
          set((st) => ({ premiumRevealsLeft: Math.max(0, st.premiumRevealsLeft - 1) }));
          return true;
        }
        if (s.tickets >= 2) {
          set((st) => ({ tickets: st.tickets - 2 }));
          return true;
        }
        return false;
      },

      addPremiumReveals: (n) => set((s) => ({ premiumRevealsLeft: s.premiumRevealsLeft + n })),

      claimEarlyBird: () => {
        const s = get();
        const t = todayStr();
        if (s.lastEarlyBirdDate === t) return { ok: false };
        set((st) => ({
          lastEarlyBirdDate: t,
          earlyBirdClaimed: true,
          sparks: st.sparks + 50,
          coins: st.coins + 200,
          premiumRevealsLeft: st.premiumRevealsLeft + 1,
        }));
        return { ok: true };
      },

      addXp: (n) => {
        const s = get();
        const newXp = s.xp + n;
        set({ xp: newXp, level: Math.floor(newXp / XP_PER_LEVEL) + 1 });
      },

      incrementBingosWon: () => {
        set((s) => ({ bingosWon: s.bingosWon + 1 }));
        get().addXp(50);
        get().progressMission("win_bingo_1", 1);
        get().progressMission("win_bingo_3", 1);
      },

      incrementRoundsPlayed: () => {
        set((s) => ({ roundsPlayed: s.roundsPlayed + 1 }));
        get().addXp(10);
        get().progressMission("play_bingo_1", 1);
      },

      incrementRevealsOpened: () => {
        set((s) => ({ revealsOpened: s.revealsOpened + 1 }));
        get().addXp(5);
        get().progressMission("open_reveal_1", 1);
        get().progressMission("open_reveal_3", 1);
      },

      activateVip: (days) => {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + days);
        set({
          vip: true,
          vipExpiry: expiry.toISOString(),
          premiumRevealsLeft: get().premiumRevealsLeft + 5,
        });
      },

      progressMission: (id, amount = 1) => {
        const s = get();
        const cfg = MISSIONS_CONFIG.find((m) => m.id === id);
        if (!cfg) return;
        const current = s.missions[id] ?? { progress: 0, claimed: false, resetDate: todayStr() };
        if (current.claimed) return;
        const newProgress = Math.min(cfg.total, (id === "streak_3" ? amount : current.progress + amount));
        set({ missions: { ...s.missions, [id]: { ...current, progress: newProgress } } });
      },

      claimMission: (id) => {
        const s = get();
        const cfg = MISSIONS_CONFIG.find((m) => m.id === id);
        if (!cfg) return { ok: false, sparks: 0, tickets: 0 };
        const current = s.missions[id];
        if (!current || current.claimed || current.progress < cfg.total) return { ok: false, sparks: 0, tickets: 0 };
        set((st) => ({
          missions: { ...st.missions, [id]: { ...current, claimed: true } },
          sparks: st.sparks + cfg.reward_sparks,
          tickets: st.tickets + cfg.reward_tickets,
        }));
        get().addXp(20);
        return { ok: true, sparks: cfg.reward_sparks, tickets: cfg.reward_tickets };
      },
    }),
    {
      name: "golden-room-v5",
      partialize: (s) => ({
        coins: s.coins, sparks: s.sparks, tickets: s.tickets, hearts: s.hearts, gems: s.gems,
        vip: s.vip, vipExpiry: s.vipExpiry, playerSeed: s.playerSeed,
        username: s.username, avatar: s.avatar,
        xp: s.xp, level: s.level, bingosWon: s.bingosWon,
        revealsOpened: s.revealsOpened, roundsPlayed: s.roundsPlayed,
        streak: s.streak, lastClaimDate: s.lastClaimDate,
        dailyRevealUsed: s.dailyRevealUsed, premiumRevealsLeft: s.premiumRevealsLeft,
        earlyBirdClaimed: s.earlyBirdClaimed, lastEarlyBirdDate: s.lastEarlyBirdDate,
        muted: s.muted, musicMuted: s.musicMuted, missions: s.missions, rank: s.rank,
      }),
    },
  ),
);
