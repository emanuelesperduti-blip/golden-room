import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Shield,
  Users,
  Ticket,
  Sparkles,
  Activity,
  Crown,
  ArrowLeftRight,
  BarChart3,
  Bot,
  UserRound,
  SlidersHorizontal,
  MessageSquareText,
  Rabbit,
  Zap,
  AlertCircle,
  Bell,
  Wrench,
  TrendingUp,
  FileText,
  Trash2,
  Plus,
  Edit2,
  Ban,
  RotateCcw,
  Send,
  X,
  ChevronDown,
  UploadCloud,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { MobileShell } from "@/components/game/MobileShell";
import { useAuth } from "@/hooks/useAuth";
import { useViewerGameState } from "@/hooks/useViewerGameState";
import {
  getControlledRoomPopulation,
  getDefaultBotConfig,
  isAdminUser,
  readBotConfig,
  saveBotConfig,
  type BotRoomConfig,
  type BotRoomConfigMap,
  type ChatPace,
  type ReactionSpeed,
} from "@/lib/admin";
import { ROOMS, getRoomTimeline } from "@/lib/rooms";
import { useAdminStore, type UserProfile, type ActivityLog } from "@/lib/adminStore";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "GameSpark — Admin" },
      { name: "description", content: "Pannello admin completo per Golden Room." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user } = useAuth();
  const { sparks, tickets, bingosWon } = useViewerGameState();
  const allowed = isAdminUser(user);
  const [now, setNow] = useState(() => Date.now());
  const [botConfig, setBotConfig] = useState<BotRoomConfigMap>(() => readBotConfig());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  const [activeTab, setActiveTab] = useState<"dashboard" | "currencies" | "rooms" | "users" | "leaderboard" | "notifications" | "maintenance" | "events" | "logs" | "email" | "update">("dashboard");

  // Admin store
  const {
    currencyConfig,
    setCurrencyConfig,
    roomConfigs,
    setRoomConfig,
    users,
    addUser,
    updateUser,
    banUser,
    unbanUser,
    assignCreditsToUser,
    assignCreditsToAll,
    resetUserProfile,
    winRecords,
    addWinRecord,
    getTopUsersBySparks,
    getTopUsersByWins,
    notifications,
    addNotification,
    removeNotification,
    getActiveNotifications,
    maintenance,
    setMaintenance,
    toggleMaintenance,
    eventMultipliers,
    addEventMultiplier,
    updateEventMultiplier,
    removeEventMultiplier,
    getActiveMultipliers,
    activityLogs,
    addActivityLog,
    getActivityLogs,
  } = useAdminStore();

  useEffect(() => {
    saveBotConfig(botConfig);
  }, [botConfig]);

  const roomsState = useMemo(
    () =>
      ROOMS.map((room) => {
        const timeline = getRoomTimeline(room, now);
        const controlled = getControlledRoomPopulation(room, now);

        return {
          room,
          timeline,
          realUsers: controlled.realUsers,
          bots: controlled.bots,
          roomConfig: botConfig[room.id] ?? controlled.config,
        };
      }),
    [now, botConfig]
  );

  const realUsersNow = roomsState.reduce((sum, entry) => sum + entry.realUsers, 0);
  const activeBots = roomsState.reduce((sum, entry) => sum + entry.bots, 0);
  const connectedNow = realUsersNow + activeBots;
  const activeGames = roomsState.filter((entry) => entry.timeline.phase === "playing").length;
  const ticketsSoldToday = roomsState.reduce((sum, entry) => sum + (entry.realUsers + entry.bots) * Math.max(1, entry.room.ticketCost), 0);
  const sparksDistributed = roomsState.reduce((sum, entry) => sum + entry.room.sparkReward * Math.max(1, entry.realUsers + entry.bots), 0);

  const activityBars = Array.from({ length: 8 }, (_, index) => {
    const base = connectedNow + sparks + tickets + bingosWon * 3;
    const value = 28 + ((base + index * 11) % 64);
    return { label: `${index * 3}h`, value };
  });

  function updateRoomConfig(roomId: string, patch: Partial<BotRoomConfig>) {
    setBotConfig((prev) => ({
      ...prev,
      [roomId]: {
        ...(prev[roomId] ?? getDefaultBotConfig()[roomId]),
        ...patch,
      },
    }));
  }

  if (!allowed) {
    return (
      <MobileShell>
        <div className="px-4 pb-24 pt-5">
          <div className="rounded-3xl border border-red-400/25 bg-[linear-gradient(180deg,rgba(70,0,20,0.65),rgba(15,5,20,0.92))] p-5 text-center shadow-card-game">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-200">
              <Shield className="h-7 w-7" />
            </div>
            <p className="mt-4 text-xl font-black text-white">Accesso non autorizzato</p>
            <p className="mt-2 text-sm font-semibold text-white/65">Questa sezione è disponibile solo per l&apos;account admin del sito.</p>
            <Link to="/profile" className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-extrabold text-white">
              <ArrowLeftRight className="h-4 w-4" />
              Torna al profilo
            </Link>
          </div>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <div className="px-4 pb-24 pt-5">
        {/* Header */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[32px] border border-gold/20 bg-[linear-gradient(155deg,rgba(45,18,79,0.95),rgba(15,10,28,0.98))] p-5 shadow-card-game"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-gold">
                <Shield className="h-3.5 w-3.5" />
                Golden Room Admin
              </div>
              <h2 className="mt-3 text-2xl font-black text-white">Pannello di controllo</h2>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-white/60">Gestione completa: valute, room, utenti, eventi e manutenzione.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Ruolo</p>
              <p className="mt-1 text-sm font-extrabold text-gold">Admin</p>
            </div>
          </div>
        </motion.section>

        {/* Tab Navigation */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {[
            { id: "dashboard",     label: "Dashboard",      icon: BarChart3 },
            { id: "currencies",    label: "Valute",         icon: Sparkles },
            { id: "email",         label: "Email",          icon: Send },
            { id: "rooms",         label: "Room",           icon: SlidersHorizontal },
            { id: "users",         label: "Utenti",         icon: Users },
            { id: "leaderboard",   label: "Classifica",     icon: TrendingUp },
            { id: "notifications", label: "Notifiche",      icon: Bell },
            { id: "maintenance",   label: "Manutenzione",   icon: Wrench },
            { id: "events",        label: "Eventi",         icon: Zap },
            { id: "logs",          label: "Log",            icon: FileText },
            { id: "update",        label: "Aggiornamenti",  icon: UploadCloud },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold transition-all ${
                activeTab === id
                  ? "border border-gold/50 bg-gold/20 text-gold"
                  : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <>
            <section className="mt-4 grid grid-cols-2 gap-3">
              <KpiCard icon={<UserRound className="h-5 w-5" />} label="Utenti reali online" value={realUsersNow.toString()} accent="cyan" />
              <KpiCard icon={<Bot className="h-5 w-5" />} label="Bot attivi" value={activeBots.toString()} accent="violet" />
              <KpiCard icon={<Users className="h-5 w-5" />} label="Totale partecipanti" value={connectedNow.toString()} accent="gold" />
              <KpiCard icon={<Activity className="h-5 w-5" />} label="Partite attive" value={activeGames.toString()} accent="pink" />
            </section>

            <section className="mt-3 grid grid-cols-2 gap-3">
              <KpiCard icon={<Ticket className="h-5 w-5" />} label="Biglietti venduti oggi" value={ticketsSoldToday.toLocaleString("it-IT")} accent="gold" />
              <KpiCard icon={<Sparkles className="h-5 w-5" />} label="Spark distribuiti" value={sparksDistributed.toLocaleString("it-IT")} accent="pink" />
            </section>

            <section className="mt-4 rounded-[28px] border border-white/10 bg-card-game p-4 shadow-card-game">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">Attività ultime 24 ore</p>
                  <p className="mt-1 text-[11px] font-bold text-white/55">KPI live per il pannello admin</p>
                </div>
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/60">Live</span>
              </div>
              <div className="mt-4 flex h-36 items-end gap-2">
                {activityBars.map((bar) => (
                  <div key={bar.label} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-24 w-full items-end rounded-2xl bg-black/20 p-1.5">
                      <div
                        className="w-full rounded-xl bg-[linear-gradient(180deg,rgba(255,217,93,0.95),rgba(255,83,178,0.9),rgba(111,76,255,0.9))] shadow-[0_0_18px_rgba(255,83,178,0.28)]"
                        style={{ height: `${bar.value}%` }}
                      />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">{bar.label}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-4 rounded-[28px] border border-white/10 bg-card-game p-4 shadow-card-game">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-gold" />
                <p className="text-sm font-black text-white">Stato room</p>
              </div>
              <div className="mt-3 space-y-2.5">
                {roomsState.map(({ room, timeline, realUsers, bots }) => (
                  <div key={room.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-white">{room.name}</p>
                      <p className="mt-1 text-[11px] font-bold text-white/55">
                        {realUsers + bots} in sala · {realUsers} reali · {bots} bot · fase {phaseLabel(timeline.phase)}
                      </p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/65">
                      {room.tier}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* Step 5: Currencies Tab */}
        {activeTab === "currencies" && <CurrenciesTab currencyConfig={currencyConfig} setCurrencyConfig={setCurrencyConfig} assignCreditsToAll={assignCreditsToAll} addActivityLog={addActivityLog} />}

        {activeTab === "email" && <EmailSettingsTab addActivityLog={addActivityLog} />}

        {/* Step 6: Rooms Tab */}
        {activeTab === "rooms" && (
          <RoomsTab
            roomsState={roomsState}
            botConfig={botConfig}
            updateRoomConfig={updateRoomConfig}
            roomConfigs={roomConfigs}
            setRoomConfig={setRoomConfig}
            addActivityLog={addActivityLog}
          />
        )}

        {/* Step 7: Users Tab */}
        {activeTab === "users" && (
          <UsersTab
            users={users}
            addUser={addUser}
            updateUser={updateUser}
            banUser={banUser}
            unbanUser={unbanUser}
            assignCreditsToUser={assignCreditsToUser}
            resetUserProfile={resetUserProfile}
            addActivityLog={addActivityLog}
          />
        )}

        {/* Step 8: Leaderboard Tab */}
        {activeTab === "leaderboard" && (
          <LeaderboardTab
            users={users}
            winRecords={winRecords}
            getTopUsersBySparks={getTopUsersBySparks}
            getTopUsersByWins={getTopUsersByWins}
          />
        )}

        {/* Step 9: Notifications Tab */}
        {activeTab === "notifications" && (
          <NotificationsTab
            notifications={notifications}
            addNotification={addNotification}
            removeNotification={removeNotification}
            addActivityLog={addActivityLog}
          />
        )}

        {/* Step 10: Maintenance Tab */}
        {activeTab === "maintenance" && (
          <MaintenanceTab
            maintenance={maintenance}
            setMaintenance={setMaintenance}
            toggleMaintenance={toggleMaintenance}
            addActivityLog={addActivityLog}
          />
        )}

        {/* Step 11: Events Tab */}
        {activeTab === "events" && (
          <EventsTab
            eventMultipliers={eventMultipliers}
            addEventMultiplier={addEventMultiplier}
            updateEventMultiplier={updateEventMultiplier}
            removeEventMultiplier={removeEventMultiplier}
            addActivityLog={addActivityLog}
          />
        )}

        {/* Step 12: Logs Tab */}
        {activeTab === "logs" && <LogsTab activityLogs={activityLogs} getActivityLogs={getActivityLogs} />}
        {activeTab === "update" && <UpdateTab />}

        {/* Bot Management Section */}
        <section className="mt-4 rounded-[28px] border border-white/10 bg-card-game p-4 shadow-card-game">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-gold" />
            <p className="text-sm font-black text-white">Gestione bot per room</p>
          </div>
          <p className="mt-1 text-[11px] font-bold text-white/55">Configura quantità bot, frequenza chat e velocità di reazione per ogni room.</p>
          <div className="mt-3 space-y-3">
            {roomsState.map(({ room, roomConfig }) => (
              <div key={room.id} className="rounded-3xl border border-white/8 bg-black/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-white">{room.name}</p>
                    <p className="mt-1 text-[11px] font-bold text-white/50">I bot vincono solo per fortuna su cartelle reali. Nessun vantaggio speciale.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateRoomConfig(room.id, { enabled: !roomConfig.enabled })}
                    className={`rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] ${
                      roomConfig.enabled ? "border border-emerald-300/25 bg-emerald-400/15 text-emerald-100" : "border border-white/10 bg-white/5 text-white/50"
                    }`}
                  >
                    {roomConfig.enabled ? "Bot ON" : "Bot OFF"}
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3">
                  <label className="block">
                    <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-white/60">
                      <span className="inline-flex items-center gap-1.5">
                        <Bot className="h-3.5 w-3.5" /> Bot attivi
                      </span>
                      <span>{roomConfig.enabled ? roomConfig.botCount : 0}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={50}
                      value={roomConfig.botCount}
                      disabled={!roomConfig.enabled}
                      onChange={(e) => updateRoomConfig(room.id, { botCount: Number(e.target.value) })}
                      className="w-full accent-yellow-400 disabled:opacity-40"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block rounded-2xl border border-white/8 bg-white/5 p-2.5">
                      <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-white/60">
                        <MessageSquareText className="h-3.5 w-3.5" /> Chat
                      </div>
                      <select
                        value={roomConfig.chatPace}
                        disabled={!roomConfig.enabled}
                        onChange={(e) => updateRoomConfig(room.id, { chatPace: e.target.value as ChatPace })}
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-xs font-bold text-white outline-none disabled:opacity-40"
                      >
                        <option value="bassa">Bassa</option>
                        <option value="media">Media</option>
                        <option value="alta">Alta</option>
                      </select>
                    </label>

                    <label className="block rounded-2xl border border-white/8 bg-white/5 p-2.5">
                      <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-white/60">
                        <Rabbit className="h-3.5 w-3.5" /> Reazione
                      </div>
                      <select
                        value={roomConfig.reactionSpeed}
                        disabled={!roomConfig.enabled}
                        onChange={(e) => updateRoomConfig(room.id, { reactionSpeed: e.target.value as ReactionSpeed })}
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-xs font-bold text-white outline-none disabled:opacity-40"
                      >
                        <option value="lenta">Lenta</option>
                        <option value="normale">Normale</option>
                        <option value="rapida">Rapida</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-[28px] border border-dashed border-gold/30 bg-[linear-gradient(180deg,rgba(245,180,0,0.08),rgba(20,12,30,0.72))] p-4 text-center shadow-card-game">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-shine text-purple-deep shadow-button-gold">
            <Crown className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-black text-white">Pannello Admin Completo</p>
          <p className="mt-1 text-[11px] font-bold leading-relaxed text-white/60">
            Step 5-12 implementati: valute, room, utenti, classifica, notifiche, manutenzione, eventi e log attività.
          </p>
        </section>
      </div>
    </MobileShell>
  );
}

function EmailSettingsTab({ addActivityLog }: { addActivityLog: (log: any) => void }) {
  const [fromEmail, setFromEmail] = useState(() => localStorage.getItem("gamespark-sendgrid-from-email") || "noreply@gamespark.app");
  const [fromName, setFromName] = useState(() => localStorage.getItem("gamespark-sendgrid-from-name") || "Golden Room");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("gamespark-sendgrid-api-key") || "");
  const [templateId, setTemplateId] = useState(() => localStorage.getItem("gamespark-sendgrid-template-id") || "");
  const [functionUrl, setFunctionUrl] = useState(() => localStorage.getItem("gamespark-sendgrid-function-url") || "");

  const save = () => {
    localStorage.setItem("gamespark-sendgrid-from-email", fromEmail.trim());
    localStorage.setItem("gamespark-sendgrid-from-name", fromName.trim());
    localStorage.setItem("gamespark-sendgrid-api-key", apiKey.trim());
    localStorage.setItem("gamespark-sendgrid-template-id", templateId.trim());
    localStorage.setItem("gamespark-sendgrid-function-url", functionUrl.trim());
    addActivityLog({ type: "admin_action", details: { action: "save_sendgrid_settings", fromEmail, templateIdConfigured: !!templateId, functionUrlConfigured: !!functionUrl }, severity: "info" });
  };

  return (
    <section className="mt-4 space-y-4">
      <div className="rounded-[28px] border border-white/10 bg-card-game p-4 shadow-card-game">
        <div className="flex items-center gap-2 mb-4">
          <Send className="h-5 w-5 text-gold" />
          <p className="text-sm font-black text-white">SendGrid Email</p>
        </div>
        <p className="mb-4 text-xs font-semibold leading-relaxed text-white/55">
          Impostazioni per inviare email di conferma dal dominio reale invece dei link Lovable. In produzione usa la funzione interna / Supabase Edge Function e salva la API key come secret server-side.
        </p>
        <div className="grid grid-cols-1 gap-3">
          <label className="block"><p className="text-xs font-bold text-white/60 mb-2">Mittente email</p><input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none" /></label>
          <label className="block"><p className="text-xs font-bold text-white/60 mb-2">Nome mittente</p><input value={fromName} onChange={(e) => setFromName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none" /></label>
          <label className="block"><p className="text-xs font-bold text-white/60 mb-2">SendGrid API key</p><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="SG.xxxxx" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none" /></label>
          <label className="block"><p className="text-xs font-bold text-white/60 mb-2">Template ID conferma email</p><input value={templateId} onChange={(e) => setTemplateId(e.target.value)} placeholder="d-xxxxxxxx" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none" /></label>
          <label className="block"><p className="text-xs font-bold text-white/60 mb-2">Endpoint API interna</p><input value={functionUrl} onChange={(e) => setFunctionUrl(e.target.value)} placeholder="/functions/v1/send-confirmation-email" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none" /></label>
          <button onClick={save} className="mt-2 w-full rounded-2xl border border-gold/50 bg-gold/20 px-4 py-2 text-sm font-extrabold text-gold hover:bg-gold/30 transition-all">Salva impostazioni SendGrid</button>
        </div>
      </div>
    </section>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// STEP 5: Currencies Tab Component
// ─────────────────────────────────────────────────────────────────────────────

function CurrenciesTab({
  currencyConfig,
  setCurrencyConfig,
  assignCreditsToAll,
  addActivityLog,
}: {
  currencyConfig: any;
  setCurrencyConfig: (config: any) => void;
  assignCreditsToAll: (sparks: number, tickets: number, coins: number) => void;
  addActivityLog: (log: any) => void;
}) {
  const [sparksInput, setSparksInput] = useState("0");
  const [ticketsInput, setTicketsInput] = useState("0");

  const handleAssignAll = () => {
    const sparks = parseInt(sparksInput) || 0;
    const tickets = parseInt(ticketsInput) || 0;
    assignCreditsToAll(sparks, tickets, 0);
    addActivityLog({
      type: "admin_action",
      details: { action: "assign_credits_all", sparks, tickets },
      severity: "info",
    });

    setSparksInput("0");
    setTicketsInput("0");
  };

  return (
    <section className="mt-4 space-y-4">
      <div className="rounded-[28px] border border-white/10 bg-card-game p-4 shadow-card-game">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-gold" />
          <p className="text-sm font-black text-white">Configurazione valute</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <label className="block">
            <p className="text-xs font-bold text-white/60 mb-2">Valore Spark</p>
            <input
              type="number"
              value={currencyConfig.sparkValue}
              onChange={(e) => setCurrencyConfig({ sparkValue: Number(e.target.value) })}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none"
            />
          </label>

          <label className="block">
            <p className="text-xs font-bold text-white/60 mb-2">Valore Ticket</p>
            <input
              type="number"
              value={currencyConfig.ticketValue}
              onChange={(e) => setCurrencyConfig({ ticketValue: Number(e.target.value) })}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none"
            />
          </label>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-card-game p-4 shadow-card-game">
        <p className="text-sm font-black text-white mb-4">Assegna crediti a tutti gli utenti</p>

        <div className="grid grid-cols-1 gap-3">
          <label className="block">
            <p className="text-xs font-bold text-white/60 mb-2">Spark da aggiungere</p>
            <input
              type="number"
              value={sparksInput}
              onChange={(e) => setSparksInput(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none"
            />
          </label>

          <label className="block">
            <p className="text-xs font-bold text-white/60 mb-2">Ticket da aggiungere</p>
            <input
              type="number"
              value={ticketsInput}
              onChange={(e) => setTicketsInput(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none"
            />
          </label>

          <button
            onClick={handleAssignAll}
            className="mt-2 w-full rounded-2xl border border-gold/50 bg-gold/20 px-4 py-2 text-sm font-extrabold text-gold hover:bg-gold/30 transition-all"
          >
            Assegna a tutti
          </button>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6: Rooms Tab Component
// ─────────────────────────────────────────────────────────────────────────────

function RoomsTab({
  roomsState,
  botConfig,
  updateRoomConfig,
  roomConfigs,
  setRoomConfig,
  addActivityLog,
}: {
  roomsState: any[];
  botConfig: any;
  updateRoomConfig: (roomId: string, config: any) => void;
  roomConfigs: any;
  setRoomConfig: (roomId: string, config: any) => void;
  addActivityLog: (log: any) => void;
}) {
  return (
    <section className="mt-4 space-y-4">
      {roomsState.map(({ room }) => {
        const bc = botConfig[room.id] ?? { enabled: true, botCount: 5, chatPace: "media", reactionSpeed: "normale" };
        return (
          <div key={room.id} className="rounded-[28px] border border-white/10 bg-card-game p-4 shadow-card-game">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-black text-white">{room.name}</p>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] ${bc.enabled ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-200" : "border-red-300/30 bg-red-400/10 text-red-200"}`}>
                Bot {bc.enabled ? "ON" : "OFF"}
              </span>
            </div>

            {/* ── Configurazione Room ── */}
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/40 mb-2">Parametri room</p>
            <div className="grid grid-cols-1 gap-3 mb-5">
              <label className="block">
                <p className="text-xs font-bold text-white/60 mb-2">Durata countdown (secondi)</p>
                <input
                  type="number"
                  defaultValue={room.waitingSec}
                  onChange={(e) => {
                    setRoomConfig(room.id, { countdownDuration: Number(e.target.value) });
                    addActivityLog({ type: "admin_action", roomId: room.id, details: { action: "update_room_countdown", value: Number(e.target.value) }, severity: "info" });
                  }}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none"
                />
              </label>

              <label className="block">
                <p className="text-xs font-bold text-white/60 mb-2">Durata partita (secondi)</p>
                <input
                  type="number"
                  defaultValue={room.playingSec}
                  onChange={(e) => {
                    setRoomConfig(room.id, { gameDuration: Number(e.target.value) });
                    addActivityLog({ type: "admin_action", roomId: room.id, details: { action: "update_room_duration", value: Number(e.target.value) }, severity: "info" });
                  }}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none"
                />
              </label>

              <label className="block">
                <p className="text-xs font-bold text-white/60 mb-2">Costo cartella (ticket)</p>
                <input
                  type="number"
                  defaultValue={room.ticketCost}
                  onChange={(e) => {
                    setRoomConfig(room.id, { ticketCost: Number(e.target.value) });
                    addActivityLog({ type: "admin_action", roomId: room.id, details: { action: "update_ticket_cost", value: Number(e.target.value) }, severity: "info" });
                  }}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none"
                />
              </label>

              <label className="block">
                <p className="text-xs font-bold text-white/60 mb-2">Premio Spark</p>
                <input
                  type="number"
                  defaultValue={room.sparkReward}
                  onChange={(e) => {
                    setRoomConfig(room.id, { sparkReward: Number(e.target.value) });
                    addActivityLog({ type: "admin_action", roomId: room.id, details: { action: "update_spark_reward", value: Number(e.target.value) }, severity: "info" });
                  }}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none"
                />
              </label>
            </div>

            {/* ── Configurazione Bot ── */}
            <div className="rounded-2xl border border-white/8 bg-black/20 p-3 space-y-3">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/40">Configurazione bot</p>

              {/* Enabled toggle */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-white">Bot attivi</p>
                  <p className="text-[11px] font-bold text-white/50">Abilita/disabilita bot per questa room</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    updateRoomConfig(room.id, { enabled: !bc.enabled });
                    addActivityLog({ type: "admin_action", roomId: room.id, details: { action: "toggle_bots", enabled: !bc.enabled }, severity: "info" });
                  }}
                  className={`relative h-7 w-12 rounded-full border transition-all ${bc.enabled ? "border-emerald-400/60 bg-emerald-500/30" : "border-white/15 bg-white/10"}`}
                >
                  <span className={`absolute top-0.5 h-6 w-6 rounded-full transition-all shadow ${bc.enabled ? "left-5 bg-emerald-400" : "left-0.5 bg-white/40"}`} />
                </button>
              </div>

              {/* Bot count */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-white">Numero bot</p>
                  <span className="rounded-full border border-white/15 bg-black/20 px-2 py-0.5 text-xs font-extrabold text-gold">{bc.botCount}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={bc.botCount}
                  disabled={!bc.enabled}
                  onChange={(e) => {
                    updateRoomConfig(room.id, { botCount: Number(e.target.value) });
                    addActivityLog({ type: "admin_action", roomId: room.id, details: { action: "update_bot_count", value: Number(e.target.value) }, severity: "info" });
                  }}
                  className="w-full accent-yellow-400 disabled:opacity-40"
                />
                <div className="flex justify-between text-[10px] font-bold text-white/35 mt-1">
                  <span>0</span><span>25</span><span>50</span>
                </div>
              </div>

              {/* Chat pace */}
              <div>
                <p className="text-xs font-bold text-white mb-2">Frequenza chat bot</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["bassa", "media", "alta"] as const).map((pace) => (
                    <button
                      key={pace}
                      type="button"
                      disabled={!bc.enabled}
                      onClick={() => {
                        updateRoomConfig(room.id, { chatPace: pace });
                        addActivityLog({ type: "admin_action", roomId: room.id, details: { action: "update_chat_pace", value: pace }, severity: "info" });
                      }}
                      className={`rounded-xl border py-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] transition-all disabled:opacity-40 ${bc.chatPace === pace ? "border-gold/50 bg-gold/20 text-gold" : "border-white/10 bg-white/5 text-white/55"}`}
                    >
                      {pace}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reaction speed */}
              <div>
                <p className="text-xs font-bold text-white mb-2">Velocità reazione bot</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["lenta", "normale", "rapida"] as const).map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      disabled={!bc.enabled}
                      onClick={() => {
                        updateRoomConfig(room.id, { reactionSpeed: speed });
                        addActivityLog({ type: "admin_action", roomId: room.id, details: { action: "update_reaction_speed", value: speed }, severity: "info" });
                      }}
                      className={`rounded-xl border py-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] transition-all disabled:opacity-40 ${bc.reactionSpeed === speed ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/5 text-white/55"}`}
                    >
                      {speed}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live preview */}
              <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/40 mb-1">Stato effettivo in lobby</p>
                <p className="text-xs font-bold text-white">
                  {bc.enabled ? `${bc.botCount} bot attivi` : "Nessun bot"} · chat {bc.chatPace} · reazione {bc.reactionSpeed}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 7: Users Tab Component
// ─────────────────────────────────────────────────────────────────────────────

function UsersTab({
  users,
  addUser,
  updateUser,
  banUser,
  unbanUser,
  assignCreditsToUser,
  resetUserProfile,
  addActivityLog,
}: {
  users: Record<string, any>;
  addUser: (user: any) => void;
  updateUser: (userId: string, updates: any) => void;
  banUser: (userId: string, reason: string) => void;
  unbanUser: (userId: string) => void;
  assignCreditsToUser: (userId: string, sparks: number, tickets: number, coins: number) => void;
  resetUserProfile: (userId: string) => void;
  addActivityLog: (log: any) => void;
}) {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const userList = Object.values(users);

  return (
    <section className="mt-4 space-y-4">
      <div className="rounded-[28px] border border-white/10 bg-card-game p-4 shadow-card-game">
        <p className="text-sm font-black text-white mb-4">Utenti registrati ({userList.length})</p>

        <div className="space-y-2">
          {userList.map((user) => (
            <div
              key={user.id}
              onClick={() => setSelectedUser(selectedUser === user.id ? null : user.id)}
              className={`rounded-2xl border p-3 cursor-pointer transition-all ${
                selectedUser === user.id
                  ? "border-gold/50 bg-gold/10"
                  : "border-white/10 bg-black/20 hover:bg-black/30"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{user.username}</p>
                  <p className="text-xs text-white/50 truncate">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {user.isBanned && <Ban className="h-4 w-4 text-red-400" />}
                  <ChevronDown className={`h-4 w-4 text-white/50 transition-transform ${selectedUser === user.id ? "rotate-180" : ""}`} />
                </div>
              </div>

              {selectedUser === user.id && (
                <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-white/60">Spark</p>
                      <p className="font-bold text-white">{user.sparks}</p>
                    </div>
                    <div>
                      <p className="text-white/60">Ticket</p>
                      <p className="font-bold text-white">{user.tickets}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-white/60">Partite</p>
                      <p className="font-bold text-white">{user.gamesPlayed}</p>
                    </div>
                    <div>
                      <p className="text-white/60">Vittorie</p>
                      <p className="font-bold text-white">{user.wins}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    {!user.isBanned ? (
                      <button
                        onClick={() => {
                          banUser(user.id, "Admin ban");
                          addActivityLog({
                            type: "ban",
                            userId: user.id,
                            username: user.username,
                            details: { action: "ban_user" },
                            severity: "warning",
                          });
                        }}
                        className="flex-1 rounded-lg border border-red-400/50 bg-red-500/10 px-2 py-1 text-xs font-bold text-red-300 hover:bg-red-500/20"
                      >
                        <Ban className="h-3 w-3 inline mr-1" /> Ban
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          unbanUser(user.id);
                          addActivityLog({
                            type: "admin_action",
                            userId: user.id,
                            username: user.username,
                            details: { action: "unban_user" },
                            severity: "info",
                          });
                        }}
                        className="flex-1 rounded-lg border border-green-400/50 bg-green-500/10 px-2 py-1 text-xs font-bold text-green-300 hover:bg-green-500/20"
                      >
                        Sblocca
                      </button>
                    )}

                    <button
                      onClick={() => {
                        resetUserProfile(user.id);
                        addActivityLog({
                          type: "admin_action",
                          userId: user.id,
                          username: user.username,
                          details: { action: "reset_profile" },
                          severity: "warning",
                        });
                      }}
                      className="flex-1 rounded-lg border border-yellow-400/50 bg-yellow-500/10 px-2 py-1 text-xs font-bold text-yellow-300 hover:bg-yellow-500/20"
                    >
                      <RotateCcw className="h-3 w-3 inline mr-1" /> Reset
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {userList.length === 0 && (
            <p className="text-xs text-white/50 text-center py-4">Nessun utente registrato</p>
          )}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 8: Leaderboard Tab Component
// ─────────────────────────────────────────────────────────────────────────────

function LeaderboardTab({
  users,
  winRecords,
  getTopUsersBySparks,
  getTopUsersByWins,
}: {
  users: Record<string, any>;
  winRecords: any[];
  getTopUsersBySparks: (limit: number) => any[];
  getTopUsersByWins: (limit: number) => any[];
}) {
  const topBySparks = getTopUsersBySparks(10);
  const topByWins = getTopUsersByWins(10);
  const recentWins = winRecords.slice(0, 20);

  return (
    <section className="mt-4 space-y-4">
      <div className="rounded-[28px] border border-white/10 bg-card-game p-4 shadow-card-game">
        <p className="text-sm font-black text-white mb-4">Top 10 per Spark</p>
        <div className="space-y-2">
          {topBySparks.map((user, index) => (
            <div key={user.id} className="flex items-center justify-between rounded-lg border border-white/8 bg-black/20 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gold w-6">{index + 1}.</span>
                <div>
                  <p className="text-xs font-bold text-white">{user.username}</p>
                  <p className="text-[10px] text-white/50">{user.email}</p>
                </div>
              </div>
              <p className="text-sm font-extrabold text-gold">{user.sparks}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-card-game p-4 shadow-card-game">
        <p className="text-sm font-black text-white mb-4">Top 10 per Vittorie</p>
        <div className="space-y-2">
          {topByWins.map((user, index) => (
            <div key={user.id} className="flex items-center justify-between rounded-lg border border-white/8 bg-black/20 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gold w-6">{index + 1}.</span>
                <div>
                  <p className="text-xs font-bold text-white">{user.username}</p>
                  <p className="text-[10px] text-white/50">{user.email}</p>
                </div>
              </div>
              <p className="text-sm font-extrabold text-gold">{user.wins}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-card-game p-4 shadow-card-game">
        <p className="text-sm font-black text-white mb-4">Ultime vincite ({recentWins.length})</p>
        <div className="space-y-2">
          {recentWins.map((win) => (
            <div key={win.id} className="flex items-center justify-between rounded-lg border border-white/8 bg-black/20 px-3 py-2">
              <div>
                <p className="text-xs font-bold text-white">{win.username}</p>
                <p className="text-[10px] text-white/50">{win.roomName}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gold">+{win.sparkReward} Spark</p>
                {win.ticketReward > 0 && <p className="text-[10px] text-white/50">+{win.ticketReward} Ticket</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 9: Notifications Tab Component
// ─────────────────────────────────────────────────────────────────────────────

function NotificationsTab({
  notifications,
  addNotification,
  removeNotification,
  addActivityLog,
}: {
  notifications: any[];
  addNotification: (notification: any) => void;
  removeNotification: (id: string) => void;
  addActivityLog: (log: any) => void;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"banner" | "popup" | "temporary">("banner");
  const [duration, setDuration] = useState("5000");

  const handleCreate = () => {
    if (!title || !message) return;

    addNotification({
      title,
      message,
      type,
      displayDuration: parseInt(duration),
      isActive: true,
    });

    addActivityLog({
      type: "admin_action",
      details: { action: "create_notification", title, message, type },
      severity: "info",
    });

    setTitle("");
    setMessage("");
    setType("banner");
    setDuration("5000");
  };

  return (
    <section className="mt-4 space-y-4">
      <div className="rounded-[28px] border border-white/10 bg-card-game p-4 shadow-card-game">
        <p className="text-sm font-black text-white mb-4">Crea nuova notifica</p>

        <div className="space-y-3">
          <label className="block">
            <p className="text-xs font-bold text-white/60 mb-2">Titolo</p>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="es. Evento doppio Spark"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white placeholder-white/30 outline-none"
            />
          </label>

          <label className="block">
            <p className="text-xs font-bold text-white/60 mb-2">Messaggio</p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="es. Stasera dalle 21:00 doppio Spark su tutte le room!"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white placeholder-white/30 outline-none resize-none h-20"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <p className="text-xs font-bold text-white/60 mb-2">Tipo</p>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none"
              >
                <option value="banner">Banner</option>
                <option value="popup">Popup</option>
                <option value="temporary">Temporaneo</option>
              </select>
            </label>

            <label className="block">
              <p className="text-xs font-bold text-white/60 mb-2">Durata (ms)</p>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none"
              />
            </label>
          </div>

          <button
            onClick={handleCreate}
            className="w-full rounded-2xl border border-gold/50 bg-gold/20 px-4 py-2 text-sm font-extrabold text-gold hover:bg-gold/30 transition-all"
          >
            <Send className="h-4 w-4 inline mr-2" /> Invia notifica
          </button>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-card-game p-4 shadow-card-game">
        <p className="text-sm font-black text-white mb-4">Notifiche attive ({notifications.length})</p>

        <div className="space-y-2">
          {notifications.map((notif) => (
            <div key={notif.id} className="flex items-start justify-between gap-3 rounded-lg border border-white/8 bg-black/20 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{notif.title}</p>
                <p className="text-[10px] text-white/50 line-clamp-2">{notif.message}</p>
                <p className="text-[10px] text-white/40 mt-1">{notif.type}</p>
              </div>
              <button
                onClick={() => removeNotification(notif.id)}
                className="rounded-lg border border-red-400/50 bg-red-500/10 p-1.5 text-red-300 hover:bg-red-500/20"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {notifications.length === 0 && (
            <p className="text-xs text-white/50 text-center py-4">Nessuna notifica</p>
          )}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 10: Maintenance Tab Component
// ─────────────────────────────────────────────────────────────────────────────

function MaintenanceTab({
  maintenance,
  setMaintenance,
  toggleMaintenance,
  addActivityLog,
}: {
  maintenance: any;
  setMaintenance: (config: any) => void;
  toggleMaintenance: (enabled: boolean) => void;
  addActivityLog: (log: any) => void;
}) {
  return (
    <section className="mt-4 space-y-4">
      <div className="rounded-[28px] border border-white/10 bg-card-game p-4 shadow-card-game">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-gold" />
            <p className="text-sm font-black text-white">Modalità manutenzione</p>
          </div>
          <button
            onClick={() => {
              toggleMaintenance(!maintenance.isEnabled);
              addActivityLog({
                type: "admin_action",
                details: { action: "toggle_maintenance", enabled: !maintenance.isEnabled },
                severity: "warning",
              });
            }}
            className={`rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] ${
              maintenance.isEnabled
                ? "border border-red-300/25 bg-red-400/15 text-red-100"
                : "border border-white/10 bg-white/5 text-white/50"
            }`}
          >
            {maintenance.isEnabled ? "ON" : "OFF"}
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <p className="text-xs font-bold text-white/60 mb-2">Titolo</p>
            <input
              type="text"
              value={maintenance.title}
              onChange={(e) => setMaintenance({ title: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none"
            />
          </label>

          <label className="block">
            <p className="text-xs font-bold text-white/60 mb-2">Messaggio</p>
            <textarea
              value={maintenance.message}
              onChange={(e) => setMaintenance({ message: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none resize-none h-20"
            />
          </label>

          <label className="block">
            <p className="text-xs font-bold text-white/60 mb-2">Orario previsto ritorno online</p>
            <input
              type="datetime-local"
              defaultValue={new Date(maintenance.estimatedReturnTime).toISOString().slice(0, 16)}
              onChange={(e) => setMaintenance({ estimatedReturnTime: new Date(e.target.value).getTime() })}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none"
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={maintenance.allowAdminAccess}
              onChange={(e) => setMaintenance({ allowAdminAccess: e.target.checked })}
              className="w-4 h-4 rounded border-white/10 bg-black/30"
            />
            <p className="text-xs font-bold text-white/60">Consenti accesso admin durante manutenzione</p>
          </label>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 11: Events Tab Component
// ─────────────────────────────────────────────────────────────────────────────

function EventsTab({
  eventMultipliers,
  addEventMultiplier,
  updateEventMultiplier,
  removeEventMultiplier,
  addActivityLog,
}: {
  eventMultipliers: any[];
  addEventMultiplier: (event: any) => void;
  updateEventMultiplier: (id: string, updates: any) => void;
  removeEventMultiplier: (id: string) => void;
  addActivityLog: (log: any) => void;
}) {
  const [eventName, setEventName] = useState("");
  const [sparkMult, setSparkMult] = useState("2");
  const [ticketMult, setTicketMult] = useState("1");
  const [freeRoom, setFreeRoom] = useState(false);

  const handleCreate = () => {
    if (!eventName) return;

    const newEvent = {
      id: `event-${Date.now()}`,
      name: eventName,
      isActive: true,
      sparkMultiplier: parseFloat(sparkMult),
      ticketMultiplier: parseFloat(ticketMult),
      freeRoomEnabled: freeRoom,
      startTime: Date.now(),
      endTime: Date.now() + 3600000,
    };

    addEventMultiplier(newEvent);
    addActivityLog({
      type: "admin_action",
      details: { action: "create_event", eventName },
      severity: "info",
    });

    setEventName("");
    setSparkMult("2");
    setTicketMult("1");
    setFreeRoom(false);
  };

  return (
    <section className="mt-4 space-y-4">
      <div className="rounded-[28px] border border-white/10 bg-card-game p-4 shadow-card-game">
        <p className="text-sm font-black text-white mb-4">Crea nuovo evento</p>

        <div className="space-y-3">
          <label className="block">
            <p className="text-xs font-bold text-white/60 mb-2">Nome evento</p>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="es. Doppio Spark"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white placeholder-white/30 outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <p className="text-xs font-bold text-white/60 mb-2">Moltiplicatore Spark</p>
              <input
                type="number"
                step="0.1"
                value={sparkMult}
                onChange={(e) => setSparkMult(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none"
              />
            </label>

            <label className="block">
              <p className="text-xs font-bold text-white/60 mb-2">Moltiplicatore Ticket</p>
              <input
                type="number"
                step="0.1"
                value={ticketMult}
                onChange={(e) => setTicketMult(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none"
              />
            </label>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={freeRoom}
              onChange={(e) => setFreeRoom(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 bg-black/30"
            />
            <p className="text-xs font-bold text-white/60">Abilita room gratis temporanea</p>
          </label>

          <button
            onClick={handleCreate}
            className="w-full rounded-2xl border border-gold/50 bg-gold/20 px-4 py-2 text-sm font-extrabold text-gold hover:bg-gold/30 transition-all"
          >
            <Plus className="h-4 w-4 inline mr-2" /> Crea evento
          </button>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-card-game p-4 shadow-card-game">
        <p className="text-sm font-black text-white mb-4">Eventi attivi ({eventMultipliers.length})</p>

        <div className="space-y-2">
          {eventMultipliers.map((event) => (
            <div key={event.id} className="flex items-start justify-between gap-3 rounded-lg border border-white/8 bg-black/20 px-3 py-2">
              <div>
                <p className="text-xs font-bold text-white">{event.name}</p>
                <p className="text-[10px] text-white/50 mt-1">
                  {event.sparkMultiplier}x Spark · {event.ticketMultiplier}x Ticket
                  {event.freeRoomEnabled && " · Room gratis"}
                </p>
              </div>
              <button
                onClick={() => {
                  removeEventMultiplier(event.id);
                  addActivityLog({
                    type: "admin_action",
                    details: { action: "remove_event", eventName: event.name },
                    severity: "info",
                  });
                }}
                className="rounded-lg border border-red-400/50 bg-red-500/10 p-1.5 text-red-300 hover:bg-red-500/20"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}

          {eventMultipliers.length === 0 && (
            <p className="text-xs text-white/50 text-center py-4">Nessun evento attivo</p>
          )}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 12: Logs Tab Component
// ─────────────────────────────────────────────────────────────────────────────

function LogsTab({
  activityLogs,
  getActivityLogs,
}: {
  activityLogs: any[];
  getActivityLogs: (filters?: any) => any[];
}) {
  const [filterType, setFilterType] = useState<string>("");
  const logs = filterType ? getActivityLogs({ type: filterType }) : activityLogs;

  return (
    <section className="mt-4 space-y-4">
      <div className="rounded-[28px] border border-white/10 bg-card-game p-4 shadow-card-game">
        <p className="text-sm font-black text-white mb-4">Filtri</p>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none"
        >
          <option value="">Tutti gli eventi</option>
          <option value="purchase">Acquisti</option>
          <option value="win">Vittorie</option>
          <option value="admin_action">Azioni admin</option>
          <option value="ban">Ban</option>
          <option value="error">Errori</option>
        </select>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-card-game p-4 shadow-card-game">
        <p className="text-sm font-black text-white mb-4">Log attività ({logs.length})</p>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {logs.slice(0, 50).map((log) => (
            <div key={log.id} className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      log.severity === "error" ? "bg-red-500/20 text-red-300" :
                      log.severity === "warning" ? "bg-yellow-500/20 text-yellow-300" :
                      "bg-green-500/20 text-green-300"
                    }`}>
                      {log.type}
                    </span>
                    <p className="text-[10px] text-white/50">{new Date(log.timestamp).toLocaleTimeString("it-IT")}</p>
                  </div>
                  {log.username && <p className="text-xs font-bold text-white mt-1">{log.username}</p>}
                  <p className="text-[10px] text-white/50 mt-0.5">{JSON.stringify(log.details).slice(0, 60)}...</p>
                </div>
              </div>
            </div>
          ))}

          {logs.length === 0 && (
            <p className="text-xs text-white/50 text-center py-4">Nessun log</p>
          )}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Components
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent: "cyan" | "violet" | "gold" | "pink";
}) {
  const accents = {
    cyan: "bg-[linear-gradient(135deg,rgba(55,223,255,0.22),rgba(8,25,38,0.82))] text-cyan-100 border-cyan-300/20",
    violet: "bg-[linear-gradient(135deg,rgba(124,58,237,0.26),rgba(20,12,34,0.86))] text-violet-100 border-violet-300/20",
    gold: "bg-[linear-gradient(135deg,rgba(245,180,0,0.28),rgba(34,18,7,0.86))] text-yellow-100 border-yellow-300/20",
    pink: "bg-[linear-gradient(135deg,rgba(255,61,166,0.24),rgba(35,12,25,0.84))] text-pink-100 border-pink-300/20",
  };

  return (
    <div className={`rounded-[26px] border p-4 shadow-card-game ${accents[accent]}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
          {icon}
        </div>
        <p className="text-2xl font-black text-white">{value}</p>
      </div>
      <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/60">{label}</p>
    </div>
  );
}

function phaseLabel(phase: ReturnType<typeof getRoomTimeline>["phase"]) {
  switch (phase) {
    case "waiting":
      return "prevendita";
    case "playing":
      return "live";
    case "finished":
      return "chiusura";
    default:
      return phase;
  }
}

// ─── UpdateTab ────────────────────────────────────────────────
const UPDATE_SERVER_KEY = "golden-room-update-server-url";
const UPDATE_TOKEN_KEY  = "golden-room-update-token";

function UpdateTab() {
  const [serverUrl,   setServerUrl]   = useState(() => localStorage.getItem(UPDATE_SERVER_KEY) || window.location.origin);
  const [token,       setToken]       = useState(() => localStorage.getItem(UPDATE_TOKEN_KEY)  || "");
  const [zipFile,     setZipFile]     = useState<File | null>(null);
  const [skipNpm,     setSkipNpm]     = useState(false);
  const [skipBuild,   setSkipBuild]   = useState(false);
  const [noRestart,   setNoRestart]   = useState(false);
  const [phase,       setPhase]       = useState<"idle" | "uploading" | "installing" | "done">("idle");
  const [success,     setSuccess]     = useState<boolean | null>(null);
  const [logs,        setLogs]        = useState<string[]>([]);
  const [uploadPct,   setUploadPct]   = useState(0);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  function saveSettings() {
    localStorage.setItem(UPDATE_SERVER_KEY, serverUrl);
    localStorage.setItem(UPDATE_TOKEN_KEY,  token);
  }

  function addLog(msg: string) {
    setLogs((prev) => [...prev, msg]);
  }

  async function handleUpload() {
    if (!zipFile) return;
    saveSettings();
    setPhase("uploading");
    setLogs([]);
    setSuccess(null);
    setUploadPct(0);

    try {
      const formData = new FormData();
      formData.append("file", zipFile);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${serverUrl}/update-api/upload`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100));
      };

      const result = await new Promise<{ ok: boolean; path?: string; error?: string }>((resolve, reject) => {
        xhr.onload  = () => { try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error("Risposta non valida")); } };
        xhr.onerror = () => reject(new Error("Errore di rete"));
        xhr.send(formData);
      });

      if (!result.ok) throw new Error(result.error || "Upload fallito");

      setUploadedPath(result.path!);
      addLog(`✅ ZIP caricato: ${zipFile.name} (${result.path})`);
      await startInstall(result.path!);
    } catch (err: any) {
      addLog(`❌ ${err.message}`);
      setPhase("done");
      setSuccess(false);
    }
  }

  async function startInstall(zipPath: string) {
    setPhase("installing");
    addLog("🔄 Avvio installazione...");

    // Apri SSE stream con fetch manuale perché EventSource non supporta header Authorization.
    const resp = await fetch(`${serverUrl}/update-api/stream`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.body) throw new Error("SSE non supportato");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // Avvia la chiamata install in parallelo e intercetta subito eventuali errori di avvio.
    const installPromise = fetch(`${serverUrl}/update-api/install`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ zipPath, skipNpmInstall: skipNpm, skipBuild, noRestart }),
    }).then(async (installResp) => {
      if (!installResp.ok) {
        let msg = `Installazione non avviata (${installResp.status})`;
        try {
          const body = await installResp.json();
          if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }
      return installResp;
    });

    installPromise.catch((err: any) => {
      addLog(`❌ ${err.message || "Errore avvio installazione"}`);
      setSuccess(false);
      setPhase("done");
      reader.cancel().catch(() => {});
    });

    // Leggi stream SSE
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        try {
          const data = JSON.parse(line.slice(5).trim());
          if (data.type === "log") addLog(data.msg);
          if (data.type === "status" && !data.running) {
            setSuccess(data.success);
            setPhase("done");
            reader.cancel();
            return;
          }
        } catch {}
      }
    }
    setPhase("done");
  }

  function reset() {
    setPhase("idle");
    setZipFile(null);
    setLogs([]);
    setSuccess(null);
    setUploadPct(0);
    setUploadedPath(null);
  }

  const inputClass = "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none";
  const labelClass = "mb-1 block text-xs font-bold text-white/60";

  return (
    <div className="mt-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/20 border border-gold/30">
          <UploadCloud className="h-5 w-5 text-gold" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-white">Aggiornamenti App</h2>
          <p className="text-xs text-white/50">Carica uno ZIP per aggiornare il sito senza SSH</p>
        </div>
      </div>

      {/* Config server */}
      <div className="rounded-2xl border border-white/10 bg-card-game p-4 space-y-3">
        <p className="text-xs font-extrabold uppercase tracking-widest text-white/40">Configurazione Server</p>
        <div>
          <label className={labelClass}>Dominio app (es. https://gamespark.it)</label>
          <input className={inputClass} value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} placeholder="https://gamespark.it" />
        </div>
        <div>
          <label className={labelClass}>Token Admin</label>
          <input className={inputClass} type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="UPDATE_ADMIN_TOKEN" />
        </div>
        <p className="text-[10px] text-white/30">
          Il token deve corrispondere a <code className="text-gold/70">UPDATE_ADMIN_TOKEN</code> nel <code className="text-gold/70">.env</code> del server.
        </p>
      </div>

      {/* Upload + opzioni */}
      {phase === "idle" && (
        <div className="rounded-2xl border border-white/10 bg-card-game p-4 space-y-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-white/40">Carica Aggiornamento</p>

          {/* Drop zone */}
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/20 bg-black/20 p-6 text-center hover:border-gold/40 transition-colors">
            <UploadCloud className="h-8 w-8 text-white/30" />
            {zipFile ? (
              <>
                <span className="text-sm font-bold text-gold">{zipFile.name}</span>
                <span className="text-xs text-white/40">{(zipFile.size / 1024 / 1024).toFixed(2)} MB</span>
              </>
            ) : (
              <>
                <span className="text-sm font-bold text-white/60">Trascina o clicca per scegliere ZIP</span>
                <span className="text-xs text-white/30">Massimo 100 MB · solo .zip</span>
              </>
            )}
            <input type="file" accept=".zip" className="hidden" onChange={(e) => setZipFile(e.target.files?.[0] || null)} />
          </label>

          {/* Opzioni protezione */}
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-extrabold text-white/60">File sempre protetti (non sovrascritti)</span>
            </div>
            {[".env", "supabase/config.toml", "supabase/functions/send-confirmation-email/index.ts"].map((f) => (
              <div key={f} className="flex items-center gap-2 text-[11px] text-emerald-400/80">
                <CheckCircle2 className="h-3 w-3 shrink-0" /> <code>{f}</code>
              </div>
            ))}
          </div>

          {/* Opzioni avanzate */}
          <div className="space-y-2">
            <p className="text-xs font-extrabold uppercase tracking-widest text-white/40">Opzioni Avanzate</p>
            {[
              { key: "skipNpm",   state: skipNpm,   set: setSkipNpm,   label: "Salta npm install (usa dipendenze esistenti)" },
              { key: "skipBuild", state: skipBuild, set: setSkipBuild, label: "Salta build (solo sostituzione file)" },
              { key: "noRestart", state: noRestart, set: setNoRestart, label: "Non riavviare i servizi dopo l'update" },
            ].map(({ key, state, set, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => set(!state)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${state ? "bg-gold" : "bg-white/20"}`}
                >
                  <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${state ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
                <span className="text-xs text-white/60">{label}</span>
              </label>
            ))}
          </div>

          <button
            onClick={handleUpload}
            disabled={!zipFile || !token || !serverUrl}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold-shine py-3 font-extrabold text-purple-deep shadow-button-gold transition disabled:opacity-40"
          >
            <UploadCloud className="h-5 w-5" />
            Installa Aggiornamento
          </button>
        </div>
      )}

      {/* Progress upload */}
      {phase === "uploading" && (
        <div className="rounded-2xl border border-white/10 bg-card-game p-4 space-y-3 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-gold" />
          <p className="font-bold text-white">Caricamento ZIP... {uploadPct}%</p>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-gold transition-all rounded-full" style={{ width: `${uploadPct}%` }} />
          </div>
        </div>
      )}

      {/* Log in tempo reale */}
      {(phase === "installing" || phase === "done") && (
        <div className="rounded-2xl border border-white/10 bg-card-game p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {phase === "installing" && <Loader2 className="h-4 w-4 animate-spin text-gold" />}
              {phase === "done" && success  && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
              {phase === "done" && !success && <XCircle className="h-4 w-4 text-red-400" />}
              <span className="text-sm font-bold text-white">
                {phase === "installing" ? "Installazione in corso..." : success ? "Aggiornamento riuscito!" : "Aggiornamento fallito"}
              </span>
            </div>
            {phase === "done" && (
              <button onClick={reset} className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20">
                <RefreshCw className="h-3.5 w-3.5" /> Nuovo update
              </button>
            )}
          </div>

          {/* Log terminale */}
          <div className="max-h-64 overflow-y-auto rounded-xl bg-black/60 p-3 font-mono text-[11px] leading-relaxed">
            {logs.map((line, i) => {
              const color = line.startsWith("✅") || line.startsWith("✓")
                ? "text-emerald-400"
                : line.startsWith("❌") || line.startsWith("✗")
                ? "text-red-400"
                : line.startsWith("⚠") || line.startsWith("warn")
                ? "text-yellow-400"
                : line.startsWith("🚀") || line.startsWith("🔨") || line.startsWith("📦")
                ? "text-gold"
                : "text-white/70";
              return <p key={i} className={color}>{line}</p>;
            })}
            <div ref={logEndRef} />
          </div>

          {phase === "done" && success && (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-900/20 p-3 text-center text-sm font-bold text-emerald-300">
              🎉 Il sito è stato aggiornato correttamente. Ricarica la pagina per vedere le modifiche.
            </div>
          )}
          {phase === "done" && !success && (
            <div className="rounded-xl border border-red-400/30 bg-red-900/20 p-3 text-center text-sm font-bold text-red-300">
              Il rollback automatico è stato eseguito. Il sito è tornato alla versione precedente.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
