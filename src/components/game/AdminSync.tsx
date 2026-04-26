import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useViewerGameState } from "@/hooks/useViewerGameState";
import { useAdminStore } from "@/lib/adminStore";
import { useGameStore } from "@/lib/gameStore";
import { supabase } from "@/integrations/supabase/client";
import { isAdminUser } from "@/lib/admin";

function cleanName(value?: string | null) {
  const name = (value || "").trim();
  if (!name || name.toLowerCase() === "nuovo giocatore" || name.toLowerCase() === "goldenplayer") return "";
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
    username: row.username || row.email?.split("@")[0] || "Nuovo Giocatore",
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

function makeOnlinePayload(user: ReturnType<typeof useAuth>["user"], state: ReturnType<typeof useGameStore.getState>) {
  return {
    id: user!.id,
    email: user!.email || "",
    username: bestUserName(user, state.username),
    sparks: numberOr(state.sparks, 0),
    tickets: numberOr(state.tickets, 0),
    coins: numberOr(state.coins, 0),
    hearts: numberOr(state.hearts, 0),
    gems: numberOr(state.gems, 0),
    player_seed: numberOr(state.playerSeed, Math.floor(Math.random() * 1_000_000) + 1),
    xp: numberOr(state.xp, 0),
    level: numberOr(state.level, 1),
    wins: numberOr(state.bingosWon, 0),
    games_played: numberOr(state.roundsPlayed, 0),
    reveals_opened: numberOr(state.revealsOpened, 0),
    rank: numberOr(state.rank, 0),
    streak: numberOr(state.streak, 0),
    last_claim_date: state.lastClaimDate ?? null,
    daily_reveal_used: Boolean(state.dailyRevealUsed),
    premium_reveals_left: numberOr(state.premiumRevealsLeft, 0),
    last_early_bird_date: state.lastEarlyBirdDate ?? null,
    early_bird_claimed: Boolean(state.earlyBirdClaimed),
    vip: Boolean(state.vip),
    vip_expiry: state.vipExpiry ?? null,
    is_online: true,
    last_access: Date.now(),
    updated_at: new Date().toISOString(),
  };
}

export function AdminSync() {
  const { user } = useAuth();
  const gameState = useViewerGameState();
  const { addUser, updateUser, addActivityLog, addWinRecord } = useAdminStore();

  const streak = useGameStore((s) => s.streak);
  const lastClaimDate = useGameStore((s) => s.lastClaimDate);
  const dailyRevealUsed = useGameStore((s) => s.dailyRevealUsed);
  const premiumRevealsLeft = useGameStore((s) => s.premiumRevealsLeft);
  const lastEarlyBirdDate = useGameStore((s) => s.lastEarlyBirdDate);
  const earlyBirdClaimed = useGameStore((s) => s.earlyBirdClaimed);
  const vip = useGameStore((s) => s.vip);
  const vipExpiry = useGameStore((s) => s.vipExpiry);

  const syncReadyRef = useRef(false);
  const loadKeyRef = useRef<string | null>(null);
  const lastSparks = useRef(gameState.sparks);
  const lastTickets = useRef(gameState.tickets);
  const lastWins = useRef(gameState.bingosWon);
  const lastGames = useRef(gameState.roundsPlayed);

  // Ogni login Google/email diventa subito un utente registrato in Supabase.
  // Supabase e' la fonte unica: se l'utente esiste gia', carichiamo saldo e progressi online.
  useEffect(() => {
    if (!user?.id) {
      syncReadyRef.current = false;
      loadKeyRef.current = null;
      return;
    }

    const loadKey = `${user.id}:${user.email || ""}`;
    if (loadKeyRef.current === loadKey && syncReadyRef.current) return;
    loadKeyRef.current = loadKey;
    syncReadyRef.current = false;

    let cancelled = false;

    async function registerAndHydrateUser() {
      const sb = supabase as any;
      const local = useGameStore.getState();
      const fallbackName = bestUserName(user, local.username);
      const fallbackSeed = numberOr(local.playerSeed, Math.floor(Math.random() * 1_000_000) + 1);

      try {
        const { data, error } = await sb
          .from("gamespark_users")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error && error.code !== "PGRST116") {
          console.warn("[AdminSync] Lettura utente online fallita", error);
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
            streak: numberOr(data.streak, local.streak),
            lastClaimDate: data.last_claim_date ?? local.lastClaimDate,
            dailyRevealUsed: Boolean(data.daily_reveal_used ?? local.dailyRevealUsed),
            premiumRevealsLeft: numberOr(data.premium_reveals_left, local.premiumRevealsLeft),
            lastEarlyBirdDate: data.last_early_bird_date ?? local.lastEarlyBirdDate,
            earlyBirdClaimed: Boolean(data.early_bird_claimed ?? local.earlyBirdClaimed),
            vip: Boolean(data.vip ?? local.vip),
            vipExpiry: data.vip_expiry ?? local.vipExpiry,
          });

          await sb.from("gamespark_users").upsert({
            id: user.id,
            email: user.email || data.email || "",
            username: onlineName,
            player_seed: numberOr(data.player_seed, fallbackSeed),
            is_online: true,
            last_access: Date.now(),
            updated_at: new Date().toISOString(),
          }, { onConflict: "id" });
        } else {
          const payload = makeOnlinePayload(user, { ...local, username: fallbackName, playerSeed: fallbackSeed });
          useGameStore.setState({ username: fallbackName, playerSeed: fallbackSeed });
          const { error: insertError } = await sb.from("gamespark_users").upsert(payload, { onConflict: "id" });
          if (insertError) console.warn("[AdminSync] Registrazione utente Google fallita", insertError);
        }

        const finalState = useGameStore.getState();
        addUser({
          id: user.id,
          email: user.email || "",
          username: bestUserName(user, finalState.username),
          sparks: finalState.sparks,
          tickets: finalState.tickets,
          coins: finalState.coins,
          lastAccess: Date.now(),
          gamesPlayed: finalState.roundsPlayed,
          wins: finalState.bingosWon,
          isOnline: true,
          isBanned: Boolean(useAdminStore.getState().users[user.id]?.isBanned),
        });
      } finally {
        if (!cancelled) syncReadyRef.current = true;
      }
    }

    void registerAndHydrateUser();

    return () => {
      cancelled = true;
      void (supabase as any)
        .from("gamespark_users")
        .update({ is_online: false, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      updateUser(user.id, { isOnline: false });
    };
  }, [user?.id, user?.email, user?.name, addUser, updateUser]);

  // Admin: mostra tutti gli utenti registrati via Google/email dal database.
  useEffect(() => {
    if (!user || !isAdminUser(user)) return;
    let cancelled = false;

    async function loadAllUsers() {
      const { data, error } = await (supabase as any)
        .from("gamespark_users")
        .select("*")
        .order("updated_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        console.warn("[AdminSync] Lista utenti non caricata", error);
        return;
      }
      if (!Array.isArray(data)) return;
      for (const row of data) addUser(toAdminProfile(row));
    }

    void loadAllUsers();
    const interval = window.setInterval(loadAllUsers, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user?.id, addUser]);

  // Salva online saldo/progressi/claim con debounce: PC e smartphone vedono lo stesso account.
  useEffect(() => {
    if (!user?.id || !syncReadyRef.current) return;

    const timer = window.setTimeout(async () => {
      const state = useGameStore.getState();
      const payload = makeOnlinePayload(user, state);
      const { error } = await (supabase as any).from("gamespark_users").upsert(payload, { onConflict: "id" });
      if (error) console.warn("[AdminSync] Sync utente online fallita", error);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    user?.id,
    user?.email,
    user?.name,
    gameState.username,
    gameState.sparks,
    gameState.tickets,
    gameState.coins,
    gameState.hearts,
    gameState.gems,
    gameState.level,
    gameState.xp,
    gameState.bingosWon,
    gameState.roundsPlayed,
    gameState.revealsOpened,
    gameState.rank,
    streak,
    lastClaimDate,
    dailyRevealUsed,
    premiumRevealsLeft,
    lastEarlyBirdDate,
    earlyBirdClaimed,
    vip,
    vipExpiry,
  ]);

  // Aggiorna anche lo store admin locale per compatibilita' UI.
  useEffect(() => {
    if (!user?.id) return;
    updateUser(user.id, {
      username: bestUserName(user, gameState.username),
      sparks: gameState.sparks,
      tickets: gameState.tickets,
      coins: gameState.coins,
      lastAccess: Date.now(),
      gamesPlayed: gameState.roundsPlayed,
      wins: gameState.bingosWon,
      isOnline: true,
    });
  }, [user?.id, user?.email, user?.name, gameState.username, gameState.sparks, gameState.tickets, gameState.coins, gameState.roundsPlayed, gameState.bingosWon, updateUser]);

  // Log eventi principali.
  useEffect(() => {
    if (!user?.id) return;

    if (gameState.bingosWon > lastWins.current) {
      const diff = gameState.bingosWon - lastWins.current;
      const sparkDelta = Math.max(0, gameState.sparks - lastSparks.current);
      addActivityLog({
        type: "win",
        userId: user.id,
        username: bestUserName(user, gameState.username),
        details: { count: diff, sparksWon: sparkDelta },
        severity: "info",
      });

      addWinRecord({
        id: `win-${Date.now()}`,
        userId: user.id,
        username: bestUserName(user, gameState.username),
        roomId: "unknown",
        roomName: "Partita Bingo",
        sparkReward: sparkDelta,
        ticketReward: 0,
        timestamp: Date.now(),
        isBot: false,
      });
    }

    if (gameState.roundsPlayed > lastGames.current) {
      addActivityLog({
        type: "admin_action",
        userId: user.id,
        username: bestUserName(user, gameState.username),
        details: { action: "play_round", total: gameState.roundsPlayed },
        severity: "info",
      });
    }

    lastSparks.current = gameState.sparks;
    lastTickets.current = gameState.tickets;
    lastWins.current = gameState.bingosWon;
    lastGames.current = gameState.roundsPlayed;
  }, [user?.id, user?.email, user?.name, gameState.username, gameState.sparks, gameState.tickets, gameState.bingosWon, gameState.roundsPlayed, addActivityLog, addWinRecord]);

  return null;
}
