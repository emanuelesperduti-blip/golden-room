import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useViewerGameState } from "@/hooks/useViewerGameState";
import { useAdminStore } from "@/lib/adminStore";
import { useGameStore } from "@/lib/gameStore";
import { supabase } from "@/integrations/supabase/client";
import { isAdminUser } from "@/lib/admin";

function cleanName(value?: string | null) {
  const name = (value || "").trim();
  if (!name || name.toLowerCase() === "nuovo giocatore") return "";
  return name;
}

function bestUserName(user: ReturnType<typeof useAuth>["user"], fallback?: string | null) {
  return cleanName(fallback) || cleanName(user?.name) || cleanName(user?.email?.split("@")[0]) || "Nuovo Giocatore";
}

function numberOr(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toAdminProfile(row: any) {
  return {
    id: row.id,
    email: row.email || "",
    username: row.username || "Nuovo Giocatore",
    sparks: numberOr(row.sparks, 0),
    tickets: numberOr(row.tickets, 0),
    coins: numberOr(row.coins, 0),
    lastAccess: numberOr(row.last_access, Date.now()),
    gamesPlayed: numberOr(row.games_played, 0),
    wins: numberOr(row.wins, 0),
    isOnline: Boolean(row.is_online),
    currentRoom: row.current_room || undefined,
    isBanned: Boolean(row.is_banned),
    banReason: row.ban_reason || undefined,
  };
}

export function AdminSync() {
  const { user } = useAuth();
  const gameState = useViewerGameState();
  const addUser = useAdminStore((s) => s.addUser);
  const updateUser = useAdminStore((s) => s.updateUser);
  const addActivityLog = useAdminStore((s) => s.addActivityLog);
  const addWinRecord = useAdminStore((s) => s.addWinRecord);

  const syncReadyRef = useRef(false);
  const loadKeyRef = useRef<string | null>(null);
  const lastAdminSnapshotRef = useRef<string>("");
  const lastRemoteSnapshotRef = useRef<string>("");

  const lastSparks = useRef(gameState.sparks);
  const lastTickets = useRef(gameState.tickets);
  const lastWins = useRef(gameState.bingosWon);
  const lastGames = useRef(gameState.roundsPlayed);

  const {
    username,
    sparks,
    tickets,
    coins,
    hearts,
    gems,
    level,
    xp,
    bingosWon,
    roundsPlayed,
    revealsOpened,
    rank,
  } = gameState;

  // Carica lo stato online dell'utente al login. Supabase resta la fonte unica.
  useEffect(() => {
    if (!user) {
      syncReadyRef.current = false;
      loadKeyRef.current = null;
      lastAdminSnapshotRef.current = "";
      lastRemoteSnapshotRef.current = "";
      return;
    }

    const loadKey = `${user.id}:${user.email || ""}`;
    if (loadKeyRef.current === loadKey && syncReadyRef.current) return;
    loadKeyRef.current = loadKey;
    syncReadyRef.current = false;

    let cancelled = false;

    async function loadOnlineUser() {
      const sb = supabase as any;
      const local = useGameStore.getState();
      const fallbackName = bestUserName(user, local.username);
      const fallbackSeed = local.playerSeed || Math.floor(Math.random() * 1_000_000) + 1;

      try {
        const { data, error } = await sb.from("gamespark_users").select("*").eq("id", user.id).maybeSingle();
        if (cancelled) return;

        if (error && error.code !== "PGRST116") {
          console.warn("[AdminSync] Lettura profilo online fallita", error);
        }

        if (data) {
          const onlineName = bestUserName(user, data.username);
          useGameStore.setState({
            username: onlineName,
            coins: numberOr(data.coins, local.coins),
            sparks: numberOr(data.sparks, local.sparks),
            tickets: numberOr(data.tickets, local.tickets),
            hearts: numberOr(data.hearts, local.hearts),
            gems: numberOr(data.gems, local.gems),
            playerSeed: numberOr(data.player_seed, fallbackSeed),
            xp: numberOr(data.xp, local.xp),
            level: numberOr(data.level, local.level),
            bingosWon: numberOr(data.wins, local.bingosWon),
            roundsPlayed: numberOr(data.games_played, local.roundsPlayed),
            revealsOpened: numberOr(data.reveals_opened, local.revealsOpened),
            rank: numberOr(data.rank, local.rank),
          });

          await sb.from("gamespark_users").upsert(
            {
              id: user.id,
              email: user.email || data.email || "",
              username: onlineName,
              is_online: true,
              last_access: Date.now(),
              player_seed: numberOr(data.player_seed, fallbackSeed),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          );
        } else {
          const payload = {
            id: user.id,
            email: user.email || "",
            username: fallbackName,
            sparks: numberOr(local.sparks, 0),
            tickets: numberOr(local.tickets, 0),
            coins: numberOr(local.coins, 0),
            hearts: numberOr(local.hearts, 0),
            gems: numberOr(local.gems, 0),
            player_seed: fallbackSeed,
            xp: numberOr(local.xp, 0),
            level: numberOr(local.level, 1),
            wins: numberOr(local.bingosWon, 0),
            games_played: numberOr(local.roundsPlayed, 0),
            reveals_opened: numberOr(local.revealsOpened, 0),
            rank: numberOr(local.rank, 0),
            is_online: true,
            last_access: Date.now(),
            updated_at: new Date().toISOString(),
          };
          useGameStore.setState({ username: fallbackName, playerSeed: fallbackSeed });
          await sb.from("gamespark_users").upsert(payload, { onConflict: "id" });
        }

        const finalState = useGameStore.getState();
        addUser({
          id: user.id,
          email: user.email || "",
          username: finalState.username,
          sparks: finalState.sparks,
          tickets: finalState.tickets,
          coins: finalState.coins,
          lastAccess: Date.now(),
          gamesPlayed: finalState.roundsPlayed,
          wins: finalState.bingosWon,
          isOnline: true,
          isBanned: false,
        });
      } finally {
        if (!cancelled) syncReadyRef.current = true;
      }
    }

    void loadOnlineUser();

    return () => {
      cancelled = true;
      void (supabase as any)
        .from("gamespark_users")
        .update({ is_online: false, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      updateUser(user.id, { isOnline: false });
    };
  }, [user?.id, user?.email, user?.name, addUser, updateUser]);

  // Admin: ricarica la lista utenti dal database condiviso.
  useEffect(() => {
    if (!user || !isAdminUser(user)) return;
    let cancelled = false;

    async function loadAllUsers() {
      const { data, error } = await (supabase as any)
        .from("gamespark_users")
        .select("*")
        .order("updated_at", { ascending: false });
      if (cancelled || error || !Array.isArray(data)) return;
      for (const row of data) addUser(toAdminProfile(row));
    }

    void loadAllUsers();
    const interval = window.setInterval(loadAllUsers, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user?.id, addUser]);

  // Salva online saldo/progressi con debounce. Dipendenze primitive: evita loop React #185.
  useEffect(() => {
    if (!user || !syncReadyRef.current) return;

    const snapshot = JSON.stringify({
      id: user.id,
      email: user.email || "",
      username,
      sparks,
      tickets,
      coins,
      hearts,
      gems,
      level,
      xp,
      bingosWon,
      roundsPlayed,
      revealsOpened,
      rank,
    });
    if (snapshot === lastRemoteSnapshotRef.current) return;
    lastRemoteSnapshotRef.current = snapshot;

    const timeout = window.setTimeout(async () => {
      const state = useGameStore.getState();
      await (supabase as any).from("gamespark_users").upsert(
        {
          id: user.id,
          email: user.email || "",
          username: bestUserName(user, state.username),
          sparks: state.sparks,
          tickets: state.tickets,
          coins: state.coins,
          hearts: state.hearts,
          gems: state.gems,
          player_seed: state.playerSeed,
          xp: state.xp,
          level: state.level,
          wins: state.bingosWon,
          games_played: state.roundsPlayed,
          reveals_opened: state.revealsOpened,
          rank: state.rank,
          is_online: true,
          last_access: Date.now(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [
    user?.id,
    user?.email,
    user?.name,
    username,
    sparks,
    tickets,
    coins,
    hearts,
    gems,
    level,
    xp,
    bingosWon,
    roundsPlayed,
    revealsOpened,
    rank,
  ]);

  // Sincronizza lo store admin locale solo se cambia davvero qualcosa.
  useEffect(() => {
    if (!user) return;

    const snapshot = JSON.stringify({
      id: user.id,
      username,
      sparks,
      tickets,
      coins,
      roundsPlayed,
      bingosWon,
    });
    if (snapshot === lastAdminSnapshotRef.current) return;
    lastAdminSnapshotRef.current = snapshot;

    updateUser(user.id, {
      username,
      sparks,
      tickets,
      coins,
      lastAccess: Date.now(),
      gamesPlayed: roundsPlayed,
      wins: bingosWon,
      isOnline: true,
    });
  }, [user?.id, username, sparks, tickets, coins, roundsPlayed, bingosWon, updateUser]);

  // Track activity and logs. Dipendenze primitive: evita loop React #185.
  useEffect(() => {
    if (!user) return;

    if (bingosWon > lastWins.current) {
      const diff = bingosWon - lastWins.current;
      const sparkDelta = Math.max(0, sparks - lastSparks.current);
      addActivityLog({
        type: "win",
        userId: user.id,
        username,
        details: { count: diff, sparksWon: sparkDelta },
        severity: "info",
      });

      addWinRecord({
        id: `win-${Date.now()}`,
        userId: user.id,
        username,
        roomId: "unknown",
        roomName: "Partita Bingo",
        sparkReward: sparkDelta,
        ticketReward: 0,
        timestamp: Date.now(),
        isBot: false,
      });
    }

    if (roundsPlayed > lastGames.current) {
      addActivityLog({
        type: "admin_action",
        userId: user.id,
        username,
        details: { action: "play_round", total: roundsPlayed },
        severity: "info",
      });
    }

    lastSparks.current = sparks;
    lastTickets.current = tickets;
    lastWins.current = bingosWon;
    lastGames.current = roundsPlayed;
  }, [user?.id, username, sparks, tickets, bingosWon, roundsPlayed, addActivityLog, addWinRecord]);

  return null;
}
