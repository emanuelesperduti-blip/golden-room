import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5: Gestione valute e crediti
// ─────────────────────────────────────────────────────────────────────────────

export interface CurrencyConfig {
  sparkValue: number;
  ticketValue: number;
  coinValue: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6: Configurazione room in tempo reale
// ─────────────────────────────────────────────────────────────────────────────

export interface RoomConfigOverride {
  countdownDuration: number;
  /** Deprecated: la durata partita non è più configurabile. */
  gameDuration?: number;
  ticketCost: number;
  sparkReward: number;
  maxCardsPerUser: number;
  drawSpeed: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 7: Gestione utenti reali
// ─────────────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  sparks: number;
  tickets: number;
  coins: number;
  lastAccess: number;
  gamesPlayed: number;
  wins: number;
  isOnline: boolean;
  currentRoom?: string;
  isBanned: boolean;
  banReason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 8: Classifica e monitoraggio vincite
// ─────────────────────────────────────────────────────────────────────────────

export interface WinRecord {
  id: string;
  userId: string;
  username: string;
  roomId: string;
  roomName: string;
  sparkReward: number;
  ticketReward: number;
  timestamp: number;
  isBot: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 9: Notifiche e annunci in-app
// ─────────────────────────────────────────────────────────────────────────────

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: "banner" | "popup" | "temporary";
  displayDuration: number;
  createdAt: number;
  isActive: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 10: Modalità manutenzione
// ─────────────────────────────────────────────────────────────────────────────

export interface MaintenanceConfig {
  isEnabled: boolean;
  title: string;
  message: string;
  estimatedReturnTime: number;
  allowAdminAccess: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 11: Moltiplicatori evento
// ─────────────────────────────────────────────────────────────────────────────

export interface EventMultiplier {
  id: string;
  name: string;
  isActive: boolean;
  sparkMultiplier: number;
  ticketMultiplier: number;
  freeRoomEnabled: boolean;
  targetRoomId?: string;
  startTime: number;
  endTime: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 12: Log attività
// ─────────────────────────────────────────────────────────────────────────────

export interface ActivityLog {
  id: string;
  timestamp: number;
  type: "purchase" | "win" | "claim" | "admin_action" | "error" | "login" | "logout" | "ban" | "credit_change";
  userId?: string;
  username?: string;
  roomId?: string;
  details: Record<string, any>;
  severity: "info" | "warning" | "error";
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Store
// ─────────────────────────────────────────────────────────────────────────────

interface AdminState {
  // Step 5: Currency management
  currencyConfig: CurrencyConfig;
  setCurrencyConfig: (config: Partial<CurrencyConfig>) => void;

  // Step 6: Room configuration
  roomConfigs: Record<string, RoomConfigOverride>;
  setRoomConfig: (roomId: string, config: Partial<RoomConfigOverride>) => void;

  // Step 7: User management
  users: Record<string, UserProfile>;
  addUser: (user: UserProfile) => void;
  updateUser: (userId: string, updates: Partial<UserProfile>) => void;
  banUser: (userId: string, reason: string) => void;
  unbanUser: (userId: string) => void;
  assignCreditsToUser: (userId: string, sparks: number, tickets: number, coins: number) => void;
  assignCreditsToAll: (sparks: number, tickets: number, coins: number) => void;
  resetUserProfile: (userId: string) => void;

  // Step 8: Leaderboard and wins
  winRecords: WinRecord[];
  addWinRecord: (record: WinRecord) => void;
  getTopUsersBySparks: (limit: number) => UserProfile[];
  getTopUsersByWins: (limit: number) => UserProfile[];

  // Step 9: Notifications
  notifications: AdminNotification[];
  addNotification: (notification: Omit<AdminNotification, "id" | "createdAt">) => void;
  removeNotification: (id: string) => void;
  getActiveNotifications: () => AdminNotification[];

  // Step 10: Maintenance
  maintenance: MaintenanceConfig;
  setMaintenance: (config: Partial<MaintenanceConfig>) => void;
  toggleMaintenance: (enabled: boolean) => void;

