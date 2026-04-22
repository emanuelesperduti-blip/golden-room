import { useAuth } from "@/hooks/useAuth";
import { useGameStore } from "@/lib/gameStore";

const GUEST_VALUES = {
  coins: 0,
  sparks: 0,
  tickets: 0,
  hearts: 0,
  gems: 0,
  vip: false,
  streak: 0,
  level: 0,
  xp: 0,
  premiumRevealsLeft: 0,
  rank: 0,
  bingosWon: 0,
  revealsOpened: 0,
  roundsPlayed: 0,
};

export function useViewerGameState() {
  const { user } = useAuth();
  const isGuest = !user;

  const username = useGameStore((s) => s.username);
  const avatar = useGameStore((s) => s.avatar);
  const coins = useGameStore((s) => s.coins);
  const sparks = useGameStore((s) => s.sparks);
  const tickets = useGameStore((s) => s.tickets);
  const hearts = useGameStore((s) => s.hearts);
  const gems = useGameStore((s) => s.gems);
  const vip = useGameStore((s) => s.vip);
  const streak = useGameStore((s) => s.streak);
  const level = useGameStore((s) => s.level);
  const xp = useGameStore((s) => s.xp);
  const premiumRevealsLeft = useGameStore((s) => s.premiumRevealsLeft);
  const rank = useGameStore((s) => s.rank);
  const bingosWon = useGameStore((s) => s.bingosWon);
  const revealsOpened = useGameStore((s) => s.revealsOpened);
  const roundsPlayed = useGameStore((s) => s.roundsPlayed);

  return {
    isGuest,
    username,
    avatar,
    coins: isGuest ? GUEST_VALUES.coins : coins,
    sparks: isGuest ? GUEST_VALUES.sparks : sparks,
    tickets: isGuest ? GUEST_VALUES.tickets : tickets,
    hearts: isGuest ? GUEST_VALUES.hearts : hearts,
    gems: isGuest ? GUEST_VALUES.gems : gems,
    vip: isGuest ? GUEST_VALUES.vip : vip,
    streak: isGuest ? GUEST_VALUES.streak : streak,
    level: isGuest ? GUEST_VALUES.level : level,
    xp: isGuest ? GUEST_VALUES.xp : xp,
    premiumRevealsLeft: isGuest ? GUEST_VALUES.premiumRevealsLeft : premiumRevealsLeft,
    rank: isGuest ? GUEST_VALUES.rank : rank,
    bingosWon: isGuest ? GUEST_VALUES.bingosWon : bingosWon,
    revealsOpened: isGuest ? GUEST_VALUES.revealsOpened : revealsOpened,
    roundsPlayed: isGuest ? GUEST_VALUES.roundsPlayed : roundsPlayed,
  };
}
