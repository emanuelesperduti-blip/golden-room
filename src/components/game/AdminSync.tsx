import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useViewerGameState } from "@/hooks/useViewerGameState";
import { useAdminStore } from "@/lib/adminStore";
import { useGameStore } from "@/lib/gameStore";

export function AdminSync() {
  const { user } = useAuth();
  const gameState = useViewerGameState();
  const { addUser, updateUser, addActivityLog, addWinRecord, currencyConfig, eventMultipliers } = useAdminStore();
  
  const lastSparks = useRef(gameState.sparks);
  const lastTickets = useRef(gameState.tickets);
  const lastWins = useRef(gameState.bingosWon);
  const lastGames = useRef(gameState.roundsPlayed);

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

    addUser(profile);

    return () => {
      updateUser(user.id, { isOnline: false });
    };
  }, [user?.id, gameState.username, addUser, updateUser]);

  // Track activity and logs
  useEffect(() => {
    if (!user) return;

    // Track wins
    if (gameState.bingosWon > lastWins.current) {
      const diff = gameState.bingosWon - lastWins.current;
      addActivityLog({
        type: "win",
        userId: user.id,
        username: gameState.username,
        details: { count: diff },
        severity: "info",
      });
      
      // Add to win records (simplified)
      addWinRecord({
        id: `win-${Date.now()}`,
        userId: user.id,
        username: gameState.username,
        roomId: "unknown",
        roomName: "Partita Bingo",
        sparkReward: 0, // Would need more context to get actual reward
        ticketReward: 0,
        timestamp: Date.now(),
        isBot: false,
      });
    }

    // Track games played
    if (gameState.roundsPlayed > lastGames.current) {
      addActivityLog({
        type: "purchase",
        userId: user.id,
        username: gameState.username,
        details: { action: "play_round" },
        severity: "info",
      });
    }

    // Track currency changes
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

  // Apply admin currency overrides (Step 5)
  // Note: In a real app, we'd hook into the reward logic. 
  // Here we can only simulate it by watching the store.
  
  return null;
}
