#!/bin/bash
# GameSpark Bot Activity Script
# Simula attività bot reale: cartelle + vincite per ogni stanza
# Cron: */6 * * * * (ogni 6 minuti)

set -euo pipefail

# ─── CONFIG ────────────────────────────────────────────────────────────────────
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_KEY="${SUPABASE_KEY:-}"
LOG_FILE="/var/log/gamespark-bots.log"

if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_KEY" ]]; then
  # Prova a caricare dal .env dell'app
  if [[ -f /home/ubuntu/app/.env ]]; then
    export $(grep -E "^SUPABASE_URL|^VITE_SUPABASE_URL|^SUPABASE_PUBLISHABLE_KEY|^VITE_SUPABASE_PUBLISHABLE_KEY" /home/ubuntu/app/.env | sed 's/VITE_SUPABASE_URL/SUPABASE_URL/;s/VITE_SUPABASE_PUBLISHABLE_KEY/SUPABASE_KEY/' | xargs)
  fi
fi

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

# ─── DATI ROOMS ────────────────────────────────────────────────────────────────
declare -A ROOM_NAMES=( 
  ["neon-newcomer"]="Neon Newcomer"
  ["night-rush"]="Night Bingo Rush"
  ["golden-city"]="Golden City"
  ["royal-vip"]="Royal VIP Hall"
  ["mega-jackpot"]="Mega Jackpot"
)
declare -A ROOM_SPARKS=( 
  ["neon-newcomer"]=6
  ["night-rush"]=14
  ["golden-city"]=36
  ["royal-vip"]=90
  ["mega-jackpot"]=300
)
declare -A ROOM_TICKETS=( 
  ["neon-newcomer"]=0
  ["night-rush"]=1
  ["golden-city"]=1
  ["royal-vip"]=2
  ["mega-jackpot"]=3
)
declare -A ROOM_CYCLE=( 
  ["neon-newcomer"]=329
  ["night-rush"]=358
  ["golden-city"]=419
  ["royal-vip"]=437
  ["mega-jackpot"]=449
)

# ─── BOT NAMES ─────────────────────────────────────────────────────────────────
BOT_NAMES=("Marco_B" "Giulia92" "AlessioPro" "NicolaGold" "LauraVIP" "Roberto77" "SofiaLuck" "FrancoBingo" "CarloKing" "AnnaGr" "DavideX" "MiriamVIP" "Piero_99" "ErikaTop" "SimoneBig")

# ─── FUNZIONI ──────────────────────────────────────────────────────────────────
supabase_insert() {
  local table="$1"
  local payload="$2"
  curl -sS -o /dev/null -w "%{http_code}" \
    -X POST \
    "${SUPABASE_URL}/rest/v1/${table}" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=ignore-duplicates" \
    -d "$payload"
}

supabase_upsert() {
  local table="$1"
  local payload="$2"
  local on_conflict="$3"
  curl -sS -o /dev/null -w "%{http_code}" \
    -X POST \
    "${SUPABASE_URL}/rest/v1/${table}?on_conflict=${on_conflict}" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates" \
    -d "$payload"
}

pick_random_bot() {
  echo "${BOT_NAMES[$((RANDOM % ${#BOT_NAMES[@]}))]}"
}

current_round_index() {
  local cycle_sec="$1"
  echo $(( $(date +%s) / cycle_sec ))
}

# ─── MAIN LOOP ─────────────────────────────────────────────────────────────────
log "=== Bot activity run START ==="

ROOMS=("neon-newcomer" "night-rush" "golden-city" "royal-vip" "mega-jackpot")

for room_id in "${ROOMS[@]}"; do
  room_name="${ROOM_NAMES[$room_id]}"
  spark="${ROOM_SPARKS[$room_id]}"
  ticket="${ROOM_TICKETS[$room_id]}"
  cycle="${ROOM_CYCLE[$room_id]}"
  
  round_index=$(current_round_index "$cycle")
  round_id="${room_id}:${round_index}"
  
  log "Room: $room_name | Round: $round_index"

  # 1. Seed cartelle bot per round corrente E prossimo
  for r_idx in $round_index $((round_index + 1)); do
    r_id="${room_id}:${r_idx}"
    cards_payload="["
    first=true
    # Inserisci 6-10 bot per stanza (2 cartelle a testa)
    bot_count=$(( 6 + RANDOM % 5 ))
    selected_bots=("${BOT_NAMES[@]:0:$bot_count}")
    
    for bot_name in "${selected_bots[@]}"; do
      bot_user_id="bot-$(echo "$bot_name" | tr '[:upper:]' '[:lower:]' | tr '_' '-')"
      for slot in 0 1; do
        [[ "$first" == "true" ]] && first=false || cards_payload+=","
        cards_payload+="{\"user_id\":\"${bot_user_id}\",\"username\":\"${bot_name}\",\"room_id\":\"${room_id}\",\"round_id\":\"${r_id}\",\"card_slot\":${slot},\"marked_numbers\":[],\"is_virtual\":false,\"numbers\":[]}"
      done
    done
    cards_payload+="]"
    
    status=$(supabase_upsert "gamespark_bingo_cards" "$cards_payload" "user_id,room_id,round_id,card_slot")
    log "  Cartelle round $r_idx: HTTP $status"
  done

  # 2. Registra 1 vincita bot per questa stanza (simula fine round)
  winner_bot=$(pick_random_bot)
  bot_user_id="bot-$(echo "$winner_bot" | tr '[:upper:]' '[:lower:]' | tr '_' '-')"
  prize_label="+${spark} Spark"
  [[ $ticket -gt 0 ]] && prize_label="${prize_label} · +${ticket} Ticket"
  
  # Timestamp casuale negli ultimi N minuti (simula partita appena finita)
  delay_sec=$(( RANDOM % cycle ))
  win_time=$(date -u -d "${delay_sec} seconds ago" '+%Y-%m-%dT%H:%M:%S+00:00' 2>/dev/null || date -u -v-${delay_sec}S '+%Y-%m-%dT%H:%M:%S+00:00')
  
  win_payload="{\"user_id\":\"${bot_user_id}\",\"username\":\"${winner_bot}\",\"room_id\":\"${room_id}\",\"room_name\":\"${room_name}\",\"game_type\":\"bingo\",\"prize_label\":\"${prize_label}\",\"spark_reward\":${spark},\"ticket_reward\":${ticket},\"is_bot\":true,\"source_round_id\":\"${round_id}-auto\",\"created_at\":\"${win_time}\"}"
  
  status=$(supabase_insert "gamespark_win_history" "$win_payload")
  log "  Vincita bot $winner_bot: HTTP $status"

done

log "=== Bot activity run END ==="
