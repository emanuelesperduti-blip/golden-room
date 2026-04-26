# Golden Room — Update Server

Sistema di auto-aggiornamento dal pannello Admin → Aggiornamenti.

## Struttura

```
scripts/
  update-from-zip.sh   ← script bash che esegue il deploy
  update-server.js     ← microserver Node.js nativo (zero dipendenze)
  README.md            ← questo file
```

> **Nota**: questi file vanno installati sul server **una volta sola via SSH/SCP**.
> Dopo, gli aggiornamenti dell'app si caricano dal pannello Admin.

---

## Due tipi di ZIP

Lo script distingue automaticamente due modalità:

### ZIP PARZIALE (quello che usi normalmente)
Contiene solo i file che hai modificato, senza `package.json`.
Lo script lo rileva automaticamente, salta `npm install` e fa solo la build.

```
app/src/routes/admin.tsx
app/src/routes/scratch.tsx
app/src/hooks/useAuth.tsx
```

### ZIP COMPLETO
Contiene l'intero progetto incluso `package.json`, ma senza `.env`, `.git/`, `dist/`, `node_modules/`.
Lo script esegue anche `npm install` prima della build.
Utile quando aggiungi/rimuovi dipendenze npm.

```
app/package.json
app/src/...
app/public/...
```

### Regola comune a entrambi: MAI includere

```
.env
.git/
dist/
node_modules/
scripts/        ← gli script server si aggiornano via SSH/Git, non dal pannello
```

---

## Installazione iniziale sul server (una volta sola, via SSH)

### 1. Copia i file

```bash
scp scripts/update-from-zip.sh ubuntu@gamespark.it:/home/ubuntu/app/scripts/
scp scripts/update-server.js   ubuntu@gamespark.it:/home/ubuntu/app/scripts/
chmod +x /home/ubuntu/app/scripts/update-from-zip.sh
```

### 2. Aggiungi variabili al .env

```bash
# /home/ubuntu/app/.env — aggiungi queste righe
UPDATE_ADMIN_TOKEN=genera-con-openssl-rand-hex-32
UPDATE_PORT=3099
ALLOWED_ORIGIN=https://gamespark.it
APP_DIR=/home/ubuntu/app
SERVICE_NAME=golden-room
```

Genera token sicuro:
```bash
openssl rand -hex 32
```

> **CORS**: se usi `https://www.gamespark.it`, cambia `ALLOWED_ORIGIN` di conseguenza.
> Il pannello admin deve essere aperto dallo stesso dominio configurato qui.

### 3. Crea il servizio systemd

```bash
sudo nano /etc/systemd/system/golden-room-updater.service
```

Contenuto:

```ini
[Unit]
Description=Golden Room Update Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/ubuntu/app
EnvironmentFile=/home/ubuntu/app/.env
ExecStart=/usr/bin/node /home/ubuntu/app/scripts/update-server.js
Restart=always
RestartSec=5
User=ubuntu

[Install]
WantedBy=multi-user.target
```

Abilita e avvia:

```bash
sudo systemctl daemon-reload
sudo systemctl enable golden-room-updater
sudo systemctl start golden-room-updater
sudo systemctl status golden-room-updater
```

### 4. Permessi sudo per restart servizi

L'updater gira come `ubuntu` ma deve riavviare golden-room e nginx.
Configura sudoers con i permessi minimi necessari:

```bash
sudo visudo
```

Aggiungi **esattamente** questa riga:

```
ubuntu ALL=NOPASSWD: /bin/systemctl restart golden-room, /bin/systemctl reload nginx, /usr/sbin/nginx -t
```

### 5. Configura Nginx (proxy verso update server)

Aggiungi al virtual host di gamespark.it:

```nginx
location /update-api/ {
    proxy_pass          http://127.0.0.1:3099;
    proxy_http_version  1.1;
    proxy_set_header    Connection '';
    proxy_buffering     off;
    proxy_cache         off;
    proxy_read_timeout  600s;
    client_max_body_size 110m;
}
```

Ricarica:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## Utilizzo dal pannello Admin

1. Vai su **Admin → Aggiornamenti**
2. **Dominio app**: `https://gamespark.it` ← solo il dominio, senza `/update-api`
3. **Token Admin**: il valore di `UPDATE_ADMIN_TOKEN` nel `.env`
4. Carica lo ZIP (parziale o completo)
5. Premi **Installa Aggiornamento**
6. Osserva il log in tempo reale

---

## File sempre protetti (mai sovrascritti dallo ZIP)

| File | Motivo |
|------|--------|
| `.env` | Credenziali e chiavi API |
| `supabase/config.toml` | Configurazione Supabase |
| `supabase/functions/send-confirmation-email/index.ts` | Edge function email |

---

## Cosa NON aggiornare dal pannello

Gli ZIP non possono contenere file `.sh`. Questa è una scelta di sicurezza intenzionale:
uno script bash arbitrario nello zip potrebbe eseguire qualsiasi comando sul server.

Per aggiornare `update-from-zip.sh` o `update-server.js` usa SSH direttamente:

```bash
scp scripts/update-from-zip.sh ubuntu@gamespark.it:/home/ubuntu/app/scripts/
```

---

## Rollback automatico

Se la build fallisce o lo script si interrompe per qualsiasi motivo:
1. Tutti i file vengono ripristinati dalla versione precedente
2. golden-room viene riavviato con la versione precedente
3. L'errore viene mostrato nel log del pannello

I backup sono in `/home/ubuntu/app-backups/` (ultimi 5 mantenuti automaticamente).


## ZIP caricati dal pannello: cosa viene bloccato

Gli ZIP caricati dal pannello admin non possono contenere la cartella `scripts/`.
Questo è intenzionale: `scripts/update-server.js`, `scripts/update-from-zip.sh` e gli altri script server possono modificare file e riavviare servizi, quindi vanno aggiornati solo manualmente via SSH/Git.

Gli ZIP dal pannello possono essere:

- parziali, con soli file sorgente modificati, per esempio `app/src/routes/admin.tsx`;
- completi, con `package.json`, ma sempre senza `.env`, `.git/`, `dist/`, `node_modules/` e `scripts/`.
