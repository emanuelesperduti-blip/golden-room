import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AuthUser } from "@/hooks/useAuth";
import { BOTS } from "@/lib/bots";
import { ROOMS } from "@/lib/rooms";

export type RealWinRecord = {
  id: string;
  user_id: string;
  username: string;
  room_id: string;
  room_name: string;
  game_type: "bingo" | "scratch" | "reveal" | string;
  prize_label: string | null;
  spark_reward: number;
  ticket_reward: number;
  is_bot: boolean;
  created_at: string;
};

type RecordWinInput = {
  user: AuthUser | null;
  username?: string | null;
  roomId: string;
  roomName: string;
  gameType: "bingo" | "scratch" | "reveal" | string;
  prizeLabel?: string | null;
  sparkReward?: number;
  ticketReward?: number;
};

function safeUsername(user: AuthUser | null, fallback?: string | null) {
  const fromFallback = fallback?.trim();
  if (fromFallback && fromFallback !== "Nuovo Giocatore") return fromFallback;
  const fromName = user?.name?.trim();
  if (fromName) return fromName;
  const emailName = user?.email?.split("@")[0]?.trim();
  return emailName || "Giocatore";
}

function roomById(roomId?: string | null) {
  if (!roomId) return null;
  return ROOMS.find((room) => room.id === roomId) ?? null;
}

function pickBySeed<T>(items: T[], seed: number): T {
  const index = Math.abs(Math.floor(seed)) % items.length;
  return items[index];
}

function buildBotWinFeed(limit: number, roomId?: string | null): RealWinRecord[] {
  const now = Date.now();
  const bucket = Math.floor(now / 45000); // cambia circa ogni 45 secondi
  const feedSize = Math.max(limit + 4, 8);
  const fixedRoom = roomById(roomId);

  return Array.from({ length: feedSize }, (_, i) => {
    const seed = bucket * 31 + i * 17 + (roomId ? roomId.length * 13 : 0);
    const bot = pickBySeed(BOTS, seed);
    const room = fixedRoom ?? pickBySeed(ROOMS, seed + 7);

    // Timestamp sintetici ma cronologici: i bot non sono sempre sotto o sopra.
    // In questo modo una vincita reale entra nel flusso e scende solo quando arrivano vincite successive.
    const ageSeconds = 35 + i * 72 + Math.abs(Math.sin(seed)) * 28;
    const createdAt = new Date(now - ageSeconds * 1000).toISOString();

    const sparkReward = room.sparkReward;
    const ticketReward = room.ticketReward;
    const prizeLabel = [
      sparkReward > 0 ? `+${sparkReward} Spark` : "",
      ticketReward > 0 ? `+${ticketReward} Ticket` : "",
    ].filter(Boolean).join(" · ");

    return {
      id: `bot-${room.id}-${bucket}-${i}`,
      user_id: `bot-${bot.name}`,
      username: bot.name,
      room_id: room.id,
      room_name: room.name,
      game_type: "bingo",
      prize_label: prizeLabel,
      spark_reward: sparkReward,
      ticket_reward: ticketReward,
      is_bot: true,
      created_at: createdAt,
    };
  });
}

function sortChronological(records: RealWinRecord[], limit: number) {
  return records
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

export async function recordRealWin(input: RecordWinInput) {
  if (!input.user?.id) return;

  try {
    const sparkReward = Math.max(0, Math.floor(input.sparkReward ?? 0));
    const ticketReward = Math.max(0, Math.floor(input.ticketReward ?? 0));

    await supabase.from("gamespark_win_history" as any).insert({
      user_id: input.user.id,
      username: safeUsername(input.user, input.username),
      room_id: input.roomId,
      room_name: input.roomName,
      game_type: input.gameType,
      prize_label: input.prizeLabel ?? null,
      spark_reward: sparkReward,
      ticket_reward: ticketReward,
      is_bot: false,
    } as any);
  } catch (error) {
    console.warn("GameSpark: impossibile registrare la vincita reale", error);
  }
}

export function useRecentWinHistory(limit = 8, roomId?: string | null) {
  const [wins, setWins] = useState<RealWinRecord[]>([]);
  const roomFilter = useMemo(() => roomId || null, [roomId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        let query = supabase
          .from("gamespark_win_history" as any)
          .select("id,user_id,username,room_id,room_name,game_type,prize_label,spark_reward,ticket_reward,is_bot,created_at")
          .eq("is_bot", false)
          .order("created_at", { ascending: false })
          .limit(Math.max(limit, 12));

        if (roomFilter) query = query.eq("room_id", roomFilter);

        const { data, error } = await query;
        const realWins = !error ? ((data ?? []) as RealWinRecord[]) : [];
        const botWins = buildBotWinFeed(limit, roomFilter);

        if (!cancelled) {
          setWins(sortChronological([...realWins, ...botWins], limit));
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("GameSpark: cronologia vincite non disponibile", error);
          setWins(sortChronological(buildBotWinFeed(limit, roomFilter), limit));
        }
      }
    }

    load();

    const refreshTimer = window.setInterval(load, 45000);

    const channel = supabase
      .channel(`gamespark-wins-mixed-${roomFilter || "all"}`)
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "gamespark_win_history" },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [limit, roomFilter]);

  return wins;
}

export function formatRealWin(win: Pick<RealWinRecord, "username" | "room_name" | "game_type" | "prize_label" | "spark_reward" | "ticket_reward">) {
  const prize = win.prize_label?.trim()
    || [
      win.spark_reward > 0 ? `+${win.spark_reward} Spark` : "",
      win.ticket_reward > 0 ? `+${win.ticket_reward} Ticket` : "",
    ].filter(Boolean).join(" · ")
    || "un premio";

  const game = win.game_type === "scratch" ? "Gratta e Vinci" : win.game_type === "bingo" ? win.room_name : win.room_name;
  return `${win.username} ha vinto ${prize} in ${game}`;
}