  // Step 11: Event multipliers
  eventMultipliers: EventMultiplier[];
  addEventMultiplier: (event: EventMultiplier) => void;
  updateEventMultiplier: (id: string, updates: Partial<EventMultiplier>) => void;
  removeEventMultiplier: (id: string) => void;
  getActiveMultipliers: () => EventMultiplier[];

  // Step 12: Activity logs
  activityLogs: ActivityLog[];
  addActivityLog: (log: Omit<ActivityLog, "id" | "timestamp">) => void;
  getActivityLogs: (filters?: { userId?: string; roomId?: string; type?: string; startDate?: number; endDate?: number }) => ActivityLog[];
}

const DEFAULT_CURRENCY_CONFIG: CurrencyConfig = {
  sparkValue: 1,
  ticketValue: 1,
  coinValue: 1,
};

const DEFAULT_MAINTENANCE: MaintenanceConfig = {
  isEnabled: false,
  title: "Manutenzione in corso",
  message: "Il sito è in manutenzione. Torneremo online presto.",
  estimatedReturnTime: Date.now() + 3600000,
  allowAdminAccess: true,
};

export const useAdminStore = create<AdminState>()(
  persist(
    (set, get) => ({
      // Step 5: Currency management
      currencyConfig: DEFAULT_CURRENCY_CONFIG,
      setCurrencyConfig: (config) =>
        set((state) => ({
          currencyConfig: { ...state.currencyConfig, ...config },
        })),

      // Step 6: Room configuration
      roomConfigs: {},
      setRoomConfig: (roomId, config) =>
        set((state) => ({
          roomConfigs: {
            ...state.roomConfigs,
            [roomId]: {
              ...(state.roomConfigs[roomId] || {}),
              ...config,
            },
          },
        })),

      // Step 7: User management
      users: {},
      addUser: (user) =>
        set((state) => ({
          users: { ...state.users, [user.id]: user },
        })),
      updateUser: (userId, updates) =>
        set((state) => ({
          users: {
            ...state.users,
            [userId]: {
              ...state.users[userId],
              ...updates,
            },
          },
        })),
      banUser: (userId, reason) =>
        set((state) => ({
          users: {
            ...state.users,
            [userId]: {
              ...state.users[userId],
              isBanned: true,
              banReason: reason,
            },
          },
        })),
      unbanUser: (userId) =>
        set((state) => ({
          users: {
            ...state.users,
            [userId]: {
              ...state.users[userId],
              isBanned: false,
              banReason: undefined,
            },
          },
        })),
      assignCreditsToUser: (userId, sparks, tickets, coins) => {
        // Update admin store
        set((state) => {
          const user = state.users[userId];
          if (!user) return state;
          return {
            users: {
              ...state.users,
              [userId]: {
                ...user,
                sparks: user.sparks + sparks,
                tickets: user.tickets + tickets,
                coins: user.coins + coins,
              },
            },
          };
        });
        
        // Real-time connection to gameStore if this is the current user
        // We use a dynamic import or access the store directly to avoid circular deps
        try {
          const { useGameStore } = require("./gameStore");
          const { useAuth } = require("../hooks/useAuth");
          const currentUser = useAuth.getState?.()?.user || (window as any).__GAMESPARK_USER__;
          
          if (currentUser?.id === userId) {
            const gameStore = useGameStore.getState();
            if (sparks !== 0) gameStore.addSparks(sparks);
            if (tickets !== 0) gameStore.addTickets(tickets);
            if (coins !== 0) gameStore.addCoins(coins);
          }
        } catch (e) {
          console.error("Failed to sync credits to gameStore:", e);
        }
      },
      assignCreditsToAll: (sparks, tickets, coins) => {
        // Update admin store
        set((state) => {
          const updated = { ...state.users };
          for (const userId in updated) {
            updated[userId] = {
              ...updated[userId],
              sparks: updated[userId].sparks + sparks,
              tickets: updated[userId].tickets + tickets,
              coins: updated[userId].coins + coins,
            };
          }
          return { users: updated };
        });

        // Real-time connection to gameStore for current user
        try {
          const { useGameStore } = require("./gameStore");
          const gameStore = useGameStore.getState();
          if (sparks !== 0) gameStore.addSparks(sparks);
          if (tickets !== 0) gameStore.addTickets(tickets);
          if (coins !== 0) gameStore.addCoins(coins);
        } catch (e) {
          console.error("Failed to sync credits to gameStore:", e);
        }
      },
      resetUserProfile: (userId) =>
        set((state) => {
          const user = state.users[userId];
          if (!user) return state;
          return {
            users: {
              ...state.users,
              [userId]: {
                ...user,
                sparks: 0,
                tickets: 0,
                coins: 0,
                gamesPlayed: 0,
                wins: 0,
              },
            },
          };
        }),

      // Step 8: Leaderboard
      winRecords: [],
      addWinRecord: (record) =>
        set((state) => ({
          winRecords: [record, ...state.winRecords].slice(0, 1000),
        })),
      getTopUsersBySparks: (limit) => {
        const state = get();
        return Object.values(state.users)
          .filter((u) => !u.isBanned)
          .sort((a, b) => b.sparks - a.sparks)
          .slice(0, limit);
      },
      getTopUsersByWins: (limit) => {
        const state = get();
        return Object.values(state.users)
          .filter((u) => !u.isBanned)
          .sort((a, b) => b.wins - a.wins)
          .slice(0, limit);
      },

      // Step 9: Notifications
      notifications: [],
      addNotification: (notification) =>
        set((state) => ({
          notifications: [
            ...state.notifications,
            {
              ...notification,
              id: `notif-${Date.now()}-${Math.random()}`,
              createdAt: Date.now(),
            },
          ],
        })),
      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),
      getActiveNotifications: () => {
        const state = get();
        const now = Date.now();
        return state.notifications.filter((n) => n.isActive && now - n.createdAt < n.displayDuration);
      },

      // Step 10: Maintenance
      maintenance: DEFAULT_MAINTENANCE,
      setMaintenance: (config) =>
        set((state) => ({
          maintenance: { ...state.maintenance, ...config },
        })),
      toggleMaintenance: (enabled) =>
        set((state) => ({
          maintenance: { ...state.maintenance, isEnabled: enabled },
        })),

      // Step 11: Event multipliers
      eventMultipliers: [],
      addEventMultiplier: (event) =>
        set((state) => ({
          eventMultipliers: [...state.eventMultipliers, event],
        })),
      updateEventMultiplier: (id, updates) =>
        set((state) => ({
          eventMultipliers: state.eventMultipliers.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),
      removeEventMultiplier: (id) =>
        set((state) => ({
          eventMultipliers: state.eventMultipliers.filter((e) => e.id !== id),
        })),
      getActiveMultipliers: () => {
        const state = get();
        const now = Date.now();
        return state.eventMultipliers.filter((e) => e.isActive && e.startTime <= now && now < e.endTime);
      },

      // Step 12: Activity logs
      activityLogs: [],
      addActivityLog: (log) =>
        set((state) => ({
          activityLogs: [
            {
              ...log,
              id: `log-${Date.now()}-${Math.random()}`,
              timestamp: Date.now(),
            },
            ...state.activityLogs,
          ].slice(0, 5000),
        })),
      getActivityLogs: (filters) => {
        const state = get();
        let logs = [...state.activityLogs];

        if (filters?.userId) {
          logs = logs.filter((l) => l.userId === filters.userId);
        }
        if (filters?.roomId) {
          logs = logs.filter((l) => l.roomId === filters.roomId);
        }
        if (filters?.type) {
          logs = logs.filter((l) => l.type === filters.type);
        }
        if (filters?.startDate) {
          logs = logs.filter((l) => l.timestamp >= filters.startDate!);
        }
        if (filters?.endDate) {
          logs = logs.filter((l) => l.timestamp <= filters.endDate!);
        }

        return logs;
      },
    }),
    {
      name: "golden-room-admin-v1",
      partialize: (state) => ({
        currencyConfig: state.currencyConfig,
        roomConfigs: state.roomConfigs,
        users: state.users,
        winRecords: state.winRecords,
        notifications: state.notifications,
        maintenance: state.maintenance,
        eventMultipliers: state.eventMultipliers,
        activityLogs: state.activityLogs,
      }),
    }
  )
);
