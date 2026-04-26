#!/bin/bash
# ============================================================
#  update-from-zip.sh
#  Aggiornamento sicuro dell'app Golden Room da file ZIP
#
#  Uso: ./update-from-zip.sh <path-allo-zip> [opzioni]
#  Opzioni:
#    --skip-npm-install    non riesegue npm install
#    --skip-build          non riesegue npm run build
#    --no-restart          non riavvia i servizi
#
#  NOTA SICUREZZA: gli zip non possono contenere la cartella scripts/.
#  Per aggiornare update-from-zip.sh o update-server.js
#  usa SSH/Git direttamente sul server.
# ============================================================

set -euo pipefail

# ── Configurazione ───────────────────────────────────────────
APP_DIR="${APP_DIR:-/home/ubuntu/app}"
BACKUP_DIR="${BACKUP_DIR:-/home/ubuntu/app-backups}"
TMP_DIR="/tmp/golden-room-update-$$"
LOG_FILE="/tmp/golden-room-update-$$.log"
SERVICE_NAME="${SERVICE_NAME:-golden-room}"
MAX_BACKUP_COUNT=5

# File che NON devono mai essere sovrascritti da uno ZIP
PROTECTED_FILES=(
  ".env"
  "supabase/config.toml"
  "supabase/functions/send-confirmation-email/index.ts"
)

# ── Colori log ───────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"; }
ok()   { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✓${NC} $*" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠${NC} $*" | tee -a "$LOG_FILE"; }
fail() { echo -e "${RED}[$(date '+%H:%M:%S')] ✗ ERRORE:${NC} $*" | tee -a "$LOG_FILE"; }

# ── Argomenti ────────────────────────────────────────────────
ZIP_PATH="${1:-}"
SKIP_NPM_INSTALL=false
SKIP_BUILD=false
NO_RESTART=false

for arg in "${@:2}"; do
  case "$arg" in
    --skip-npm-install) SKIP_NPM_INSTALL=true ;;
    --skip-build)       SKIP_BUILD=true ;;
    --no-restart)       NO_RESTART=true ;;
  esac
done

# ── Validazione input ────────────────────────────────────────
if [[ -z "$ZIP_PATH" ]]; then
  fail "Nessun file ZIP specificato."
  echo "Uso: $0 <path-allo-zip>" >&2
  exit 1
fi

if [[ ! -f "$ZIP_PATH" ]]; then
  fail "File ZIP non trovato: $ZIP_PATH"
  exit 1
fi

if [[ "${ZIP_PATH##*.}" != "zip" ]]; then
  fail "Il file deve avere estensione .zip"
  exit 1
fi

ZIP_SIZE=$(stat -c%s "$ZIP_PATH" 2>/dev/null || echo 0)
if (( ZIP_SIZE > 104857600 )); then
  fail "ZIP troppo grande (massimo 100 MB)"
  exit 1
fi

# ── Sicurezza: blocca file pericolosi nello zip ───────────────
# NOTA: la cartella scripts/ non può essere aggiornata via pannello.
# Per aggiornare update-server.js, update-from-zip.sh o altri script server
# usa SSH/Git direttamente.
log "Controllo contenuto ZIP..."
DANGEROUS=$(unzip -l "$ZIP_PATH" | awk '{print $4}' | grep -iE '(^|/)\.env$|(^|/)scripts/|\.bashrc$|authorized_keys$|sudoers$|crontab$' || true)
if [[ -n "$DANGEROUS" ]]; then
  fail "ZIP contiene file non consentiti (cartella scripts/ o configurazioni sensibili):"
  echo "$DANGEROUS"
  exit 1
fi

# Avvisa se lo zip contiene file protetti (li ignoreremo comunque)
for pf in "${PROTECTED_FILES[@]}"; do
  if unzip -l "$ZIP_PATH" | grep -q "$pf"; then
    warn "Lo ZIP contiene '$pf' — verrà ignorato (file protetto)."
  fi
done

# ── Funzione rollback ────────────────────────────────────────
ROLLBACK_BACKUP=""

