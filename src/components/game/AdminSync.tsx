import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useViewerGameState } from "@/hooks/useViewerGameState";
import { useAdminStore } from "@/lib/adminStore";
import { useGameStore } from "@/lib/gameStore";
import { supabase } from "@/integrations/supabase/client";

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

  const lastSparks = useRef(gameState.sparks);
  const lastTickets = useRef(gameState.tickets);
  const lastWins = useRef(gameState.bingosWon);
  const lastGames = useRef(gameState.roundsPlayed);

  // Hydrate daily/VIP state from Supabase when the authenticated user changes.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    async function hydrateDailyState() {
      try {
        const { data } = await (supabase as any)
          .from("gamespark_users")
          .select("streak,last_claim_date,daily_reveal_used,premium_reveals_left,last_early_bird_date,early_bird_claimed,vip,vip_expiry")
          .eq("id", user.id)
          .maybeSingle();

        if (cancelled || !data) return;

        useGameStore.setState((current) => ({
          streak: Number(data.streak ?? current.streak),
          lastClaimDate: data.last_claim_date ?? current.lastClaimDate,
          dailyRevealUsed: Boolean(data.daily_reveal_used ?? current.dailyRevealUsed),
          premiumRevealsLeft: Number(data.premium_reveals_left ?? current.premiumRevealsLeft),
          lastEarlyBirdDate: data.last_early_bird_date ?? current.lastEarlyBirdDate,
          earlyBirdClaimed: Boolean(data.early_bird_claimed ?? current.earlyBirdClaimed),
          vip: Boolean(data.vip ?? current.vip),
          vipExpiry: data.vip_expiry ?? current.vipExpiry,
        }));
      } catch (err) {
        console.warn("Admin daily hydrate failed", err);
      }
    }

    hydrateDailyState();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Persist daily/VIP fields to Supabase so every device sees the same claim state.
  useEffect(() => {
    if (!user?.id) return;

    const timer = window.setTimeout(() => {
      (supabase as any)
        .from("gamespark_users")
        .update({
          streak,
          last_claim_date: lastClaimDate,
          daily_reveal_used: dailyRevealUsed,
          premium_reveals_left: premiumRevealsLeft,
          last_early_bird_date: lastEarlyBirdDate,
          early_bird_claimed: earlyBirdClaimed,
          vip,
          vip_expiry: vipExpiry,
        })
        .eq("id", user.id)
        .then(({ error }: any) => {
          if (error) console.warn("Admin daily sync failed", error);
        });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [user?.id, streak, lastClaimDate, dailyRevealUsed, premiumRevealsLeft, lastEarlyBirdDate, earlyBirdClaimed, vip, vipExpiry]);

  // Sync user profile to admin store
  useEffect(() => {
    if (!user) return;

    const profile = {
      id: user.id,
      email: user.email || "",
      username: gameState.username || "User",
      sparks: gameState.sparks,
      tickets: gameState.tickets,
      coins: gameState.coins,
      lastAccess: Date.now(),
      gamesPlayed: gameState.roundsPlayed,
      wins: gameState.bingosWon,
      isOnline: true,
      isBanned: false,
    };

    const existingUser = useAdminStore.getState().users[user.id];
    if (existingUser) {
      profile.isBanned = existingUser.isBanned;
    }

    addUser(profile);

    return () => {
      updateUser(user.id, { isOnline: false });
    };
  }, [user?.id, gameState.username, addUser, updateUser]);

  // Track activity and logs
  useEffect(() => {
    if (!user) return;

    if (gameState.bingosWon > lastWins.current) {
      const diff = gameState.bingosWon - lastWins.current;
      const sparkDelta = Math.max(0, gameState.sparks - lastSparks.current);
      addActivityLog({
        type: "win",
        userId: user.id,
        username: gameState.username,
        details: { count: diff, sparksWon: sparkDelta },
        severity: "info",
      });

      addWinRecord({
        id: `win-${Date.now()}`,
        userId: user.id,
        username: gameState.username,
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
        username: gameState.username,
        details: { action: "play_round", total: gameState.roundsPlayed },
        severity: "info",
      });
    }

    if (gameState.sparks !== lastSparks.current || gameState.tickets !== lastTickets.current) {
      updateUser(user.id, {
        sparks: gameState.sparks,
        tickets: gameState.tickets,
        coins: gameState.coins,
      });
    }

    lastSparks.current = gameState.sparks;
    lastTickets.current = gameState.tickets;
    lastWins.current = gameState.bingosWon;
    lastGames.current = gameState.roundsPlayed;
  }, [user, gameState, addActivityLog, addWinRecord, updateUser]);

  return null;
}
