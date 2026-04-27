#!/usr/bin/env node
/*
 * GameSpark Bingo Engine
 *
 * Motore server-side per far giocare automaticamente tutte le room Bingo anche
 * quando nessun utente reale ha la pagina aperta.
 *
 * Scrive SOLO nel database:
 * - gamespark_bingo_rounds
 * - gamespark_bingo_cards
 * - gamespark_bingo_draws
 * - gamespark_win_history
 *
 * Richiede nel file .env lato server:
 * - SUPABASE_URL oppure VITE_SUPABASE_URL
 * - SUPABASE_SECRET_KEY oppure SUPABASE_SERVICE_ROLE_KEY
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const APP_DIR = process.env.APP_DIR || path.resolve(__dirname, '..');
const ENV_FILE = path.join(APP_DIR, '.env');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2] || '';
    value = value.replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(ENV_FILE);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENGINE_INTERVAL_MS = Math.max(5000, Number(process.env.BINGO_ENGINE_INTERVAL_MS || 15000));
const ENGINE_LOOKBACK_ROUNDS = Math.max(1, Number(process.env.BINGO_ENGINE_LOOKBACK_ROUNDS || 2));

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[bingo-engine] ERRORE: mancano SUPABASE_URL/VITE_SUPABASE_URL o SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY nel .env server.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BOTS = [
  { name: 'SimoneBig', avatar: '🏆' },
  { name: 'Giulia92', avatar: '🌸' },
  { name: 'Marco_B', avatar: '🦁' },
  { name: 'AlessioPro', avatar: '🎯' },
  { name: 'SofiaLuck', avatar: '💎' },
  { name: 'CarloKing', avatar: '🔥' },
  { name: 'FrancoBingo', avatar: '🎲' },
  { name: 'LauraVIP', avatar: '👑' },
  { name: 'DavideX', avatar: '⚡' },
  { name: 'NicolaGold', avatar: '🏅' },
  { name: 'Roberto77', avatar: '🚀' },
];

const ROOMS = [
  {
    id: 'neon-newcomer',
    name: 'Neon Newcomer',
    tier: 'free',
    waitingSec: 180,
    finishedSec: 5,
    drawIntervalMs: 2400,
    ticketCost: 0,
    sparkReward: 6,
    ticketReward: 0,
    maxNumber: 60,
    cardSize: 3,
  },
  {
    id: 'night-rush',
    name: 'Night Bingo Rush',
    tier: 'standard',
    waitingSec: 180,
    finishedSec: 5,
    drawIntervalMs: 2300,
    ticketCost: 1,
    sparkReward: 14,
    ticketReward: 1,
    maxNumber: 75,
    cardSize: 5,
  },
  {
    id: 'golden-city',
    name: 'Golden City',
    tier: 'premium',
    waitingSec: 180,
    finishedSec: 5,
    drawIntervalMs: 2600,
    ticketCost: 2,
    sparkReward: 36,
    ticketReward: 1,
    maxNumber: 90,
    cardSize: 4,
  },
  {
    id: 'royal-vip',
    name: 'Royal VIP Hall',
    tier: 'vip',
    waitingSec: 180,
    finishedSec: 5,
    drawIntervalMs: 2800,
    ticketCost: 5,
    sparkReward: 90,
    ticketReward: 2,
    maxNumber: 90,
    cardSize: 5,
  },
  {
    id: 'mega-jackpot',
    name: 'Mega Jackpot',
    tier: 'jackpot',
    waitingSec: 210,
    finishedSec: 5,
    drawIntervalMs: 2600,
    ticketCost: 10,
    sparkReward: 300,
    ticketReward: 3,
    maxNumber: 90,
    cardSize: 5,
  },
].map((room) => {
  const playingSec = Math.ceil((room.maxNumber * room.drawIntervalMs) / 1000);
  return { ...room, playingSec, cycleSec: room.waitingSec + playingSec + room.finishedSec };
});

const EPOCH = new Date('2024-01-01T00:00:00Z').getTime();

function hashStringToSeedParts(value) {
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

function sfc32(a, b, c, d) {
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + t) >>> 0;
    return t / 4294967296;
  };
}

function rng(...parts) {
  const [a, b, c, d] = hashStringToSeedParts(parts.join('|'));
  return sfc32(a, b, c, d);
}

function shuffle(pool, random) {
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function drawOrderForRound(room, roundIndex) {
  return shuffle(Array.from({ length: room.maxNumber }, (_, i) => i + 1), rng('draw-order', room.id, room.maxNumber, room.cardSize, roundIndex));
}

function cardForRound(room, playerSeed, roundIndex, slot = 0) {
  const pool = shuffle(Array.from({ length: room.maxNumber }, (_, i) => i + 1), rng('card', room.id, playerSeed, roundIndex, slot, room.maxNumber, room.cardSize));
  const total = room.cardSize * room.cardSize;
  const card = pool.slice(0, total);
  if (room.cardSize === 5) card[12] = 0;
  return card;
}

function timeline(room, now = Date.now()) {
  const elapsed = Math.floor((now - EPOCH) / 1000);
  const cycleIndex = Math.floor(elapsed / room.cycleSec);
  const inCycleSec = ((elapsed % room.cycleSec) + room.cycleSec) % room.cycleSec;
  if (inCycleSec < room.waitingSec) return { phase: 'waiting', cycleIndex, activeRoundIndex: cycleIndex, phaseElapsedSec: inCycleSec };
  if (inCycleSec < room.waitingSec + room.playingSec) return { phase: 'playing', cycleIndex, activeRoundIndex: cycleIndex, phaseElapsedSec: inCycleSec - room.waitingSec };
  return { phase: 'finished', cycleIndex, activeRoundIndex: cycleIndex, phaseElapsedSec: inCycleSec - room.waitingSec - room.playingSec };
}

function virtualCountForRoom(room, roundIndex) {
  const ranges = {
    free: [9, 16],
    standard: [7, 14],
    premium: [6, 12],
    vip: [4, 9],
    jackpot: [3, 7],
  };
  const [min, max] = ranges[room.tier] || [6, 12];
  const random = rng('population', room.id, roundIndex);
  return min + Math.floor(random() * (max - min + 1));
}

function completionDrawIndex(card, drawOrder) {
  const positions = new Map();
  drawOrder.forEach((value, idx) => positions.set(value, idx));
  let maxPos = -1;
  for (const value of card) {
    if (value === 0) continue;
    const pos = positions.get(value);
    if (pos == null) return null;
    if (pos > maxPos) maxPos = pos;
  }
  return maxPos >= 0 ? maxPos : null;
}

function roundId(roomId, roundIndex) {
  return `${roomId}:${roundIndex}`;
}

function cardId(roundIdValue, userId, slot) {
  return `${roundIdValue}:${userId}:${slot}`;
}

function drawId(roundIdValue, order) {
  return `${roundIdValue}:${order}`;
}

function prizeLabel(room) {
  return [
    room.sparkReward > 0 ? `+${room.sparkReward} Spark` : '',
    room.ticketReward > 0 ? `+${room.ticketReward} Ticket` : '',
  ].filter(Boolean).join(' · ');
}

function startedAtForRound(room, roundIndex) {
  return new Date(EPOCH + roundIndex * room.cycleSec * 1000 + room.waitingSec * 1000).toISOString();
}

function endedAtForDraw(room, roundIndex, drawCount) {
  return new Date(EPOCH + roundIndex * room.cycleSec * 1000 + room.waitingSec * 1000 + drawCount * room.drawIntervalMs).toISOString();
}

function dedupeBy(rows, getKey) {
  const map = new Map();
  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    map.set(key, row);
  }
  return Array.from(map.values());
}

async function upsert(table, rows, onConflict) {
  const arr = Array.isArray(rows) ? rows : [rows];
  if (!arr.length) return;

  const conflictColumns = onConflict
    ? onConflict.split(',').map((value) => value.trim()).filter(Boolean)
    : ['id'];

  const cleanRows = dedupeBy(arr, (row) => conflictColumns.map((column) => String(row[column] ?? '')).join('|'));
  if (!cleanRows.length) return;

  const { error } = await supabase.from(table).upsert(cleanRows, onConflict ? { onConflict } : undefined);
  if (error) throw error;
}

async function insertMissingWinRows(roundIdValue, rows) {
  if (!rows.length) return;

  const cleanRows = dedupeBy(rows, (row) => `${row.source_round_id}|${row.user_id}|${row.game_type}`);
  if (!cleanRows.length) return;

  const { data, error } = await supabase
    .from('gamespark_win_history')
    .select('user_id,game_type')
    .eq('source_round_id', roundIdValue);
  if (error) throw error;

  const existing = new Set((data || []).map((row) => `${row.user_id}|${row.game_type}`));
  const missing = cleanRows.filter((row) => !existing.has(`${row.user_id}|${row.game_type}`));
  if (missing.length) {
    const { error: insertError } = await supabase.from('gamespark_win_history').insert(missing);
    if (insertError) throw insertError;
  }
}

async function processRoomRound(room, roundIndex, availableDrawCount) {
  const id = roundId(room.id, roundIndex);
  const draws = drawOrderForRound(room, roundIndex);
  const count = Math.max(0, Math.min(room.maxNumber, availableDrawCount));
  const virtualCount = virtualCountForRoom(room, roundIndex);
  const cards = [];
  const candidates = [];

  for (let i = 0; i < virtualCount; i++) {
    const bot = BOTS[i % BOTS.length];
    const userId = `virtual:${bot.name}:${i}`;
    const numbers = cardForRound(room, 100000 + i * 7919, roundIndex, 0);
    const completeAt = completionDrawIndex(numbers, draws);
    cards.push({ bot, userId, numbers, completeAt });
    if (completeAt != null) candidates.push({ bot, userId, completeAt });
  }

  const earliest = candidates.length ? Math.min(...candidates.map((candidate) => candidate.completeAt)) : null;
  const hasWinner = earliest != null && count >= earliest + 1;
  const winners = hasWinner ? candidates.filter((candidate) => candidate.completeAt === earliest) : [];
  const winningDrawCount = hasWinner ? earliest + 1 : count;
  const winningNumbers = new Set(draws.slice(0, winningDrawCount));

  await upsert('gamespark_bingo_rounds', {
    id,
    room_id: room.id,
    room_name: room.name,
    round_index: roundIndex,
    status: hasWinner ? 'ended' : (count > 0 ? 'running' : 'waiting'),
    winning_pattern: 'bingo',
    winner_user_id: hasWinner ? winners[0].userId : null,
    winner_username: hasWinner ? winners[0].bot.name : null,
    winner_is_virtual: hasWinner,
    winning_card_id: hasWinner ? cardId(id, winners[0].userId, 0) : null,
    spark_reward: room.sparkReward,
    ticket_reward: room.ticketReward,
    started_at: startedAtForRound(room, roundIndex),
    ended_at: hasWinner ? endedAtForDraw(room, roundIndex, winningDrawCount) : null,
  }, 'id');

  const drawRows = draws.slice(0, winningDrawCount).map((number_drawn, index) => ({
    id: drawId(id, index + 1),
    round_id: id,
    number_drawn,
    draw_order: index + 1,
    created_at: endedAtForDraw(room, roundIndex, index + 1),
  }));
  await upsert('gamespark_bingo_draws', drawRows, 'round_id,number_drawn');

  const cardRows = cards.map(({ bot, userId, numbers }) => ({
    id: cardId(id, userId, 0),
    round_id: id,
    user_id: userId,
    username: bot.name,
    is_virtual: true,
    card_slot: 0,
    numbers,
    marked_numbers: numbers.filter((value) => value !== 0 && winningNumbers.has(value)),
    is_winning_card: winners.some((winner) => winner.userId === userId),
  }));
  await upsert('gamespark_bingo_cards', cardRows, 'id');

  if (hasWinner) {
    const label = prizeLabel(room);
    const winRows = winners.map(({ bot, userId }) => ({
      source_round_id: id,
      user_id: userId,
      username: bot.name,
      room_id: room.id,
      room_name: room.name,
      game_type: 'bingo',
      prize_label: label,
      spark_reward: room.sparkReward,
      ticket_reward: room.ticketReward,
      is_bot: true,
      created_at: endedAtForDraw(room, roundIndex, winningDrawCount),
    }));
    await insertMissingWinRows(id, winRows);
  }

  return { id, status: hasWinner ? 'ended' : 'running', winners: winners.map((w) => w.bot.name), drawCount: winningDrawCount };
}

async function tick() {
  const now = Date.now();
  const results = [];

  for (const room of ROOMS) {
    const t = timeline(room, now);
    const roundsToProcess = new Set();
    roundsToProcess.add(t.activeRoundIndex);
    for (let i = 1; i <= ENGINE_LOOKBACK_ROUNDS; i++) roundsToProcess.add(t.activeRoundIndex - i);

    for (const roundIndex of roundsToProcess) {
      if (roundIndex < 0) continue;
      let availableDrawCount = room.maxNumber;
      if (roundIndex === t.activeRoundIndex) {
        if (t.phase === 'waiting') availableDrawCount = 0;
        else if (t.phase === 'playing') availableDrawCount = Math.floor((t.phaseElapsedSec * 1000) / room.drawIntervalMs);
        else availableDrawCount = room.maxNumber;
      }

      if (availableDrawCount <= 0 && roundIndex === t.activeRoundIndex) {
        await upsert('gamespark_bingo_rounds', {
          id: roundId(room.id, roundIndex),
          room_id: room.id,
          room_name: room.name,
          round_index: roundIndex,
          status: 'waiting',
          winning_pattern: 'bingo',
          spark_reward: room.sparkReward,
          ticket_reward: room.ticketReward,
          started_at: startedAtForRound(room, roundIndex),
          ended_at: null,
        }, 'id');
        continue;
      }

      const result = await processRoomRound(room, roundIndex, availableDrawCount);
      results.push(`${room.id}#${roundIndex}:${result.status}:${result.drawCount}`);
    }
  }

  console.log(`[bingo-engine] ${new Date().toISOString()} ${results.join(' | ')}`);
}

let running = false;
async function safeTick() {
  if (running) return;
  running = true;
  try {
    await tick();
  } catch (error) {
    console.error('[bingo-engine] ERRORE tick:', error && (error.stack || error.message || error));
  } finally {
    running = false;
  }
}

console.log(`[bingo-engine] Avviato. Intervallo ${ENGINE_INTERVAL_MS}ms. Room: ${ROOMS.map((r) => r.id).join(', ')}. Duplicate-safe.`);
void safeTick();
setInterval(() => void safeTick(), ENGINE_INTERVAL_MS);