rollback() {
  if [[ -z "$ROLLBACK_BACKUP" || ! -d "$ROLLBACK_BACKUP" ]]; then
    fail "Nessun backup disponibile per il rollback."
    return
  fi
  warn "🔄 Eseguo ROLLBACK alla versione precedente..."
  rsync -a --delete \
    --exclude='node_modules/' \
    "$ROLLBACK_BACKUP/" "$APP_DIR/" 2>>"$LOG_FILE" || true
  ok "Rollback file completato."
  if [[ "$NO_RESTART" == false ]]; then
    restart_services || warn "Riavvio fallito in rollback — intervento manuale necessario."
  fi
}

restart_services() {
  log "Riavvio servizi..."
  # Prova prima systemd, poi pm2
  if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    sudo systemctl restart "$SERVICE_NAME" 2>>"$LOG_FILE" && ok "systemctl: $SERVICE_NAME riavviato."
  elif command -v pm2 &>/dev/null; then
    pm2 restart "$SERVICE_NAME" 2>>"$LOG_FILE" && ok "pm2: $SERVICE_NAME riavviato."
  else
    warn "Servizio $SERVICE_NAME non trovato — riavvio manuale necessario."
  fi

  if systemctl is-active --quiet nginx 2>/dev/null; then
    sudo nginx -t 2>>"$LOG_FILE" && sudo systemctl reload nginx 2>>"$LOG_FILE" && ok "Nginx ricaricato."
  fi
}

# Rollback automatico su qualsiasi errore
trap 'STATUS=$?; if [[ $STATUS -ne 0 ]]; then fail "Script interrotto (exit $STATUS). Avvio rollback..."; rollback; fi; rm -rf "$TMP_DIR"; exit $STATUS' EXIT

# ── 1. Backup ────────────────────────────────────────────────
log "📦 Creo backup della versione attuale..."
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_PATH="$BACKUP_DIR/backup_$TIMESTAMP"
mkdir -p "$BACKUP_PATH"

rsync -a \
  --exclude='node_modules/' \
  --exclude='.git/' \
  "$APP_DIR/" "$BACKUP_PATH/" 2>>"$LOG_FILE"

ROLLBACK_BACKUP="$BACKUP_PATH"
ok "Backup salvato in: $BACKUP_PATH"

# Mantieni solo gli ultimi MAX_BACKUP_COUNT backup
BACKUP_COUNT=$(ls -1d "$BACKUP_DIR"/backup_* 2>/dev/null | wc -l)
if (( BACKUP_COUNT > MAX_BACKUP_COUNT )); then
  ls -1dt "$BACKUP_DIR"/backup_* | tail -n +$((MAX_BACKUP_COUNT + 1)) | xargs rm -rf
  ok "Eliminati backup vecchi (mantengo gli ultimi $MAX_BACKUP_COUNT)."
fi

# ── 2. Salva file protetti ────────────────────────────────────
log "🔒 Salvo file protetti..."
mkdir -p "$TMP_DIR/protected"
for pf in "${PROTECTED_FILES[@]}"; do
  SRC="$APP_DIR/$pf"
  if [[ -f "$SRC" ]]; then
    mkdir -p "$TMP_DIR/protected/$(dirname "$pf")"
    cp "$SRC" "$TMP_DIR/protected/$pf"
    ok "  Salvato: $pf"
  fi
done

# ── 3. Estrai ZIP ────────────────────────────────────────────
log "📂 Estraggo ZIP..."
mkdir -p "$TMP_DIR/extracted"
unzip -q "$ZIP_PATH" -d "$TMP_DIR/extracted" 2>>"$LOG_FILE"
ok "ZIP estratto."

# ── Rileva automaticamente: ZIP completo o patch parziale ─────
#
# ZIP COMPLETO:  contiene package.json → npm install + build completa
# ZIP PARZIALE:  solo file modificati (es. src/routes/*.tsx) → copia
#                file + build con package.json già presente sul server
#
ZIP_ROOT="$TMP_DIR/extracted"
ZIP_MODE="partial"  # default: patch parziale

