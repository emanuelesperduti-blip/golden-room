/**
 * update-server.js
 * Microserver Node.js nativo per l'aggiornamento remoto di Golden Room.
 * Zero dipendenze obbligatorie — usa solo moduli built-in Node.js.
 *
 * Avvio:  node update-server.js
 * Porta:  3099 (env UPDATE_PORT)
 *
 * Variabili d'ambiente richieste nel .env:
 *   UPDATE_ADMIN_TOKEN   — token segreto da inserire nel pannello admin
 *   APP_DIR              — cartella app (default: /home/ubuntu/app)
 *   UPDATE_SCRIPT        — path script bash (default: APP_DIR/scripts/update-from-zip.sh)
 *   SERVICE_NAME         — nome servizio systemd (default: golden-room)
 *   ALLOWED_ORIGIN       — dominio frontend per CORS (default: https://gamespark.it)
 */

"use strict";

const http      = require("http");
const path      = require("path");
const fs        = require("fs");
const os        = require("os");
const { spawn } = require("child_process");

// ── Carica .env se presente ───────────────────────────────────
const dotenvPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(dotenvPath)) {
  fs.readFileSync(dotenvPath, "utf8").split("\n").forEach((line) => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
}

// ── Config ────────────────────────────────────────────────────
const PORT           = parseInt(process.env.UPDATE_PORT    || "3099", 10);
const ADMIN_TOKEN    = process.env.UPDATE_ADMIN_TOKEN      || "";
const APP_DIR        = process.env.APP_DIR                 || "/home/ubuntu/app";
const UPDATE_SCRIPT  = process.env.UPDATE_SCRIPT           || path.join(APP_DIR, "scripts", "update-from-zip.sh");
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN          || "https://gamespark.it";
const MAX_ZIP_MB     = 100;
const UPLOAD_TMP     = path.join(os.tmpdir(), "golden-room-uploads");

if (!ADMIN_TOKEN) {
  console.error("[update-server] ✗ UPDATE_ADMIN_TOKEN non impostato — il server si rifiuta di partire.");
  process.exit(1);
}

fs.mkdirSync(UPLOAD_TMP, { recursive: true });

// ── Stato globale ─────────────────────────────────────────────
let updateState = { running: false, success: null, startedAt: null, log: [] };
let sseClients  = [];

function broadcast(data) {
  const line = `data: ${JSON.stringify(data)}\n\n`;
  sseClients = sseClients.filter((res) => {
    try { res.write(line); return true; } catch { return false; }
  });
}

function logLine(text) {
  const entry = { t: Date.now(), msg: text };
  updateState.log.push(entry);
  broadcast({ type: "log", ...entry });
}

// ── Helpers ───────────────────────────────────────────────────
function cors(res) {
  // CORS ristretto al dominio dell'app — non wildcard
  res.setHeader("Access-Control-Allow-Origin",  ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Vary", "Origin");
}

function auth(req, res) {
  const token = (req.headers["authorization"] || "").replace(/^Bearer\s+/i, "").trim();
  if (token !== ADMIN_TOKEN) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Non autorizzato" }));
    return false;
  }
  return true;
}

function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

// ── Routes ────────────────────────────────────────────────────
const ROUTES = [];
function route(method, pathname, handler) { ROUTES.push({ method, pathname, handler }); }

// GET /update-api/status
route("GET", "/update-api/status", (req, res) => {
  if (!auth(req, res)) return;
  json(res, 200, { running: updateState.running, success: updateState.success, startedAt: updateState.startedAt, logLines: updateState.log.length });
});

// GET /update-api/log
route("GET", "/update-api/log", (req, res) => {
  if (!auth(req, res)) return;
  json(res, 200, { log: updateState.log });
});

// GET /update-api/stream  (SSE)
route("GET", "/update-api/stream", (req, res) => {
  if (!auth(req, res)) return;
  res.writeHead(200, {
    "Content-Type":      "text/event-stream",
    "Cache-Control":     "no-cache",
    "Connection":        "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(":\n\n");
  // Invia log già accumulato
  updateState.log.forEach((e) => res.write(`data: ${JSON.stringify({ type: "log", ...e })}\n\n`));
  res.write(`data: ${JSON.stringify({ type: "status", running: updateState.running, success: updateState.success })}\n\n`);
  sseClients.push(res);
  req.on("close", () => { sseClients = sseClients.filter((r) => r !== res); });
});

// POST /update-api/upload
route("POST", "/update-api/upload", (req, res) => {
  if (!auth(req, res)) return;
  if (updateState.running) return json(res, 409, { error: "Aggiornamento già in corso." });

  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) return json(res, 400, { error: "Richiede multipart/form-data" });

  const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
  if (!boundaryMatch) return json(res, 400, { error: "Boundary multipart mancante" });

  const chunks = [];
  let totalBytes = 0;

  req.on("data", (chunk) => {
    totalBytes += chunk.length;
    if (totalBytes > MAX_ZIP_MB * 1024 * 1024) { req.destroy(new Error("File troppo grande (max 100MB)")); return; }
    chunks.push(chunk);
  });

  req.on("error", (err) => json(res, 413, { error: err.message }));

  req.on("end", () => {
    try {
      const body     = Buffer.concat(chunks);
      const boundary = Buffer.from("--" + boundaryMatch[1]);
      let fileStart  = -1, fileEnd = -1, filename = "update.zip";

      let pos = 0;
      while (pos < body.length) {
        const bIdx = body.indexOf(boundary, pos);
        if (bIdx === -1) break;
        const partStart = bIdx + boundary.length + 2;
        const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), partStart);
        if (headerEnd === -1) break;
        const headers = body.slice(partStart, headerEnd).toString();
        if (headers.includes("filename")) {
          const fnMatch = headers.match(/filename="([^"]+)"/);
          if (fnMatch) filename = fnMatch[1];
          fileStart = headerEnd + 4;
          const nextBoundary = body.indexOf(boundary, fileStart);
          fileEnd = nextBoundary !== -1 ? nextBoundary - 2 : body.length;
          break;
        }
        pos = partStart;
      }

      if (fileStart === -1)                              return json(res, 400, { error: "Nessun file trovato nel body" });
      if (!filename.toLowerCase().endsWith(".zip"))     return json(res, 400, { error: "Solo file .zip accettati" });

      const fileData = body.slice(fileStart, fileEnd);
      const savePath = path.join(UPLOAD_TMP, `update_${Date.now()}.zip`);
      fs.writeFileSync(savePath, fileData);
      json(res, 200, { ok: true, path: savePath, size: `${(fileData.length / 1024 / 1024).toFixed(2)} MB`, filename });
    } catch (err) {
      json(res, 500, { error: err.message });
    }
  });
});

