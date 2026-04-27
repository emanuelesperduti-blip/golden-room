import { supabase } from "@/integrations/supabase/client";
import { cardForRound, type RoomConfig } from "@/lib/rooms";

export type PersistedBingoCard = {
  roundIndex: number;
  slot: number;
  marked: number[];
  numbers?: number[];
};

export type PersistedVirtualBingoCard = PersistedBingoCard & {
  userId: string;
  username: string;
};

type BingoCardRow = {
  id?: string;
  round_id?: string;
  room_id?: string | null;
  user_id?: string;
  username?: string | null;
  is_virtual?: boolean | null;
  card_slot?: number | null;
  numbers?: number[] | null;
  marked_numbers?: number[] | null;
  is_winning_card?: boolean | null;
  created_at?: string | null;
};

export function bingoRoundId(roomId: string, roundIndex: number) {
  return `${roomId}:${roundIndex}`;
}

export function bingoCardId(roomId: string, roundIndex: number, userId: string, slot: number) {
  return `${bingoRoundId(roomId, roundIndex)}:${userId}:${slot}`;
}

function normalizeNumberList(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((entry): entry is number => typeof entry === "number") : [];
}

function normalizeCardRow(row: BingoCardRow, fallbackRoundIndex: number): PersistedBingoCard | null {
  if (typeof row.card_slot !== "number") return null;

  return {
    roundIndex: fallbackRoundIndex,
    slot: row.card_slot,
    marked: normalizeNumberList(row.marked_numbers),
    numbers: normalizeNumberList(row.numbers),
  };
}

function normalizeVirtualCardRow(row: BingoCardRow, fallbackRoundIndex: number): PersistedVirtualBingoCard | null {
  const base = normalizeCardRow(row, fallbackRoundIndex);
  if (!base || !row.user_id || !row.username) return null;

  return {
    ...base,
    userId: row.user_id,
    username: row.username,
  };
}

export async function loadRealBingoCards(params: {
  roomId: string;
  roundIndex: number;
  userId: string;
}): Promise<PersistedBingoCard[]> {
  const { roomId, roundIndex, userId } = params;
  const round_id = bingoRoundId(roomId, roundIndex);

  const { data, error } = await supabase
    .from("gamespark_bingo_cards" as any)
    .select("id,round_id,user_id,username,is_virtual,card_slot,numbers,marked_numbers,is_winning_card,created_at")
    .eq("round_id", round_id)
    .eq("user_id", userId)
    .eq("is_virtual", false)
    .order("card_slot", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as BingoCardRow[])
    .map((row) => normalizeCardRow(row, roundIndex))
    .filter((entry): entry is PersistedBingoCard => Boolean(entry));
}

export async function loadVirtualBingoCards(params: {
  roomId: string;
  roundIndex: number;
}): Promise<PersistedVirtualBingoCard[]> {
  const { roomId, roundIndex } = params;
  const round_id = bingoRoundId(roomId, roundIndex);

  const { data, error } = await supabase
    .from("gamespark_bingo_cards" as any)
    .select("id,round_id,room_id,user_id,username,is_virtual,card_slot,numbers,marked_numbers,is_winning_card,created_at")
    .eq("round_id", round_id)
    .eq("is_virtual", true)
    .order("user_id", { ascending: true })
    .order("card_slot", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as BingoCardRow[])
    .map((row) => normalizeVirtualCardRow(row, roundIndex))
    .filter((entry): entry is PersistedVirtualBingoCard => Boolean(entry));
}

async function upsertCardsWithRoomId(rows: BingoCardRow[]) {
  return supabase.from("gamespark_bingo_cards" as any).upsert(rows as any, { onConflict: "id", ignoreDuplicates: true } as any);
}

async function upsertCardsWithoutRoomId(rows: BingoCardRow[]) {
  const rowsWithoutRoomId = rows.map(({ room_id: _roomId, ...row }) => row);
  return supabase.from("gamespark_bingo_cards" as any).upsert(rowsWithoutRoomId as any, { onConflict: "id", ignoreDuplicates: true } as any);
}

function isMissingRoomIdColumnError(error: unknown) {
  const message = String((error as { message?: string } | null)?.message ?? error ?? "").toLowerCase();
  return message.includes("room_id") || message.includes("schema cache");
}

export async function saveRealBingoCards(params: {
  room: RoomConfig;
  roundIndex: number;
  userId: string;
  username: string;
  playerSeed: number;
  cards: Array<{ slot: number }>;
}): Promise<PersistedBingoCard[]> {
  const { room, roundIndex, userId, username, playerSeed, cards } = params;
  if (cards.length === 0) return loadRealBingoCards({ roomId: room.id, roundIndex, userId });

  const round_id = bingoRoundId(room.id, roundIndex);
  const rows: BingoCardRow[] = cards.map((entry) => ({
    id: bingoCardId(room.id, roundIndex, userId, entry.slot),
    round_id,
    room_id: room.id,
    user_id: userId,
    username,
    is_virtual: false,
    card_slot: entry.slot,
    numbers: cardForRound(room, playerSeed, roundIndex, entry.slot),
    marked_numbers: [],
    is_winning_card: false,
  }));

  const result = await upsertCardsWithRoomId(rows);
  if (result.error) {
    if (!isMissingRoomIdColumnError(result.error)) throw result.error;
    const fallbackResult = await upsertCardsWithoutRoomId(rows);
    if (fallbackResult.error) throw fallbackResult.error;
  }

  return loadRealBingoCards({ roomId: room.id, roundIndex, userId });
}

export async function ensureVirtualBingoCards(params: {
  room: RoomConfig;
  roundIndex: number;
  bots: Array<{ name: string }>;
}): Promise<PersistedVirtualBingoCard[]> {
  const { room, roundIndex, bots } = params;
  if (bots.length === 0) return [];

  const existing = await loadVirtualBingoCards({ roomId: room.id, roundIndex });
  const existingKeys = new Set(existing.map((entry) => `${entry.userId}:${entry.slot}`));
  const round_id = bingoRoundId(room.id, roundIndex);
  const rows: BingoCardRow[] = [];

  bots.forEach((bot, index) => {
    const userId = `virtual:${bot.name}`;
    const slot = 0;
    if (existingKeys.has(`${userId}:${slot}`)) return;

    rows.push({
      id: bingoCardId(room.id, roundIndex, userId, slot),
      round_id,
      room_id: room.id,
      user_id: userId,
      username: bot.name,
      is_virtual: true,
      card_slot: slot,
      numbers: cardForRound(room, 100000 + index * 7919, roundIndex, slot),
      marked_numbers: [],
      is_winning_card: false,
    });
  });

  if (rows.length > 0) {
    const result = await upsertCardsWithRoomId(rows);
    if (result.error) {
      if (!isMissingRoomIdColumnError(result.error)) throw result.error;
      const fallbackResult = await upsertCardsWithoutRoomId(rows);
      if (fallbackResult.error) throw fallbackResult.error;
    }
  }

  return loadVirtualBingoCards({ roomId: room.id, roundIndex });
}

export async function updateRealBingoCardMarkedNumbers(params: {
  roomId: string;
  roundIndex: number;
  userId: string;
  slot: number;
  marked: number[];
}) {
  const { roomId, roundIndex, userId, slot, marked } = params;
  const id = bingoCardId(roomId, roundIndex, userId, slot);
  const { error } = await supabase
    .from("gamespark_bingo_cards" as any)
    .update({ marked_numbers: Array.from(new Set(marked)).sort((a, b) => a - b) } as any)
    .eq("id", id)
    .eq("user_id", userId)
    .eq("is_virtual", false);

  if (error) throw error;
}
