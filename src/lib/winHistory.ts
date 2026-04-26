import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AuthUser } from "@/hooks/useAuth";

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
          .limit(limit);

        if (roomFilter) query = query.eq("room_id", roomFilter);

        const { data, error } = await query;
        if (!cancelled && !error) setWins((data ?? []) as RealWinRecord[]);
      } catch (error) {
        if (!cancelled) console.warn("GameSpark: cronologia vincite non disponibile", error);
      }
    }

    load();

    const channel = supabase
      .channel(`gamespark-real-wins-${roomFilter || "all"}`)
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "gamespark_win_history" },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
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