// POST /update-api/install
route("POST", "/update-api/install", (req, res) => {
  if (!auth(req, res)) return;
  if (updateState.running) return json(res, 409, { error: "Aggiornamento già in corso." });

  let body = "";
  req.on("data", (c) => { body += c.toString(); });
  req.on("end", () => {
    let params;
    try { params = JSON.parse(body); } catch { return json(res, 400, { error: "Body JSON non valido" }); }

    const { zipPath, skipNpmInstall, skipBuild, noRestart } = params;
    if (!zipPath || !fs.existsSync(zipPath))  return json(res, 400, { error: "zipPath non valido o file non trovato" });
    if (!fs.existsSync(UPDATE_SCRIPT))        return json(res, 500, { error: `Script non trovato: ${UPDATE_SCRIPT}` });

    json(res, 200, { ok: true, message: "Aggiornamento avviato. Seguilo via SSE su /update-api/stream" });

    updateState = { running: true, success: null, startedAt: new Date().toISOString(), log: [] };
    broadcast({ type: "status", running: true });

    const args = [zipPath];
    if (skipNpmInstall) args.push("--skip-npm-install");
    if (skipBuild)      args.push("--skip-build");
    if (noRestart)      args.push("--no-restart");

    logLine(`🚀 Avvio aggiornamento — ${new Date().toLocaleString("it-IT")}`);

    const child = spawn("bash", [UPDATE_SCRIPT, ...args], {
      env: { ...process.env, APP_DIR, SERVICE_NAME: process.env.SERVICE_NAME || "golden-room" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (d) => d.toString().split("\n").filter(Boolean).forEach(logLine));
    child.stderr.on("data", (d) => d.toString().split("\n").filter(Boolean).forEach(logLine));

    child.on("close", (code) => {
      updateState.running = false;
      updateState.success = code === 0;
      logLine(code === 0 ? "✅ AGGIORNAMENTO COMPLETATO" : `❌ AGGIORNAMENTO FALLITO (exit ${code}) — rollback eseguito`);
      broadcast({ type: "status", running: false, success: updateState.success });
      try { fs.unlinkSync(zipPath); } catch {}
    });

    child.on("error", (err) => {
      logLine(`❌ Errore avvio script: ${err.message}`);
      updateState.running = false;
      updateState.success = false;
      broadcast({ type: "status", running: false, success: false });
    });
  });
});

// ── Server HTTP ───────────────────────────────────────────────
const server = http.createServer((req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  const handler = ROUTES.find((r) => r.method === req.method && r.pathname === req.url.split("?")[0]);
  if (handler) handler.handler(req, res);
  else { res.writeHead(404, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Not found" })); }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[update-server] ✅ In ascolto su 127.0.0.1:${PORT}`);
  console.log(`[update-server] APP_DIR:        ${APP_DIR}`);
  console.log(`[update-server] UPDATE_SCRIPT:  ${UPDATE_SCRIPT}`);
  console.log(`[update-server] ALLOWED_ORIGIN: ${ALLOWED_ORIGIN}`);
  console.log(`[update-server] Token:          ${ADMIN_TOKEN.slice(0, 4)}${"*".repeat(Math.max(0, ADMIN_TOKEN.length - 4))}`);
});

server.on("error", (err) => { console.error("[update-server] Errore:", err.message); process.exit(1); });