# Se c'è una sola sottocartella con package.json, entra in essa
SUBDIRS=$(ls -1 "$ZIP_ROOT" 2>/dev/null)
SUBDIR_COUNT=$(echo "$SUBDIRS" | grep -c "." || echo 0)
if [[ $SUBDIR_COUNT -eq 1 ]]; then
  CANDIDATE="$ZIP_ROOT/$SUBDIRS"
  if [[ -d "$CANDIDATE" ]]; then
    ZIP_ROOT="$CANDIDATE"
    log "Sottocartella rilevata nello zip: $SUBDIRS/"
  fi
fi

if [[ -f "$ZIP_ROOT/package.json" ]]; then
  ZIP_MODE="full"
  log "📦 Modalità: ZIP COMPLETO (contiene package.json)"
else
  ZIP_MODE="partial"
  log "🩹 Modalità: ZIP PARZIALE (solo file modificati)"
  # In modalità patch, npm install non serve (le dipendenze non cambiano)
  # La build verrà eseguita con il package.json già presente in $APP_DIR
  if [[ "$SKIP_NPM_INSTALL" == false ]]; then
    warn "ZIP parziale: npm install saltato automaticamente (nessun package.json nello zip)."
    SKIP_NPM_INSTALL=true
  fi
fi

# ── 4. Rimuovi file protetti dall'estratto ───────────────────
for pf in "${PROTECTED_FILES[@]}"; do
  [[ -f "$ZIP_ROOT/$pf" ]] && rm -f "$ZIP_ROOT/$pf" && warn "  Rimosso dall'estratto: $pf"
done

# ── 5. Copia i nuovi file ────────────────────────────────────
log "📋 Copio i nuovi file in $APP_DIR..."
rsync -a \
  --exclude='node_modules/' \
  --exclude='.git/' \
  --exclude='dist/' \
  --exclude='scripts/' \
  "$ZIP_ROOT/" "$APP_DIR/" 2>>"$LOG_FILE"
ok "File copiati."

# ── 6. Ripristina file protetti ──────────────────────────────
log "🔒 Ripristino file protetti originali..."
for pf in "${PROTECTED_FILES[@]}"; do
  SRC="$TMP_DIR/protected/$pf"
  if [[ -f "$SRC" ]]; then
    mkdir -p "$APP_DIR/$(dirname "$pf")"
    cp "$SRC" "$APP_DIR/$pf"
    ok "  Ripristinato: $pf"
  fi
done

# ── 7. npm install ───────────────────────────────────────────
cd "$APP_DIR"

if [[ "$SKIP_NPM_INSTALL" == false ]]; then
  log "📦 Eseguo npm install..."
  npm install --prefer-offline 2>>"$LOG_FILE" || npm install 2>>"$LOG_FILE"
  ok "npm install completato."
else
  warn "npm install saltato (--skip-npm-install)."
fi

# ── 8. npm run build ─────────────────────────────────────────
if [[ "$SKIP_BUILD" == false ]]; then
  log "🔨 Eseguo npm run build..."
  npm run build 2>>"$LOG_FILE"
  ok "Build completata."
else
  warn "Build saltata (--skip-build)."
fi

# ── 9. Verifica build output ─────────────────────────────────
if [[ ! -d "$APP_DIR/dist" ]]; then
  fail "La cartella dist/ non esiste dopo la build."
  exit 1
fi
ok "Build verificata: dist/ presente."

# ── 10. Riavvia servizi ──────────────────────────────────────
if [[ "$NO_RESTART" == false ]]; then
  restart_services
else
  warn "Riavvio servizi saltato (--no-restart)."
fi

echo ""
echo -e "${GREEN}${BOLD}══════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✅ AGGIORNAMENTO COMPLETATO CON SUCCESSO ${NC}"
echo -e "${GREEN}${BOLD}══════════════════════════════════════════${NC}"
echo -e "  Backup: ${BOLD}$BACKUP_PATH${NC}"
echo -e "  Log:    ${BOLD}$LOG_FILE${NC}"

trap - EXIT
rm -rf "$TMP_DIR"
exit 0
