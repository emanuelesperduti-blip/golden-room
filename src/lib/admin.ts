import type { AuthUser } from "@/hooks/useAuth";
import { ROOMS, getRoomPopulation, type RoomConfig } from "@/lib/rooms";

export const ADMIN_EMAIL = "emanuelesperduti@gmail.com";
export const BOT_CONFIG_STORAGE_KEY = "golden-room-admin-bot-config-v1";

export type ChatPace = "bassa" | "media" | "alta";
export type ReactionSpeed = "lenta" | "normale" | "rapida";
export type BotRoomConfig = {
  enabled: boolean;
  botCount: number;
  chatPace: ChatPace;
  reactionSpeed: ReactionSpeed;
};

export type BotRoomConfigMap = Record<string, BotRoomConfig>;

export function isAdminEmail(email?: string | null) {
  return (email ?? "").trim().toLowerCase() === ADMIN_EMAIL;
}

export function isAdminUser(user: AuthUser | null | undefined) {
  return isAdminEmail(user?.email);
}

export function estimatedRealUsersByRoom(roomId: string, total: number) {
  const baseMap: Record<string, number> = {
    "neon-newcomer": 3,
    "night-rush": 2,
    "golden-city": 2,
    "royal-vip": 1,
    "mega-jackpot": 1,
  };
  return Math.max(0, Math.min(total, baseMap[roomId] ?? 1));
}

export function getDefaultBotConfig(): BotRoomConfigMap {
  return Object.fromEntries(
    ROOMS.map((room) => {
      const defaultPopulation = getRoomPopulation(room).total;
      return [
        room.id,
        {
          enabled: true,
          botCount: Math.min(50, Math.max(0, defaultPopulation - estimatedRealUsersByRoom(room.id, defaultPopulation))),
          chatPace: room.tier === "free" ? "alta" : room.tier === "vip" || room.tier === "jackpot" ? "bassa" : "media",
          reactionSpeed: room.tier === "free" ? "rapida" : room.tier === "jackpot" ? "lenta" : "normale",
        },
      ];
    }),
  );
}

export function readBotConfig(): BotRoomConfigMap {
  if (typeof window === "undefined") return getDefaultBotConfig();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BOT_CONFIG_STORAGE_KEY) ?? "null") as Partial<BotRoomConfigMap> | null;
    const defaults = getDefaultBotConfig();
    if (!parsed) return defaults;
    for (const room of ROOMS) {
      const saved = parsed[room.id];
      if (!saved) continue;
      defaults[room.id] = {
        enabled: saved.enabled ?? defaults[room.id].enabled,
        botCount: Math.max(0, Math.min(50, Number(saved.botCount ?? defaults[room.id].botCount))),
        chatPace: saved.chatPace ?? defaults[room.id].chatPace,
        reactionSpeed: saved.reactionSpeed ?? defaults[room.id].reactionSpeed,
      };
    }
    return defaults;
  } catch {
    return getDefaultBotConfig();
  }
}

export function saveBotConfig(config: BotRoomConfigMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BOT_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export function getBotConfigForRoom(roomId: string): BotRoomConfig {
  return readBotConfig()[roomId] ?? getDefaultBotConfig()[roomId] ?? { enabled: true, botCount: 0, chatPace: "media", reactionSpeed: "normale" };
}

export function getControlledRoomPopulation(room: RoomConfig, now = Date.now()) {
  const population = getRoomPopulation(room, now);
  const config = getBotConfigForRoom(room.id);
  const realUsers = estimatedRealUsersByRoom(room.id, population.total);
  const bots = config.enabled ? config.botCount : 0;
  return {
    total: realUsers + bots,
    realUsers,
    bots,
    config,
  };
}
