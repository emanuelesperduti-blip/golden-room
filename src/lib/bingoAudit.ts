import { supabase } from "@/integrations/supabase/client";
import { BOTS } from "@/lib/bots";
import { cardForRound, type RoomConfig } from "@/lib/rooms";

export type BingoAuditWinner = {
  name: string;
  kind: "player" | "bot";
  cardSlot: number | null;
  drawIndex: number;
};

function roundId(roomId: string, roundIndex: number) {
  return `${roomId}:${roundIndex}`;
}

function cardId(roundIdValue: string, userId: string, slot: number) {
  return `${roundIdValue}:${userId}:${slot}`;
}

function drawId(roundIdValue: string, order: number) {
  return `${roundIdValue}:${order}`;
}

function prizeLabel(sparkReward: number, ticketReward: number) {
  return [
    sparkReward > 0 ? `+${sparkReward} Spark` : "",
    ticketReward > 0 ? `+${ticketReward} Ticket` : "",
  ].filter(Boolean).join(" · ");
}

export async function recordBingoRoundAudit(params: {
  room: RoomConfig;
  roundIndex: number;
  drawOrder: number[];
  winningDrawCount: number;
  playerSeed: number;
  playerUserId: string | null;
  playerName: string;
  playerCards: Array<{ slot: number }>;
  botCount: number;
  winners: BingoAuditWinner[];
  sparkReward: number;
  ticketReward: number;
}) {
  const { room, roundIndex, drawOrder, winningDrawCount, playerSeed, playerUserId, playerName, playerCards, botCount, winners, sparkReward, ticketReward } = params;
  if (!winners.length || winningDrawCount <= 0) return;

  const id = roundId(room.id, roundIndex);
  const label = prizeLabel(sparkReward, ticketReward);
  const firstWinner = winners[0];
  const firstWinnerUserId = firstWinner.kind === "player" && playerUserId ? playerUserId : `virtual:${firstWinner.name}`;
  const firstWinnerCardSlot = firstWinner.kind === "player" ? firstWinner.cardSlot ?? 0 : 0;

  try {
    await supabase.from("gamespark_bingo_rounds" as any).upsert({
      id,
      room_id: room.id,
      room_name: room.name,
      round_index: roundIndex,
      status: "ended",
      winning_pattern: "bingo",
      winner_user_id: firstWinnerUserId,
      winner_username: firstWinner.name,
      winner_is_virtual: firstWinner.kind === "bot",
      winning_card_id: cardId(id, firstWinnerUserId, firstWinnerCardSlot),
      spark_reward: sparkReward,
      ticket_reward: ticketReward,
      ended_at: new Date().toISOString(),
    } as any, { onConflict: "id" } as any);

    const drawRows = drawOrder.slice(0, winningDrawCount).map((number_drawn, index) => ({
      id: drawId(id, index + 1),
      round_id: id,
      number_drawn,
      draw_order: index + 1,
    }));
    if (drawRows.length) await supabase.from("gamespark_bingo_draws" as any).upsert(drawRows as any, { onConflict: "id" } as any);

    const winningNumbers = new Set(drawOrder.slice(0, winningDrawCount));
    const cardRows: any[] = [];

    for (const entry of playerCards) {
      const uid = playerUserId ?? "guest";
      const numbers = cardForRound(room, playerSeed, roundIndex, entry.slot);
      cardRows.push({
        id: cardId(id, uid, entry.slot),
        round_id: id,
        user_id: uid,
        username: playerName,
        is_virtual: false,
        card_slot: entry.slot,
        numbers,
        marked_numbers: numbers.filter((value) => value !== 0 && winningNumbers.has(value)),
        is_winning_card: winners.some((winner) => winner.kind === "player" && winner.cardSlot === entry.slot),
      });
    }

    for (let i = 0; i < botCount; i++) {
      const bot = BOTS[i % BOTS.length];
      const uid = `virtual:${bot.name}`;
      const numbers = cardForRound(room, 100000 + i * 7919, roundIndex, 0);
      cardRows.push({
        id: cardId(id, uid, 0),
        round_id: id,
        user_id: uid,
        username: bot.name,
        is_virtual: true,
        card_slot: 0,
        numbers,
        marked_numbers: numbers.filter((value) => value !== 0 && winningNumbers.has(value)),
        is_winning_card: winners.some((winner) => winner.kind === "bot" && winner.name === bot.name),
      });
    }

    if (cardRows.length) await supabase.from("gamespark_bingo_cards" as any).upsert(cardRows as any, { onConflict: "id" } as any);

    const winRows = winners.map((winner) => {
      const uid = winner.kind === "player" && playerUserId ? playerUserId : `virtual:${winner.name}`;
      return {
        source_round_id: id,
        user_id: uid,
        username: winner.name,
        room_id: room.id,
        room_name: room.name,
        game_type: "bingo",
        prize_label: label,
        spark_reward: sparkReward,
        ticket_reward: ticketReward,
        is_bot: winner.kind === "bot",
      };
    });
    if (winRows.length) await supabase.from("gamespark_win_history" as any).upsert(winRows as any, { onConflict: "source_round_id,user_id,game_type" } as any);
  } catch (error) {
    console.warn("GameSpark: impossibile salvare audit Bingo", error);
  }
}
